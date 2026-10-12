import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma-client";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";
import { formatValidationError, importBooksFormSchema } from "@/lib/security/validation";

export const runtime = "nodejs";

const WINDOWS_PYTHON_PATH = "C:\\Users\\user\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";
const allowedMimeTypes = new Set(["application/pdf"]);
const IMPORT_TIMEOUT_MS = 10 * 60 * 1000;

type PythonCandidate = {
  command: string;
  args: string[];
  label: string;
};

type ParsedTopic = {
  title: string;
  content: string;
  excerpt: string;
  order: number;
};

type ParsedChapterGroup = {
  title: string;
  order: number;
  topics: ParsedTopic[];
};

type ParsedSection = {
  title: string;
  order: number;
  chapters: ParsedChapterGroup[];
};

type ParsedBook = {
  subject: string;
  title: string;
  author: string;
  grade: string;
  bookTitle: string;
  sections: ParsedSection[];
};

type ImportPayload = {
  books: ParsedBook[];
};

function projectRoot() {
  return process.cwd();
}

function scriptPath() {
  return resolve(projectRoot(), "scripts", "import_school_books.py");
}

function sanitizeArgument(value: string) {
  return value.trim();
}

function parseBoolean(value: FormDataEntryValue | null) {
  return String(value || "").toLowerCase() === "true";
}

function parseNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value || ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function candidatePythonCommands(): PythonCandidate[] {
  const explicit = process.env.PYTHON_BIN?.trim();
  const commands: PythonCandidate[] = [];

  if (existsSync(WINDOWS_PYTHON_PATH)) {
    commands.push({
      command: WINDOWS_PYTHON_PATH,
      args: [],
      label: WINDOWS_PYTHON_PATH
    });
  }

  if (explicit) {
    commands.push({
      command: explicit,
      args: [],
      label: explicit
    });
  }

  commands.push({ command: "py", args: ["-3"], label: "py -3" });
  commands.push({ command: "py", args: [], label: "py" });

  if (process.platform === "win32" && existsSync("C:\\Windows\\py.exe")) {
    commands.push({
      command: "C:\\Windows\\py.exe",
      args: ["-3"],
      label: "C:\\Windows\\py.exe -3"
    });
  }

  commands.push({ command: "python", args: [], label: "python" });
  return commands;
}

async function saveUploadedFiles(files: File[]) {
  const folder = join(tmpdir(), `juzbook-import-${Date.now()}`);
  await mkdir(folder, { recursive: true });

  const savedPaths: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const targetPath = join(folder, file.name);
    await writeFile(targetPath, buffer);
    savedPaths.push(targetPath);
  }

  return { folder, savedPaths };
}

async function runImporter(args: string[]) {
  const errors: string[] = [];

  for (const candidate of candidatePythonCommands()) {
    const commandArgs = [...candidate.args, scriptPath(), ...args];

    const result = await new Promise<{ code: number | null; stdout: string; stderr: string; spawnError?: string; timedOut?: boolean }>(
      (resolvePromise) => {
        const child = spawn(candidate.command, commandArgs, {
          cwd: projectRoot(),
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf-8",
            PYTHONUTF8: "1"
          }
        });

        let stdout = "";
        let stderr = "";
        let spawnError = "";
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          child.kill();
          resolvePromise({
            code: null,
            stdout,
            stderr,
            timedOut: true
          });
        }, IMPORT_TIMEOUT_MS);

        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString("utf8");
        });

        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString("utf8");
        });

        child.on("error", (error) => {
          spawnError = error.message;
        });

        child.on("close", (code) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeout);
          resolvePromise({ code, stdout, stderr, spawnError });
        });
      }
    );

    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

    if (!result.spawnError && result.code === 0) {
      return {
        ok: true as const,
        output: result.stdout.trim()
      };
    }

    if (result.timedOut) {
      return {
        ok: false as const,
        output: [`Python: ${candidate.label}`, output, "Импорт уақыты тым ұзақ болды, процесс тоқтатылды."]
          .filter(Boolean)
          .join("\n")
      };
    }

    errors.push(
      [
        `Python: ${candidate.label}`,
        result.spawnError,
        output || `Процесс ${result.code ?? "белгісіз"} кодымен тоқтады.`
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return {
    ok: false as const,
    output: errors.join("\n\n")
  };
}

async function saveBooksToDatabase(books: ParsedBook[], replaceExisting: boolean) {
  const summaries: string[] = [];

  for (const book of books) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const subject = await tx.subject.findFirst({
        where: {
          name: book.subject
        }
      });

      const addition = `${book.title} - ${book.author} (${book.grade})`;

      const subjectRecord = subject
        ? await tx.subject.update({
            where: { id: subject.id },
            data: {
              description: subject.description.includes(addition)
                ? subject.description
                : `${subject.description.replace(/[.\s]*$/, "")} | ${addition}.`
            }
          })
        : await tx.subject.create({
            data: {
              name: book.subject,
              description: `${book.subject} пәні. Қосылған оқулық: ${addition}.`
            }
          });

      const existingBook = await tx.book.findFirst({
        where: {
          subjectId: subjectRecord.id,
          title: book.bookTitle
        }
      });

      if (existingBook && !replaceExisting) {
        throw new Error(`"${book.bookTitle}" кітабы базада бар. Қайта жазу үшін тиісті белгіні қосыңыз.`);
      }

      if (existingBook && replaceExisting) {
        await tx.book.delete({
          where: { id: existingBook.id }
        });
      }

      const createdBook = await tx.book.create({
        data: {
          title: book.bookTitle,
          subjectId: subjectRecord.id
        }
      });

      for (const section of book.sections) {
        const createdSection = await tx.section.create({
          data: {
            title: section.title,
            order: section.order,
            bookId: createdBook.id
          }
        });

        for (const chapterGroup of section.chapters) {
          const createdChapterGroup = await tx.sectionChapter.create({
            data: {
              title: chapterGroup.title,
              order: chapterGroup.order,
              sectionId: createdSection.id
            }
          });

          for (const topic of chapterGroup.topics) {
            await tx.chapter.create({
              data: {
                title: topic.title,
                content: topic.content,
                excerpt: topic.excerpt,
                order: topic.order,
                bookId: createdBook.id,
                sectionId: createdSection.id,
                sectionChapterId: createdChapterGroup.id
              }
            });
          }
        }
      }
    });

    const chapterCount = book.sections.reduce((total, section) => total + section.chapters.length, 0);
    const topicCount = book.sections.reduce(
      (total, section) => total + section.chapters.reduce((sum, chapterGroup) => sum + chapterGroup.topics.length, 0),
      0
    );

    summaries.push(
      `"${book.bookTitle}" | Пән: ${book.subject} | Бөлім: ${book.sections.length} | Тарау: ${chapterCount} | Тақырып: ${topicCount}`
    );
  }

  return summaries;
}

export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const formData = await request.formData();
  const entries = formData.getAll("files");
  const files = entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!files.length) {
    return NextResponse.json({ error: "PDF файл таңдалмаған." }, { status: 400 });
  }

  for (const file of files) {
    if (!allowedMimeTypes.has(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: `${file.name} PDF емес.` }, { status: 400 });
    }
  }

  const parsedForm = importBooksFormSchema.safeParse({
    subject: sanitizeArgument(String(formData.get("subject") || "")),
    title: sanitizeArgument(String(formData.get("title") || "")),
    author: sanitizeArgument(String(formData.get("author") || "")),
    grade: sanitizeArgument(String(formData.get("grade") || "")),
    skipFirst: parseNumber(formData.get("skipFirst"), 2),
    skipLast: parseNumber(formData.get("skipLast"), 1),
    replaceExisting: parseBoolean(formData.get("replaceExisting"))
  });

  if (!parsedForm.success) {
    return NextResponse.json({ error: formatValidationError(parsedForm.error) }, { status: 400 });
  }

  const { subject, title, author, grade, skipFirst, skipLast, replaceExisting } = parsedForm.data;

  if (files.length > 1 && (title || author || grade)) {
    return NextResponse.json(
      {
        error: "Бірнеше PDF жүктегенде атау, автор және сынып өрістерін бос қалдырыңыз. Бұл мәндер файл атынан оқылады."
      },
      { status: 400 }
    );
  }

  let folder = "";

  try {
    const saved = await saveUploadedFiles(files);
    folder = saved.folder;

    const importerArgs = [
      ...saved.savedPaths,
      "--non-interactive",
      "--json-output",
      "--subject",
      subject,
      "--skip-first",
      String(skipFirst),
      "--skip-last",
      String(skipLast)
    ];

    if (title) {
      importerArgs.push("--title", title);
    }

    if (author) {
      importerArgs.push("--author", author);
    }

    if (grade) {
      importerArgs.push("--grade", grade);
    }

    if (replaceExisting) {
      importerArgs.push("--replace-existing");
    }

    const result = await runImporter(importerArgs);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.output || "Импорттау скрипті орындалмады.",
          output: result.output
        },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(result.output) as ImportPayload;
    const savedSummaries = await saveBooksToDatabase(parsed.books || [], replaceExisting);
    revalidateCatalogViews();

    return NextResponse.json({
      message: "PDF кітаптар базаға импортталды.",
      output: savedSummaries.join("\n")
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Импорттау кезінде белгісіз қате болды."
      },
      { status: 500 }
    );
  } finally {
    if (folder) {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

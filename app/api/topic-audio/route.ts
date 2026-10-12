import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/security/auth";
import { AUDIO_VOICES, buildAudioText, getAudioStorageDir, synthesizeAudio, type AudioMark } from "@/lib/topic-audio";

export const runtime = "nodejs";
export const maxDuration = 300;

const voiceSchema = z.enum(AUDIO_VOICES).default("kk-KZ-AigulNeural");

const generateSchema = z.object({
  chapterId: z.string().trim().min(1).optional(),
  bookId: z.string().trim().min(1).optional(),
  voice: voiceSchema,
  /** Бар аудионы қайта жасау керек пе */
  force: z.boolean().default(false),
  /** Кітап бойынша бір реттік топтама шегі */
  limit: z.number().int().min(1).max(40).default(10)
});

/**
 * GET — дайын аудионы береді.
 *   ?chapterId=…  → сол тақырыптың аудиосы (сөз белгілерімен бірге)
 *   ?bookId=…     → кітаптағы барлық дайын аудио тізімі (белгілерсіз, әкімші панеліне)
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get("chapterId")?.trim() || "";
    const bookId = searchParams.get("bookId")?.trim() || "";
    const voice = searchParams.get("voice")?.trim() || "";

    if (bookId) {
      const rows = await prisma.topicAudio.findMany({
        where: { chapter: { bookId } },
        select: {
          id: true,
          chapterId: true,
          voice: true,
          durationMs: true,
          wordCount: true,
          byteSize: true,
          updatedAt: true,
          chapter: { select: { title: true } }
        },
        orderBy: { updatedAt: "desc" }
      });

      return NextResponse.json({
        audios: rows.map((row) => ({
          id: row.id,
          chapterId: row.chapterId,
          chapterTitle: row.chapter.title,
          voice: row.voice,
          durationMs: row.durationMs,
          wordCount: row.wordCount,
          byteSize: row.byteSize,
          updatedAt: row.updatedAt
        }))
      });
    }

    if (!chapterId) {
      return NextResponse.json({ error: "chapterId қажет." }, { status: 400 });
    }

    const row = await prisma.topicAudio.findFirst({
      where: { chapterId, ...(voice ? { voice } : {}) },
      orderBy: { updatedAt: "desc" }
    });

    if (!row) {
      return NextResponse.json({ ready: false });
    }

    return NextResponse.json({
      ready: true,
      audio: {
        id: row.id,
        chapterId: row.chapterId,
        voice: row.voice,
        durationMs: row.durationMs,
        wordCount: row.wordCount,
        url: `/api/topic-audio/file/${row.id}`,
        marks: (row.marks as unknown as AudioMark[]) ?? []
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Аудионы оқу мүмкін болмады." },
      { status: 500 }
    );
  }
}

/**
 * POST — әкімші аудионы алдын ала дайындайды.
 * Бір тақырып (`chapterId`) немесе бүкіл кітап (`bookId`) бойынша жасауға болады.
 */
export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = generateSchema.safeParse((await request.json()) as unknown);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Дерек жарамсыз." }, { status: 400 });
  }

  const { chapterId, bookId, voice, force, limit } = parsed.data;
  if (!chapterId && !bookId) {
    return NextResponse.json({ error: "chapterId немесе bookId қажет." }, { status: 400 });
  }

  // Демо аккаунт дерекқорда болмауы мүмкін — авторды тек нақты қолданушыда жазамыз
  const dbUser = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { id: true } });
  const authorId = dbUser?.id ?? null;

  const chapters = await prisma.chapter.findMany({
    where: chapterId ? { id: chapterId } : { bookId, isHidden: false },
    select: { id: true, title: true, content: true },
    orderBy: { order: "asc" },
    take: chapterId ? 1 : limit
  });

  if (!chapters.length) {
    return NextResponse.json({ error: "Тақырып табылмады." }, { status: 404 });
  }

  const storageDir = getAudioStorageDir();
  const results: { chapterId: string; title: string; status: string; detail?: string }[] = [];

  for (const chapter of chapters) {
    const existing = await prisma.topicAudio.findUnique({
      where: { chapterId_voice: { chapterId: chapter.id, voice } },
      select: { id: true, fileName: true }
    });

    if (existing && !force) {
      results.push({ chapterId: chapter.id, title: chapter.title, status: "skipped" });
      continue;
    }

    const text = buildAudioText(chapter.title, chapter.content);
    if (text.length < 40) {
      results.push({ chapterId: chapter.id, title: chapter.title, status: "empty" });
      continue;
    }

    const fileName = `${chapter.id}--${voice}.mp3`;
    const outputPath = path.join(storageDir, fileName);

    try {
      const audio = await synthesizeAudio({ text, voice, outputPath });

      await prisma.topicAudio.upsert({
        where: { chapterId_voice: { chapterId: chapter.id, voice } },
        create: {
          chapterId: chapter.id,
          voice,
          fileName,
          byteSize: audio.byteSize,
          durationMs: audio.durationMs,
          wordCount: audio.marks.length,
          marks: audio.marks,
          createdById: authorId
        },
        update: {
          fileName,
          byteSize: audio.byteSize,
          durationMs: audio.durationMs,
          wordCount: audio.marks.length,
          marks: audio.marks
        }
      });

      results.push({ chapterId: chapter.id, title: chapter.title, status: existing ? "updated" : "created" });
    } catch (error) {
      await fs.unlink(outputPath).catch(() => undefined);
      results.push({
        chapterId: chapter.id,
        title: chapter.title,
        status: "failed",
        detail: error instanceof Error ? error.message : "Белгісіз қате"
      });
    }
  }

  const created = results.filter((item) => item.status === "created" || item.status === "updated").length;

  return NextResponse.json({ ok: true, created, results });
}

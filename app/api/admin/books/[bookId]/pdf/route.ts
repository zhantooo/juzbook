import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Кітаптың түпнұсқа PDF файлын жүктеу.
 *
 * Бұрын файл base64 болып `Book.pdfData` бағанына жазылатын: 37 МБ кітап
 * base64-те ~50 МБ болып, тексеру шегінен (25 000 000 таңба) асып кететін де,
 * жүктеу мүлде өтпейтін. Енді файл дискіге (`storage/book-pdf/<bookId>.pdf`)
 * жазылады, ал бағанда тек `file:<файл аты>` сілтемесі тұрады — ескі
 * (data:application/pdf) жазбалар да бұрынғыша оқыла береді.
 */
const MAX_BYTES = 200 * 1024 * 1024;

function pdfStorageDirectory() {
  return join(process.cwd(), "storage", "book-pdf");
}

export async function POST(request: Request, context: { params: Promise<{ bookId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { bookId } = await context.params;
  const normalizedBookId = typeof bookId === "string" ? bookId.trim() : "";

  if (!normalizedBookId || normalizedBookId.length > 120 || !/^[A-Za-z0-9_-]+$/.test(normalizedBookId)) {
    return NextResponse.json({ error: "Кітап ID жарамсыз." }, { status: 400 });
  }

  const book = await prisma.book.findUnique({
    where: { id: normalizedBookId },
    select: { id: true, subjectId: true }
  });

  if (!book) {
    return NextResponse.json({ error: "Кітап табылмады." }, { status: 404 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: "Файлды оқу мүмкін болмады." }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "Файл жіберілмеген." }, { status: 400 });
  }

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Тек PDF файлын жүктеуге болады." }, { status: 415 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF тым үлкен (200 МБ-қа дейін)." }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // PDF екені мазмұнынан да тексеріледі — кеңейтіміне ғана сенбейміз
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "Файл PDF емес." }, { status: 415 });
    }

    const directory = pdfStorageDirectory();
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, `${normalizedBookId}.pdf`), buffer);

    const originalName = typeof file.name === "string" && file.name.trim() ? file.name.trim().slice(0, 300) : "original.pdf";

    await prisma.book.update({
      where: { id: normalizedBookId },
      data: {
        pdfFileName: originalName,
        pdfData: `file:${normalizedBookId}.pdf`,
        hasPdf: true
      }
    });

    try {
      revalidateCatalogViews({ subjectId: book.subjectId, bookId: book.id });
    } catch (error) {
      console.error("Каталог кэшін жаңарту кезінде қате пайда болды.", error);
    }

    return NextResponse.json({ ok: true, pdfFileName: originalName, size: buffer.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF сақтау мүмкін болмады." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ bookId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { bookId } = await context.params;
  const normalizedBookId = typeof bookId === "string" ? bookId.trim() : "";

  if (!normalizedBookId || !/^[A-Za-z0-9_-]+$/.test(normalizedBookId)) {
    return NextResponse.json({ error: "Кітап ID жарамсыз." }, { status: 400 });
  }

  const book = await prisma.book.findUnique({
    where: { id: normalizedBookId },
    select: { id: true, subjectId: true }
  });

  if (!book) {
    return NextResponse.json({ error: "Кітап табылмады." }, { status: 404 });
  }

  try {
    await unlink(join(pdfStorageDirectory(), `${normalizedBookId}.pdf`));
  } catch {
    // Файл жоқ болса да, жазбаны тазалай береміз
  }

  await prisma.book.update({
    where: { id: normalizedBookId },
    data: { pdfFileName: null, pdfData: null, hasPdf: false }
  });

  try {
    revalidateCatalogViews({ subjectId: book.subjectId, bookId: book.id });
  } catch (error) {
    console.error("Каталог кэшін жаңарту кезінде қате пайда болды.", error);
  }

  return NextResponse.json({ ok: true });
}

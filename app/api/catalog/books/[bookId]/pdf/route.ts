import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function decodePdfDataUrl(value: string) {
  const marker = "base64,";
  const markerIndex = value.indexOf(marker);
  if (!value.startsWith("data:application/pdf") || markerIndex < 0) {
    return null;
  }

  return Buffer.from(value.slice(markerIndex + marker.length), "base64");
}

/**
 * Жаңа кітаптарда PDF дискіде тұрады, ал бағанда тек `file:<аты>` сілтемесі
 * сақталады (ескі жазбаларда бүкіл файл base64 болып жататын).
 */
async function readStoredPdf(value: string) {
  const name = value.slice("file:".length).trim();
  if (!name || !/^[A-Za-z0-9_-]+\.pdf$/.test(name)) {
    return null;
  }

  try {
    return await readFile(join(process.cwd(), "storage", "book-pdf", name));
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await context.params;
  const normalizedBookId = typeof bookId === "string" ? bookId.trim() : "";
  if (!normalizedBookId || normalizedBookId.length > 120) {
    return NextResponse.json({ error: "PDF файлын ашу үшін кітап ID дұрыс болуы керек." }, { status: 400 });
  }

  const book = await prisma.book.findUnique({
    where: { id: normalizedBookId },
    select: {
      title: true,
      pdfFileName: true,
      pdfData: true
    }
  });

  if (!book?.pdfData) {
    return NextResponse.json({ error: "Бұл кітапқа PDF файлы жүктелмеген." }, { status: 404 });
  }

  const file = book.pdfData.startsWith("file:")
    ? await readStoredPdf(book.pdfData)
    : decodePdfDataUrl(book.pdfData);

  if (!file) {
    return NextResponse.json({ error: "PDF файлының сақталған форматы жарамсыз." }, { status: 422 });
  }

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(book.pdfFileName || `${book.title}.pdf`)}"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}

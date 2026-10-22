import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { indexChapter } from "@/lib/search/indexer";
import { hasVectorSearch } from "@/lib/search/vector-db";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

/**
 * Оқу видында әкімшінің тақырып мәтінін тікелей түзетуі.
 * Тек мазмұнды (қаласа — атауы мен қысқаша сипаттамасын) жаңартады;
 * тақырыптың бөлім/тарау ішіндегі орны өзгермейді.
 */
const patchSchema = z.object({
  content: z.string().max(600000),
  title: z.string().trim().min(1).max(400).optional(),
  excerpt: z.string().max(4000).optional()
});

/**
 * GET — бір тақырыптың толық мәтінін қайтарады.
 * Каталог клиентке «жеңіл» (мәтінсіз) күйде жүктелетіндіктен, әкімші
 * редакторы мәтінді дәл ашылған сәтте осы жерден алады.
 */
export async function GET(request: Request, context: { params: Promise<{ topicId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { topicId } = await context.params;

  try {
    const topic = await prisma.chapter.findUnique({
      where: { id: topicId },
      select: { id: true, title: true, excerpt: true, content: true, pdfPage: true, bookId: true }
    });

    if (!topic) {
      return NextResponse.json({ error: "Тақырып табылмады." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, topic });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Мәтінді оқу мүмкін болмады." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ topicId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { topicId } = await context.params;

  let parsed;
  try {
    parsed = patchSchema.safeParse((await request.json()) as unknown);
  } catch {
    return NextResponse.json({ error: "Дерек жарамсыз." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: "Дерек жарамсыз." }, { status: 400 });
  }

  try {
    const existing = await prisma.chapter.findUnique({
      where: { id: topicId },
      select: { id: true, bookId: true, book: { select: { subjectId: true } } }
    });

    if (!existing) {
      return NextResponse.json({ error: "Тақырып табылмады." }, { status: 404 });
    }

    const updated = await prisma.chapter.update({
      where: { id: topicId },
      data: {
        content: sanitizeRichText(parsed.data.content),
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.excerpt !== undefined ? { excerpt: parsed.data.excerpt } : {})
      },
      select: { id: true, title: true, excerpt: true, content: true }
    });

    try {
      revalidateCatalogViews({
        subjectId: existing.book.subjectId,
        bookId: existing.bookId,
        topicId: existing.id
      });
    } catch (error) {
      console.error("Каталог кэшін жаңарту кезінде қате пайда болды.", error);
    }

    /**
     * Мағыналық іздеудің индексін сол сәтте жаңартамыз — түнгі жүгірісті
     * күтудің қажеті жоқ. Жауапты кідіртпейміз: индекстеу құласа да,
     * мәтін сақталғаны маңызды, ал кезекте тұрған тақырыпты түнгі жүгіріс
     * бәрібір алады.
     */
    if (hasVectorSearch()) {
      void indexChapter(existing.id).catch((error) => {
        console.error("[search] тақырыпты индекстеу сәтсіз", error);
      });
    }

    return NextResponse.json({ ok: true, topic: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Мәтінді сақтау мүмкін болмады." },
      { status: 500 }
    );
  }
}

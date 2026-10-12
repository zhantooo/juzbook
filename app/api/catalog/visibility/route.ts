import { NextResponse } from "next/server";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

type VisibilityEntityType = "subject" | "book" | "section" | "chapter-group" | "topic";

function parseEntityType(value: unknown): VisibilityEntityType | null {
  if (
    value === "subject" ||
    value === "book" ||
    value === "section" ||
    value === "chapter-group" ||
    value === "topic"
  ) {
    return value;
  }

  return null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdminUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const entityType = parseEntityType(body.entityType);
    const entityId = normalizeText(body.entityId);
    const isHidden = body.isHidden === true;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "Жасырылатын элемент дұрыс таңдалмады." }, { status: 400 });
    }

    if (entityType === "subject") {
      const subject = await prisma.subject.update({
        where: { id: entityId },
        data: { isHidden },
        select: { id: true }
      });
      revalidateCatalogViews({ subjectId: subject.id });
    } else if (entityType === "book") {
      const book = await prisma.book.update({
        where: { id: entityId },
        data: { isHidden },
        select: { id: true, subjectId: true }
      });
      revalidateCatalogViews({ subjectId: book.subjectId, bookId: book.id });
    } else if (entityType === "section") {
      const section = await prisma.section.update({
        where: { id: entityId },
        data: { isHidden },
        select: { id: true, bookId: true, book: { select: { subjectId: true } } }
      });
      revalidateCatalogViews({ subjectId: section.book.subjectId, bookId: section.bookId });
    } else if (entityType === "chapter-group") {
      const chapterGroup = await prisma.sectionChapter.update({
        where: { id: entityId },
        data: { isHidden },
        select: { id: true, section: { select: { bookId: true, book: { select: { subjectId: true } } } } }
      });
      revalidateCatalogViews({ subjectId: chapterGroup.section.book.subjectId, bookId: chapterGroup.section.bookId });
    } else {
      const topic = await prisma.chapter.update({
        where: { id: entityId },
        data: { isHidden },
        select: { id: true, bookId: true, book: { select: { subjectId: true } } }
      });
      revalidateCatalogViews({ subjectId: topic.book.subjectId, bookId: topic.bookId, topicId: topic.id });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Көріну күйін өзгерту мүмкін болмады." },
      { status: 500 }
    );
  }
}

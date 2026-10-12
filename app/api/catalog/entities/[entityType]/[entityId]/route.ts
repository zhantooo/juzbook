import { NextResponse } from "next/server";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";
import { entityParamsSchema, formatValidationError } from "@/lib/security/validation";

export const runtime = "nodejs";

function safeRevalidateCatalogViews(input?: { subjectId?: string; bookId?: string; topicId?: string }) {
  try {
    revalidateCatalogViews(input);
  } catch (error) {
    console.error("Каталог кэшін жаңарту кезінде қате пайда болды.", error);
  }
}

async function deleteEntity(entityType: string, entityId: string) {
  switch (entityType) {
    case "subject": {
      await prisma.subject.delete({ where: { id: entityId } });
      return { message: "Пән базадан өшірілді.", subjectId: entityId };
    }
    case "book": {
      const book = await prisma.book.findUnique({
        where: { id: entityId },
        select: { id: true, subjectId: true }
      });

      await prisma.book.delete({ where: { id: entityId } });
      return { message: "Кітап базадан өшірілді.", subjectId: book?.subjectId, bookId: book?.id };
    }
    case "section": {
      const section = await prisma.section.findUnique({
        where: { id: entityId },
        select: { bookId: true, book: { select: { subjectId: true } } }
      });

      await prisma.section.delete({ where: { id: entityId } });
      return { message: "Бөлім базадан өшірілді.", subjectId: section?.book.subjectId, bookId: section?.bookId };
    }
    case "chapter-group": {
      const chapterGroup = await prisma.sectionChapter.findUnique({
        where: { id: entityId },
        select: { section: { select: { bookId: true, book: { select: { subjectId: true } } } } }
      });

      await prisma.sectionChapter.delete({ where: { id: entityId } });
      return {
        message: "Тарау базадан өшірілді.",
        subjectId: chapterGroup?.section.book.subjectId,
        bookId: chapterGroup?.section.bookId
      };
    }
    case "topic": {
      const topic = await prisma.chapter.findUnique({
        where: { id: entityId },
        select: { id: true, bookId: true, book: { select: { subjectId: true } } }
      });

      await prisma.chapter.delete({ where: { id: entityId } });
      return {
        message: "Тақырып базадан өшірілді.",
        subjectId: topic?.book.subjectId,
        bookId: topic?.bookId,
        topicId: topic?.id
      };
    }
    default:
      throw new Error("Өшірілетін дерек түрі жарамсыз.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ entityType: string; entityId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const parsedParams = entityParamsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: formatValidationError(parsedParams.error) }, { status: 400 });
  }

  try {
    const result = await deleteEntity(parsedParams.data.entityType, parsedParams.data.entityId);
    safeRevalidateCatalogViews({
      subjectId: result.subjectId,
      bookId: result.bookId,
      topicId: result.topicId
    });

    return NextResponse.json({ message: result.message });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Базадан өшіру мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

type ReorderType = "book" | "section" | "chapter-group" | "topic";
type Direction = "up" | "down";
type DropPosition = "before" | "after";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeRevalidateCatalogViews(input?: { subjectId?: string; bookId?: string; topicId?: string }) {
  try {
    revalidateCatalogViews(input);
  } catch (error) {
    console.error("Каталог кэшін жаңарту кезінде қате пайда болды.", error);
  }
}

function parseDirection(value: unknown): Direction {
  return value === "down" ? "down" : "up";
}

function parseDropPosition(value: unknown): DropPosition {
  return value === "after" ? "after" : "before";
}

function parseType(value: unknown): ReorderType | null {
  if (value === "book" || value === "section" || value === "chapter-group" || value === "topic") {
    return value;
  }

  return null;
}

function getInsertIndex<T extends { id: string }>(items: T[], targetEntityId: string, position: DropPosition) {
  const targetIndex = items.findIndex((item) => item.id === targetEntityId);
  return targetIndex + (position === "after" ? 1 : 0);
}

async function moveBookToTarget(entityId: string, targetEntityId: string, position: DropPosition) {
  const current = await prisma.book.findUnique({
    where: { id: entityId },
    select: { id: true, subjectId: true }
  });

  if (!current) {
    throw new Error("Кітап табылмады.");
  }

  const items = await prisma.book.findMany({
    where: { subjectId: current.subjectId },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: { id: true }
  });
  const target = items.find((item) => item.id === targetEntityId);

  if (!target) {
    throw new Error("Кітап ретін өзгерту үшін мақсатты кітап табылмады.");
  }

  const nextItems = items.filter((item) => item.id !== entityId);
  nextItems.splice(getInsertIndex(nextItems, targetEntityId, position), 0, { id: current.id });

  await prisma.$transaction(nextItems.map((item, index) => prisma.book.update({ where: { id: item.id }, data: { order: index + 1 } })));
  return { subjectId: current.subjectId };
}

async function swapBookOrder(entityId: string, direction: Direction) {
  const current = await prisma.book.findUnique({
    where: { id: entityId },
    select: { id: true, subjectId: true, order: true }
  });

  if (!current) {
    throw new Error("Кітап табылмады.");
  }

  const neighbor = await prisma.book.findFirst({
    where: {
      subjectId: current.subjectId,
      order: direction === "up" ? { lt: current.order } : { gt: current.order }
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true }
  });

  if (!neighbor) {
    return { subjectId: current.subjectId };
  }

  await prisma.$transaction([
    prisma.book.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.book.update({ where: { id: neighbor.id }, data: { order: current.order } })
  ]);

  return { subjectId: current.subjectId };
}

async function swapSectionOrder(entityId: string, direction: Direction) {
  const current = await prisma.section.findUnique({
    where: { id: entityId },
    select: { id: true, bookId: true, order: true, book: { select: { subjectId: true } } }
  });

  if (!current) {
    throw new Error("Бөлім табылмады.");
  }

  const neighbor = await prisma.section.findFirst({
    where: {
      bookId: current.bookId,
      order: direction === "up" ? { lt: current.order } : { gt: current.order }
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true }
  });

  if (!neighbor) {
    return { subjectId: current.book.subjectId, bookId: current.bookId };
  }

  await prisma.$transaction([
    prisma.section.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.section.update({ where: { id: neighbor.id }, data: { order: current.order } })
  ]);

  return { subjectId: current.book.subjectId, bookId: current.bookId };
}

async function swapChapterGroupOrder(entityId: string, direction: Direction) {
  const current = await prisma.sectionChapter.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      sectionId: true,
      order: true,
      section: { select: { bookId: true, book: { select: { subjectId: true } } } }
    }
  });

  if (!current) {
    throw new Error("Тарау табылмады.");
  }

  const neighbor = await prisma.sectionChapter.findFirst({
    where: {
      sectionId: current.sectionId,
      order: direction === "up" ? { lt: current.order } : { gt: current.order }
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true }
  });

  if (!neighbor) {
    return { subjectId: current.section.book.subjectId, bookId: current.section.bookId };
  }

  await prisma.$transaction([
    prisma.sectionChapter.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.sectionChapter.update({ where: { id: neighbor.id }, data: { order: current.order } })
  ]);

  return { subjectId: current.section.book.subjectId, bookId: current.section.bookId };
}

async function swapTopicOrder(entityId: string, direction: Direction) {
  const current = await prisma.chapter.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      bookId: true,
      sectionId: true,
      sectionChapterId: true,
      order: true,
      book: { select: { subjectId: true } }
    }
  });

  if (!current) {
    throw new Error("Тақырып табылмады.");
  }

  const neighbor = await prisma.chapter.findFirst({
    where: current.sectionChapterId
      ? {
          sectionChapterId: current.sectionChapterId,
          order: direction === "up" ? { lt: current.order } : { gt: current.order }
        }
      : {
          sectionId: current.sectionId,
          sectionChapterId: null,
          order: direction === "up" ? { lt: current.order } : { gt: current.order }
        },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
    select: { id: true, order: true }
  });

  if (!neighbor) {
    return { subjectId: current.book.subjectId, bookId: current.bookId, topicId: current.id };
  }

  await prisma.$transaction([
    prisma.chapter.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.chapter.update({ where: { id: neighbor.id }, data: { order: current.order } })
  ]);

  return { subjectId: current.book.subjectId, bookId: current.bookId, topicId: current.id };
}

async function moveSectionToTarget(entityId: string, targetEntityId: string, position: DropPosition) {
  const items = await prisma.section.findMany({
    where: {
      book: {
        sections: {
          some: { id: entityId }
        }
      }
    },
    orderBy: { order: "asc" },
    select: { id: true, bookId: true, book: { select: { subjectId: true } } }
  });
  const current = items.find((item) => item.id === entityId);
  const target = items.find((item) => item.id === targetEntityId);

  if (!current || !target || current.bookId !== target.bookId) {
    throw new Error("Бөлім ретін өзгерту үшін ата-аналық кітап дұрыс көрсетілмеді.");
  }

  const nextItems = items.filter((item) => item.id !== entityId);
  nextItems.splice(getInsertIndex(nextItems, targetEntityId, position), 0, current);

  await prisma.$transaction(nextItems.map((item, index) => prisma.section.update({ where: { id: item.id }, data: { order: index + 1 } })));
  return { subjectId: current.book.subjectId, bookId: current.bookId };
}

async function moveChapterGroupToTarget(entityId: string, targetEntityId: string, position: DropPosition) {
  const current = await prisma.sectionChapter.findUnique({
    where: { id: entityId },
    select: { id: true, sectionId: true, section: { select: { bookId: true, book: { select: { subjectId: true } } } } }
  });

  if (!current) {
    throw new Error("Тарау табылмады.");
  }

  const items = await prisma.sectionChapter.findMany({
    where: { sectionId: current.sectionId },
    orderBy: { order: "asc" },
    select: { id: true, sectionId: true }
  });
  const target = items.find((item) => item.id === targetEntityId);

  if (!target) {
    throw new Error("Тарау ретін өзгерту үшін мақсатты тарау табылмады.");
  }

  const nextItems = items.filter((item) => item.id !== entityId);
  nextItems.splice(getInsertIndex(nextItems, targetEntityId, position), 0, { id: current.id, sectionId: current.sectionId });

  await prisma.$transaction(nextItems.map((item, index) => prisma.sectionChapter.update({ where: { id: item.id }, data: { order: index + 1 } })));
  return { subjectId: current.section.book.subjectId, bookId: current.section.bookId };
}

async function moveTopicToTarget(entityId: string, targetEntityId: string, position: DropPosition) {
  const current = await prisma.chapter.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      bookId: true,
      sectionId: true,
      sectionChapterId: true,
      book: { select: { subjectId: true } }
    }
  });

  if (!current) {
    throw new Error("Тақырып табылмады.");
  }

  const items = await prisma.chapter.findMany({
    where: current.sectionChapterId
      ? { sectionChapterId: current.sectionChapterId }
      : { sectionId: current.sectionId, sectionChapterId: null },
    orderBy: { order: "asc" },
    select: { id: true }
  });
  const target = items.find((item) => item.id === targetEntityId);

  if (!target) {
    throw new Error("Тақырып ретін өзгерту үшін мақсатты тақырып табылмады.");
  }

  const nextItems = items.filter((item) => item.id !== entityId);
  nextItems.splice(getInsertIndex(nextItems, targetEntityId, position), 0, { id: current.id });

  await prisma.$transaction(nextItems.map((item, index) => prisma.chapter.update({ where: { id: item.id }, data: { order: index + 1 } })));
  return { subjectId: current.book.subjectId, bookId: current.bookId, topicId: current.id };
}

async function moveEntityToTarget(entityType: ReorderType, entityId: string, targetEntityId: string, position: DropPosition) {
  if (entityType === "book") {
    return moveBookToTarget(entityId, targetEntityId, position);
  }

  if (entityType === "section") {
    return moveSectionToTarget(entityId, targetEntityId, position);
  }

  if (entityType === "chapter-group") {
    return moveChapterGroupToTarget(entityId, targetEntityId, position);
  }

  return moveTopicToTarget(entityId, targetEntityId, position);
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdminUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const entityType = parseType(body.entityType);
    const entityId = normalizeText(body.entityId);
    const targetEntityId = normalizeText(body.targetEntityId);
    const direction = parseDirection(body.direction);
    const position = parseDropPosition(body.position);

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "Жылжытылатын элемент дұрыс көрсетілмеді." }, { status: 400 });
    }

    const revalidateInput = targetEntityId
      ? await moveEntityToTarget(entityType, entityId, targetEntityId, position)
      : entityType === "book"
        ? await swapBookOrder(entityId, direction)
        : entityType === "section"
        ? await swapSectionOrder(entityId, direction)
        : entityType === "chapter-group"
          ? await swapChapterGroupOrder(entityId, direction)
          : await swapTopicOrder(entityId, direction);

    safeRevalidateCatalogViews(revalidateInput);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Реттілікті өзгерту мүмкін болмады." },
      { status: 500 }
    );
  }
}

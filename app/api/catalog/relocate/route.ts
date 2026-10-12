import { NextResponse } from "next/server";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

type RelocateAction =
  | "move-section"
  | "move-chapter-group"
  | "move-topic"
  | "copy-section"
  | "copy-chapter-group"
  | "copy-topic";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAction(value: unknown): RelocateAction | null {
  if (
    value === "move-section" ||
    value === "move-chapter-group" ||
    value === "move-topic" ||
    value === "copy-section" ||
    value === "copy-chapter-group" ||
    value === "copy-topic"
  ) {
    return value;
  }

  return null;
}

async function getNextSectionOrder(bookId: string) {
  const section = await prisma.section.findFirst({
    where: { bookId },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return (section?.order ?? 0) + 1;
}

async function getNextChapterGroupOrder(sectionId: string) {
  const chapterGroup = await prisma.sectionChapter.findFirst({
    where: { sectionId },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return (chapterGroup?.order ?? 0) + 1;
}

async function getNextTopicOrder(sectionId: string, sectionChapterId: string | null) {
  const topic = await prisma.chapter.findFirst({
    where: sectionChapterId ? { sectionChapterId } : { sectionId, sectionChapterId: null },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return (topic?.order ?? 0) + 1;
}

async function cloneTopic(topicId: string, targetSectionId: string, targetChapterGroupId: string | null) {
  const topic = await prisma.chapter.findUnique({
    where: { id: topicId },
    select: {
      title: true,
      excerpt: true,
      content: true,
      pdfPage: true,
      bookId: true,
      isHidden: true
    }
  });

  if (!topic) {
    throw new Error("Көшірілетін тақырып табылмады.");
  }

  const targetSection = await prisma.section.findUnique({
    where: { id: targetSectionId },
    select: { id: true, bookId: true, book: { select: { subjectId: true } } }
  });

  if (!targetSection) {
    throw new Error("Мақсатты бөлім табылмады.");
  }

  const created = await prisma.chapter.create({
    data: {
      title: topic.title,
      excerpt: topic.excerpt,
      content: topic.content,
      pdfPage: topic.pdfPage,
      isHidden: topic.isHidden,
      order: await getNextTopicOrder(targetSection.id, targetChapterGroupId),
      book: { connect: { id: targetSection.bookId } },
      section: { connect: { id: targetSection.id } },
      ...(targetChapterGroupId ? { sectionChapter: { connect: { id: targetChapterGroupId } } } : {})
    },
    select: { id: true }
  });

  revalidateCatalogViews({ subjectId: targetSection.book.subjectId, bookId: targetSection.bookId, topicId: created.id });
}

async function cloneChapterGroup(chapterGroupId: string, targetSectionId: string) {
  const chapterGroup = await prisma.sectionChapter.findUnique({
    where: { id: chapterGroupId },
    select: {
      title: true,
      isHidden: true,
      topics: {
        orderBy: { order: "asc" },
        select: {
          title: true,
          excerpt: true,
          content: true,
          pdfPage: true,
          isHidden: true,
          order: true
        }
      }
    }
  });

  if (!chapterGroup) {
    throw new Error("Көшірілетін тарау табылмады.");
  }

  const targetSection = await prisma.section.findUnique({
    where: { id: targetSectionId },
    select: { id: true, bookId: true, book: { select: { subjectId: true } } }
  });

  if (!targetSection) {
    throw new Error("Мақсатты бөлім табылмады.");
  }

  const createdGroup = await prisma.sectionChapter.create({
    data: {
      title: chapterGroup.title,
      isHidden: chapterGroup.isHidden,
      order: await getNextChapterGroupOrder(targetSection.id),
      section: { connect: { id: targetSection.id } }
    },
    select: { id: true }
  });

  for (const topic of chapterGroup.topics) {
    await prisma.chapter.create({
      data: {
        title: topic.title,
        excerpt: topic.excerpt,
        content: topic.content,
        pdfPage: topic.pdfPage,
        isHidden: topic.isHidden,
        order: topic.order,
        book: { connect: { id: targetSection.bookId } },
        section: { connect: { id: targetSection.id } },
        sectionChapter: { connect: { id: createdGroup.id } }
      }
    });
  }

  revalidateCatalogViews({ subjectId: targetSection.book.subjectId, bookId: targetSection.bookId });
}

async function cloneSection(sectionId: string, targetBookId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      title: true,
      isHidden: true,
      chapters: {
        orderBy: { order: "asc" },
        select: {
          title: true,
          isHidden: true,
          order: true,
          topics: {
            orderBy: { order: "asc" },
            select: {
              title: true,
              excerpt: true,
              content: true,
              pdfPage: true,
              isHidden: true,
              order: true
            }
          }
        }
      },
      topics: {
        where: { sectionChapterId: null },
        orderBy: { order: "asc" },
        select: {
          title: true,
          excerpt: true,
          content: true,
          pdfPage: true,
          isHidden: true,
          order: true
        }
      }
    }
  });

  if (!section) {
    throw new Error("Көшірілетін бөлім табылмады.");
  }

  const targetBook = await prisma.book.findUnique({
    where: { id: targetBookId },
    select: { id: true, subjectId: true }
  });

  if (!targetBook) {
    throw new Error("Мақсатты кітап табылмады.");
  }

  const createdSection = await prisma.section.create({
    data: {
      title: section.title,
      isHidden: section.isHidden,
      order: await getNextSectionOrder(targetBook.id),
      book: { connect: { id: targetBook.id } }
    },
    select: { id: true }
  });

  for (const directTopic of section.topics) {
    await prisma.chapter.create({
      data: {
        title: directTopic.title,
        excerpt: directTopic.excerpt,
        content: directTopic.content,
        pdfPage: directTopic.pdfPage,
        isHidden: directTopic.isHidden,
        order: directTopic.order,
        book: { connect: { id: targetBook.id } },
        section: { connect: { id: createdSection.id } }
      }
    });
  }

  for (const chapterGroup of section.chapters) {
    const createdGroup = await prisma.sectionChapter.create({
      data: {
        title: chapterGroup.title,
        isHidden: chapterGroup.isHidden,
        order: chapterGroup.order,
        section: { connect: { id: createdSection.id } }
      },
      select: { id: true }
    });

    for (const topic of chapterGroup.topics) {
      await prisma.chapter.create({
        data: {
          title: topic.title,
          excerpt: topic.excerpt,
          content: topic.content,
          pdfPage: topic.pdfPage,
          isHidden: topic.isHidden,
          order: topic.order,
          book: { connect: { id: targetBook.id } },
          section: { connect: { id: createdSection.id } },
          sectionChapter: { connect: { id: createdGroup.id } }
        }
      });
    }
  }

  revalidateCatalogViews({ subjectId: targetBook.subjectId, bookId: targetBook.id });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = parseAction(body.action);
    const entityId = normalizeText(body.entityId);
    const targetBookId = normalizeText(body.targetBookId);
    const targetSectionId = normalizeText(body.targetSectionId);
    const targetChapterGroupId = normalizeText(body.targetChapterGroupId) || null;

    if (!action || !entityId) {
      return NextResponse.json({ error: "Ауыстырылатын элемент дұрыс көрсетілмеді." }, { status: 400 });
    }

    if (action === "move-section") {
      const targetBook = await prisma.book.findUnique({
        where: { id: targetBookId },
        select: { id: true, subjectId: true }
      });
      if (!targetBook) {
        return NextResponse.json({ error: "Мақсатты кітап табылмады." }, { status: 404 });
      }

      await prisma.section.update({
        where: { id: entityId },
        data: {
          bookId: targetBook.id,
          order: await getNextSectionOrder(targetBook.id)
        }
      });
      revalidateCatalogViews({ subjectId: targetBook.subjectId, bookId: targetBook.id });
    } else if (action === "move-chapter-group") {
      const targetSection = await prisma.section.findUnique({
        where: { id: targetSectionId },
        select: { id: true, bookId: true, book: { select: { subjectId: true } } }
      });
      if (!targetSection) {
        return NextResponse.json({ error: "Мақсатты бөлім табылмады." }, { status: 404 });
      }

      await prisma.sectionChapter.update({
        where: { id: entityId },
        data: {
          sectionId: targetSection.id,
          order: await getNextChapterGroupOrder(targetSection.id),
          topics: {
            updateMany: {
              where: {},
              data: {
                sectionId: targetSection.id,
                bookId: targetSection.bookId
              }
            }
          }
        }
      });
      revalidateCatalogViews({ subjectId: targetSection.book.subjectId, bookId: targetSection.bookId });
    } else if (action === "move-topic") {
      const targetSection = await prisma.section.findUnique({
        where: { id: targetSectionId },
        select: { id: true, bookId: true, book: { select: { subjectId: true } } }
      });
      if (!targetSection) {
        return NextResponse.json({ error: "Мақсатты бөлім табылмады." }, { status: 404 });
      }

      await prisma.chapter.update({
        where: { id: entityId },
        data: {
          sectionId: targetSection.id,
          bookId: targetSection.bookId,
          sectionChapterId: targetChapterGroupId,
          order: await getNextTopicOrder(targetSection.id, targetChapterGroupId)
        }
      });
      revalidateCatalogViews({ subjectId: targetSection.book.subjectId, bookId: targetSection.bookId, topicId: entityId });
    } else if (action === "copy-section") {
      await cloneSection(entityId, targetBookId);
    } else if (action === "copy-chapter-group") {
      await cloneChapterGroup(entityId, targetSectionId);
    } else if (action === "copy-topic") {
      await cloneTopic(entityId, targetSectionId, targetChapterGroupId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Элементті басқа жерге ауыстыру мүмкін болмады." },
      { status: 500 }
    );
  }
}

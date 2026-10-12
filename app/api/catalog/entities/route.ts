import { NextResponse } from "next/server";
import { ensureDemoCatalogInDatabase, revalidateCatalogViews } from "@/lib/catalog-db";
import { demoCatalog } from "@/lib/demo-catalog";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";
import {
  catalogCreateRequestSchema,
  catalogUpdateRequestSchema,
  formatValidationError,
  parseCatalogDataByType
} from "@/lib/security/validation";

export const runtime = "nodejs";

type EntityType = "subject" | "book" | "section" | "chapter-group" | "topic";
const VIRTUAL_DIRECT_CHAPTER_PREFIX = "virtual-direct:";
const DEFAULT_SECTION_TITLE = "Негізгі бөлім";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePdfData(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.startsWith("data:application/pdf") ? normalized : undefined;
}

function normalizePdfPage(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : null;
}

function normalizeUrl(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeChapterGroupId(value: unknown) {
  const normalized = normalizeText(value);
  return normalized.startsWith(VIRTUAL_DIRECT_CHAPTER_PREFIX) ? "" : normalized;
}

function safeRevalidateCatalogViews(input?: { subjectId?: string; bookId?: string; topicId?: string }) {
  try {
    revalidateCatalogViews(input);
  } catch (error) {
    console.error("Каталог кэшін жаңарту кезінде қате пайда болды.", error);
  }
}

async function getNextSectionOrder(bookId: string) {
  const section = await prisma.section.findFirst({
    where: { bookId },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return (section?.order ?? 0) + 1;
}

async function getNextBookOrder(subjectId: string) {
  const book = await prisma.book.findFirst({
    where: { subjectId },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return (book?.order ?? 0) + 1;
}

async function getNextChapterGroupOrder(sectionId: string) {
  const chapterGroup = await prisma.sectionChapter.findFirst({
    where: { sectionId },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return (chapterGroup?.order ?? 0) + 1;
}

async function getNextTopicOrder(sectionId: string, chapterGroupId: string) {
  const topic = await prisma.chapter.findFirst({
    where: chapterGroupId
      ? { sectionChapterId: chapterGroupId }
      : {
          sectionId,
          sectionChapterId: null
        },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  return (topic?.order ?? 0) + 1;
}

function createRelationError(message: string) {
  return new Error(message);
}

async function requireBook(bookId: string) {
  if (!bookId) {
    throw createRelationError("Кітап анықталмады. Бетті жаңартып, қайта көріңіз.");
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, subjectId: true }
  });

  if (!book) {
    throw createRelationError("Бұл кітап базада табылмады. Кітапты қайта ашып көріңіз.");
  }

  return book;
}

async function requireSection(sectionId: string, bookId?: string) {
  if (!sectionId) {
    throw createRelationError("Бөлім анықталмады. Алдымен кітапқа бөлім қосыңыз.");
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, bookId: true }
  });

  if (!section) {
    throw createRelationError("Бұл бөлім базада табылмады. Бетті жаңартып, қайта көріңіз.");
  }

  if (bookId && section.bookId !== bookId) {
    throw createRelationError("Бөлім осы кітапқа тиесілі емес.");
  }

  return section;
}

async function requireChapterGroup(chapterGroupId: string, sectionId: string) {
  if (!chapterGroupId) {
    return null;
  }

  const chapterGroup = await prisma.sectionChapter.findUnique({
    where: { id: chapterGroupId },
    select: { id: true, sectionId: true }
  });

  if (!chapterGroup) {
    throw createRelationError("Бұл тарау базада табылмады. Бетті жаңартып, қайта көріңіз.");
  }

  if (chapterGroup.sectionId !== sectionId) {
    throw createRelationError("Тарау осы бөлімге тиесілі емес.");
  }

  return chapterGroup;
}

async function createEntity(entityType: EntityType, data: Record<string, unknown>) {
  switch (entityType) {
    case "subject":
      return prisma.subject.create({
        data: {
          ...(normalizeText(data.id) ? { id: normalizeText(data.id) } : {}),
          name: normalizeText(data.name),
          description: normalizeText(data.description)
        }
      });
    case "book": {
      const requestedSubjectId = normalizeText(data.subjectId);
      const requestedSubjectName = normalizeText(data.subjectName);
      const demoSubject = demoCatalog.find((subject) => subject.id === requestedSubjectId);
      const subject =
        (requestedSubjectId
          ? await prisma.subject.findUnique({ where: { id: requestedSubjectId }, select: { id: true } })
          : null) ??
        (requestedSubjectName
          ? await prisma.subject.findUnique({ where: { name: requestedSubjectName }, select: { id: true } })
          : null) ??
        (demoSubject
          ? await prisma.subject.findUnique({ where: { name: demoSubject.name }, select: { id: true } })
          : null);

      const subjectId =
        subject?.id ??
        (
          await prisma.subject.create({
            data: {
              id: requestedSubjectId || undefined,
              name: requestedSubjectName || demoSubject?.name || "Жаңа пән",
              description: demoSubject?.description || ""
            },
            select: { id: true }
          })
        ).id;

      return prisma.$transaction(async (tx) => {
        const book = await tx.book.create({
          data: {
            ...(normalizeText(data.id) ? { id: normalizeText(data.id) } : {}),
            title: normalizeText(data.title),
            order: await getNextBookOrder(subjectId),
            theme: normalizeText(data.theme) || "sky",
            coverImage: normalizeText(data.coverImage) || null,
            sourceInfo: normalizeText(data.sourceInfo) || null,
            sourceLink: normalizeUrl(data.sourceLink),
            pdfFileName: normalizeText(data.pdfFileName) || null,
            pdfData: normalizePdfData(data.pdfData) ?? null,
            hasPdf: Boolean(normalizePdfData(data.pdfData)),
            subject: {
              connect: { id: subjectId }
            },
            sections: {
              create: {
                title: DEFAULT_SECTION_TITLE,
                order: 1
              }
            }
          }
        });

        return book;
      });
    }
    case "section": {
      const bookId = normalizeText(data.bookId);
      await requireBook(bookId);

      return prisma.section.create({
        data: {
          ...(normalizeText(data.id) ? { id: normalizeText(data.id) } : {}),
          title: normalizeText(data.title),
          book: {
            connect: { id: bookId }
          },
          order: await getNextSectionOrder(bookId)
        }
      });
    }
    case "chapter-group": {
      const bookId = normalizeText(data.bookId);
      const sectionId = normalizeText(data.sectionId);
      await requireSection(sectionId, bookId || undefined);

      return prisma.sectionChapter.create({
        data: {
          ...(normalizeText(data.id) ? { id: normalizeText(data.id) } : {}),
          title: normalizeText(data.title),
          section: {
            connect: { id: sectionId }
          },
          order: await getNextChapterGroupOrder(sectionId)
        }
      });
    }
    case "topic": {
      const bookId = normalizeText(data.bookId);
      const sectionId = normalizeText(data.sectionId);
      const chapterGroupId = normalizeChapterGroupId(data.chapterGroupId);
      await requireBook(bookId);
      await requireSection(sectionId, bookId);
      await requireChapterGroup(chapterGroupId, sectionId);

      return prisma.chapter.create({
        data: {
          ...(normalizeText(data.id) ? { id: normalizeText(data.id) } : {}),
          title: normalizeText(data.title),
          excerpt: normalizeText(data.excerpt),
          content: typeof data.content === "string" ? data.content : "",
          pdfPage: normalizePdfPage(data.pdfPage),
          book: {
            connect: { id: bookId }
          },
          section: {
            connect: { id: sectionId }
          },
          ...(chapterGroupId
            ? {
                sectionChapter: {
                  connect: { id: chapterGroupId }
                }
              }
            : {}),
          order: await getNextTopicOrder(sectionId, chapterGroupId)
        }
      });
    }
  }
}

async function updateEntity(entityType: EntityType, entityId: string, data: Record<string, unknown>) {
  switch (entityType) {
    case "subject":
      return prisma.subject.update({
        where: { id: entityId },
        data: {
          name: normalizeText(data.name),
          description: normalizeText(data.description)
        }
      });
    case "book":
      const nextPdfData = normalizePdfData(data.pdfData);
      return prisma.book.update({
        where: { id: entityId },
        data: {
          title: normalizeText(data.title),
          theme: normalizeText(data.theme) || "sky",
          coverImage: normalizeText(data.coverImage) || null,
          sourceInfo: normalizeText(data.sourceInfo) || null,
          sourceLink: normalizeUrl(data.sourceLink),
          subjectId: normalizeText(data.subjectId),
          ...(nextPdfData === undefined
            ? {
                pdfFileName: normalizeText(data.pdfFileName) || undefined
              }
            : {
                pdfFileName: nextPdfData ? normalizeText(data.pdfFileName) || "original.pdf" : null,
                pdfData: nextPdfData,
                hasPdf: Boolean(nextPdfData)
              })
        }
      });
    case "section":
      return prisma.section.update({
        where: { id: entityId },
        data: {
          title: normalizeText(data.title)
        }
      });
    case "chapter-group":
      return prisma.sectionChapter.update({
        where: { id: entityId },
        data: {
          title: normalizeText(data.title)
        }
      });
    case "topic":
      return prisma.chapter.update({
        where: { id: entityId },
        data: {
          title: normalizeText(data.title),
          excerpt: normalizeText(data.excerpt),
          content: typeof data.content === "string" ? data.content : "",
          pdfPage: normalizePdfPage(data.pdfPage),
          sectionId: normalizeText(data.sectionId) || null,
          sectionChapterId: normalizeChapterGroupId(data.chapterGroupId) || null
        }
      });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const parsedPayload = catalogCreateRequestSchema.safeParse((await request.json()) as unknown);
    if (!parsedPayload.success) {
      return NextResponse.json({ error: formatValidationError(parsedPayload.error) }, { status: 400 });
    }

    const parsedData = parseCatalogDataByType(parsedPayload.data.entityType, parsedPayload.data.data);
    if (!parsedData.success) {
      return NextResponse.json({ error: formatValidationError(parsedData.error) }, { status: 400 });
    }

    const parsedDataRecord = parsedData.data as Record<string, unknown>;
    const entity = await createEntity(parsedPayload.data.entityType, parsedDataRecord);
    safeRevalidateCatalogViews({
      subjectId:
        normalizeText((entity as { subjectId?: string; id?: string }).subjectId) || normalizeText(parsedDataRecord.subjectId),
      bookId: normalizeText((entity as { bookId?: string; id?: string }).bookId) || normalizeText(parsedDataRecord.bookId),
      topicId: parsedPayload.data.entityType === "topic" ? normalizeText((entity as { id?: string }).id) : undefined
    });
    return NextResponse.json({ entity });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Жаңа деректі базаға жазу мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdminUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const parsedPayload = catalogUpdateRequestSchema.safeParse((await request.json()) as unknown);
    if (!parsedPayload.success) {
      return NextResponse.json({ error: formatValidationError(parsedPayload.error) }, { status: 400 });
    }

    const parsedData = parseCatalogDataByType(parsedPayload.data.entityType, parsedPayload.data.data);
    if (!parsedData.success) {
      return NextResponse.json({ error: formatValidationError(parsedData.error) }, { status: 400 });
    }

    const parsedDataRecord = parsedData.data as Record<string, unknown>;
    const entity = await updateEntity(parsedPayload.data.entityType, parsedPayload.data.entityId, parsedDataRecord);
    safeRevalidateCatalogViews({
      subjectId: normalizeText(parsedDataRecord.subjectId),
      bookId: normalizeText((entity as { bookId?: string }).bookId) || normalizeText(parsedDataRecord.bookId),
      topicId: parsedPayload.data.entityType === "topic" ? parsedPayload.data.entityId : undefined
    });

    return NextResponse.json({ entity });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Деректі жаңарту мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

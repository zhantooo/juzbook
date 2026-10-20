import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import type { BookRecord, SubjectRecord } from "@/lib/types";
import { demoCatalog } from "@/lib/demo-catalog";
import { prisma } from "@/lib/prisma";

let ensureDemoCatalogPromise: Promise<void> | null = null;

type TopicRow = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  pdfPage: number | null;
  order: number;
  isHidden: boolean;
  bookId: string;
  sectionId: string | null;
  sectionChapterId: string | null;
  updatedAt: Date;
};

/**
 * Навигация сұрауы тақырыптың қысқаша мазмұнын алмайды: ол жауаптың
 * жартысына жуығын алып жатқан да, навигацияда көрсетілмейтін. Оқу беті
 * тақырыпты өз сұранысымен алады, сондықтан мазмұн сонда келеді.
 */
type NavigationTopicRow = Omit<TopicRow, "content" | "updatedAt" | "excerpt">;

type BookQueryRow = {
  id: string;
  title: string;
  subjectId: string;
  isHidden: boolean;
  coverImage: string | null;
  sourceInfo: string | null;
  sourceLink: string | null;
  theme: string;
  pdfFileName: string | null;
  hasPdf: boolean;
  chapters: TopicRow[];
  sections: Array<{
    id: string;
    title: string;
    order: number;
    isHidden: boolean;
    chapters: Array<{
      id: string;
      title: string;
      order: number;
      isHidden: boolean;
      topics: TopicRow[];
    }>;
  }>;
};

type NavigationBookQueryRow = {
  id: string;
  title: string;
  subjectId: string;
  isHidden: boolean;
  coverImage: string | null;
  sourceInfo: string | null;
  sourceLink: string | null;
  theme: string;
  pdfFileName: string | null;
  hasPdf: boolean;
  chapters: NavigationTopicRow[];
  sections: Array<{
    id: string;
    title: string;
    order: number;
    isHidden: boolean;
    chapters: Array<{
      id: string;
      title: string;
      order: number;
      isHidden: boolean;
      topics: NavigationTopicRow[];
    }>;
  }>;
};

const VIRTUAL_DIRECT_CHAPTER_PREFIX = "virtual-direct:";

function makeVirtualDirectChapterGroupId(sectionId: string) {
  return `${VIRTUAL_DIRECT_CHAPTER_PREFIX}${sectionId}`;
}

function mapBook(book: BookQueryRow, includeHidden = false): BookRecord {
  const sections = book.sections
    .filter((section) => includeHidden || !section.isHidden)
    .map((section) => ({
    id: section.id,
    title: section.title,
    order: section.order,
    isHidden: section.isHidden,
    bookId: book.id,
    chapters: [
      ...section.chapters
        .filter((chapterGroup) => includeHidden || !chapterGroup.isHidden)
        .map((chapterGroup) => ({
        id: chapterGroup.id,
        title: chapterGroup.title,
        order: chapterGroup.order,
        isHidden: chapterGroup.isHidden,
        bookId: book.id,
        sectionId: section.id,
        topics: chapterGroup.topics
          .filter((topic) => includeHidden || !topic.isHidden)
          .map((topic) => ({
          id: topic.id,
          title: topic.title,
          excerpt: topic.excerpt,
          content: topic.content,
          pdfPage: topic.pdfPage,
          order: topic.order,
          isHidden: topic.isHidden,
          bookId: book.id,
          sectionId: topic.sectionId ?? section.id,
          chapterGroupId: topic.sectionChapterId ?? chapterGroup.id,
          originalTitle: topic.title,
          originalExcerpt: topic.excerpt,
          originalContent: topic.content,
          lastSavedAt: topic.updatedAt.toISOString()
        }))
      })),
      ...(() => {
        const directTopics = book.chapters
          .filter((topic) => topic.sectionId === section.id && !topic.sectionChapterId && (includeHidden || !topic.isHidden))
          .sort((left, right) => left.order - right.order);

        if (!directTopics.length) {
          return [];
        }

        return [
          {
            id: makeVirtualDirectChapterGroupId(section.id),
            title: "Тақырыптар",
            order: Math.max(0, ...section.chapters.map((chapterGroup) => chapterGroup.order)) + 1,
            bookId: book.id,
            sectionId: section.id,
            topics: directTopics.map((topic) => ({
              id: topic.id,
              title: topic.title,
              excerpt: topic.excerpt,
              content: topic.content,
              pdfPage: topic.pdfPage,
              order: topic.order,
              isHidden: topic.isHidden,
              bookId: book.id,
              sectionId: topic.sectionId ?? section.id,
              chapterGroupId: makeVirtualDirectChapterGroupId(section.id),
              originalTitle: topic.title,
              originalExcerpt: topic.excerpt,
              originalContent: topic.content,
              lastSavedAt: topic.updatedAt.toISOString()
            }))
          }
        ];
      })()
    ]
  }));

  return {
    id: book.id,
    title: book.title,
    subjectId: book.subjectId,
    isHidden: book.isHidden,
    coverImage: book.coverImage,
    sourceInfo: book.sourceInfo,
    sourceLink: book.sourceLink,
    theme: book.theme,
    pdfFileName: book.pdfFileName,
    hasPdf: book.hasPdf,
    sections,
    chapters: sections.flatMap((section) => section.chapters.flatMap((chapterGroup) => chapterGroup.topics))
  };
}

function mapNavigationBook(book: NavigationBookQueryRow, includeHidden = false): BookRecord {
  const sections = book.sections
    .filter((section) => includeHidden || !section.isHidden)
    .map((section) => ({
    id: section.id,
    title: section.title,
    order: section.order,
    isHidden: section.isHidden,
    bookId: book.id,
    chapters: [
      ...section.chapters
        .filter((chapterGroup) => includeHidden || !chapterGroup.isHidden)
        .map((chapterGroup) => ({
        id: chapterGroup.id,
        title: chapterGroup.title,
        order: chapterGroup.order,
        isHidden: chapterGroup.isHidden,
        bookId: book.id,
        sectionId: section.id,
        topics: chapterGroup.topics
          .filter((topic) => includeHidden || !topic.isHidden)
          .map((topic) => ({
          id: topic.id,
          title: topic.title,
          // Навигацияда қысқаша мазмұн көрсетілмейді, ал ол жауаптың
          // жартысына жуығын алып жатқан: 2 282 тақырыпта ~900 КБ.
          // Оқу беті тақырыпты өз сұранысымен алады, сондықтан бос.
          excerpt: "",
          content: "",
          pdfPage: topic.pdfPage,
          order: topic.order,
          isHidden: topic.isHidden,
          bookId: book.id,
          sectionId: topic.sectionId ?? section.id,
          chapterGroupId: topic.sectionChapterId ?? chapterGroup.id
        }))
      })),
      ...(() => {
        const directTopics = book.chapters
          .filter((topic) => topic.sectionId === section.id && !topic.sectionChapterId && (includeHidden || !topic.isHidden))
          .sort((left, right) => left.order - right.order);

        if (!directTopics.length) {
          return [];
        }

        return [
          {
            id: makeVirtualDirectChapterGroupId(section.id),
            title: "Тақырыптар",
            order: Math.max(0, ...section.chapters.map((chapterGroup) => chapterGroup.order)) + 1,
            bookId: book.id,
            sectionId: section.id,
            topics: directTopics.map((topic) => ({
              id: topic.id,
              title: topic.title,
              // Навигацияда мазмұн жоқ — жоғарыдағы себеп
              excerpt: "",
              content: "",
              pdfPage: topic.pdfPage,
              order: topic.order,
              isHidden: topic.isHidden,
              bookId: book.id,
              sectionId: topic.sectionId ?? section.id,
              chapterGroupId: makeVirtualDirectChapterGroupId(section.id)
            }))
          }
        ];
      })()
    ]
  }));

  return {
    id: book.id,
    title: book.title,
    subjectId: book.subjectId,
    isHidden: book.isHidden,
    coverImage: book.coverImage,
    sourceInfo: book.sourceInfo,
    sourceLink: book.sourceLink,
    theme: book.theme,
    pdfFileName: book.pdfFileName,
    hasPdf: book.hasPdf,
    sections,
    // Бөлімі бар кітапта жалпақ `chapters` тізімі бөлімдердегі тақырыптардың
    // көшірмесі болады да, жауапты екі есе ауырлатады. Клиент оны
    // `flattenBookTopics` арқылы өзі құрады (catalog-context), сондықтан мұнда
    // тек бөлімсіз ескі кітаптар үшін жіберіледі.
    chapters: sections.length
      ? []
      : sections.flatMap((section) => section.chapters.flatMap((chapterGroup) => chapterGroup.topics))
  };
}

/// Толық оқу залын ашқанда ғана ауыр мәтіндерді аламыз.
async function getCatalogFromDatabaseUncached(includeHidden = false): Promise<SubjectRecord[]> {
  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isHidden: true,
      books: {
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          order: true,
          subjectId: true,
          isHidden: true,
          coverImage: true,
          sourceInfo: true,
          sourceLink: true,
          theme: true,
          pdfFileName: true,
          hasPdf: true,
          chapters: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              excerpt: true,
              content: true,
              pdfPage: true,
              order: true,
              isHidden: true,
              bookId: true,
              sectionId: true,
              sectionChapterId: true,
              updatedAt: true
            }
          },
          sections: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              isHidden: true,
              chapters: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  order: true,
                  isHidden: true,
                  topics: {
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      title: true,
                      excerpt: true,
                      content: true,
                      pdfPage: true,
                      order: true,
                      isHidden: true,
                      bookId: true,
                      sectionId: true,
                      sectionChapterId: true,
                      updatedAt: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return subjects
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      description: subject.description,
      isHidden: subject.isHidden,
      books: subject.books
        .filter((book) => includeHidden || !book.isHidden)
        .map((book) => mapBook(book, includeHidden))
    }))
    // Пәнді әкімші өзі жасырады (кітаптары әлі жүктелмеген пәндер үшін).
    // Әкімшіде (includeHidden) жасырылғаны да тұрады — әйтпесе оны қайта
    // ашу да, жаңа кітапты сол пәнге қосу да мүмкін болмас еді.
    .filter((subject) => includeHidden || !subject.isHidden);
}

export async function getCatalogFromDatabase(includeHidden = false): Promise<SubjectRecord[]> {
  return getCatalogFromDatabaseUncached(includeHidden);
}

/// Каталог сайдбары үшін тек атаулар мен қысқа үзінділерді ғана қайтарамыз.
async function getCatalogNavigationFromDatabaseUncached(includeHidden = false): Promise<SubjectRecord[]> {
  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isHidden: true,
      books: {
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          order: true,
          subjectId: true,
          isHidden: true,
          coverImage: true,
          sourceInfo: true,
          sourceLink: true,
          theme: true,
          pdfFileName: true,
          hasPdf: true,
          chapters: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              pdfPage: true,
              isHidden: true,
              bookId: true,
              sectionId: true,
              sectionChapterId: true
            }
          },
          sections: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              isHidden: true,
              chapters: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  order: true,
                  isHidden: true,
                  topics: {
                    orderBy: { order: "asc" },
                    select: {
                      id: true,
                      title: true,
                              order: true,
                      pdfPage: true,
                      isHidden: true,
                      bookId: true,
                      sectionId: true,
                      sectionChapterId: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return subjects
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      description: subject.description,
      isHidden: subject.isHidden,
      books: subject.books
        .filter((book) => includeHidden || !book.isHidden)
        .map((book) => mapNavigationBook(book, includeHidden))
    }))
    // Жасырылған пән навигацияда да көрінбейді (жоғарыдағы себеп)
    .filter((subject) => includeHidden || !subject.isHidden);
}

const getCatalogNavigationFromDatabaseCached = unstable_cache(
  getCatalogNavigationFromDatabaseUncached,
  ["catalog-navigation"],
  {
    revalidate: 3600,
    tags: ["catalog", "catalog-navigation"]
  }
);

export async function getCatalogNavigationFromDatabase(): Promise<SubjectRecord[]> {
  return getCatalogNavigationFromDatabaseCached();
}

/// Оқу беті үшін бір ғана тақырып пен оның навигациясын бір сұраныспен аламыз.
const getReaderTopicPayloadCached = unstable_cache(
  async (bookId: string, topicId: string) =>
    prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      subjectId: true,
      coverImage: true,
      sourceInfo: true,
      sourceLink: true,
      theme: true,
      pdfFileName: true,
      hasPdf: true,
      sections: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          isHidden: true,
          chapters: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              title: true,
              order: true,
              isHidden: true,
              topics: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  title: true,
                  excerpt: true,
                  pdfPage: true,
                  order: true,
                  isHidden: true
                }
              }
            }
          }
        }
      },
      chapters: {
        where: { id: topicId, isHidden: false },
        select: {
          id: true,
          title: true,
          excerpt: true,
          content: true,
          pdfPage: true,
          order: true,
          bookId: true,
          sectionId: true,
          sectionChapterId: true,
          isHidden: true,
          updatedAt: true
        },
        take: 1
      }
    }
  }),
  ["reader-topic-payload"],
  {
    revalidate: 3600,
    tags: ["catalog", "catalog-full", "catalog-navigation"]
  }
);

export async function getReaderTopicPayload(bookId: string, topicId: string) {
  const payload = await getReaderTopicPayloadCached(bookId, topicId);
  if (!payload) {
    return null;
  }

  return {
    ...payload,
    sections: payload.sections
      .filter((section) => !section.isHidden)
      .map((section) => ({
        ...section,
        chapters: section.chapters
          .filter((chapterGroup) => !chapterGroup.isHidden)
          .map((chapterGroup) => ({
            ...chapterGroup,
            topics: chapterGroup.topics.filter((topic) => !topic.isHidden)
          }))
      })),
    chapters: payload.chapters.filter((topic) => !topic.isHidden)
  };
}

export function revalidateCatalogViews(input?: { subjectId?: string; bookId?: string; topicId?: string }) {
  revalidateTag("catalog");
  revalidateTag("catalog-full");
  revalidateTag("catalog-navigation");
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin");

  if (input?.subjectId) {
    revalidatePath(`/subjects/${input.subjectId}`);
  }

  if (input?.bookId && input?.topicId) {
    revalidatePath(`/books/${input.bookId}/chapters/${input.topicId}`);
  }
}

async function ensureDemoCatalogInDatabaseInternal() {
  if (process.env.ENABLE_DEMO_CATALOG !== "true") {
    return;
  }

  const subjectCount = await prisma.subject.count();
  if (subjectCount > 0) {
    return;
  }

  const existingSubjects = await prisma.subject.findMany({
    select: { id: true, name: true }
  });

  const subjectIdByName = new Map(existingSubjects.map((subject) => [subject.name.trim().toLowerCase(), subject.id]));
  const subjectIdById = new Map(existingSubjects.map((subject) => [subject.id, subject.id]));

  for (const subject of demoCatalog) {
    const subjectId =
      subjectIdById.get(subject.id) ??
      subjectIdByName.get(subject.name.trim().toLowerCase()) ??
      subject.id;

    await prisma.subject.upsert({
      where: { id: subjectId },
      update: {
        name: subject.name,
        description: subject.description
      },
      create: {
        id: subjectId,
        name: subject.name,
        description: subject.description
      }
    });

    for (const [bookIndex, book] of subject.books.entries()) {
      await prisma.book.upsert({
        where: { id: book.id },
        update: {
          title: book.title,
          order: bookIndex + 1,
          coverImage: book.coverImage ?? null,
          sourceInfo: book.sourceInfo ?? null,
          sourceLink: book.sourceLink ?? null,
          subjectId
        },
        create: {
          id: book.id,
          title: book.title,
          order: bookIndex + 1,
          coverImage: book.coverImage ?? null,
          sourceInfo: book.sourceInfo ?? null,
          sourceLink: book.sourceLink ?? null,
          subjectId
        }
      });

      for (const section of book.sections) {
        await prisma.section.upsert({
          where: { id: section.id },
          update: {
            title: section.title,
            order: section.order,
            bookId: book.id
          },
          create: {
            id: section.id,
            title: section.title,
            order: section.order,
            bookId: book.id
          }
        });

        for (const chapterGroup of section.chapters) {
          await prisma.sectionChapter.upsert({
            where: { id: chapterGroup.id },
            update: {
              title: chapterGroup.title,
              order: chapterGroup.order,
              sectionId: section.id
            },
            create: {
              id: chapterGroup.id,
              title: chapterGroup.title,
              order: chapterGroup.order,
              sectionId: section.id
            }
          });

          for (const topic of chapterGroup.topics) {
            await prisma.chapter.upsert({
              where: { id: topic.id },
              update: {
                title: topic.title,
                excerpt: topic.excerpt,
                content: topic.content,
                order: topic.order,
                bookId: book.id,
                sectionId: section.id,
                sectionChapterId: chapterGroup.id
              },
              create: {
                id: topic.id,
                title: topic.title,
                excerpt: topic.excerpt,
                content: topic.content,
                order: topic.order,
                bookId: book.id,
                sectionId: section.id,
                sectionChapterId: chapterGroup.id
              }
            });
          }
        }
      }
    }
  }
}

/// Demo каталог бос базада тек бір рет қана құйылады.
export async function ensureDemoCatalogInDatabase() {
  if (!ensureDemoCatalogPromise) {
    ensureDemoCatalogPromise = ensureDemoCatalogInDatabaseInternal().catch((error) => {
      ensureDemoCatalogPromise = null;
      throw error;
    });
  }

  return ensureDemoCatalogPromise;
}

"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import type {
  BookRecord,
  ChapterGroupRecord,
  ChapterRecord,
  GlossaryEntry,
  SpecificationRecord,
  SectionRecord,
  SubjectRecord
} from "@/lib/types";

type SubjectInput = {
  id?: string;
  name: string;
  description: string;
};

type BookInput = {
  id?: string;
  subjectId: string;
  subjectName?: string;
  title: string;
  coverImage?: string | null;
  sourceInfo?: string | null;
  sourceLink?: string | null;
  theme?: string | null;
  pdfFileName?: string | null;
  pdfData?: string | null;
};

type SectionInput = {
  id?: string;
  subjectId: string;
  bookId: string;
  title: string;
};

type ChapterGroupInput = {
  id?: string;
  subjectId: string;
  bookId: string;
  sectionId: string;
  title: string;
};

type TopicInput = {
  id?: string;
  subjectId: string;
  bookId: string;
  sectionId: string;
  chapterGroupId?: string;
  title: string;
  excerpt: string;
  content: string;
  pdfPage?: number | null;
};

type CatalogContextValue = {
  subjects: SubjectRecord[];
  specifications: SpecificationRecord[];
  glossary: GlossaryEntry[];
  isReady: boolean;
  refreshCatalog: () => Promise<void>;
  moveSubject: (subjectId: string, direction: "up" | "down") => void;
  moveSection: (sectionId: string, direction: "up" | "down") => Promise<void>;
  moveChapterGroup: (chapterGroupId: string, direction: "up" | "down") => Promise<void>;
  moveTopic: (topicId: string, direction: "up" | "down") => Promise<void>;
  addSubject: (input: SubjectInput) => Promise<void>;
  updateSubject: (subjectId: string, input: SubjectInput) => Promise<void>;
  deleteSubject: (subjectId: string) => Promise<void>;
  addBook: (input: BookInput) => Promise<void>;
  updateBook: (bookId: string, input: BookInput) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  addSection: (input: SectionInput) => Promise<void>;
  updateSection: (sectionId: string, input: SectionInput) => Promise<void>;
  deleteSection: (sectionId: string) => Promise<void>;
  addChapterGroup: (input: ChapterGroupInput) => Promise<void>;
  updateChapterGroup: (chapterGroupId: string, input: ChapterGroupInput) => Promise<void>;
  deleteChapterGroup: (chapterGroupId: string) => Promise<void>;
  addTopic: (input: TopicInput) => Promise<void>;
  updateTopic: (topicId: string, input: TopicInput) => Promise<void>;
  deleteTopic: (topicId: string) => Promise<void>;
  setEntityHidden: (entityType: "subject" | "book" | "section" | "chapter-group" | "topic", entityId: string, isHidden: boolean) => Promise<void>;
  moveSectionToBook: (sectionId: string, targetBookId: string) => Promise<void>;
  moveChapterGroupToSection: (chapterGroupId: string, targetSectionId: string) => Promise<void>;
  moveTopicToLocation: (topicId: string, targetSectionId: string, targetChapterGroupId?: string) => Promise<void>;
  copySectionToBook: (sectionId: string, targetBookId: string) => Promise<void>;
  copyChapterGroupToSection: (chapterGroupId: string, targetSectionId: string) => Promise<void>;
  copyTopicToLocation: (topicId: string, targetSectionId: string, targetChapterGroupId?: string) => Promise<void>;
  refreshSpecifications: (subjectId?: string) => Promise<void>;
  saveSpecification: (input: { specificationId?: string; subjectId: string; title: string; description: string; topicIds: string[] }) => Promise<void>;
  deleteSpecification: (specificationId: string) => Promise<void>;
  generateGlossaryFromText: (text: string) => void;
  updateGlossaryEntry: (entryId: string, word: string, definition: string) => void;
  removeGlossaryEntry: (entryId: string) => void;
  resetCatalog: () => void;
};

const STORAGE_KEY = "juzbook-catalog";
const GLOSSARY_KEY = "juzbook-glossary";
const SUBJECT_ORDER_KEY = "juzbook-subject-order";
const CatalogContext = createContext<CatalogContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// Тақырыптың `order` нөмірі әр тарау ішінде қайтадан 1-ден басталады
// (1-тараудың 1-тақырыбы да, 2-тараудың 1-тақырыбы да «1»). Сондықтан
// жалпақ тізімді сол нөмір бойынша сұрыптауға БОЛМАЙДЫ — әйтпесе
// тақырыптар тараулар арасында араласып, «Келесі тақырып» басқа бөлімге
// секіреді. Дұрыс рет: бөлім → тарау → тақырып, яғни аралап шығу реті.
function flattenBookTopics(book: BookRecord) {
  return book.sections.flatMap((section) =>
    section.chapters.flatMap((chapterGroup) =>
      [...chapterGroup.topics].sort((left, right) => left.order - right.order)
    )
  );
}

function normalizeBook(book: BookRecord): BookRecord {
  if (book.sections && book.sections.length > 0) {
    const normalizedSections = [...book.sections]
      .sort((left, right) => left.order - right.order)
      .map((section) => ({
        ...section,
        bookId: book.id,
        chapters: [...section.chapters]
          .sort((left, right) => left.order - right.order)
          .map((chapterGroup) => ({
            ...chapterGroup,
            bookId: book.id,
            sectionId: section.id,
            topics: [...chapterGroup.topics]
              .sort((left, right) => left.order - right.order)
              .map((topic, topicIndex) => ({
                ...topic,
                bookId: book.id,
                sectionId: section.id,
                chapterGroupId: chapterGroup.id,
                order: topic.order || topicIndex + 1,
                originalTitle: topic.originalTitle ?? topic.title,
                originalExcerpt: topic.originalExcerpt ?? topic.excerpt,
                originalContent: topic.originalContent ?? topic.content,
                lastSavedAt: topic.lastSavedAt ?? new Date().toISOString()
              }))
          }))
      }));

    const normalizedBook = {
      ...book,
      sections: normalizedSections,
      chapters: [] as ChapterRecord[]
    };

    return {
      ...normalizedBook,
      chapters: flattenBookTopics(normalizedBook)
    };
  }

  if (!book.chapters.length) {
    return {
      ...book,
      sections: [],
      chapters: []
    };
  }

  const fallbackSectionId = makeId("section");
  const fallbackSection: SectionRecord = {
    id: fallbackSectionId,
    title: "1-бөлім: Негізгі бөлім",
    order: 1,
    bookId: book.id,
    chapters: book.chapters.map((topic, index) => {
      const chapterGroupId = makeId("chapter-group");
      return {
        id: chapterGroupId,
        title: `${index + 1}-тарау: ${topic.title}`,
        order: index + 1,
        bookId: book.id,
        sectionId: fallbackSectionId,
        topics: [
          {
            ...topic,
            sectionId: fallbackSectionId,
            chapterGroupId,
            order: 1,
            originalTitle: topic.originalTitle ?? topic.title,
            originalExcerpt: topic.originalExcerpt ?? topic.excerpt,
            originalContent: topic.originalContent ?? topic.content,
            lastSavedAt: topic.lastSavedAt ?? new Date().toISOString()
          }
        ]
      };
    })
  };

  const normalizedBook: BookRecord = {
    ...book,
    sections: [fallbackSection],
    chapters: []
  };

  return {
    ...normalizedBook,
    chapters: flattenBookTopics(normalizedBook)
  };
}

function normalizeSubjects(subjects: SubjectRecord[]) {
  return subjects.map((subject) => ({
    ...subject,
    books: subject.books.map((book) => normalizeBook(book))
  }));
}

function normalizeTextKey(value: string) {
  return value.trim().toLowerCase();
}

function mergeBooks(targetSubjectId: string, baseBooks: BookRecord[], incomingBooks: BookRecord[]) {
  const books = [...baseBooks];

  for (const incomingBook of incomingBooks) {
    const existingIndex = books.findIndex(
      (book) =>
        book.id === incomingBook.id ||
        normalizeTextKey(book.title) === normalizeTextKey(incomingBook.title)
    );
    const normalizedIncomingBook = normalizeBook({
      ...incomingBook,
      subjectId: targetSubjectId
    });

    if (existingIndex >= 0) {
      books[existingIndex] = normalizedIncomingBook;
    } else {
      books.push(normalizedIncomingBook);
    }
  }

  return books;
}

function mergeSubjects(baseSubjects: SubjectRecord[], incomingSubjects: SubjectRecord[]) {
  const subjects = normalizeSubjects(baseSubjects);

  for (const incomingSubject of normalizeSubjects(incomingSubjects)) {
    const existingIndex = subjects.findIndex(
      (subject) =>
        subject.id === incomingSubject.id ||
        normalizeTextKey(subject.name) === normalizeTextKey(incomingSubject.name)
    );

    if (existingIndex >= 0) {
      const existingSubject = subjects[existingIndex];
      subjects[existingIndex] = {
        ...existingSubject,
        description: incomingSubject.description || existingSubject.description,
        books: mergeBooks(existingSubject.id, existingSubject.books, incomingSubject.books)
      };
    } else {
      subjects.push(incomingSubject);
    }
  }

  return subjects;
}

function applySubjectOrder(subjects: SubjectRecord[], subjectOrder: string[]) {
  if (!subjectOrder.length) {
    return subjects;
  }

  const orderMap = new Map(subjectOrder.map((id, index) => [id, index]));

  return [...subjects].sort((left, right) => {
    const leftIndex = orderMap.get(left.id);
    const rightIndex = orderMap.get(right.id);

    if (leftIndex == null && rightIndex == null) {
      return left.name.localeCompare(right.name, "kk");
    }

    if (leftIndex == null) {
      return 1;
    }

    if (rightIndex == null) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [specifications, setSpecifications] = useState<SpecificationRecord[]>([]);
  const [subjectOrder, setSubjectOrder] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  async function persistEntity(
    method: "POST" | "PATCH",
    payload: {
      entityType: "subject" | "book" | "section" | "chapter-group" | "topic";
      entityId?: string;
      data: Record<string, unknown>;
    }
  ) {
    const response = await fetch("/api/catalog/entities", {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const entityPayload = (await response.json().catch(() => null)) as { entity?: { id?: string }; error?: string } | null;

    if (!response.ok) {
      throw new Error(entityPayload?.error || "Каталогты базаға сақтау мүмкін болмады.");
    }

    return entityPayload;
  }

  function findDemoSubjectIdByName(name: string) {
    return undefined;
  }

  async function refreshCatalog() {
    try {
      // Тек әкімші панелі тақырып мәтіндерімен жұмыс істейді. Қалған беттерге
      // навигация ғана керек — толық каталог 12 МБ, навигация нұсқасы ~40 КБ.
      const isAdminView = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
      const response = await fetch(`/api/catalog${isAdminView ? "?includeHidden=1" : "?view=navigation"}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { subjects?: SubjectRecord[] };
      if (payload.subjects && payload.subjects.length > 0) {
        setSubjects(normalizeSubjects(payload.subjects));
      }
    } catch {
      // Local demo деректері fallback ретінде қала береді.
    }
  }

  async function refreshSpecifications(subjectId?: string) {
    try {
      const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
      const response = await fetch(`/api/specifications${query}`, {
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { specifications?: SpecificationRecord[] };
      setSpecifications(payload.specifications ?? []);
    } catch {
      setSpecifications([]);
    }
  }

  async function deleteEntityRequest(entityType: "subject" | "book" | "section" | "chapter-group" | "topic", entityId: string) {
    const response = await fetch(`/api/catalog/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
      method: "DELETE",
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error("Каталогтағы жазбаны өшіру мүмкін болмады.");
    }
  }

  async function reorderEntityRequest(entityType: "section" | "chapter-group" | "topic", entityId: string, direction: "up" | "down") {
    const response = await fetch("/api/catalog/reorder", {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ entityType, entityId, direction })
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.error || "Реттілікті өзгерту мүмкін болмады.");
    }
  }

  useEffect(() => {
    const storedGlossary = loadFromStorage<GlossaryEntry[]>(GLOSSARY_KEY, []);
    const storedSubjectOrder = loadFromStorage<string[]>(SUBJECT_ORDER_KEY, []);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("juzbook-deleted-entities");
    setSubjectOrder(storedSubjectOrder);
    setSubjects([]);
    setGlossary(storedGlossary);
    setIsReady(true);
    void refreshCatalog();
    void refreshSpecifications();
  }, []);

  useEffect(() => {
    if (isReady) {
      saveToStorage(GLOSSARY_KEY, glossary);
      saveToStorage(SUBJECT_ORDER_KEY, subjectOrder);
    }
  }, [glossary, isReady, subjectOrder]);

  useEffect(() => {
    if (!subjects.length) {
      return;
    }

    setSubjectOrder((current) => {
      const existing = current.filter((id) => subjects.some((subject) => subject.id === id));
      const missing = subjects.map((subject) => subject.id).filter((id) => !existing.includes(id));
      const next = [...existing, ...missing];
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [subjects]);

  const orderedSubjects = useMemo(() => applySubjectOrder(subjects, subjectOrder), [subjectOrder, subjects]);

  const value = useMemo<CatalogContextValue>(
    () => ({
      subjects: orderedSubjects,
      specifications,
      glossary,
      isReady,
      refreshCatalog,
      moveSubject: (subjectId, direction) => {
        setSubjectOrder((current) => {
          const source = current.length ? [...current] : orderedSubjects.map((subject) => subject.id);
          const currentIndex = source.indexOf(subjectId);
          if (currentIndex === -1) {
            return source;
          }

          const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
          if (targetIndex < 0 || targetIndex >= source.length) {
            return source;
          }

          const next = [...source];
          const [item] = next.splice(currentIndex, 1);
          next.splice(targetIndex, 0, item);
          return next;
        });
      },
      moveSection: async (sectionId, direction) => {
        await reorderEntityRequest("section", sectionId, direction);
        await refreshCatalog();
      },
      moveChapterGroup: async (chapterGroupId, direction) => {
        await reorderEntityRequest("chapter-group", chapterGroupId, direction);
        await refreshCatalog();
      },
      moveTopic: async (topicId, direction) => {
        await reorderEntityRequest("topic", topicId, direction);
        await refreshCatalog();
      },
      addSubject: async (input) => {
        const stableId = input.id || findDemoSubjectIdByName(input.name) || undefined;

        await persistEntity("POST", {
          entityType: "subject",
          data: {
            id: stableId,
            name: input.name,
            description: input.description
          }
        })
          .then(() => refreshCatalog())
          .catch((error) => {
            void refreshCatalog();
            throw error;
          });
      },
      updateSubject: async (subjectId, input) => {
        setSubjects((current) =>
          current.map((subject) =>
            subject.id === subjectId
              ? {
                  ...subject,
                  name: input.name,
                  description: input.description
                }
              : subject
          )
        );

        await persistEntity("PATCH", {
          entityType: "subject",
          entityId: subjectId,
          data: {
            name: input.name,
            description: input.description
          }
        })
          .then(() => refreshCatalog())
          .catch((error) => {
            void refreshCatalog();
            throw error;
          });
      },
      deleteSubject: async (subjectId) => {
        await deleteEntityRequest("subject", subjectId)
          .then(() => refreshCatalog())
          .catch((error) => {
            void refreshCatalog();
            throw error;
          });
      },
      addBook: async (input) => {
        const bookId = input.id || makeId("book");
        const optimisticBook = normalizeBook({
          id: bookId,
          subjectId: input.subjectId,
          title: input.title,
          coverImage: input.coverImage ?? null,
          sourceInfo: input.sourceInfo ?? null,
          sourceLink: input.sourceLink ?? null,
          theme: input.theme ?? "sky",
          pdfFileName: input.pdfFileName ?? null,
          hasPdf: Boolean(input.pdfData),
          sections: [],
          chapters: []
        });

        setSubjects((current) =>
          current.map((subject) =>
            subject.id === input.subjectId
              ? {
                  ...subject,
                  books: subject.books.some((book) => book.id === bookId)
                    ? subject.books
                    : [optimisticBook, ...subject.books]
                }
              : subject
          )
        );

        await persistEntity("POST", {
          entityType: "book",
          data: {
            id: bookId,
            subjectId: input.subjectId,
            subjectName: input.subjectName,
            title: input.title,
            coverImage: input.coverImage ?? null,
            sourceInfo: input.sourceInfo ?? null,
            sourceLink: input.sourceLink ?? null,
            theme: input.theme ?? "sky",
            pdfFileName: input.pdfFileName ?? null,
            pdfData: input.pdfData ?? null
          }
        })
          .then(() => refreshCatalog())
          .catch((error) => {
            setSubjects((current) =>
              current.map((subject) => ({
                ...subject,
                books: subject.books.filter((book) => book.id !== bookId)
              }))
            );
            void refreshCatalog();
            throw error;
          });
      },
      updateBook: async (bookId, input) => {
        setSubjects((current) =>
          current.map((subject) => ({
            ...subject,
            books: subject.books.map((book) =>
              book.id === bookId
                ? {
                    ...book,
                    title: input.title,
                    coverImage: input.coverImage ?? null,
                    sourceInfo: input.sourceInfo ?? null,
                    sourceLink: input.sourceLink ?? null,
                    theme: input.theme ?? book.theme ?? "sky",
                    pdfFileName:
                      input.pdfData === undefined
                        ? book.pdfFileName ?? null
                        : input.pdfData
                          ? input.pdfFileName ?? book.pdfFileName ?? "original.pdf"
                          : null,
                    hasPdf: input.pdfData === undefined ? Boolean(book.hasPdf) : Boolean(input.pdfData)
                  }
                : book
            )
          }))
        );

        await persistEntity("PATCH", {
          entityType: "book",
          entityId: bookId,
          data: {
            subjectId: input.subjectId,
            title: input.title,
            coverImage: input.coverImage ?? null,
            sourceInfo: input.sourceInfo ?? null,
            sourceLink: input.sourceLink ?? null,
            theme: input.theme ?? "sky",
            pdfFileName: input.pdfFileName ?? undefined,
            pdfData: input.pdfData
          }
        })
          .then(() => refreshCatalog())
          .catch(() => refreshCatalog());
      },
      deleteBook: async (bookId) => {
        await deleteEntityRequest("book", bookId)
          .then(() => refreshCatalog())
          .catch((error) => {
            void refreshCatalog();
            throw error;
          });
      },
      addSection: async (input) => {
        await persistEntity("POST", {
          entityType: "section",
          data: {
            id: input.id,
            subjectId: input.subjectId,
            bookId: input.bookId,
            title: input.title
          }
        });
        await refreshCatalog();
      },
      updateSection: async (sectionId, input) => {
        setSubjects((current) =>
          current.map((subject) => ({
            ...subject,
            books: subject.books.map((book) =>
              normalizeBook({
                ...book,
                sections: book.sections.map((section) =>
                  section.id === sectionId ? { ...section, title: input.title } : section
                )
              })
            )
          }))
        );

        await persistEntity("PATCH", {
          entityType: "section",
          entityId: sectionId,
          data: {
            subjectId: input.subjectId,
            bookId: input.bookId,
            title: input.title
          }
        })
          .then(() => refreshCatalog())
          .catch(() => refreshCatalog());
      },
      deleteSection: async (sectionId) => {
        await deleteEntityRequest("section", sectionId)
          .then(() => refreshCatalog())
          .catch((error) => {
            void refreshCatalog();
            throw error;
          });
      },
      addChapterGroup: async (input) => {
        await persistEntity("POST", {
          entityType: "chapter-group",
          data: {
            id: input.id,
            subjectId: input.subjectId,
            bookId: input.bookId,
            sectionId: input.sectionId,
            title: input.title
          }
        });
        await refreshCatalog();
      },
      updateChapterGroup: async (chapterGroupId, input) => {
        setSubjects((current) =>
          current.map((subject) => ({
            ...subject,
            books: subject.books.map((book) =>
              normalizeBook({
                ...book,
                sections: book.sections.map((section) => ({
                  ...section,
                  chapters: section.chapters.map((chapterGroup) =>
                    chapterGroup.id === chapterGroupId ? { ...chapterGroup, title: input.title } : chapterGroup
                  )
                }))
              })
            )
          }))
        );

        await persistEntity("PATCH", {
          entityType: "chapter-group",
          entityId: chapterGroupId,
          data: {
            subjectId: input.subjectId,
            bookId: input.bookId,
            sectionId: input.sectionId,
            title: input.title
          }
        })
          .then(() => refreshCatalog())
          .catch(() => refreshCatalog());
      },
      deleteChapterGroup: async (chapterGroupId) => {
        await deleteEntityRequest("chapter-group", chapterGroupId)
          .then(() => refreshCatalog())
          .catch((error) => {
            void refreshCatalog();
            throw error;
          });
      },
      addTopic: async (input) => {
        await persistEntity("POST", {
          entityType: "topic",
          data: {
            id: input.id,
            subjectId: input.subjectId,
            bookId: input.bookId,
            sectionId: input.sectionId,
            chapterGroupId: input.chapterGroupId,
            title: input.title,
            excerpt: input.excerpt,
            content: input.content,
            pdfPage: input.pdfPage ?? null
          }
        });
        await refreshCatalog();
      },
      updateTopic: async (topicId, input) => {
        setSubjects((current) =>
          current.map((subject) => ({
            ...subject,
            books: subject.books.map((book) =>
              normalizeBook({
                ...book,
                sections: book.sections.map((section) => ({
                  ...section,
                  chapters: section.chapters.map((chapterGroup) => ({
                    ...chapterGroup,
                    topics: chapterGroup.topics.map((topic) =>
                      topic.id === topicId
                        ? {
                            ...topic,
                            title: input.title,
                            excerpt: input.excerpt,
                            content: input.content,
                            pdfPage: input.pdfPage ?? null,
                            originalTitle: topic.originalTitle ?? topic.title,
                            originalExcerpt: topic.originalExcerpt ?? topic.excerpt,
                            originalContent: topic.originalContent ?? topic.content,
                            lastSavedAt: new Date().toISOString()
                          }
                        : topic
                    )
                  }))
                }))
              })
            )
          }))
        );

        await persistEntity("PATCH", {
          entityType: "topic",
          entityId: topicId,
          data: {
            subjectId: input.subjectId,
            bookId: input.bookId,
            sectionId: input.sectionId,
            chapterGroupId: input.chapterGroupId,
            title: input.title,
            excerpt: input.excerpt,
            content: input.content,
            pdfPage: input.pdfPage ?? null
          }
        });
        await refreshCatalog();
      },
      deleteTopic: async (topicId) => {
        await deleteEntityRequest("topic", topicId)
          .then(() => refreshCatalog())
          .catch((error) => {
            void refreshCatalog();
            throw error;
          });
      },
      setEntityHidden: async (entityType, entityId, isHidden) => {
        const response = await fetch("/api/catalog/visibility", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId, isHidden })
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Көріну күйін өзгерту мүмкін болмады.");
        }

        await refreshCatalog();
      },
      moveSectionToBook: async (sectionId, targetBookId) => {
        await fetch("/api/catalog/relocate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "move-section", entityId: sectionId, targetBookId })
        }).then(() => refreshCatalog());
      },
      moveChapterGroupToSection: async (chapterGroupId, targetSectionId) => {
        await fetch("/api/catalog/relocate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "move-chapter-group", entityId: chapterGroupId, targetSectionId })
        }).then(() => refreshCatalog());
      },
      moveTopicToLocation: async (topicId, targetSectionId, targetChapterGroupId) => {
        await fetch("/api/catalog/relocate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "move-topic", entityId: topicId, targetSectionId, targetChapterGroupId: targetChapterGroupId ?? null })
        }).then(() => refreshCatalog());
      },
      copySectionToBook: async (sectionId, targetBookId) => {
        await fetch("/api/catalog/relocate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copy-section", entityId: sectionId, targetBookId })
        }).then(() => refreshCatalog());
      },
      copyChapterGroupToSection: async (chapterGroupId, targetSectionId) => {
        await fetch("/api/catalog/relocate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copy-chapter-group", entityId: chapterGroupId, targetSectionId })
        }).then(() => refreshCatalog());
      },
      copyTopicToLocation: async (topicId, targetSectionId, targetChapterGroupId) => {
        await fetch("/api/catalog/relocate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copy-topic", entityId: topicId, targetSectionId, targetChapterGroupId: targetChapterGroupId ?? null })
        }).then(() => refreshCatalog());
      },
      refreshSpecifications,
      saveSpecification: async (input) => {
        const method = input.specificationId ? "PATCH" : "POST";
        const response = await fetch("/api/specifications", {
          method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Спецификацияны сақтау мүмкін болмады.");
        }

        await refreshSpecifications(input.subjectId);
      },
      deleteSpecification: async (specificationId) => {
        const response = await fetch(`/api/specifications/${encodeURIComponent(specificationId)}`, {
          method: "DELETE",
          credentials: "same-origin"
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Спецификацияны өшіру мүмкін болмады.");
        }

        await refreshSpecifications();
      },
      generateGlossaryFromText: (text) => {
        const words = Array.from(
          new Set(
            text
              .toLowerCase()
              .replace(/[^\p{L}\p{N}\s-]/gu, " ")
              .split(/\s+/)
              .filter((word) => word.length > 3)
          )
        ).slice(0, 50);

        setGlossary((current) => {
          const existingWords = new Set(current.map((item) => item.word.toLowerCase()));
          const additions = words
            .filter((word) => !existingWords.has(word))
            .map((word) => ({
              id: makeId("glossary"),
              word,
              definition: ""
            }));
          return [...current, ...additions];
        });
      },
      updateGlossaryEntry: (entryId, word, definition) => {
        setGlossary((current) =>
          current.map((item) => (item.id === entryId ? { ...item, word, definition } : item))
        );
      },
      removeGlossaryEntry: (entryId) => {
        setGlossary((current) => current.filter((item) => item.id !== entryId));
      },
      resetCatalog: () => {
        setSubjects([]);
        setGlossary([]);
      }
    }),
    [glossary, isReady, orderedSubjects, specifications, subjectOrder, subjects]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);

  if (!context) {
    throw new Error("useCatalog must be used inside CatalogProvider");
  }

  return context;
}

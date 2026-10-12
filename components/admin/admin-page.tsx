"use client";

import Link from "next/link";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Files,
  FolderTree,
  GripVertical,
  Plus,
  RotateCcw,
  Search,
  SquarePen,
  Trash2,
  Type
} from "lucide-react";
import { CatalogTransferModal, type TransferDialogState } from "@/components/admin/catalog-transfer-modal";
import { RouteGuard } from "@/components/auth/route-guard";
import { ChapterEditor, type ChapterEditorHandle } from "@/components/admin/chapter-editor";
import { PdfImportPanel } from "@/components/admin/pdf-import-panel";
import { QuestionBankPanel } from "@/components/admin/question-bank-panel";
import { AudioBankPanel } from "@/components/admin/audio-bank-panel";
import { SpecificationPanel } from "@/components/admin/specification-panel";
import { ContentRenderer } from "@/components/reader/content-renderer";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { Modal } from "@/components/ui/modal";
import type { BookRecord, ChapterGroupRecord, SectionRecord, SubjectRecord, TopicRecord } from "@/lib/types";
import { sanitizePlainText, sanitizeRichText } from "@/lib/sanitize";

const VIRTUAL_DIRECT_CHAPTER_PREFIX = "virtual-direct:";
type CatalogDragItem = {
  type: "subject" | "book" | "section" | "chapter-group" | "topic";
  id: string;
};
type CatalogDropPosition = "before" | "after";
type CatalogDragOverItem = CatalogDragItem & {
  position: CatalogDropPosition;
};
type AdminBookStat = {
  bookId: string;
  title: string;
  readerCount: number;
  totalSeconds: number;
};

type AdminSubjectStat = {
  subjectId: string;
  subjectName: string;
  totalSeconds: number;
  readerCount: number;
  books: AdminBookStat[];
};

function makeVirtualDirectChapterGroupId(sectionId: string) {
  return `${VIRTUAL_DIRECT_CHAPTER_PREFIX}${sectionId}`;
}

function isVirtualDirectChapterGroupId(chapterGroupId: string) {
  return chapterGroupId.startsWith(VIRTUAL_DIRECT_CHAPTER_PREFIX);
}

type ModalState =
  | { type: "subject-create" | "subject-edit"; subjectId?: string }
  | { type: "book-create" | "book-edit"; subjectId: string; bookId?: string }
  | { type: "section-create" | "section-edit"; subjectId: string; bookId: string; sectionId?: string }
  | { type: "chapter-group-create" | "chapter-group-edit"; subjectId: string; bookId: string; sectionId: string; chapterGroupId?: string }
  | {
      type: "topic-create" | "topic-edit";
      subjectId: string;
      bookId: string;
      sectionId: string;
      chapterGroupId?: string;
      topicId?: string;
    }
  | null;

type EntityActions = {
  addSubject: (input: { id?: string; name: string; description: string }) => void | Promise<void>;
  updateSubject: (subjectId: string, input: { id?: string; name: string; description: string }) => void | Promise<void>;
  addBook: (input: { id?: string; subjectId: string; subjectName?: string; title: string; coverImage?: string | null; sourceInfo?: string | null; sourceLink?: string | null; theme?: string | null; pdfFileName?: string | null; pdfData?: string | null }) => void | Promise<void>;
  updateBook: (bookId: string, input: { id?: string; subjectId: string; title: string; coverImage?: string | null; sourceInfo?: string | null; sourceLink?: string | null; theme?: string | null; pdfFileName?: string | null; pdfData?: string | null }) => void | Promise<void>;
  addSection: (input: { id?: string; subjectId: string; bookId: string; title: string }) => void | Promise<void>;
  updateSection: (sectionId: string, input: { id?: string; subjectId: string; bookId: string; title: string }) => void | Promise<void>;
  addChapterGroup: (input: { id?: string; subjectId: string; bookId: string; sectionId: string; title: string }) => void | Promise<void>;
  updateChapterGroup: (
    chapterGroupId: string,
    input: { id?: string; subjectId: string; bookId: string; sectionId: string; title: string }
  ) => void | Promise<void>;
  addTopic: (input: {
    id?: string;
    subjectId: string;
    bookId: string;
    sectionId: string;
    chapterGroupId?: string;
    title: string;
    excerpt: string;
    content: string;
    pdfPage?: number | null;
  }) => void | Promise<void>;
  updateTopic: (
    topicId: string,
    input: {
      id?: string;
      subjectId: string;
      bookId: string;
      sectionId: string;
      chapterGroupId?: string;
      title: string;
      excerpt: string;
      content: string;
      pdfPage?: number | null;
    }
  ) => void | Promise<void>;
};

export function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const {
    subjects,
    specifications,
    refreshCatalog,
    refreshSpecifications,
    moveSubject,
    moveSection,
    moveChapterGroup,
    moveTopic,
    addSubject,
    updateSubject,
    deleteSubject,
    addBook,
    updateBook,
    deleteBook,
    addSection,
    updateSection,
    deleteSection,
    addChapterGroup,
    updateChapterGroup,
    deleteChapterGroup,
    addTopic,
    updateTopic,
    deleteTopic,
    setEntityHidden,
    moveSectionToBook,
    moveChapterGroupToSection,
    moveTopicToLocation,
    copySectionToBook,
    copyChapterGroupToSection,
    copyTopicToLocation,
    saveSpecification,
    deleteSpecification
  } = useCatalog();

  const [modal, setModal] = useState<ModalState>(null);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [activeSubjectId, setActiveSubjectId] = useState("");
  const [collapsedBooks, setCollapsedBooks] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [collapsedChapterGroups, setCollapsedChapterGroups] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "subject" | "book" | "section" | "chapter-group" | "topic";
    id: string;
    title: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [draggedCatalogItem, setDraggedCatalogItem] = useState<CatalogDragItem | null>(null);
  const [dragOverCatalogItem, setDragOverCatalogItem] = useState<CatalogDragOverItem | null>(null);
  const [adminStats, setAdminStats] = useState<AdminSubjectStat[]>([]);
  const [activePanel, setActivePanel] = useState<"catalog" | "stats" | "specifications" | "questions" | "audio">("catalog");
  const [collapsedSubjectStats, setCollapsedSubjectStats] = useState<Record<string, boolean>>({});
  const [transferDialog, setTransferDialog] = useState<TransferDialogState | null>(null);
  const draggedCatalogItemRef = useRef<CatalogDragItem | null>(null);

  function startCatalogDrag(event: DragEvent<HTMLElement>, item: CatalogDragItem) {
    event.stopPropagation();
    draggedCatalogItemRef.current = item;
    setDraggedCatalogItem(item);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${item.type}:${item.id}`);
  }

  function getCatalogDropPosition(event: DragEvent<HTMLElement>): CatalogDropPosition {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function getCatalogDropClasses(item: CatalogDragItem) {
    const active = dragOverCatalogItem?.type === item.type && dragOverCatalogItem.id === item.id;
    if (!active || draggedCatalogItem?.id === item.id) {
      return "";
    }

    return dragOverCatalogItem.position === "before"
      ? "relative before:absolute before:left-4 before:right-4 before:top-0 before:z-20 before:h-1 before:-translate-y-1/2 before:rounded-full before:bg-sky-500 before:shadow-[0_0_18px_rgba(14,165,233,0.55)] dark:before:bg-cyan-300"
      : "relative after:absolute after:bottom-0 after:left-4 after:right-4 after:z-20 after:h-1 after:translate-y-1/2 after:rounded-full after:bg-sky-500 after:shadow-[0_0_18px_rgba(14,165,233,0.55)] dark:after:bg-cyan-300";
  }

  async function moveCatalogItemToTarget(target: CatalogDragItem, orderedIds: string[], position: CatalogDropPosition) {
    const draggedItem = draggedCatalogItemRef.current ?? draggedCatalogItem;
    if (!draggedItem || draggedItem.type !== target.type || draggedItem.id === target.id) {
      return;
    }

    const sourceIndex = orderedIds.indexOf(draggedItem.id);
    const targetIndex = orderedIds.indexOf(target.id);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    if (draggedItem.type === "subject") {
      const idsWithoutDragged = orderedIds.filter((id) => id !== draggedItem.id);
      const targetIndexAfterRemoval = idsWithoutDragged.indexOf(target.id);
      if (targetIndexAfterRemoval === -1) {
        return;
      }

      const desiredIndex = targetIndexAfterRemoval + (position === "after" ? 1 : 0);
      const direction = desiredIndex < sourceIndex ? "up" : "down";
      const steps = Math.abs(desiredIndex - sourceIndex);
      for (let index = 0; index < steps; index += 1) {
        moveSubject(draggedItem.id, direction);
      }
      return;
    }

    const response = await fetch("/api/catalog/reorder", {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        entityType: draggedItem.type,
        entityId: draggedItem.id,
        targetEntityId: target.id,
        position
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error || "Реттілікті өзгерту мүмкін болмады.");
      await refreshCatalog();
      return;
    }

    await refreshCatalog();
  }

  function handleCatalogDragOver(event: DragEvent<HTMLElement>, target: CatalogDragItem) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const draggedItem = draggedCatalogItemRef.current ?? draggedCatalogItem;
    if (!draggedItem || draggedItem.type !== target.type || draggedItem.id === target.id) {
      setDragOverCatalogItem(null);
      return;
    }

    setDragOverCatalogItem({
      ...target,
      position: getCatalogDropPosition(event)
    });
  }

  async function handleCatalogDrop(event: DragEvent<HTMLElement>, target: CatalogDragItem, orderedIds: string[]) {
    event.preventDefault();
    event.stopPropagation();
    const position =
      dragOverCatalogItem?.type === target.type && dragOverCatalogItem.id === target.id
        ? dragOverCatalogItem.position
        : getCatalogDropPosition(event);
    await moveCatalogItemToTarget(target, orderedIds, position);
    draggedCatalogItemRef.current = null;
    setDraggedCatalogItem(null);
    setDragOverCatalogItem(null);
  }

  function endCatalogDrag() {
    draggedCatalogItemRef.current = null;
    setDraggedCatalogItem(null);
    setDragOverCatalogItem(null);
  }

  function toggleBook(bookId: string) {
    setCollapsedBooks((current) => ({
      ...current,
      [bookId]: current[bookId] === false
    }));
  }

  function toggleSection(sectionId: string) {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: current[sectionId] === false
    }));
  }

  function toggleChapterGroup(chapterGroupId: string) {
    setCollapsedChapterGroups((current) => ({
      ...current,
      [chapterGroupId]: current[chapterGroupId] === false
    }));
  }

  function toggleSubjectStats(subjectId: string) {
    setCollapsedSubjectStats((current) => ({
      ...current,
      [subjectId]: current[subjectId] === false
    }));
  }

  function isBookCollapsed(bookId: string) {
    return collapsedBooks[bookId] !== false;
  }

  function isSectionCollapsed(sectionId: string) {
    return collapsedSections[sectionId] !== false;
  }

  function isChapterGroupCollapsed(chapterGroupId: string) {
    return collapsedChapterGroups[chapterGroupId] !== false;
  }

  const currentSubject = useMemo(
    () => (modal && "subjectId" in modal ? subjects.find((item) => item.id === modal.subjectId) ?? null : null),
    [modal, subjects]
  );

  const currentBook = useMemo(() => {
    if (!modal || !("bookId" in modal) || !modal.bookId) {
      return null;
    }

    for (const subject of subjects) {
      const book = subject.books.find((item) => item.id === modal.bookId);
      if (book) {
        return book;
      }
    }

    return null;
  }, [modal, subjects]);

  const currentSection = useMemo(() => {
    if (!currentBook || !modal || !("sectionId" in modal) || !modal.sectionId) {
      return null;
    }

    return currentBook.sections.find((item) => item.id === modal.sectionId) ?? null;
  }, [currentBook, modal]);

  const currentChapterGroup = useMemo(() => {
    if (!currentSection || !modal || !("chapterGroupId" in modal) || !modal.chapterGroupId) {
      return null;
    }

    return currentSection.chapters.find((item) => item.id === modal.chapterGroupId) ?? null;
  }, [currentSection, modal]);

  const currentTopic = useMemo(() => {
    if (!currentSection || !modal || !("topicId" in modal) || !modal.topicId) {
      return null;
    }

    for (const chapterGroup of currentSection.chapters) {
      const topic = chapterGroup.topics.find((item) => item.id === modal.topicId);
      if (topic) {
        return topic;
      }
    }

    return null;
  }, [currentSection, modal]);

  const filteredSubjects = useMemo(() => {
    const term = subjectSearch.trim().toLowerCase();
    if (!term) {
      return subjects;
    }

    return subjects.filter((subject) => subject.name.toLowerCase().includes(term));
  }, [subjectSearch, subjects]);

  const activeSubject = useMemo(
    () => filteredSubjects.find((subject) => subject.id === activeSubjectId) ?? filteredSubjects[0] ?? null,
    [activeSubjectId, filteredSubjects]
  );

  useEffect(() => {
    if (!filteredSubjects.length) {
      if (activeSubjectId) {
        setActiveSubjectId("");
      }
      return;
    }

    if (!activeSubjectId || !filteredSubjects.some((subject) => subject.id === activeSubjectId)) {
      setActiveSubjectId(filteredSubjects[0].id);
    }
  }, [activeSubjectId, filteredSubjects]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (panel === "stats") {
      setActivePanel("stats");
      return;
    }

    if (panel === "specifications") {
      setActivePanel("specifications");
      return;
    }

    if (panel === "questions") {
      setActivePanel("questions");
      return;
    }

    if (panel === "audio") {
      setActivePanel("audio");
      return;
    }

    setActivePanel("catalog");
  }, [searchParams]);

  useEffect(() => {
    if (activePanel !== "stats") {
      return;
    }

    void fetch("/api/admin/stats", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload) => {
        setAdminStats(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch(() => {
        setAdminStats([]);
      });
  }, [activePanel]);

  function openDeleteConfirm(type: "subject" | "book" | "section" | "chapter-group" | "topic", id: string, title: string) {
    setDeleteConfirm({ type, id, title });
    setDeleteConfirmText("");
  }

  function applyDeleteConfirm() {
    if (!deleteConfirm || deleteConfirmText.trim().toUpperCase() !== "РАСТАУ") {
      return;
    }

    if (deleteConfirm.type === "subject") {
      deleteSubject(deleteConfirm.id);
    } else if (deleteConfirm.type === "book") {
      deleteBook(deleteConfirm.id);
    } else if (deleteConfirm.type === "section") {
      deleteSection(deleteConfirm.id);
    } else if (deleteConfirm.type === "chapter-group") {
      deleteChapterGroup(deleteConfirm.id);
    } else {
      deleteTopic(deleteConfirm.id);
    }

    setDeleteConfirm(null);
    setDeleteConfirmText("");
  }

  return (
    <RouteGuard role="ADMIN">
      <div className="page-shell">
        <div className="page-glow">
          <div className="glow-drift-a absolute left-[-8rem] top-12 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl dark:bg-cyan-500/15" />
          <div className="glow-drift-b absolute bottom-8 right-[-12rem] h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl dark:bg-sky-500/12" />
        </div>
        <SiteHeader />

        <main id="juz-main" className="page-width py-10">
          <section className="glass-card p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="intro-mask">
                  <p className="hero-line flex items-center gap-3 text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
                    <span className="hero-rule inline-block h-[2px] w-8 bg-sky-600 dark:bg-cyan-400" style={{ animationDelay: "0.2s" }} />
                    Әкімші панелі
                  </p>
                </div>
                <h1 className="intro-mask mt-4 text-5xl font-semibold">
                  <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>Кітап құрылымын басқару</span>
                </h1>
                <p className="hero-line mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-zinc-400" style={{ animationDelay: "0.4s" }}>
                  Мұнда пән, кітап, бөлім, тарау және тақырыптарды реттеп, оқушыға шығатын мәтінді алдын ала тексеруге болады.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  Кітаптар
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const nextPanel = activePanel === "stats" ? "catalog" : "stats";
                    setActivePanel(nextPanel);
                    router.replace(nextPanel === "stats" ? "/admin?panel=stats" : "/admin");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  {activePanel === "stats" ? "Кітаптар көрінісі" : "Статистика"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextPanel = activePanel === "specifications" ? "catalog" : "specifications";
                    setActivePanel(nextPanel);
                    router.replace(nextPanel === "specifications" ? "/admin?panel=specifications" : "/admin");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  {activePanel === "specifications" ? "Каталогқа оралу" : "Спецификация"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextPanel = activePanel === "questions" ? "catalog" : "questions";
                    setActivePanel(nextPanel);
                    router.replace(nextPanel === "questions" ? "/admin?panel=questions" : "/admin");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  {activePanel === "questions" ? "Каталогқа оралу" : "Сұрақтар банкі"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextPanel = activePanel === "audio" ? "catalog" : "audio";
                    setActivePanel(nextPanel);
                    router.replace(nextPanel === "audio" ? "/admin?panel=audio" : "/admin");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  {activePanel === "audio" ? "Каталогқа оралу" : "Аудио банкі"}
                </button>
                {session?.role === "SUPERADMIN" ? (
                  <Link
                    href="/admin/users"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                  >
                    Пайдаланушыларды басқару
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setModal({ type: "subject-create" })}
                  className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-3 text-sm font-medium text-white dark:bg-cyan-400 dark:text-zinc-950"
                >
                  <Plus className="h-4 w-4" />
                  Пән қосу
                </button>

              </div>
            </div>
          </section>

          {activePanel === "stats" ? (
          <section className="mt-8 glass-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">Статистика</p>
                <h2 className="mt-3 text-3xl font-semibold">Пәндер бойынша оқу белсенділігі</h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {adminStats.map((item) => {
                const maxSeconds = Math.max(...adminStats.map((stat) => stat.totalSeconds), 1);
                const subjectWidth = Math.max(8, Math.min(100, Math.round((item.totalSeconds / maxSeconds) * 100)));
                const isCollapsed = collapsedSubjectStats[item.subjectId] !== false;
                return (
                  <div key={item.subjectId} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">{item.subjectName}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                          {item.readerCount} оқушы оқыды
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm font-medium text-sky-700 dark:text-cyan-300">
                          {(item.totalSeconds / 3600).toFixed(1)} сағат
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSubjectStats(item.subjectId)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                        >
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-slate-100 dark:bg-zinc-800">
                      <div className="h-3 rounded-full bg-sky-500 dark:bg-cyan-400" style={{ width: `${subjectWidth}%` }} />
                    </div>

                    {!isCollapsed ? (
                    <div className="mt-5 grid gap-3">
                      {item.books.map((book) => {
                        const width = item.totalSeconds > 0 ? Math.max(8, Math.round((book.totalSeconds / item.totalSeconds) * 100)) : 8;
                        return (
                          <div key={book.bookId} className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{book.title}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                  {book.readerCount} оқушы | {(book.totalSeconds / 3600).toFixed(1)} сағат
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 h-2.5 rounded-full bg-white dark:bg-zinc-900">
                              <div className="h-2.5 rounded-full bg-sky-500 dark:bg-cyan-400" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                );
              })}
              {!adminStats.length ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  Оқу сағаты туралы дерек жиналған жоқ.
                </div>
              ) : null}
            </div>
          </section>
          ) : null}

          {activePanel === "questions" ? <QuestionBankPanel subjects={subjects} /> : null}

          {activePanel === "audio" ? <AudioBankPanel subjects={subjects} /> : null}

          {activePanel === "specifications" ? (
            <SpecificationPanel
              subjects={subjects}
              activeSubjectId={activeSubjectId}
              onSelectSubject={setActiveSubjectId}
              specifications={specifications}
              onRefreshSpecifications={refreshSpecifications}
              onSaveSpecification={saveSpecification}
              onDeleteSpecification={deleteSpecification}
            />
          ) : null}

          {activePanel === "catalog" ? (
          <section className="mt-8 glass-card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">Пәндер</p>
                <h2 className="mt-3 text-3xl font-semibold">Пәнді таңдап басқару</h2>
              </div>
              <label className="relative block w-full max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={subjectSearch}
                  spellCheck={false}
                  onChange={(event) => setSubjectSearch(event.target.value || "")}
                  placeholder="Пәнді іздеу"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-cyan-500/50"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
              {filteredSubjects.map((subject) => {
                const active = activeSubject?.id === subject.id;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    draggable
                    onDragStart={(event) => startCatalogDrag(event, { type: "subject", id: subject.id })}
                    onDragOver={(event) => handleCatalogDragOver(event, { type: "subject", id: subject.id })}
                    onDrop={(event) => void handleCatalogDrop(event, { type: "subject", id: subject.id }, filteredSubjects.map((item) => item.id))}
                    onDragEnd={endCatalogDrag}
                    onClick={() => setActiveSubjectId(subject.id)}
                    className={`min-w-[240px] shrink-0 rounded-3xl border px-5 py-4 text-left transition ${
                      active
                        ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100 dark:border-cyan-500/50 dark:bg-cyan-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    } ${draggedCatalogItem?.type === "subject" && draggedCatalogItem.id === subject.id ? "opacity-60 ring-2 ring-sky-300" : ""} ${getCatalogDropClasses({ type: "subject", id: subject.id })}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs uppercase tracking-[0.12em] text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                          <GripVertical className="h-3.5 w-3.5" />
                          Пән
                        </div>
                        <h3 className="mt-3 truncate text-xl font-semibold">{subject.name}</h3>
                        {subject.isHidden ? (
                          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            <EyeOff className="h-3.5 w-3.5" />
                            Жасырылған
                          </span>
                        ) : null}
                      </div>
                      {active ? (
                        <div className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700 dark:border-cyan-500/30 dark:bg-zinc-900 dark:text-cyan-300">
                          Ашық
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                      {subject.description}
                    </p>
                    <p className="mt-4 text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-500">
                      {subject.books.length} кітап
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
          ) : null}

          {activePanel === "catalog" ? (
          <section className="mt-8 space-y-5">
            {[activeSubject].filter((subject): subject is SubjectRecord => !!subject).map((subject) => (
              <div key={subject.id} className="glass-card p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs uppercase tracking-[0.12em] text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                      <Files className="h-4 w-4" />
                      Пән
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold">{subject.name}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-zinc-400">{subject.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModal({ type: "book-create", subjectId: subject.id })}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      <Plus className="h-4 w-4" />
                      Кітап қосу
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ type: "subject-edit", subjectId: subject.id })}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      <SquarePen className="h-4 w-4" />
                      Өңдеу
                    </button>
                    {/* Кітаптары әлі жүктелмеген пәнді оқырманнан жасырып қоюға болады */}
                    <button
                      type="button"
                      onClick={() => void setEntityHidden("subject", subject.id, !subject.isHidden)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                        subject.isHidden
                          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                          : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                      }`}
                      title={subject.isHidden ? "Пәнді оқырманға қайта көрсету" : "Пәнді оқырманнан жасыру"}
                    >
                      {subject.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {subject.isHidden ? "Жасырылған" : "Жасыру"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteConfirm("subject", subject.id, subject.name)}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      Өшіру
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  {subject.books.map((book) => (
                    <div
                      key={book.id}
                      draggable
                      onDragStart={(event) => startCatalogDrag(event, { type: "book", id: book.id })}
                      onDragOver={(event) => handleCatalogDragOver(event, { type: "book", id: book.id })}
                      onDrop={(event) => void handleCatalogDrop(event, { type: "book", id: book.id }, subject.books.map((item) => item.id))}
                      onDragEnd={endCatalogDrag}
                      className={`soft-card p-5 ${
                        draggedCatalogItem?.type === "book" && draggedCatalogItem.id === book.id ? "opacity-60 ring-2 ring-sky-300" : ""
                      } ${getCatalogDropClasses({ type: "book", id: book.id })}`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 gap-4">
                          <button
                            type="button"
                            onClick={() => toggleBook(book.id)}
                            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                            aria-label={isBookCollapsed(book.id) ? "Кітапты ашу" : "Кітапты жинақтау"}
                            title={isBookCollapsed(book.id) ? "Кітапты ашу" : "Кітапты жинақтау"}
                          >
                            {isBookCollapsed(book.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <div className="flex h-[6.67rem] w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950">
                            {book.coverImage ? (
                              <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" />
                            ) : (
                              <span className="px-3 text-center text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500">
                                Мұқаба
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                              <GripVertical className="h-4 w-4 cursor-grab" />
                              <BookOpen className="h-4 w-4" />
                              Кітап
                            </div>
                            <h3 className="mt-3 text-2xl font-semibold">{book.title}</h3>
                            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                              {book.sections.length} бөлім, {book.chapters.length} тақырып
                            </p>
                            {book.hasPdf ? (
                              <p className="mt-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-200">
                                PDF жүктелген: {book.pdfFileName || "original.pdf"}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setModal({ type: "book-edit", subjectId: subject.id, bookId: book.id })}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                          >
                            Өңдеу
                          </button>
                          <button
                            type="button"
                            onClick={() => setModal({ type: "section-create", subjectId: subject.id, bookId: book.id })}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                          >
                            Бөлім қосу
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteConfirm("book", book.id, book.title)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                          >
                            Кітапты өшіру
                          </button>
                        </div>
                      </div>

                      {!isBookCollapsed(book.id) ? <div className="mt-5 space-y-4">
                        {book.sections.map((section) => (
                          <div
                            key={section.id}
                            draggable
                            onDragStart={(event) => startCatalogDrag(event, { type: "section", id: section.id })}
                            onDragOver={(event) => handleCatalogDragOver(event, { type: "section", id: section.id })}
                            onDrop={(event) => void handleCatalogDrop(event, { type: "section", id: section.id }, book.sections.map((item) => item.id))}
                            onDragEnd={endCatalogDrag}
                            className={`rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${
                              draggedCatalogItem?.type === "section" && draggedCatalogItem.id === section.id ? "opacity-60 ring-2 ring-sky-300" : ""
                            } ${getCatalogDropClasses({ type: "section", id: section.id })}`}
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-start gap-3">
                                <button
                                  type="button"
                                  onClick={() => toggleSection(section.id)}
                                  className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                                  aria-label={isSectionCollapsed(section.id) ? "Бөлімді ашу" : "Бөлімді жинақтау"}
                                  title={isSectionCollapsed(section.id) ? "Бөлімді ашу" : "Бөлімді жинақтау"}
                                >
                                  {isSectionCollapsed(section.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                <div>
                                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">
                                    <GripVertical className="h-4 w-4 cursor-grab" />
                                    <Boxes className="h-4 w-4" />
                                    Бөлім
                                  </div>
                                  <h4 className="mt-2 text-lg font-semibold">{section.title}</h4>
                                  {section.isHidden ? (
                                    <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                                      Жасырылған бөлім
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setModal({ type: "section-edit", subjectId: subject.id, bookId: book.id, sectionId: section.id })}
                                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                >
                                  Өңдеу
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModal({
                                      type: "chapter-group-create",
                                      subjectId: subject.id,
                                      bookId: book.id,
                                      sectionId: section.id
                                    })
                                  }
                                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                >
                                  Тарау қосу
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModal({
                                      type: "topic-create",
                                      subjectId: subject.id,
                                      bookId: book.id,
                                      sectionId: section.id,
                                      chapterGroupId: makeVirtualDirectChapterGroupId(section.id)
                                    })
                                  }
                                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                >
                                  Тақырып қосу
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void setEntityHidden("section", section.id, !section.isHidden)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all duration-300 hover:scale-105 hover:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/40"
                                  title={section.isHidden ? "Көрсету" : "Жасыру"}
                                  aria-label={section.isHidden ? "Көрсету" : "Жасыру"}
                                >
                                  {section.isHidden ? <Eye className="h-4 w-4 transition-transform duration-300" /> : <EyeOff className="h-4 w-4 transition-transform duration-300" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTransferDialog({
                                      mode: "move",
                                      entityType: "section",
                                      entityId: section.id,
                                      entityTitle: section.title,
                                      currentBookId: book.id,
                                      subjectId: subject.id
                                    })
                                  }
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                  title="Ауыстыру"
                                  aria-label="Ауыстыру"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTransferDialog({
                                      mode: "copy",
                                      entityType: "section",
                                      entityId: section.id,
                                      entityTitle: section.title,
                                      currentBookId: book.id,
                                      subjectId: subject.id
                                    })
                                  }
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                  title="Көшіру"
                                  aria-label="Көшіру"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDeleteConfirm("section", section.id, section.title)}
                                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                                >
                                  Өшіру
                                </button>
                              </div>
                            </div>

                            {!isSectionCollapsed(section.id) ? <div className="mt-4 space-y-3">
                              {section.chapters.map((chapterGroup) => (
                                <div
                                  key={chapterGroup.id}
                                  draggable={!isVirtualDirectChapterGroupId(chapterGroup.id)}
                                  onDragStart={(event) => startCatalogDrag(event, { type: "chapter-group", id: chapterGroup.id })}
                                  onDragOver={(event) => handleCatalogDragOver(event, { type: "chapter-group", id: chapterGroup.id })}
                                  onDrop={(event) =>
                                    void handleCatalogDrop(
                                      event,
                                      { type: "chapter-group", id: chapterGroup.id },
                                      section.chapters.filter((item) => !isVirtualDirectChapterGroupId(item.id)).map((item) => item.id)
                                    )
                                  }
                                  onDragEnd={endCatalogDrag}
                                  className={`rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60 ${
                                    draggedCatalogItem?.type === "chapter-group" && draggedCatalogItem.id === chapterGroup.id ? "opacity-60 ring-2 ring-emerald-300" : ""
                                  } ${getCatalogDropClasses({ type: "chapter-group", id: chapterGroup.id })}`}
                                >
                                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-start gap-3">
                                      <button
                                        type="button"
                                        onClick={() => toggleChapterGroup(chapterGroup.id)}
                                        className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-emerald-500/50 dark:hover:text-emerald-300"
                                        aria-label={isChapterGroupCollapsed(chapterGroup.id) ? "Тарауды ашу" : "Тарауды жинақтау"}
                                        title={isChapterGroupCollapsed(chapterGroup.id) ? "Тарауды ашу" : "Тарауды жинақтау"}
                                      >
                                        {isChapterGroupCollapsed(chapterGroup.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                      </button>
                                      <div>
                                        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                                          {!isVirtualDirectChapterGroupId(chapterGroup.id) ? <GripVertical className="h-4 w-4 cursor-grab" /> : null}
                                          <FolderTree className="h-4 w-4" />
                                          {isVirtualDirectChapterGroupId(chapterGroup.id) ? "Тақырыптар" : "Тарау"}
                                        </div>
                                        <h5 className="mt-2 text-base font-semibold">{chapterGroup.title}</h5>
                                        {!isVirtualDirectChapterGroupId(chapterGroup.id) && chapterGroup.isHidden ? (
                                          <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                                            Жасырылған тарау
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {!isVirtualDirectChapterGroupId(chapterGroup.id) ? (
                                        <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setModal({
                                              type: "chapter-group-edit",
                                              subjectId: subject.id,
                                              bookId: book.id,
                                              sectionId: section.id,
                                              chapterGroupId: chapterGroup.id
                                            })
                                          }
                                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                        >
                                          Өңдеу
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void setEntityHidden("chapter-group", chapterGroup.id, !chapterGroup.isHidden)}
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all duration-300 hover:scale-105 hover:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-500/40"
                                          title={chapterGroup.isHidden ? "Көрсету" : "Жасыру"}
                                          aria-label={chapterGroup.isHidden ? "Көрсету" : "Жасыру"}
                                        >
                                          {chapterGroup.isHidden ? <Eye className="h-4 w-4 transition-transform duration-300" /> : <EyeOff className="h-4 w-4 transition-transform duration-300" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setTransferDialog({
                                              mode: "move",
                                              entityType: "chapter-group",
                                              entityId: chapterGroup.id,
                                              entityTitle: chapterGroup.title,
                                              currentSectionId: section.id,
                                              subjectId: subject.id
                                            })
                                          }
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                          title="Ауыстыру"
                                          aria-label="Ауыстыру"
                                        >
                                          <ArrowRightLeft className="h-4 w-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setTransferDialog({
                                              mode: "copy",
                                              entityType: "chapter-group",
                                              entityId: chapterGroup.id,
                                              entityTitle: chapterGroup.title,
                                              currentSectionId: section.id,
                                              subjectId: subject.id
                                            })
                                          }
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                          title="Көшіру"
                                          aria-label="Көшіру"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </button>
                                        </>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setModal({
                                            type: "topic-create",
                                            subjectId: subject.id,
                                            bookId: book.id,
                                            sectionId: section.id,
                                            chapterGroupId: chapterGroup.id
                                          })
                                        }
                                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                      >
                                        Тақырып қосу
                                      </button>
                                      {!isVirtualDirectChapterGroupId(chapterGroup.id) ? (
                                        <button
                                          type="button"
                                          onClick={() => openDeleteConfirm("chapter-group", chapterGroup.id, chapterGroup.title)}
                                          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                                        >
                                          Өшіру
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>

                                  {!isChapterGroupCollapsed(chapterGroup.id) ? <div className="mt-4 space-y-2">
                                    {chapterGroup.topics.map((topic) => (
                                      <div
                                        key={topic.id}
                                        draggable
                                        onDragStart={(event) => startCatalogDrag(event, { type: "topic", id: topic.id })}
                                        onDragOver={(event) => handleCatalogDragOver(event, { type: "topic", id: topic.id })}
                                        onDrop={(event) => void handleCatalogDrop(event, { type: "topic", id: topic.id }, chapterGroup.topics.map((item) => item.id))}
                                        onDragEnd={endCatalogDrag}
                                        className={`flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-start md:justify-between ${
                                          draggedCatalogItem?.type === "topic" && draggedCatalogItem.id === topic.id ? "opacity-60 ring-2 ring-violet-300" : ""
                                        } ${getCatalogDropClasses({ type: "topic", id: topic.id })}`}
                                      >
                                        <div className="min-w-0">
                                          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
                                            <GripVertical className="h-4 w-4 cursor-grab" />
                                            <Type className="h-4 w-4" />
                                            Тақырып
                                          </div>
                                          <p className="mt-2 text-base font-semibold">{topic.title}</p>
                                          {topic.isHidden ? (
                                            <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                                              Жасырылған тақырып
                                            </p>
                                          ) : null}
                                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">{topic.excerpt}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setModal({
                                                type: "topic-edit",
                                                subjectId: subject.id,
                                                bookId: book.id,
                                                sectionId: section.id,
                                                chapterGroupId: chapterGroup.id,
                                                topicId: topic.id
                                              })
                                            }
                                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                          >
                                            Өңдеу
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void setEntityHidden("topic", topic.id, !topic.isHidden)}
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-all duration-300 hover:scale-105 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-violet-500/40"
                                          title={topic.isHidden ? "Көрсету" : "Жасыру"}
                                          aria-label={topic.isHidden ? "Көрсету" : "Жасыру"}
                                        >
                                            {topic.isHidden ? <Eye className="h-4 w-4 transition-transform duration-300" /> : <EyeOff className="h-4 w-4 transition-transform duration-300" />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setTransferDialog({
                                                mode: "move",
                                                entityType: "topic",
                                                entityId: topic.id,
                                                entityTitle: topic.title,
                                                currentSectionId: section.id,
                                                currentChapterGroupId: chapterGroup.id,
                                                subjectId: subject.id
                                              })
                                            }
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                            title="Ауыстыру"
                                            aria-label="Ауыстыру"
                                          >
                                            <ArrowRightLeft className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setTransferDialog({
                                                mode: "copy",
                                                entityType: "topic",
                                                entityId: topic.id,
                                                entityTitle: topic.title,
                                                currentSectionId: section.id,
                                                currentChapterGroupId: chapterGroup.id,
                                                subjectId: subject.id
                                              })
                                            }
                                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                                            title="Көшіру"
                                            aria-label="Көшіру"
                                          >
                                            <Copy className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => openDeleteConfirm("topic", topic.id, topic.title)}
                                            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                                          >
                                            Өшіру
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div> : null}
                                </div>
                              ))}
                            </div> : null}
                          </div>
                        ))}
                      </div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
          ) : null}

          {activePanel === "catalog" ? (
          <section className="mt-8">
            <div className="glass-card p-8 xl:col-span-2">
              <PdfImportPanel
                subjects={subjects.map((item) => ({ id: item.id, name: item.name }))}
                onImported={refreshCatalog}
              />
            </div>
          </section>
          ) : null}

          <EntityModal
            modal={modal}
            currentSubject={currentSubject}
            currentBook={currentBook}
            currentSection={currentSection}
            currentChapterGroup={currentChapterGroup}
            currentTopic={currentTopic}
            onClose={() => setModal(null)}
            actions={{
              addSubject,
              updateSubject,
              addBook,
              updateBook,
              addSection,
              updateSection,
              addChapterGroup,
              updateChapterGroup,
              addTopic,
              updateTopic
            }}
          />

          <CatalogTransferModal
            open={!!transferDialog}
            state={transferDialog}
            subjects={subjects}
            onClose={() => setTransferDialog(null)}
            onMoveSectionToBook={moveSectionToBook}
            onMoveChapterGroupToSection={moveChapterGroupToSection}
            onMoveTopicToLocation={moveTopicToLocation}
            onCopySectionToBook={copySectionToBook}
            onCopyChapterGroupToSection={copyChapterGroupToSection}
            onCopyTopicToLocation={copyTopicToLocation}
          />

          <Modal
            open={!!deleteConfirm}
            onClose={() => {
              setDeleteConfirm(null);
              setDeleteConfirmText("");
            }}
            title="Өшіруді растау"
            description="Бұл әрекет қайтарылмайды. Жалғастыру үшін төмендегі өріске РАСТАУ деп жазыңыз."
            maxWidthClassName="max-w-lg"
            bodyClassName=""
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                Өшірілетін нысан: <span className="font-semibold">{deleteConfirm?.title}</span>
              </div>
              <input
                value={deleteConfirmText}
                spellCheck={false}
                onChange={(event) => setDeleteConfirmText(event.target.value || "")}
                placeholder="РАСТАУ"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={applyDeleteConfirm}
                  disabled={deleteConfirmText.trim().toUpperCase() !== "РАСТАУ"}
                  className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Өшіруді растау
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm(null);
                    setDeleteConfirmText("");
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  Бас тарту
                </button>
              </div>
            </div>
          </Modal>
        </main>
      </div>
    </RouteGuard>
  );
}

function EntityModal({
  modal,
  currentSubject,
  currentBook,
  currentSection,
  currentChapterGroup,
  currentTopic,
  onClose,
  actions
}: {
  modal: ModalState;
  currentSubject: SubjectRecord | null;
  currentBook: BookRecord | null;
  currentSection: SectionRecord | null;
  currentChapterGroup: ChapterGroupRecord | null;
  currentTopic: TopicRecord | null;
  onClose: () => void;
  actions: EntityActions;
}) {
  const [submitError, setSubmitError] = useState("");

  if (!modal) {
    return null;
  }

  const normalizedChapterGroupId =
    "chapterGroupId" in modal && modal.chapterGroupId && isVirtualDirectChapterGroupId(modal.chapterGroupId)
      ? ""
      : "chapterGroupId" in modal
        ? modal.chapterGroupId ?? ""
        : "";

  const titleMap: Record<NonNullable<ModalState>["type"], string> = {
    "subject-create": "Пән қосу",
    "subject-edit": "Пәнді өңдеу",
    "book-create": "Кітап қосу",
    "book-edit": "Өңдеу",
    "section-create": "Бөлім қосу",
    "section-edit": "Бөлімді өңдеу",
    "chapter-group-create": "Тарау қосу",
    "chapter-group-edit": "Тарауды өңдеу",
    "topic-create": "Тақырып қосу",
    "topic-edit": "Тақырыпты өңдеу"
  };

  const descriptionMap: Record<NonNullable<ModalState>["type"], string> = {
    "subject-create": "Пән атауы мен сипаттамасын енгізіңіз.",
    "subject-edit": "Пән атауы мен сипаттамасын жаңартыңыз.",
    "book-create": "Кітап атауын, мұқаба суретін және дереккөз мәліметін енгізіңіз.",
    "book-edit": "Кітап атауын, мұқаба суретін және дереккөз мәліметін жаңартыңыз.",
    "section-create": "Бөлім атауын енгізіңіз.",
    "section-edit": "Бөлім атауын жаңартыңыз.",
    "chapter-group-create": "Тарау атауын енгізіңіз.",
    "chapter-group-edit": "Тарау атауын жаңартыңыз.",
    "topic-create": "Оқылатын тақырып мәтінін толтырыңыз.",
    "topic-edit": "Оқылатын тақырып мәтінін жаңартыңыз."
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={titleMap[modal.type]}
      description={descriptionMap[modal.type]}
      maxWidthClassName={modal.type.startsWith("topic") ? "max-w-5xl" : modal.type.startsWith("book") ? "max-w-3xl" : "max-w-2xl"}
      bodyClassName={modal.type.startsWith("topic") ? "max-h-[78vh] overflow-y-auto pr-2" : ""}
    >
      {submitError ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {submitError}
        </div>
      ) : null}

      {modal.type.startsWith("subject") ? (
        <SubjectForm
          initialName={currentSubject?.name ?? ""}
          initialDescription={currentSubject?.description ?? ""}
          onSubmit={(name, description) => {
            void (async () => {
              try {
                setSubmitError("");
                if (modal.type === "subject-edit" && currentSubject) {
                  await Promise.resolve(
                    actions.updateSubject(currentSubject.id, {
                      name: sanitizePlainText(name),
                      description: sanitizePlainText(description)
                    })
                  );
                } else {
                  await Promise.resolve(
                    actions.addSubject({
                      name: sanitizePlainText(name),
                      description: sanitizePlainText(description)
                    })
                  );
                }
                onClose();
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : "Сақтау кезінде қате пайда болды.");
              }
            })();
          }}
        />
      ) : null}

      {modal.type === "book-create" || modal.type === "book-edit" ? (
        <BookForm
          initialTitle={currentBook?.title ?? ""}
          initialCoverImage={currentBook?.coverImage ?? ""}
          initialSourceInfo={currentBook?.sourceInfo ?? ""}
          initialSourceLink={currentBook?.sourceLink ?? ""}
          initialTheme={currentBook?.theme ?? "sky"}
          initialPdfFileName={currentBook?.pdfFileName ?? ""}
          hasExistingPdf={Boolean(currentBook?.hasPdf)}
          onSubmit={(title, coverImage, sourceInfo, sourceLink, theme, pdfFileName, pdfFile) => {
            void (async () => {
              try {
                setSubmitError("");
                // Жаңа кітаптың id-ін алдын ала жасаймыз — PDF сол id-ге жүктеледі
                const bookId =
                  modal.type === "book-edit" && currentBook
                    ? currentBook.id
                    : `book-${Math.random().toString(36).slice(2, 10)}`;

                if (modal.type === "book-edit" && currentBook) {
                  await Promise.resolve(
                    actions.updateBook(currentBook.id, {
                      subjectId: modal.subjectId,
                      title: sanitizePlainText(title),
                      coverImage: coverImage.trim() || null,
                      sourceInfo: sanitizePlainText(sourceInfo).trim() || null,
                      sourceLink: sourceLink.trim() || null,
                      theme,
                      pdfFileName: pdfFileName.trim() || null
                    })
                  );
                } else {
                  await Promise.resolve(
                    actions.addBook({
                      id: bookId,
                      subjectId: modal.subjectId,
                      subjectName: currentSubject?.name,
                      title: sanitizePlainText(title),
                      coverImage: coverImage.trim() || null,
                      sourceInfo: sanitizePlainText(sourceInfo).trim() || null,
                      sourceLink: sourceLink.trim() || null,
                      theme,
                      pdfFileName: pdfFileName.trim() || null
                    })
                  );
                }

                // PDF бөлек сұраныспен, файл күйінде жүктеледі (base64 емес):
                // сондықтан ондаған мегабайттық оқулық та өтеді
                if (pdfFile) {
                  const body = new FormData();
                  body.append("file", pdfFile);
                  const response = await fetch(`/api/admin/books/${encodeURIComponent(bookId)}/pdf`, {
                    method: "POST",
                    credentials: "same-origin",
                    body
                  });

                  if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    throw new Error(payload?.error || "PDF жүктеу мүмкін болмады.");
                  }
                } else if (pdfFile === null && modal.type === "book-edit") {
                  // Әкімші «PDF-ті өшіру» дегенде файл да, жазба да тазаланады
                  await fetch(`/api/admin/books/${encodeURIComponent(bookId)}/pdf`, {
                    method: "DELETE",
                    credentials: "same-origin"
                  });
                }

                onClose();
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : "Сақтау кезінде қате пайда болды.");
              }
            })();
          }}
        />
      ) : null}

      {modal.type === "section-create" || modal.type === "section-edit" ? (
        <SimpleTitleForm
          initialTitle={currentSection?.title ?? ""}
          label="Бөлім атауы"
          onSubmit={(title) => {
            void (async () => {
              try {
                setSubmitError("");
                if (modal.type === "section-edit" && currentSection) {
                  await Promise.resolve(
                    actions.updateSection(currentSection.id, {
                      subjectId: modal.subjectId,
                      bookId: modal.bookId,
                      title: sanitizePlainText(title)
                    })
                  );
                } else {
                  await Promise.resolve(
                    actions.addSection({
                      subjectId: modal.subjectId,
                      bookId: modal.bookId,
                      title: sanitizePlainText(title)
                    })
                  );
                }
                onClose();
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : "Сақтау кезінде қате пайда болды.");
              }
            })();
          }}
        />
      ) : null}

      {modal.type === "chapter-group-create" || modal.type === "chapter-group-edit" ? (
        <SimpleTitleForm
          initialTitle={currentChapterGroup?.title ?? ""}
          label="Тарау атауы"
          onSubmit={(title) => {
            void (async () => {
              try {
                setSubmitError("");
                if (modal.type === "chapter-group-edit" && currentChapterGroup) {
                  await Promise.resolve(
                    actions.updateChapterGroup(currentChapterGroup.id, {
                      subjectId: modal.subjectId,
                      bookId: modal.bookId,
                      sectionId: modal.sectionId,
                      title: sanitizePlainText(title)
                    })
                  );
                } else {
                  await Promise.resolve(
                    actions.addChapterGroup({
                      subjectId: modal.subjectId,
                      bookId: modal.bookId,
                      sectionId: modal.sectionId,
                      title: sanitizePlainText(title)
                    })
                  );
                }
                onClose();
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : "Сақтау кезінде қате пайда болды.");
              }
            })();
          }}
        />
      ) : null}

      {modal.type === "topic-create" || modal.type === "topic-edit" ? (
        <TopicForm
          topicId={currentTopic?.id ?? ""}
          bookId={modal.bookId}
          initialTitle={currentTopic?.title ?? ""}
          initialExcerpt={currentTopic?.excerpt ?? ""}
          initialContent={currentTopic?.content ?? ""}
          initialPdfPage={currentTopic?.pdfPage ?? null}
          originalTitle={currentTopic?.originalTitle ?? currentTopic?.title ?? ""}
          originalExcerpt={currentTopic?.originalExcerpt ?? currentTopic?.excerpt ?? ""}
          originalContent={currentTopic?.originalContent ?? currentTopic?.content ?? ""}
          lastSavedAt={currentTopic?.lastSavedAt ?? ""}
          isEditing={modal.type === "topic-edit"}
          onSubmit={(title, excerpt, content, pdfPage) => {
            void (async () => {
              try {
                setSubmitError("");
                if (modal.type === "topic-edit" && currentTopic) {
                  await Promise.resolve(
                    actions.updateTopic(currentTopic.id, {
                      subjectId: modal.subjectId,
                      bookId: modal.bookId,
                      sectionId: modal.sectionId,
                      chapterGroupId: normalizedChapterGroupId,
                      title: sanitizePlainText(title),
                      excerpt: sanitizePlainText(excerpt),
                      content: sanitizeRichText(content),
                      pdfPage
                    })
                  );
                } else {
                  await Promise.resolve(
                    actions.addTopic({
                      subjectId: modal.subjectId,
                      bookId: modal.bookId,
                      sectionId: modal.sectionId,
                      chapterGroupId: normalizedChapterGroupId,
                      title: sanitizePlainText(title),
                      excerpt: sanitizePlainText(excerpt),
                      content: sanitizeRichText(content),
                      pdfPage
                    })
                  );
                }
                onClose();
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : "Сақтау кезінде қате пайда болды.");
              }
            })();
          }}
        />
      ) : null}
    </Modal>
  );
}

function SubjectForm({
  initialName,
  initialDescription,
  onSubmit
}: {
  initialName: string;
  initialDescription: string;
  onSubmit: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(initialName || "");
  const [description, setDescription] = useState(initialDescription || "");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(name.trim(), description.trim());
      }}
    >
      <input
        value={name}
        spellCheck={false}
        onChange={(event) => setName(event.target.value || "")}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
        placeholder="Пән атауы"
      />
      <textarea
        value={description}
        spellCheck={false}
        onChange={(event) => setDescription(event.target.value || "")}
        rows={4}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none dark:border-zinc-800 dark:bg-zinc-950"
        placeholder="Сипаттамасы"
      />
      <button type="submit" className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-medium text-white">
        Сақтау
      </button>
    </form>
  );
}

function SimpleTitleForm({
  initialTitle,
  label,
  onSubmit
}: {
  initialTitle: string;
  label: string;
  onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle || "");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(title.trim());
      }}
    >
      <input
        value={title}
        spellCheck={false}
        onChange={(event) => setTitle(event.target.value || "")}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
        placeholder={label}
      />
      <button type="submit" className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-medium text-white">
        Сақтау
      </button>
    </form>
  );
}

function BookForm({
  initialTitle,
  initialCoverImage,
  initialSourceInfo,
  initialSourceLink,
  initialTheme,
  initialPdfFileName,
  hasExistingPdf,
  onSubmit
}: {
  initialTitle: string;
  initialCoverImage: string;
  initialSourceInfo: string;
  initialSourceLink: string;
  initialTheme: string;
  initialPdfFileName: string;
  hasExistingPdf: boolean;
  onSubmit: (
    title: string,
    coverImage: string,
    sourceInfo: string,
    sourceLink: string,
    theme: string,
    pdfFileName: string,
    pdfFile: File | null | undefined
  ) => void;
}) {
  const [title, setTitle] = useState(initialTitle || "");
  const [coverImage, setCoverImage] = useState(initialCoverImage || "");
  const [sourceInfo, setSourceInfo] = useState(initialSourceInfo || "");
  const [sourceLink, setSourceLink] = useState(initialSourceLink || "");
  const [theme, setTheme] = useState(initialTheme || "sky");
  const [pdfFileName, setPdfFileName] = useState(initialPdfFileName || "");
  // Файл base64 болып мәтінге айналмайды: ол бөлек сұраныспен дискіге жүктеледі
  const [pdfFile, setPdfFile] = useState<File | null | undefined>(undefined);
  const [hasPdf, setHasPdf] = useState(hasExistingPdf);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCoverImage(reader.result || "");
      }
    };
    reader.readAsDataURL(file);
  }

  function handlePdfFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPdfFile(file);
    setPdfFileName(file.name || "original.pdf");
    setHasPdf(true);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(
          title.trim(),
          coverImage.trim(),
          sourceInfo.trim(),
          sourceLink.trim(),
          theme,
          pdfFileName.trim(),
          pdfFile
        );
      }}
    >
      <input
        value={title}
        spellCheck={false}
        onChange={(event) => setTitle(event.target.value || "")}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
        placeholder="Кітап атауы"
      />
      <input
        value={coverImage}
        spellCheck={false}
        onChange={(event) => setCoverImage(event.target.value || "")}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
        placeholder="Мұқаба суретінің сілтемесі"
      />
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
      />
      {coverImage ? <img src={coverImage} alt="Мұқаба көрінісі" className="h-44 w-full rounded-xl object-cover" /> : null}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">Дереккөз / Баспа (Издательство, год)</p>
        <input
          value={sourceInfo}
          spellCheck={false}
          onChange={(event) => setSourceInfo(event.target.value || "")}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="Мысалы: Атамұра баспасы, 2024 ж."
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-zinc-200">Ресми сілтеме (необязательно)</p>
        <input
          value={sourceLink}
          spellCheck={false}
          onChange={(event) => setSourceLink(event.target.value || "")}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="https://..."
        />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Кітап темасы</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { value: "basic", style: "linear-gradient(135deg,#f8fafc,#e2e8f0)" },
            { value: "sky", style: "linear-gradient(135deg,#38bdf8,#0ea5e9)" },
            { value: "emerald", style: "linear-gradient(135deg,#34d399,#059669)" },
            { value: "amber", style: "linear-gradient(135deg,#fbbf24,#d97706)" },
            { value: "rose", style: "linear-gradient(135deg,#fb7185,#be123c)" },
            { value: "violet", style: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
            { value: "slate", style: "linear-gradient(135deg,#94a3b8,#334155)" }
          ].map((item, index) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTheme(item.value)}
              className={`h-11 w-11 rounded-full border transition hover:scale-105 ${
                theme === item.value ? "border-slate-950 ring-4 ring-sky-200 dark:border-zinc-50 dark:ring-cyan-500/20" : "border-white/80 dark:border-zinc-700"
              }`}
              style={{ background: item.style }}
              aria-label={`Кітап темасы ${index + 1}`}
              title={`Кітап темасы ${index + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Кітаптың оригинал PDF нұсқасы</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Оқушы кітапты оқып отырып, осы оригинал PDF файлын бөлек аша алады.
        </p>
        <input
          type="file"
          accept="application/pdf"
          onChange={handlePdfFileChange}
          className="mt-3 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        />
        {hasPdf ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 dark:bg-zinc-900 dark:text-zinc-200">
            <span className="font-medium">{pdfFileName || "PDF файл жүктелген"}</span>
            <button
              type="button"
              onClick={() => {
                // null — «өшір» дегенді білдіреді (undefined — «өзгеріссіз»)
                setPdfFile(null);
                setPdfFileName("");
                setHasPdf(false);
              }}
              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              PDF-ті өшіру
            </button>
          </div>
        ) : null}
      </div>
      <button type="submit" className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-medium text-white">
        Сақтау
      </button>
    </form>
  );
}

function formatSavedTime(value: string) {
  if (!value) {
    return "уақыты белгісіз";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "уақыты белгісіз";
  }

  return date.toLocaleString("kk-KZ", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function TopicForm({
  topicId,
  bookId,
  initialTitle,
  initialExcerpt,
  initialContent,
  initialPdfPage,
  originalTitle,
  originalExcerpt,
  originalContent,
  lastSavedAt,
  isEditing,
  onSubmit
}: {
  topicId: string;
  bookId: string;
  initialTitle: string;
  initialExcerpt: string;
  initialContent: string;
  initialPdfPage: number | null;
  originalTitle: string;
  originalExcerpt: string;
  originalContent: string;
  lastSavedAt: string;
  isEditing: boolean;
  onSubmit: (title: string, excerpt: string, content: string, pdfPage: number | null) => void;
}) {
  const [title, setTitle] = useState(initialTitle || "");
  const [excerpt, setExcerpt] = useState(initialExcerpt || "");
  const [content, setContent] = useState(initialContent || "");
  const [pdfPage, setPdfPage] = useState(initialPdfPage ? String(initialPdfPage) : "");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const editorRef = useRef<ChapterEditorHandle | null>(null);

  // Каталог клиентке мәтінсіз жүктелуі мүмкін (навигация нұсқасы), сондықтан
  // түзетуге ашылған тақырыптың толық мәтінін серверден бөлек аламыз.
  useEffect(() => {
    if (!isEditing || !topicId) {
      return;
    }

    let cancelled = false;
    setIsContentLoading(true);

    void fetch(`/api/admin/topics/${encodeURIComponent(topicId)}`, { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { topic?: { content?: string } } | null) => {
        if (cancelled || !payload?.topic) {
          return;
        }
        const loaded = typeof payload.topic.content === "string" ? payload.topic.content : "";
        if (loaded) {
          setContent(loaded);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsContentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEditing, topicId]);

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const latestContent = editorRef.current?.flush() || content || "";
          const normalizedPdfPage = pdfPage.trim() ? Math.max(1, Number(pdfPage) || 1) : null;
          setContent(latestContent);
          onSubmit(title.trim(), excerpt.trim(), latestContent, normalizedPdfPage);
        }}
      >
        <input
          value={title}
          spellCheck={false}
          onChange={(event) => setTitle(event.target.value || "")}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="Тақырып атауы"
        />
        <input
          value={excerpt}
          spellCheck={false}
          onChange={(event) => setExcerpt(event.target.value || "")}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="Қысқаша сипаттама"
        />
        <input
          value={pdfPage}
          spellCheck={false}
          inputMode="numeric"
          onChange={(event) => setPdfPage(event.target.value.replace(/[^\d]/g, ""))}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-950"
          placeholder="Оригинал PDF ішіндегі бет нөмірі, мысалы: 24"
        />

        {isEditing ? (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  Ең соңғы сақталған нұсқаға қайтару
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  Соңғы сақталған уақыт: {formatSavedTime(lastSavedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTitle(initialTitle || "");
                    setExcerpt(initialExcerpt || "");
                    setContent(initialContent || "");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  <RotateCcw className="h-4 w-4" />
                  Ең соңғы сақталған нұсқаға қайтару
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle(originalTitle || "");
                    setExcerpt(originalExcerpt || "");
                    setContent(originalContent || "");
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  Бастапқы нұсқаға қайтару
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <ChapterEditor ref={editorRef} value={content || ""} onChange={(nextValue) => setContent(nextValue || "")} />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
          >
            <Eye className="h-4 w-4" />
            Көру
          </button>
          {isEditing && bookId && topicId ? (
            <a
              href={`/books/${encodeURIComponent(bookId)}/chapters/${encodeURIComponent(topicId)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200"
            >
              <BookOpen className="h-4 w-4" />
              Кітап түрінде ашып өңдеу
            </a>
          ) : null}
          <button type="submit" className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-medium text-white">
            Тақырыпты сақтау
          </button>
        </div>
      </form>

      <Modal
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Оқушыға көрінетін алдын ала нұсқа"
        description="Бұл көрініс әлі сақталмайды. Тек тақырыптың оқушы бетінде қалай шығатынын тексеруге арналған."
        maxWidthClassName="max-w-5xl"
        bodyClassName="max-h-[78vh] overflow-y-auto pr-2"
      >
        <div className="space-y-6">
          <div className="border-b border-slate-200/80 pb-6 dark:border-zinc-800">
            <p className="text-sm uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Алдын ала көру</p>
            <h3 className="mt-3 text-4xl font-semibold text-slate-900 dark:text-zinc-50">
              {title || "Тақырып атауы"}
            </h3>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-zinc-400">
              {excerpt || "Қысқаша сипаттама әлі енгізілген жоқ."}
            </p>
          </div>

          <article className="relative flow-root overflow-hidden rounded-panel border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <ContentRenderer
              content={content || "<p>Мәтін әлі енгізілген жоқ.</p>"}
              activeParagraphId={null}
              focusParagraphId={null}
              highlights={[]}
              onSelectParagraph={() => undefined}
              onSelectHighlight={() => undefined}
            />
          </article>
        </div>
      </Modal>
    </>
  );
}


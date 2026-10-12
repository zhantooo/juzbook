"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  Pencil,
  ScrollText,
  Trash2
} from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { NoteHtml } from "@/components/notes/note-html";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { PageIntro } from "@/components/ui/page-intro";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import type { SummaryRecord } from "@/lib/types";

const SummaryEditModal = dynamic(
  () => import("@/components/notes/summary-edit-modal").then((module) => module.SummaryEditModal),
  { ssr: false }
);

type ChapterGroup = {
  chapterId: string;
  chapterTitle: string;
  notes: SummaryRecord[];
};

type BookGroup = {
  bookId: string;
  bookTitle: string;
  subjectName: string;
  chapters: ChapterGroup[];
};

export function NotesPage() {
  const { summaries, moveSummary, removeSummary, updateSummary } = useAuth();
  const [activeSubject, setActiveSubject] = useState("");
  const [editingSummary, setEditingSummary] = useState<SummaryRecord | null>(null);
  const [selectedSummaryId, setSelectedSummaryId] = useState("");
  const [openBooks, setOpenBooks] = useState<string[]>([]);
  const [openChapters, setOpenChapters] = useState<string[]>([]);

  const subjectTabs = useMemo(() => {
    const unique = new Map<string, string>();
    summaries.forEach((summary) => {
      unique.set(summary.subjectId, summary.subjectName);
    });

    return Array.from(unique, ([id, name]) => ({ id, name }));
  }, [summaries]);

  const filteredSummaries = useMemo(
    () => summaries.filter((summary) => !activeSubject || summary.subjectId === activeSubject),
    [activeSubject, summaries]
  );

  const grouped = useMemo<BookGroup[]>(() => {
    const books = new Map<
      string,
      {
        bookId: string;
        bookTitle: string;
        subjectName: string;
        chapters: Map<string, ChapterGroup>;
      }
    >();

    filteredSummaries.forEach((summary) => {
      if (!books.has(summary.bookId)) {
        books.set(summary.bookId, {
          bookId: summary.bookId,
          bookTitle: summary.bookTitle,
          subjectName: summary.subjectName,
          chapters: new Map()
        });
      }

      const book = books.get(summary.bookId)!;
      if (!book.chapters.has(summary.chapterId)) {
        book.chapters.set(summary.chapterId, {
          chapterId: summary.chapterId,
          chapterTitle: summary.chapterTitle,
          notes: []
        });
      }

      book.chapters.get(summary.chapterId)!.notes.push(summary);
    });

    return Array.from(books.values()).map((book) => ({
      bookId: book.bookId,
      bookTitle: book.bookTitle,
      subjectName: book.subjectName,
      chapters: Array.from(book.chapters.values())
    }));
  }, [filteredSummaries]);

  const selectedSummary = useMemo(
    () => filteredSummaries.find((summary) => summary.id === selectedSummaryId) ?? filteredSummaries[0] ?? null,
    [filteredSummaries, selectedSummaryId]
  );

  useEffect(() => {
    if (!subjectTabs.length) {
      if (activeSubject) {
        setActiveSubject("");
      }
      return;
    }

    if (!activeSubject || !subjectTabs.some((tab) => tab.id === activeSubject)) {
      setActiveSubject(subjectTabs[0].id);
    }
  }, [activeSubject, subjectTabs]);

  useEffect(() => {
    if (!selectedSummary) {
      setSelectedSummaryId("");
      return;
    }

    setSelectedSummaryId(selectedSummary.id);
    setOpenBooks((current) =>
      current.includes(selectedSummary.bookId) ? current : [...current, selectedSummary.bookId]
    );
    setOpenChapters((current) =>
      current.includes(selectedSummary.chapterId) ? current : [...current, selectedSummary.chapterId]
    );
  }, [selectedSummary?.bookId, selectedSummary?.chapterId, selectedSummary?.id]);

  function toggleBook(bookId: string) {
    setOpenBooks((current) => (current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId]));
  }

  function toggleChapter(chapterId: string) {
    setOpenChapters((current) =>
      current.includes(chapterId) ? current.filter((id) => id !== chapterId) : [...current, chapterId]
    );
  }

  return (
    <RouteGuard role="USER">
      <div className="page-shell">
        <SummaryEditModal
          summary={editingSummary}
          onClose={() => setEditingSummary(null)}
          onSave={(payload) => {
            if (!editingSummary) {
              return;
            }

            updateSummary(editingSummary.id, payload);
            setEditingSummary(null);
          }}
        />

        <SiteHeader />

        <main id="juz-main" className="page-width py-10">
          <PageIntro
            eyebrow="Конспект"
            title="Менің"
            accent="конспекттерім"
            description="Конспект тізімі сол жақта беріледі. Қай жазбаны таңдасаңыз, оның толық мәтіні орталық бөлікте кітап оқитын бет секілді жайлы форматта ашылады."
          />

          <Reveal distance={44} blur={7} scale>
          <section className="glass-card mt-6 p-8">
            <div className="mt-6 flex flex-wrap gap-3">
              {subjectTabs.map((tab) => {
                const active = tab.id === activeSubject;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSubject(tab.id)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "bg-sky-700 text-white dark:bg-cyan-400 dark:text-zinc-950"
                        : "border border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </section>
          </Reveal>
          <section className="mt-8">
            {summaries.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="Конспекттер әлі жоқ"
                description="Кез келген тарауда конспект сақтасаңыз, ол осы бетте автоматты түрде көрінеді."
              />
            ) : !activeSubject || grouped.length === 0 || !selectedSummary ? (
              <EmptyState
                icon={ScrollText}
                title="Бұл пән бойынша конспект табылмады"
                description="Басқа пәнді таңдаңыз немесе жаңа конспект жазып сақтап көріңіз."
              />
            ) : (
              <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="glass-card h-fit p-5 xl:sticky xl:top-24">
                  <div className="flex items-center gap-2">
                    <BookOpenText className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
                    <h2 className="text-2xl font-semibold">Конспект тізімі</h2>
                  </div>

                  <div className="mt-5 space-y-3">
                    {grouped.map((book) => {
                      const isBookOpen = openBooks.includes(book.bookId);

                      return (
                        <div key={book.bookId} className="rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                          <button
                            type="button"
                            onClick={() => toggleBook(book.bookId)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{book.bookTitle}</p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{book.chapters.length} тарау</p>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition ${isBookOpen ? "rotate-180" : ""}`} />
                          </button>

                          {isBookOpen ? (
                            <div className="border-t border-slate-200/80 px-3 py-3 dark:border-zinc-800">
                              <div className="space-y-2">
                                {book.chapters.map((chapter) => {
                                  const isChapterOpen = openChapters.includes(chapter.chapterId);

                                  return (
                                    <div key={chapter.chapterId} className="rounded-xl bg-slate-50 p-2 dark:bg-zinc-950/60">
                                      <button
                                        type="button"
                                        onClick={() => toggleChapter(chapter.chapterId)}
                                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{chapter.chapterTitle}</p>
                                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{chapter.notes.length} жазба</p>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition ${isChapterOpen ? "rotate-90" : ""}`} />
                                      </button>

                                      {isChapterOpen ? (
                                        <div className="space-y-2 px-2 pb-2">
                                          {chapter.notes.map((summary) => {
                                            const isSelected = selectedSummary.id === summary.id;

                                            return (
                                              <div
                                                key={summary.id}
                                                className={`rounded-xl border transition ${
                                                  isSelected
                                                    ? "border-sky-300 bg-sky-50 text-sky-900 dark:border-cyan-400/50 dark:bg-cyan-500/10 dark:text-cyan-100"
                                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
                                                }`}
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => setSelectedSummaryId(summary.id)}
                                                  className="w-full px-3 py-3 text-left"
                                                >
                                                  <p className="text-sm font-semibold">{summary.title}</p>
                                                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                                    {new Date(summary.updatedAt).toLocaleDateString("kk-KZ")}
                                                  </p>
                                                </button>
                                                <div className="flex gap-2 border-t border-slate-200/70 px-3 py-2 dark:border-zinc-800">
                                                  <button
                                                    type="button"
                                                    onClick={() => moveSummary(summary.id, "up")}
                                                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                                                    title="Конспектіні жоғары жылжыту"
                                                  >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                    Жоғары
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => moveSummary(summary.id, "down")}
                                                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                                                    title="Конспектіні төмен жылжыту"
                                                  >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                    Төмен
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <div className="glass-card min-h-[720px] p-6 md:p-8">
                  <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 dark:border-zinc-800">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">
                          {selectedSummary.subjectName}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-zinc-50">
                          {selectedSummary.title}
                        </h2>
                        <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
                          {selectedSummary.bookTitle} • {selectedSummary.chapterTitle}
                        </p>
                        <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">
                          Соңғы өзгеріс: {new Date(selectedSummary.updatedAt).toLocaleString("kk-KZ")}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/subjects/${selectedSummary.subjectId}`}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
                        >
                          Пәнге өту
                        </Link>
                        <Link
                          href={`/books/${selectedSummary.bookId}/chapters/${selectedSummary.chapterId}`}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
                        >
                          Тарауға өту
                        </Link>
                        <button
                          type="button"
                          onClick={() => moveSummary(selectedSummary.id, "up")}
                          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
                          aria-label="Конспектті жоғары жылжыту"
                          title="Конспектті жоғары жылжыту"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSummary(selectedSummary.id, "down")}
                          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
                          aria-label="Конспектті төмен жылжыту"
                          title="Конспектті төмен жылжыту"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSummary(selectedSummary)}
                          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
                          aria-label="Конспектті өңдеу"
                          title="Конспектті өңдеу"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSummary(selectedSummary.id)}
                          className="rounded-full border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          aria-label="Конспектті өшіру"
                          title="Конспектті өшіру"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <article className="mx-auto mt-8 w-full max-w-4xl">
                    <div className="rounded-panel border border-slate-200/80 bg-white px-6 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 md:px-10 md:py-10">
                      <NoteHtml html={selectedSummary.content} className="w-full max-w-none text-base leading-8" />
                    </div>
                  </article>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </RouteGuard>
  );
}

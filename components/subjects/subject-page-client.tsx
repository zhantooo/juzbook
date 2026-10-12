"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  ChevronsUp,
  Eye,
  EyeOff,
  Highlighter,
  ListOrdered,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Trash2,
  Undo2
} from "lucide-react";
import { SpecificationBrowser } from "@/components/specifications/specification-browser";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { SiteHeader } from "@/components/site/site-header";
import { fillBookChapters, findSubjectById, getFirstChapter } from "@/lib/catalog-utils";
import type { SubjectRecord } from "@/lib/types";

type CatalogBook = SubjectRecord["books"][number];

const bookThemes = {
  sky: { enabled: true, accent: "#0284c7", soft: "rgba(14, 165, 233, 0.1)", border: "rgba(14, 165, 233, 0.32)", glow: "rgba(14, 165, 233, 0.24)" },
  emerald: { enabled: true, accent: "#059669", soft: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.34)", glow: "rgba(16, 185, 129, 0.28)" },
  amber: { enabled: true, accent: "#b45309", soft: "rgba(245, 158, 11, 0.14)", border: "rgba(245, 158, 11, 0.34)", glow: "rgba(245, 158, 11, 0.26)" },
  rose: { enabled: true, accent: "#be123c", soft: "rgba(244, 63, 94, 0.1)", border: "rgba(244, 63, 94, 0.32)", glow: "rgba(244, 63, 94, 0.22)" },
  violet: { enabled: true, accent: "#7c3aed", soft: "rgba(139, 92, 246, 0.1)", border: "rgba(139, 92, 246, 0.32)", glow: "rgba(139, 92, 246, 0.22)" },
  slate: { enabled: true, accent: "#475569", soft: "rgba(100, 116, 139, 0.1)", border: "rgba(100, 116, 139, 0.32)", glow: "rgba(100, 116, 139, 0.22)" },
  basic: { enabled: false, accent: "#0284c7", soft: "rgba(14, 165, 233, 0.08)", border: "rgba(226, 232, 240, 0.9)", glow: "transparent" }
} as const;

function getBookTheme(theme?: string | null) {
  return bookThemes[(theme || "sky") as keyof typeof bookThemes] ?? bookThemes.sky;
}

function getSwatchStyle(color: string) {
  return { backgroundColor: color };
}

/** Оқушы сақтаған ретті қолданады; жаңа қосылған кітаптар соңына түседі */
function orderBooks(books: CatalogBook[], order: string[]) {
  const byId = new Map(books.map((book) => [book.id, book]));
  const seen = new Set<string>();
  const result: CatalogBook[] = [];

  for (const id of order) {
    const book = byId.get(id);
    if (book && !seen.has(id)) {
      result.push(book);
      seen.add(id);
    }
  }

  for (const book of books) {
    if (!seen.has(book.id)) {
      result.push(book);
    }
  }

  return result;
}

const controlButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300";

export function SubjectPageClient({ subjectId, initialSubject }: { subjectId: string; initialSubject?: SubjectRecord | null }) {
  const { subjects, isReady } = useCatalog();
  const {
    continueReadingSettings,
    lastReads,
    completedChapters,
    highlights,
    removeHighlight,
    session,
    bookPreferences,
    saveBookPreference
  } = useAuth();
  const [showHighlights, setShowHighlights] = useState(true);
  const [openBooks, setOpenBooks] = useState<string[]>([]);
  const [isEditingBooks, setIsEditingBooks] = useState(false);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [draftHidden, setDraftHidden] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);
  const noticeTimerRef = useRef<number | null>(null);

  // Сервер берген навигация деректерінде кітаптың жалпақ `chapters` тізімі бос —
  // каталог контексі дайын болғанша оны бөлімдерден құрап аламыз.
  const hydratedInitialSubject = useMemo(
    () =>
      initialSubject
        ? { ...initialSubject, books: initialSubject.books.map(fillBookChapters) }
        : null,
    [initialSubject]
  );
  const catalogSubjects = subjects.length ? subjects : hydratedInitialSubject ? [hydratedInitialSubject] : [];
  const subject = findSubjectById(catalogSubjects, subjectId) ?? hydratedInitialSubject ?? null;
  // Кітап немесе тақырып өшірілген болса, ескі жазба «бет табылмады» бетіне
  // апарады — сондықтан каталогта әлі бар тақырыпты ғана көрсетеміз.
  const lastRead = lastReads.find((item) => {
    if (item.subjectId !== subjectId) {
      return false;
    }

    const book = subject?.books.find((entry) => entry.id === item.bookId);
    return Boolean(book?.chapters.some((topic) => topic.id === item.chapterId));
  });

  const preference = bookPreferences[subjectId];
  const orderedBooks = useMemo(() => orderBooks(subject?.books ?? [], preference?.order ?? []), [subject, preference]);
  const hiddenIds = useMemo(
    () => new Set((preference?.hidden ?? []).filter((id) => subject?.books.some((book) => book.id === id))),
    [preference, subject]
  );
  const booksById = useMemo(() => new Map((subject?.books ?? []).map((book) => [book.id, book])), [subject]);
  const hiddenCount = orderedBooks.filter((book) => hiddenIds.has(book.id)).length;

  const displayedBooks = isEditingBooks
    ? draftOrder.map((id) => booksById.get(id)).filter((book): book is CatalogBook => Boolean(book))
    : orderedBooks.filter((book) => !hiddenIds.has(book.id));

  const groupedHighlights = useMemo(() => {
    if (!subject) {
      return [];
    }

    return subject.books
      .map((book) => {
        const items = highlights
          .filter((item) => item.subjectId === subjectId && item.bookId === book.id)
          .map((item) => {
            const topic = book.chapters.find((entry) => entry.id === item.chapterId);
            return {
              ...item,
              chapterTitle: topic?.title ?? "Тақырып",
              bookTitle: book.title
            };
          });

        return {
          bookId: book.id,
          bookTitle: book.title,
          items
        };
      })
      .filter((group) => group.items.length > 0);
  }, [highlights, subject, subjectId]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  function toggleBook(bookId: string) {
    setOpenBooks((current) =>
      current.includes(bookId) ? current.filter((item) => item !== bookId) : [...current, bookId]
    );
  }

  function startEditingBooks() {
    setDraftOrder(orderedBooks.map((book) => book.id));
    setDraftHidden(Array.from(hiddenIds));
    setSavedNotice(false);
    setIsEditingBooks(true);
  }

  function moveBook(bookId: string, delta: number) {
    setDraftOrder((current) => {
      const index = current.indexOf(bookId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveBookToTop(bookId: string) {
    setDraftOrder((current) => [bookId, ...current.filter((id) => id !== bookId)]);
  }

  function toggleBookHidden(bookId: string) {
    setDraftHidden((current) =>
      current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId]
    );
  }

  function resetBooksToDefault() {
    setDraftOrder((subject?.books ?? []).map((book) => book.id));
    setDraftHidden([]);
  }

  function saveBooks() {
    saveBookPreference(subjectId, { order: draftOrder, hidden: draftHidden });
    setIsEditingBooks(false);
    setSavedNotice(true);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setSavedNotice(false), 2800);
  }

  if (!isReady && !initialSubject) {
    return null;
  }

  // Кітаптар реті тек аккаунтқа кірген оқушыға арналған
  const orderControls = session ? (
    <div className="glass-card h-fit p-5">
      <div className="flex items-center gap-2">
        <ListOrdered className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
        <h2 className="text-xl font-semibold">Менің кітаптарым</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
        Кітаптардың ретін өзгертіп, керек емесін жасыра аласыз. Баптау тек сіздің аккаунтыңызда сақталады.
      </p>

      {isEditingBooks ? (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={saveBooks}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
          >
            <Save className="h-4 w-4" />
            Сақтау
          </button>
          <button
            type="button"
            onClick={() => setIsEditingBooks(false)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <Undo2 className="h-4 w-4" />
            Болдырмау
          </button>
          <button
            type="button"
            onClick={resetBooksToDefault}
            className="mt-1 text-xs font-semibold text-slate-500 underline-offset-4 hover:text-sky-700 hover:underline dark:text-zinc-400 dark:hover:text-cyan-300"
          >
            Бастапқы ретке қайтару
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={startEditingBooks}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
          >
            <ListOrdered className="h-4 w-4" />
            Реттілікті өзгерту
          </button>
          {hiddenCount ? (
            <p className="text-xs leading-5 text-slate-500 dark:text-zinc-400">
              {hiddenCount} кітап жасырылған. Қайта көрсету үшін «Реттілікті өзгерту» басыңыз.
            </p>
          ) : null}
          {savedNotice ? (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">✓ Реттілік сақталды</p>
          ) : null}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="page-shell">
      <div className="page-glow">
        <div className="glow-drift-a absolute left-[-8rem] top-10 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl dark:bg-cyan-500/10" />
        <div className="glow-drift-b absolute bottom-10 right-[-6rem] h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl dark:bg-sky-500/12" />
      </div>
      <SiteHeader />

      <main id="juz-main" className="page-width py-10">
        {!subject ? (
          <div className="glass-card p-8">Пән табылмады.</div>
        ) : (
          <>
            <div className="glass-card p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="intro-mask">
                    <p className="hero-line flex items-center gap-3 text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
                      <span className="hero-rule inline-block h-[2px] w-8 bg-sky-600 dark:bg-cyan-400" style={{ animationDelay: "0.2s" }} />
                      Пән
                    </p>
                  </div>
                  <h1 className="intro-mask mt-4 text-5xl font-semibold">
                    <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>{subject.name}</span>
                  </h1>
                  <p className="hero-line mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-zinc-400" style={{ animationDelay: "0.4s" }}>
                    {subject.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHighlights((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  {showHighlights ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  {showHighlights ? "Маркерлер панелін жасыру" : "Маркерлер панелін ашу"}
                </button>
              </div>
            </div>

            {continueReadingSettings.enabled && lastRead ? (
              <div className="mt-6 glass-card p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Соңғы оқыған жерден жалғастырасыз ба?</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">{lastRead.chapterTitle}</p>
                  </div>
                  <Link
                    href={
                      session
                        ? `/books/${lastRead.bookId}/chapters/${lastRead.chapterId}?subject=${lastRead.subjectId}`
                        : `/login?redirect=/books/${lastRead.bookId}/chapters/${lastRead.chapterId}?subject=${lastRead.subjectId}`
                    }
                    className="rounded-full bg-sky-700 px-5 py-3 text-sm font-medium text-white dark:bg-cyan-400 dark:text-zinc-950"
                  >
                    Жалғастыру
                  </Link>
                </div>
              </div>
            ) : null}

            <SpecificationBrowser
              subjects={[subject]}
              initialSubjectId={subject.id}
              collapsible
              defaultCollapsed
              hideSubjectPicker
            />

            <div className={`mt-8 grid gap-6 ${showHighlights ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
              <div className="grid content-start gap-4">
                {!showHighlights ? orderControls : null}

                {isEditingBooks ? (
                  <div className="sticky top-24 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/95 px-4 py-3 text-sm text-sky-800 shadow-sm backdrop-blur dark:border-cyan-500/30 dark:bg-zinc-900/95 dark:text-cyan-200">
                    <span>
                      Реттілік режимі: ↑ ↓ арқылы ауыстырыңыз, көз белгісімен жасырыңыз. Өзгеріс «Сақтау» басылғанда ғана
                      сақталады.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingBooks(false)}
                        className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        Болдырмау
                      </button>
                      <button
                        type="button"
                        onClick={saveBooks}
                        className="inline-flex items-center gap-1.5 rounded-full bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white dark:bg-cyan-400 dark:text-zinc-950"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Сақтау
                      </button>
                    </div>
                  </div>
                ) : null}

                {!isEditingBooks && displayedBooks.length === 0 && (subject.books.length ?? 0) > 0 ? (
                  <div className="glass-card p-8 text-center text-sm text-slate-600 dark:text-zinc-400">
                    Бұл пәндегі барлық кітапты жасырғансыз.
                    {session ? (
                      <button
                        type="button"
                        onClick={startEditingBooks}
                        className="ml-2 font-semibold text-sky-700 underline-offset-4 hover:underline dark:text-cyan-300"
                      >
                        Қайта көрсету
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {displayedBooks.map((book, index) => {
                  const firstTopic = getFirstChapter(book);
                  const href = firstTopic
                    ? session
                      ? `/books/${book.id}/chapters/${firstTopic.id}?subject=${subject.id}`
                      : `/login?redirect=/books/${book.id}/chapters/${firstTopic.id}?subject=${subject.id}`
                    : "#";
                  const completed = book.chapters.filter((chapter) =>
                    completedChapters.some((item) => item.chapterId === chapter.id)
                  ).length;
                  const percent = book.chapters.length ? Math.round((completed / book.chapters.length) * 100) : 0;
                  const bookHighlights = groupedHighlights.find((item) => item.bookId === book.id)?.items.length ?? 0;
                  const theme = getBookTheme(book.theme);
                  const isHidden = isEditingBooks && draftHidden.includes(book.id);

                  const decoration = theme.enabled ? (
                    <>
                      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full blur-3xl" style={{ background: theme.glow }} />
                      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-1 rounded-full opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} />
                    </>
                  ) : null;

                  const info = (
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950">
                        {book.coverImage ? (
                          <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" />
                        ) : (
                          <span className="px-3 text-center text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500">
                            Мұқаба
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-[0.12em]" style={{ background: theme.soft, color: theme.accent }}>
                            <BookOpenText className="h-4 w-4" />
                            Кітап
                          </div>
                          {isHidden ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                              <EyeOff className="h-3.5 w-3.5" />
                              Жасырылған
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-4 text-3xl font-semibold">{book.title}</h2>
                        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
                          Ішінде {book.sections.length} бөлім, {book.chapters.length} тақырып бар. Бұл кітапта {bookHighlights} маркер сақталған.
                        </p>
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span>Кітап ішіндегі прогресс</span>
                            <span style={{ color: theme.accent }}>{percent}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-zinc-800">
                            <div className="h-2 rounded-full" style={{ width: `${percent}%`, background: theme.accent }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  if (isEditingBooks) {
                    const isFirst = index === 0;
                    const isLast = index === displayedBooks.length - 1;

                    return (
                      <div
                        key={book.id}
                        className={`glass-card relative block overflow-hidden p-6 transition ${isHidden ? "opacity-55" : ""}`}
                        style={{ borderColor: theme.border }}
                      >
                        {decoration}
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          {info}
                          <div className="relative z-10 flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => moveBookToTop(book.id)}
                              disabled={isFirst}
                              className={controlButtonClass}
                              title="Ең үстіне шығару"
                              aria-label={`«${book.title}» кітабын ең үстіне шығару`}
                            >
                              <ChevronsUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBook(book.id, -1)}
                              disabled={isFirst}
                              className={controlButtonClass}
                              title="Жоғары"
                              aria-label={`«${book.title}» кітабын жоғары жылжыту`}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBook(book.id, 1)}
                              disabled={isLast}
                              className={controlButtonClass}
                              title="Төмен"
                              aria-label={`«${book.title}» кітабын төмен жылжыту`}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleBookHidden(book.id)}
                              className={`${controlButtonClass} ${isHidden ? "border-amber-300 text-amber-600 dark:border-amber-500/40 dark:text-amber-300" : ""}`}
                              title={isHidden ? "Көрсету" : "Жасыру"}
                              aria-label={`«${book.title}» кітабын ${isHidden ? "көрсету" : "жасыру"}`}
                              aria-pressed={isHidden}
                            >
                              {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={book.id}
                      href={href}
                      className="glass-card group relative block overflow-hidden p-6 transition hover:-translate-y-0.5"
                      style={{ borderColor: theme.border }}
                    >
                      {decoration}
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        {info}
                        <div className="inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium transition group-hover:gap-3" style={{ borderColor: theme.border, background: theme.soft, color: theme.accent }}>
                          Кітапты оқу
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {showHighlights ? (
                <div className="grid h-fit gap-4">
                  {orderControls}

                  <aside className="glass-card h-fit p-5">
                    <div className="flex items-center gap-2">
                      <Highlighter className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
                      <h2 className="text-2xl font-semibold">Ортақ маркерлер</h2>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
                      Маркерлер әр кітап бойынша бөлек топтастырылған. Қажет кітапты ашып, нақты белгіге өте аласыз немесе өшіре аласыз.
                    </p>

                    {groupedHighlights.length === 0 ? (
                      <div className="mt-5 rounded-3xl border border-dashed border-slate-200/80 bg-slate-50 p-5 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                        Бұл пән бойынша әлі маркер сақталмаған.
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {groupedHighlights.map((group) => {
                          const isOpen = openBooks.includes(group.bookId);

                          return (
                            <div key={group.bookId} className="rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                              <button
                                type="button"
                                onClick={() => toggleBook(group.bookId)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                              >
                                <div>
                                  <p className="text-sm font-semibold">{group.bookTitle} маркерлері</p>
                                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{group.items.length} белгі сақталған</p>
                                </div>
                                <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                              </button>

                              {isOpen ? (
                                <div className="space-y-3 border-t border-slate-200/80 px-4 py-4 dark:border-zinc-800">
                                  {group.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/60"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <Link
                                          href={`/books/${item.bookId}/chapters/${item.chapterId}?subject=${item.subjectId}&highlight=highlight-${item.id}`}
                                          className="min-w-0 flex-1"
                                        >
                                          <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                                            {item.chapterTitle}
                                          </p>
                                          <p className="mt-2 text-sm leading-7 text-slate-800 dark:text-zinc-100">{item.selectedText}</p>
                                        </Link>
                                        <div className="flex items-center gap-2">
                                          <span className="mt-1 inline-block h-3 w-3 rounded-full" style={getSwatchStyle(item.color)} />
                                          <button
                                            type="button"
                                            onClick={() => removeHighlight(item.id)}
                                            className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </aside>
                </div>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

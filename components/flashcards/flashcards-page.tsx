"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  Layers,
  PartyPopper,
  PencilLine,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Shuffle,
  Trash2,
  X
} from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { FlipCard } from "@/components/flashcards/flip-card";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { SelectMenu } from "@/components/ui/select-menu";
import type { FlashcardRecord, FlashcardStatus } from "@/lib/types";

type Direction = "next" | "prev";

/** Пәнге / кітапқа / тақырыпқа байланбаған карточкалардың топ кілті */
const NONE = "__none__";

/** Жаттау аясы: бүкіл пән, бір кітап не бір тақырып */
type StudyScope = { subjectKey: string; bookKey?: string; topicKey?: string; label: string };
type TopicGroup = { key: string; title: string; cards: FlashcardRecord[] };
type BookGroup = { key: string; title: string; topics: TopicGroup[]; cards: FlashcardRecord[] };
type SubjectGroup = { key: string; title: string; books: BookGroup[]; cards: FlashcardRecord[] };

const fieldClass =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50";

const ghostButtonClass =
  "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300";

const iconButtonClass =
  "rounded-full p-2 text-slate-400 transition hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300";

const statusBadge: Record<FlashcardStatus, { label: string; className: string }> = {
  new: {
    label: "Жаңа",
    className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
  },
  review: {
    label: "Қайталау",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
  },
  known: {
    label: "Білемін",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
  }
};

const subjectKeyOf = (card: FlashcardRecord) => card.subjectId || NONE;
const bookKeyOf = (card: FlashcardRecord) => card.bookId || NONE;
const topicKeyOf = (card: FlashcardRecord) => card.chapterId || NONE;
const statusOf = (card: FlashcardRecord): FlashcardStatus => card.status ?? "new";
const countKnown = (cards: FlashcardRecord[]) => cards.filter((card) => statusOf(card) === "known").length;

function shuffleIds(ids: string[]) {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function cardMeta(card: FlashcardRecord) {
  return [card.subjectName, card.chapterTitle || card.bookTitle].filter(Boolean).join(" · ");
}

export function FlashcardsPage() {
  const { flashcards, addFlashcard, updateFlashcard, removeFlashcard, setFlashcardStatus, continueReadingSettings } =
    useAuth();
  const { subjects } = useCatalog();
  const formRef = useRef<HTMLFormElement | null>(null);
  const studyRef = useRef<HTMLDivElement | null>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [bookId, setBookId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isPreviewBack, setIsPreviewBack] = useState(false);

  const [filterSubject, setFilterSubject] = useState("all");
  const [scope, setScope] = useState<StudyScope | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isStudyFlipped, setIsStudyFlipped] = useState(false);
  const [direction, setDirection] = useState<Direction>("next");
  const [animationTick, setAnimationTick] = useState(0);
  const [flippedGridIds, setFlippedGridIds] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const selectedSubject = subjects.find((subject) => subject.id === subjectId) ?? null;
  const selectedBook = selectedSubject?.books.find((book) => book.id === bookId) ?? null;

  const availableTopics = useMemo(() => {
    if (!selectedBook) {
      return [] as Array<{ id: string; title: string }>;
    }

    return selectedBook.sections.flatMap((section) =>
      section.chapters.flatMap((chapterGroup) =>
        chapterGroup.topics.map((topic) => ({ id: topic.id, title: topic.title }))
      )
    );
  }, [selectedBook]);

  const bookTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const subject of subjects) {
      for (const book of subject.books) {
        map.set(book.id, book.title);
      }
    }
    return map;
  }, [subjects]);

  const subjectTitleOf = (card: FlashcardRecord) =>
    card.subjectId
      ? card.subjectName || subjects.find((subject) => subject.id === card.subjectId)?.name || "Пән"
      : "Пәнге байланбаған карточкалар";

  const subjectFilterOptions = useMemo(() => {
    const groups = new Map<string, { label: string; count: number }>();
    for (const card of flashcards) {
      const key = subjectKeyOf(card);
      const current = groups.get(key);
      groups.set(key, { label: current?.label ?? subjectTitleOf(card), count: (current?.count ?? 0) + 1 });
    }

    return [
      { value: "all", label: "Барлық пәндер", badge: flashcards.length },
      ...Array.from(groups.entries()).map(([value, item]) => ({ value, label: item.label, badge: item.count }))
    ];
    // subjectTitleOf тек subjects-ке тәуелді
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcards, subjects]);

  /** Тізімде көрінетін карточкалар (пән сүзгісі бойынша) */
  const listCards = useMemo(
    () => (filterSubject === "all" ? flashcards : flashcards.filter((card) => subjectKeyOf(card) === filterSubject)),
    [filterSubject, flashcards]
  );

  /** Жаттау аясына кіретін карточкалар */
  const scopedCards = useMemo(() => {
    if (!scope) {
      return listCards;
    }

    return listCards.filter(
      (card) =>
        subjectKeyOf(card) === scope.subjectKey &&
        (scope.bookKey === undefined || bookKeyOf(card) === scope.bookKey) &&
        (scope.topicKey === undefined || topicKeyOf(card) === scope.topicKey)
    );
  }, [listCards, scope]);

  /** Жаттау кезегі: «Білемін» деп белгіленгендер қайта шықпайды */
  const queue = useMemo(() => {
    const pending = scopedCards.filter((card) => statusOf(card) !== "known");
    if (!order) {
      return pending;
    }

    const rank = new Map(order.map((id, index) => [id, index]));
    return [...pending].sort(
      (left, right) => (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [scopedCards, order]);

  const total = queue.length;
  const safeIndex = total ? Math.min(studyIndex, total - 1) : 0;
  const currentCard = total ? queue[safeIndex] : null;
  const scopedKnown = countKnown(scopedCards);
  const masteryPercent = scopedCards.length ? Math.round((scopedKnown / scopedCards.length) * 100) : 0;
  const isComplete = scopedCards.length > 0 && total === 0;

  const groups = useMemo<SubjectGroup[]>(() => {
    const subjectMap = new Map<string, SubjectGroup>();

    for (const card of listCards) {
      const sKey = subjectKeyOf(card);
      let subjectGroup = subjectMap.get(sKey);
      if (!subjectGroup) {
        subjectGroup = { key: sKey, title: subjectTitleOf(card), books: [], cards: [] };
        subjectMap.set(sKey, subjectGroup);
      }
      subjectGroup.cards.push(card);

      const bKey = bookKeyOf(card);
      let bookGroup = subjectGroup.books.find((item) => item.key === bKey);
      if (!bookGroup) {
        bookGroup = {
          key: bKey,
          title: card.bookId ? card.bookTitle || bookTitleById.get(card.bookId) || "Кітап" : "Кітапқа байланбаған",
          topics: [],
          cards: []
        };
        subjectGroup.books.push(bookGroup);
      }
      bookGroup.cards.push(card);

      const tKey = topicKeyOf(card);
      let topicGroup = bookGroup.topics.find((item) => item.key === tKey);
      if (!topicGroup) {
        topicGroup = {
          key: tKey,
          title: card.chapterId ? card.chapterTitle || "Тақырып" : "Тақырыпқа байланбаған",
          cards: []
        };
        bookGroup.topics.push(topicGroup);
      }
      topicGroup.cards.push(card);
    }

    return Array.from(subjectMap.values());
    // subjectTitleOf тек subjects-ке тәуелді
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listCards, subjects, bookTitleById]);

  // Пән сүзгісі ауысқанда жаттау басынан басталады
  useEffect(() => {
    setScope(null);
    setOrder(null);
    setStudyIndex(0);
    setIsStudyFlipped(false);
  }, [filterSubject]);

  function bump(nextDirection: Direction) {
    setDirection(nextDirection);
    setIsStudyFlipped(false);
    setAnimationTick((current) => current + 1);
  }

  function go(nextDirection: Direction) {
    setIsStudyFlipped(false);
    if (total < 2) {
      return;
    }

    bump(nextDirection);
    setStudyIndex((current) => {
      const base = Math.min(current, total - 1);
      return nextDirection === "next" ? (base + 1) % total : (base - 1 + total) % total;
    });
  }

  function answerCard(known: boolean) {
    if (!currentCard) {
      return;
    }

    bump("next");

    if (known) {
      // Карточка кезектен шығады — сол орынға келесісі келеді (соңғысы болса, басына)
      setFlashcardStatus([currentCard.id], "known");
      setStudyIndex((current) => {
        const base = Math.min(current, total - 1);
        return base >= total - 1 ? 0 : base;
      });
      return;
    }

    setFlashcardStatus([currentCard.id], "review");
    if (total > 1) {
      setStudyIndex((current) => (Math.min(current, total - 1) + 1) % total);
    }
  }

  function shuffle() {
    setOrder(shuffleIds(queue.map((card) => card.id)));
    setStudyIndex(0);
    bump("next");
  }

  function confirmRestart(label: string, count: number) {
    return window.confirm(`«${label}» бойынша ${count} карточканы басынан жаттайсыз ба? «Білемін» белгілері алынады.`);
  }

  function restartCards(cards: FlashcardRecord[], label: string) {
    if (!cards.length || !confirmRestart(label, cards.length)) {
      return false;
    }

    setFlashcardStatus(
      cards.map((card) => card.id),
      "new"
    );
    setOrder(null);
    setStudyIndex(0);
    bump("prev");
    return true;
  }

  function studyGroup(nextScope: StudyScope, cards: FlashcardRecord[], restart: boolean) {
    if (restart && !restartCards(cards, nextScope.label)) {
      return;
    }

    setScope(nextScope);
    setOrder(null);
    setStudyIndex(0);
    bump("next");
    studyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearScope() {
    setScope(null);
    setOrder(null);
    setStudyIndex(0);
    bump("prev");
  }

  function toggleGroup(id: string) {
    setOpenGroups((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  // Пернетақта: «Бос орын» — айналдыру, ← → — ауысу. Мәтін жазып отырғанда іске қоспаймыз.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable='true'], [role='listbox']")) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        go("next");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go("prev");
      } else if (event.key === " " && currentCard) {
        event.preventDefault();
        setIsStudyFlipped((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function resetForm() {
    setQuestion("");
    setAnswer("");
    setSubjectId("");
    setBookId("");
    setTopicId("");
    setEditingId(null);
    setFormError("");
    setIsPreviewBack(false);
  }

  function startEdit(card: FlashcardRecord) {
    setEditingId(card.id);
    setQuestion(card.question);
    setAnswer(card.answer);
    setSubjectId(card.subjectId || "");
    setBookId(card.bookId || "");
    setTopicId(card.chapterId || "");
    setFormError("");
    setIsPreviewBack(false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim() || !answer.trim()) {
      setFormError("Сұрақ пен жауапты толтырыңыз.");
      return;
    }

    const original = editingId ? flashcards.find((card) => card.id === editingId) ?? null : null;
    // Өңдеу кезінде тақырып өзгермесе, бастапқы атаулар сақталады (каталогта табылмаса да)
    const keepOriginal =
      original !== null &&
      subjectId === (original.subjectId || "") &&
      bookId === (original.bookId || "") &&
      topicId === (original.chapterId || "");
    const topic = availableTopics.find((item) => item.id === topicId);

    const linkage =
      keepOriginal && original
        ? {
            subjectId: original.subjectId,
            subjectName: original.subjectName,
            bookId: original.bookId,
            bookTitle: original.bookTitle,
            chapterId: original.chapterId,
            chapterTitle: original.chapterTitle
          }
        : {
            subjectId: selectedSubject?.id ?? "",
            subjectName: selectedSubject?.name ?? "",
            bookId: selectedBook?.id ?? "",
            bookTitle: selectedBook?.title ?? "",
            chapterId: topic?.id ?? "",
            chapterTitle: topic?.title ?? ""
          };

    if (editingId) {
      updateFlashcard(editingId, { question, answer, ...linkage });
    } else {
      addFlashcard({ question, answer, ...linkage });
    }

    resetForm();
  }

  function removeCard(card: FlashcardRecord) {
    if (!window.confirm("Осы флешкартаны өшіруге сенімдісіз бе?")) {
      return;
    }

    removeFlashcard(card.id);
    setFlippedGridIds((current) => current.filter((id) => id !== card.id));
    if (editingId === card.id) {
      resetForm();
    }
  }

  function toggleGridCard(cardId: string) {
    setFlippedGridIds((current) =>
      current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]
    );
  }

  function renderGroupHeader(options: {
    id: string;
    level: 0 | 1 | 2;
    title: string;
    cards: FlashcardRecord[];
    groupScope: StudyScope;
  }) {
    const { id, level, title, cards, groupScope } = options;
    const isOpen = openGroups.includes(id);
    const known = countKnown(cards);
    const percent = cards.length ? Math.round((known / cards.length) * 100) : 0;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => toggleGroup(id)}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? "" : "-rotate-90"}`}
          />
          <span className="min-w-0">
            <span
              className={`block truncate font-semibold text-slate-900 dark:text-zinc-50 ${
                level === 0 ? "text-xl" : level === 1 ? "text-base" : "text-sm"
              }`}
            >
              {title}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-400">
              {cards.length} карточка · білемін {known}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800 sm:block">
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <button
            type="button"
            onClick={() => studyGroup(groupScope, cards, false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
          >
            <Brain className="h-3.5 w-3.5" />
            Жаттау
          </button>
          <button
            type="button"
            onClick={() => studyGroup(groupScope, cards, true)}
            title="Басынан жаттау"
            aria-label={`«${title}» басынан жаттау`}
            className={iconButtonClass}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderCard(card: FlashcardRecord) {
    const status = statusOf(card);

    return (
      <div key={card.id} className="min-w-0">
        <FlipCard
          size="sm"
          question={card.question}
          answer={card.answer}
          flipped={flippedGridIds.includes(card.id)}
          onFlip={() => toggleGridCard(card.id)}
        />
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge[status].className}`}>
            {statusBadge[status].label}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {status === "known" ? (
              <button
                type="button"
                onClick={() => setFlashcardStatus([card.id], "new")}
                aria-label="Қайта жаттауға қосу"
                title="Қайта жаттауға қосу"
                className={iconButtonClass}
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => startEdit(card)}
              aria-label="Карточканы өңдеу"
              title="Өңдеу"
              className={iconButtonClass}
            >
              <PencilLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => removeCard(card)}
              aria-label="Карточканы өшіру"
              title="Өшіру"
              className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RouteGuard role="USER">
      <div className="page-shell">
        <SiteHeader />

        <main id="juz-main" className="page-width py-10">
          <section className="glass-card p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="intro-mask">
                  <p
                    className="hero-line flex items-center gap-3 text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300"
                    style={{ animationDelay: "0.06s" }}
                  >
                    <span
                      className="hero-rule inline-block h-[2px] w-8 bg-sky-600 dark:bg-cyan-400"
                      style={{ animationDelay: "0.2s" }}
                    />
                    Флешкарта
                  </p>
                </div>
                <h1 className="intro-mask mt-3 text-5xl font-semibold">
                  <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>
                    Жаттау карточкалары
                  </span>
                </h1>
                <p
                  className="hero-line mt-4 max-w-3xl text-base leading-8 text-slate-600 dark:text-zinc-400"
                  style={{ animationDelay: "0.4s" }}
                >
                  «Білемін» деген карточкалар жаттауға қайта шықпайды — тек қайталау керектері қалады. Бәрін басынан
                  өту үшін төмендегі тізімнен «Басынан жаттау» басыңыз.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <SelectMenu
                  size="sm"
                  className="w-60"
                  ariaLabel="Пән бойынша сүзу"
                  value={filterSubject}
                  onChange={(next) => setFilterSubject(next)}
                  options={subjectFilterOptions}
                />
                <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
                  Барлығы: {flashcards.length}
                </div>
              </div>
            </div>

            {!continueReadingSettings.flashcardsEnabled ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <span>Кітап оқығанда флешкарта құралдары өшірулі. Бұл бет бәрібір жұмыс істейді.</span>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                >
                  <Settings2 className="h-4 w-4" />
                  Профильде қосу
                </Link>
              </div>
            ) : null}
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div ref={studyRef} className="glass-card min-w-0 scroll-mt-28 p-6 md:p-8">
              {scopedCards.length ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                      Жаттау режимі
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                      Қалды: {total} · білемін: {scopedKnown} / {scopedCards.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={shuffle} disabled={total < 2} className={ghostButtonClass}>
                      <Shuffle className="h-4 w-4" />
                      Араластыру
                    </button>
                    <button
                      type="button"
                      onClick={() => restartCards(scopedCards, scope?.label ?? "Таңдалған карточкалар")}
                      className={ghostButtonClass}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Басынан
                    </button>
                  </div>
                </div>
              ) : null}

              {scope ? (
                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-violet-50 py-1 pl-3 pr-1 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
                  <span className="truncate">Жаттау аясы: {scope.label}</span>
                  <button
                    type="button"
                    onClick={clearScope}
                    aria-label="Барлық карточкаларға қайту"
                    className="rounded-full p-1 transition hover:bg-violet-100 dark:hover:bg-violet-500/20"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {scopedCards.length ? (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${masteryPercent}%` }}
                  />
                </div>
              ) : null}

              {currentCard ? (
                <>
                  <div
                    key={`${currentCard.id}-${animationTick}`}
                    className={`mt-6 ${direction === "next" ? "flashcard-enter-next" : "flashcard-enter-prev"}`}
                  >
                    <FlipCard
                      question={currentCard.question}
                      answer={currentCard.answer}
                      flipped={isStudyFlipped}
                      onFlip={() => setIsStudyFlipped((current) => !current)}
                      meta={cardMeta(currentCard)}
                    />
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={() => go("prev")} disabled={total < 2} className={ghostButtonClass}>
                      <ArrowLeft className="h-4 w-4" />
                      Алдыңғы
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => answerCard(false)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                      >
                        <X className="h-4 w-4" />
                        Қайталау
                      </button>
                      <button
                        type="button"
                        onClick={() => answerCard(true)}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                      >
                        <Check className="h-4 w-4" />
                        Білемін
                      </button>
                    </div>
                    <button type="button" onClick={() => go("next")} disabled={total < 2} className={ghostButtonClass}>
                      Келесі
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-4 text-center text-xs text-slate-500 dark:text-zinc-500">
                    {statusOf(currentCard) === "review" ? "Бұл карточканы қайталау керек деп белгілегенсіз. " : ""}
                    Пернетақта: «Бос орын» — айналдыру, ← → — ауысу
                  </p>
                </>
              ) : isComplete ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <PartyPopper className="h-8 w-8" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold">Барлығын білесіз!</h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-zinc-400">
                    {scope ? `«${scope.label}»` : "Таңдалған"} бойынша {scopedCards.length} карточканың бәрі «Білемін» деп
                    белгіленді. Олар жаттауға қайта шықпайды.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => restartCards(scopedCards, scope?.label ?? "Таңдалған карточкалар")}
                      className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Басынан бастау
                    </button>
                    {scope ? (
                      <button type="button" onClick={clearScope} className={ghostButtonClass}>
                        Барлық карточкалар
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 text-sky-600 dark:bg-cyan-500/10 dark:text-cyan-300">
                    <Layers className="h-8 w-8" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold">
                    {flashcards.length ? "Бұл сүзгі бойынша карточка жоқ" : "Әзірге карточка жоқ"}
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-zinc-400">
                    {flashcards.length
                      ? "Басқа пәнді таңдаңыз немесе жаңа карточка қосыңыз."
                      : "Оң жақтағы формадан алғашқы флешкартаңызды қосыңыз. Кітап оқып отырып та карточка жасауға болады."}
                  </p>
                </div>
              )}
            </div>

            <form ref={formRef} onSubmit={submit} className="glass-card h-fit min-w-0 scroll-mt-28 p-6 xl:sticky xl:top-24">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">{editingId ? "Карточканы өңдеу" : "Жаңа флешкарта"}</h2>
                {editingId ? (
                  <button type="button" onClick={resetForm} className={ghostButtonClass}>
                    <X className="h-4 w-4" />
                    Болдырмау
                  </button>
                ) : null}
              </div>

              <div className="mt-5">
                <FlipCard
                  size="sm"
                  question={question.trim() || "Сұрақ осы жерде көрінеді"}
                  answer={answer.trim() || "Жауап осы жерде көрінеді"}
                  flipped={isPreviewBack}
                  onFlip={() => setIsPreviewBack((current) => !current)}
                />
              </div>

              <label className="mt-5 grid gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Сұрақ — алдыңғы беті</span>
                <textarea
                  value={question}
                  maxLength={600}
                  spellCheck={false}
                  onFocus={() => setIsPreviewBack(false)}
                  onChange={(event) => {
                    setQuestion(event.target.value || "");
                    setFormError("");
                  }}
                  placeholder="Мысалы: Алгоритм дегеніміз не?"
                  className={`${fieldClass} min-h-[88px] resize-y`}
                />
              </label>

              <label className="mt-4 grid gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Жауап — артқы беті</span>
                <textarea
                  value={answer}
                  maxLength={1200}
                  spellCheck={false}
                  onFocus={() => setIsPreviewBack(true)}
                  onChange={(event) => {
                    setAnswer(event.target.value || "");
                    setFormError("");
                  }}
                  placeholder="Мысалы: Есепті шешуге арналған нақты әрекеттер тізбегі"
                  className={`${fieldClass} min-h-[110px] resize-y`}
                />
              </label>

              <div className="mt-4 grid gap-3">
                <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Тақырыпқа байлау (міндетті емес)</span>
                <SelectMenu
                  ariaLabel="Пән"
                  placeholder="Пән таңдалмаған"
                  value={subjectId}
                  onChange={(next) => {
                    setSubjectId(next);
                    setBookId("");
                    setTopicId("");
                  }}
                  options={[
                    { value: "", label: "Пән таңдалмаған" },
                    ...subjects.map((subject) => ({ value: subject.id, label: subject.name }))
                  ]}
                />
                <SelectMenu
                  ariaLabel="Кітап"
                  placeholder="Кітап таңдалмаған"
                  disabled={!selectedSubject}
                  value={bookId}
                  onChange={(next) => {
                    setBookId(next);
                    setTopicId("");
                  }}
                  options={[
                    { value: "", label: "Кітап таңдалмаған" },
                    ...(selectedSubject?.books ?? []).map((book) => ({ value: book.id, label: book.title }))
                  ]}
                />
                <SelectMenu
                  ariaLabel="Тақырып"
                  placeholder="Тақырып таңдалмаған"
                  disabled={!selectedBook}
                  value={topicId}
                  onChange={(next) => setTopicId(next)}
                  options={[
                    { value: "", label: "Тақырып таңдалмаған" },
                    ...availableTopics.map((topic) => ({ value: topic.id, label: topic.title }))
                  ]}
                />
              </div>

              {formError ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-700 px-5 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
              >
                {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Өзгерісті сақтау" : "Карточка қосу"}
              </button>
            </form>
          </section>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Барлық карточкалар</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Пәнді ашыңыз → кітапты → тақырыпты. Кез келген деңгейден жаттауды бастауға болады.
                </p>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                {listCards.length} карточка · білемін {countKnown(listCards)}
              </p>
            </div>

            {groups.length ? (
              <div className="mt-5 space-y-4">
                {groups.map((subjectGroup) => {
                  const subjectId_ = `s:${subjectGroup.key}`;
                  const isSubjectOpen = openGroups.includes(subjectId_);

                  return (
                    <div key={subjectId_} className="glass-card p-4 md:p-5">
                      {renderGroupHeader({
                        id: subjectId_,
                        level: 0,
                        title: subjectGroup.title,
                        cards: subjectGroup.cards,
                        groupScope: { subjectKey: subjectGroup.key, label: subjectGroup.title }
                      })}

                      {isSubjectOpen ? (
                        <div className="mt-4 space-y-3 border-l-2 border-slate-100 pl-3 dark:border-zinc-800 md:pl-5">
                          {subjectGroup.books.map((bookGroup) => {
                            const bookId_ = `${subjectId_}|b:${bookGroup.key}`;
                            const isBookOpen = openGroups.includes(bookId_);

                            return (
                              <div
                                key={bookId_}
                                className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60 md:p-4"
                              >
                                {renderGroupHeader({
                                  id: bookId_,
                                  level: 1,
                                  title: bookGroup.title,
                                  cards: bookGroup.cards,
                                  groupScope: {
                                    subjectKey: subjectGroup.key,
                                    bookKey: bookGroup.key,
                                    label: `${subjectGroup.title} · ${bookGroup.title}`
                                  }
                                })}

                                {isBookOpen ? (
                                  <div className="mt-3 space-y-3">
                                    {bookGroup.topics.map((topicGroup) => {
                                      const topicId_ = `${bookId_}|t:${topicGroup.key}`;
                                      const isTopicOpen = openGroups.includes(topicId_);

                                      return (
                                        <div
                                          key={topicId_}
                                          className="rounded-xl border border-slate-200/70 p-3 dark:border-zinc-800"
                                        >
                                          {renderGroupHeader({
                                            id: topicId_,
                                            level: 2,
                                            title: topicGroup.title,
                                            cards: topicGroup.cards,
                                            groupScope: {
                                              subjectKey: subjectGroup.key,
                                              bookKey: bookGroup.key,
                                              topicKey: topicGroup.key,
                                              label: topicGroup.title
                                            }
                                          })}

                                          {isTopicOpen ? (
                                            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                              {topicGroup.cards.map(renderCard)}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Мұнда сіздің карточкаларыңыз пән → кітап → тақырып болып тұрады.
              </p>
            )}
          </section>
        </main>
      </div>
    </RouteGuard>
  );
}

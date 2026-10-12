"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { HeroBook } from "@/components/landing/hero-book";
import { SiteHeader } from "@/components/site/site-header";
import { SpecificationBrowser } from "@/components/specifications/specification-browser";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { Reveal } from "@/components/ui/reveal";
import { comboOptions } from "@/lib/demo-catalog";
import { formatHours, getTreeStage } from "@/lib/tree";

type SearchResult = {
  id: string;
  bookId: string;
  chapterId: string;
  subjectId: string;
  bookTitle: string;
  chapterTitle: string;
  excerpt: string;
};


export default function HomePage() {
  const { selectedCombo, treeStats, session } = useAuth();
  const { subjects } = useCatalog();
  const [searchSubjectId, setSearchSubjectId] = useState("");
  const router = useRouter();
  const [catalogSearch, setCatalogSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [isSubjectPickerOpen, setIsSubjectPickerOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 520], [1, 0.1]);
  const heroLift = useTransform(scrollY, [0, 520], [0, -60]);
  const cueOpacity = useTransform(scrollY, [0, 200], [1, 0]);

  const pinnedIds = selectedCombo
    ? Array.from(new Set([...(comboOptions.find((item) => item.code === selectedCombo)?.subjectIds ?? []), "kazakh-history"]))
    : [];

  const orderedSubjects = [...subjects].sort((left, right) => {
    const leftPinned = pinnedIds.includes(left.id) ? 0 : 1;
    const rightPinned = pinnedIds.includes(right.id) ? 0 : 1;
    if (leftPinned !== rightPinned) {
      return leftPinned - rightPinned;
    }
    return left.name.localeCompare(right.name, "kk");
  });

  const treeStage = getTreeStage(treeStats);
  const activeSearchSubject = subjects.find((subject) => subject.id === (searchSubjectId || subjects[0]?.id));
  const catalogHref = session ? "/catalog" : "/login?redirect=/catalog";
  const notesHref = session ? "/notes" : "/login?redirect=/notes";
  const gardenHref = session ? "/garden" : "/login?redirect=/garden";

  // Іздеу серверде жүреді: тақырып мәтіндерін клиентке толық жүктеудің қажеті жоқ.
  useEffect(() => {
    const term = catalogSearch.trim();
    const subjectId = activeSearchSubject?.id;

    if (!subjectId || term.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/catalog/search?subjectId=${encodeURIComponent(subjectId)}&q=${encodeURIComponent(term)}`, {
        signal: controller.signal
      })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((payload: { results?: SearchResult[] }) => setSearchResults(payload.results ?? []))
        .catch(() => undefined);
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeSearchSubject?.id, catalogSearch]);

  const activeSearchResult = searchResults[searchResultIndex] ?? searchResults[0] ?? null;
  const searchedBookCount = new Set(searchResults.map((item) => item.bookId)).size;

  useEffect(() => {
    setSearchResultIndex(0);
  }, [catalogSearch, searchSubjectId]);

  function showPreviousResult() {
    setSearchResultIndex((current) => Math.max(0, current - 1));
  }

  function showNextResult() {
    setSearchResultIndex((current) => Math.min(searchResults.length - 1, current + 1));
  }

  /** Тақырыпқа апаратын сілтеме; `hit` берілсе, дәл сол кездескен сөзге барады */
  function buildTopicHref(result: SearchResult | null, hit?: number) {
    if (!result) {
      return "#subjects";
    }

    const term = catalogSearch.trim();
    const target =
      `/books/${result.bookId}/chapters/${result.chapterId}` +
      `?subject=${result.subjectId}&q=${encodeURIComponent(term)}` +
      (typeof hit === "number" ? `&hit=${hit}` : "");

    return session ? target : `/login?redirect=${encodeURIComponent(target)}`;
  }

  /**
   * Үзіндідегі сары боялған сөзді басқанда мәтіндегі дәл сол сөзге барамыз.
   * Үзінді HTML болып келетіндіктен, оқиға делегация арқылы ұсталады.
   */
  function handleSnippetClick(event: ReactMouseEvent<HTMLDivElement>) {
    const mark = (event.target as HTMLElement | null)?.closest?.("mark[data-hit]") as HTMLElement | null;
    if (!mark) {
      return;
    }

    event.preventDefault();
    const hit = Number(mark.dataset.hit);
    router.push(buildTopicHref(activeSearchResult, Number.isFinite(hit) ? hit : 0));
  }

  return (
    <div className="page-shell">
      <div className="page-glow">
        <div className="glow-drift-a absolute left-[-14rem] top-8 h-80 w-80 rounded-full bg-sky-300/30 blur-3xl dark:bg-cyan-500/20" />
        <div className="glow-drift-b absolute right-[-10rem] top-48 h-96 w-96 rounded-full bg-cyan-200/35 blur-3xl dark:bg-sky-500/12" />
        <div className="glow-drift-a absolute bottom-[-10rem] left-1/3 h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl dark:bg-sky-500/12" />
      </div>
      <div className="page-grid pointer-events-none absolute inset-0 opacity-40 dark:opacity-10" />

      <SiteHeader />

      <main id="juz-main" className="page-width relative pb-24 pt-10">
        <motion.section
          className="grid min-h-[calc(100vh-11rem)] grid-cols-1 items-center gap-10 lg:grid-cols-[0.88fr_1.12fr]"
          style={reduceMotion ? undefined : { opacity: heroOpacity, y: heroLift }}
        >
          <div className="min-w-0">
          <div className="hero-mask">
            <p className="hero-line flex items-center gap-3 text-xs font-bold uppercase tracking-[0.1em] text-sky-700 dark:text-cyan-300 sm:tracking-[0.12em]" style={{ animationDelay: "0.1s" }}>
              <span className="hero-rule inline-block h-[2px] w-10 bg-sky-600 dark:bg-cyan-400" style={{ animationDelay: "0.25s" }} />
              ҰБТ-ға дайындалу платформасы
            </p>
          </div>

          {/* clamp: қаріп жүктелмей тұрғанда fallback ені ~50% кең болады —
              өлшемді бағанаға байлап, кітаппен қабаттасуды болдырмаймыз */}
          <h1
            // Телефонда 48px қаріп тақырыпты 7 жолға созатын (кітап суреті
            // экраннан шығып кететін), сондықтан кіші экранда өлшем ағынды
            className="mt-7 break-words text-[clamp(1.9rem,8.2vw,2.75rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-slate-900 dark:text-zinc-50 sm:text-5xl sm:leading-[0.94] sm:tracking-[-0.045em] lg:text-[clamp(2.6rem,5.4vw,4.5rem)]"
            style={{ textWrap: "pretty" }}
          >
            <span className="hero-mask block pb-[2px]">
              <span className="hero-rise block" style={{ animationDelay: "0.18s" }}>JUZBOOK,</span>
            </span>
            <span className="hero-mask block pb-[2px]">
              <span className="hero-rise block italic text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.3s" }}>оқуды жүйелейтін</span>
            </span>
            <span className="hero-mask block pb-[2px]">
              <span className="hero-rise block" style={{ animationDelay: "0.42s" }}>заманауи білім</span>
            </span>
            <span className="hero-mask block pb-[2px]">
              <span className="hero-rise block" style={{ animationDelay: "0.54s" }}>кеңістігі</span>
            </span>
          </h1>

          <p
            className="hero-line mt-8 max-w-2xl text-lg leading-8 text-slate-600 dark:text-zinc-400"
            style={{ animationDelay: "0.72s" }}
          >
            Пәндер каталогы, кітап оқу бөлімі, конспекттер, прогресс және ағаш өсіру жүйесі бір жерде жұмыс істейді.
          </p>

          <div className="hero-line mt-9 flex flex-col gap-4 sm:flex-row" style={{ animationDelay: "0.86s" }}>
            <Link
              href={catalogHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-700 px-6 py-4 text-base font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
            >
              Кітаптарды ашу
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={notesHref}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-4 text-base font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
            >
              Менің конспекттерім
            </Link>
          </div>
          </div>

          <HeroBook />
        </motion.section>

        <motion.div
          aria-hidden="true"
          className="flex flex-col items-center gap-2 pb-10 pt-8 text-slate-500 dark:text-zinc-400"
          style={reduceMotion ? undefined : { opacity: cueOpacity }}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Төмен жылжытыңыз</span>
          <motion.span
            animate={reduceMotion ? undefined : { y: [0, 7, 0] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </motion.div>

        <section id="subjects" className="pt-24">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">Пәндер каталогы</p>
              <h2 className="mt-4 text-5xl font-semibold">
                Пәндер
                <span className="ml-2 italic text-sky-700 dark:text-cyan-300">мен кітаптар</span>
                <span className="block">бір жүйеде жинақталған</span>
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-8 overflow-visible rounded-panel border border-slate-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mx-auto max-w-4xl px-5 py-8 text-center">
                {activeSearchResult ? (
                  <div className="relative mx-auto mt-2 max-w-2xl">
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-left text-lg leading-8 shadow-lg shadow-slate-200/60 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/20">
                      <p className="text-xs uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">{activeSearchResult.bookTitle}</p>
                      <h3 className="mt-2 text-2xl font-semibold">{activeSearchResult.chapterTitle}</h3>
                      <div
                        onClick={handleSnippetClick}
                        className="search-snippet mt-4 text-slate-800 dark:text-zinc-100 [&_mark]:rounded [&_mark]:bg-amber-200 [&_mark]:px-1 [&_mark]:font-semibold [&_mark]:text-slate-950"
                        dangerouslySetInnerHTML={{ __html: activeSearchResult.excerpt }}
                      />
                      <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                        Сары боялған сөзді бассаңыз, кітаптағы дәл сол сөзге барасыз.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={showPreviousResult}
                    disabled={!activeSearchResult || searchResultIndex === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Алдыңғы нәтиже
                  </button>
                  <Link
                    href={buildTopicHref(activeSearchResult)}
                    className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                  >
                    Кітаптан көру
                    <BookOpen className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={showNextResult}
                    disabled={!activeSearchResult || searchResultIndex >= searchResults.length - 1}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                  >
                    Келесі нәтиже
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mx-auto mt-8 max-w-3xl rounded-panel border border-slate-200/80 bg-slate-50/90 p-3 shadow-lg shadow-slate-200/60 dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-black/20">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_230px]">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        value={catalogSearch}
                        spellCheck={false}
                        onChange={(event) => setCatalogSearch(event.target.value || "")}
                        placeholder="Кілт сөзді енгізіңіз"
                        className="h-14 w-full rounded-2xl border border-slate-200/80 bg-white pl-14 pr-5 text-base text-slate-900 outline-none transition hover:border-sky-300 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-cyan-500/50 dark:focus:ring-cyan-500/10"
                      />
                    </label>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsSubjectPickerOpen((current) => !current)}
                        className="flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:border-sky-300 hover:shadow-sky-100/80 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-cyan-400/60 dark:hover:shadow-cyan-500/10"
                      >
                        <span className="truncate">{activeSearchSubject?.name ?? "Пән таңдау"}</span>
                        <ChevronRight className={`h-4 w-4 text-sky-600 transition dark:text-cyan-300 ${isSubjectPickerOpen ? "rotate-90" : ""}`} />
                      </button>

                      {isSubjectPickerOpen ? (
                        <div className="absolute bottom-[calc(100%+0.9rem)] right-0 z-40 max-h-80 w-full overflow-y-auto rounded-3xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_24px_80px_-28px_rgba(14,165,233,0.35)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-[0_24px_80px_-28px_rgba(34,211,238,0.18)]">
                          {subjects.map((subject) => {
                            const active = activeSearchSubject?.id === subject.id;

                            return (
                              <button
                                key={subject.id}
                                type="button"
                                onClick={() => {
                                  setSearchSubjectId(subject.id);
                                  setIsSubjectPickerOpen(false);
                                }}
                                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-sm transition ${
                                  active
                                    ? "bg-sky-50 text-sky-800 shadow-sm dark:bg-cyan-500/10 dark:text-cyan-200"
                                    : "text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                }`}
                              >
                                <span className="truncate font-medium">{subject.name}</span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {subject.books.length}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
                    <div className="flex flex-wrap gap-2 text-slate-500 dark:text-zinc-400">
                      <span>{activeSearchSubject?.books.length ?? 0} кітап</span>
                      <span>{activeSearchSubject?.books.reduce((total, book) => total + book.chapters.length, 0) ?? 0} тақырып</span>
                      <span>{searchResults.length} нәтиже</span>
                    </div>
                    <span className="text-sky-700 dark:text-cyan-300">
                      {searchResults.length > 0
                        ? `${searchResultIndex + 1}/${searchResults.length} нәтиже | ${searchedBookCount} кітап`
                        : catalogSearch.trim().length >= 2
                          ? "Нәтиже табылмады"
                          : "Іздеу дайын"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <Reveal amount={0.12} distance={56} blur={9} scale>
          <SpecificationBrowser subjects={orderedSubjects} initialSubjectId="" />
        </Reveal>

        <section className="pt-24">
          <Reveal distance={48} blur={8} scale>
            <div className="glass-card overflow-hidden p-5">
              <div className="rounded-panel border border-slate-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Сенің оқу ағашың</p>
                    <h2 className="mt-3 text-3xl font-semibold">{treeStage.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">{treeStage.description}</p>
                  </div>
                  <div className="text-5xl">{treeStage.emoji}</div>
                </div>

                <div className="mt-6 rounded-3xl bg-slate-50 p-5 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500 dark:text-zinc-400">Құйылған су</span>
                    <span className="font-semibold text-slate-900 dark:text-zinc-50">{formatHours(treeStats.totalWateredSeconds)} сағат</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-zinc-800">
                    <div className="h-2 rounded-full bg-sky-600 transition-all dark:bg-cyan-400" style={{ width: `${treeStage.progressPercent}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">{treeStage.progressLabel}</p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Құюға дайын су</p>
                    <p className="mt-2 text-2xl font-semibold">{formatHours(treeStats.availableWaterSeconds)} сағат</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Күйі</p>
                    <p className="mt-2 text-2xl font-semibold">{treeStage.isWilted ? "Жандандыру керек" : "Жақсы өсіп тұр"}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={gardenHref}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
                  >
                    Ағаш бағы
                  </Link>
                  <Link
                    href="/profile"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    Кабинетім
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="mt-24 grid gap-6 rounded-panel border border-slate-200/80 bg-white px-6 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-3">
          <div>
            <h3 className="text-2xl font-semibold">Байланыс деректері</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
              Ұсыныс, сұрақ немесе техникалық мәселе болса, төмендегі арналар арқылы хабарласа аласыз.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-semibold">Байланыс</h4>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-zinc-400">
              <p>
                Электронды пошта:{" "}
                <a className="font-medium text-sky-700 hover:underline dark:text-cyan-300" href="mailto:juzbook@gmail.com">
                  juzbook@gmail.com
                </a>
              </p>
              <p>
                Телефон:{" "}
                <a className="font-medium text-sky-700 hover:underline dark:text-cyan-300" href="tel:+77770692910">
                  +7 777 069 29 10
                </a>
              </p>
              <p>
                Telegram:{" "}
                <a
                  className="font-medium text-sky-700 hover:underline dark:text-cyan-300"
                  href="https://t.me/zhantoooo"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @zhantoooo
                </a>
              </p>
            </div>
          </div>
          <div>
            <h4 className="text-lg font-semibold">Қате таптыңыз ба?</h4>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
              Қай бетте және қандай әрекеттен кейін мәселе шыққанын жазсаңыз, оны тезірек түзетуге көмектеседі.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

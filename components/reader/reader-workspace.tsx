"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, BookOpenText, CheckCircle2, ChevronDown, ChevronRight, FileText, Gauge, Highlighter, Pause, Play, Search, Sparkles, Square, Trash2, Podcast, BrainCircuit, PencilLine, Save, X } from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { ChapterEditor } from "@/components/admin/chapter-editor";
import { SourceAttributionBadge } from "@/components/books/source-attribution-badge";
import { ReaderFlashcardsCard } from "@/components/flashcards/reader-flashcards-card";
import { PlannerSidebarCard } from "@/components/planner/planner-sidebar-card";
import { ContentRenderer } from "@/components/reader/content-renderer";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { findBookById, withFlatChapters } from "@/lib/catalog-utils";
import { sanitizePlainText, sanitizeRichText } from "@/lib/sanitize";
import type { ChapterRecord, SubjectRecord } from "@/lib/types";
import type { HighlightColor, HighlightRecord } from "@/lib/types";
import { SelectMenu } from "@/components/ui/select-menu";
import { useAudioWordHighlight, type AudioMark } from "@/components/reader/use-audio-word-highlight";

const NoteEditor = dynamic(() => import("@/components/notes/note-editor").then((module) => module.NoteEditor), {
  ssr: false
});

const TestGenerator = dynamic(
  () => import("@/components/reader/test-generator").then((module) => module.TestGenerator),
  { ssr: false }
);

type SelectionBoxState = {
  x: number;
  y: number;
  text: string;
  paragraphId: string;
  existingHighlightId?: string;
};

type SearchResultItem = {
  paragraphId: string;
  before: string;
  match: string;
  after: string;
};

const palette = [
  { id: "yellow-soft", label: "Жұмсақ сары", color: "#fde68a" },
  { id: "yellow", label: "Сары", color: "#fbbf24" },
  { id: "red-soft", label: "Жұмсақ қызыл", color: "#fca5a5" },
  { id: "red", label: "Қызыл", color: "#fb7185" },
  { id: "green-soft", label: "Жұмсақ жасыл", color: "#86efac" },
  { id: "green", label: "Жасыл", color: "#34d399" },
  { id: "blue", label: "Көк", color: "#93c5fd" },
  { id: "violet", label: "Күлгін", color: "#c4b5fd" }
] as const;

const PINNED_COLOR_KEY = "juzbook-pinned-highlight-color";
const allowedColors = new Set<string>(palette.map((item) => item.color));
const audioVoices = [
  { id: "kk-KZ-AigulNeural", label: "Қазақша әйел дауысы", browserHints: ["aigul", "female", "әйел"], lang: "kk-KZ" },
  { id: "kk-KZ-DauletNeural", label: "Қазақша ер дауысы", browserHints: ["daulet", "male", "ер"], lang: "kk-KZ" },
  { id: "ru-RU-SvetlanaNeural", label: "Орысша әйел дауысы", browserHints: ["svetlana", "female"], lang: "ru-RU" },
  { id: "en-US-JennyNeural", label: "Ағылшынша әйел дауысы", browserHints: ["jenny", "female"], lang: "en-US" }
] as const;

/** Оқу жылдамдығының таңдауы — ойнатқыштың жасырын мәзірінің орнына */
const audioRates = [0.75, 1, 1.25, 1.5, 1.75] as const;

const bookThemes = {
  sky: {
    enabled: true,
    accent: "#0284c7",
    soft: "rgba(14, 165, 233, 0.12)",
    border: "rgba(14, 165, 233, 0.28)",
    glow: "rgba(14, 165, 233, 0.18)"
  },
  emerald: {
    enabled: true,
    accent: "#059669",
    soft: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.28)",
    glow: "rgba(16, 185, 129, 0.18)"
  },
  amber: {
    enabled: true,
    accent: "#b45309",
    soft: "rgba(245, 158, 11, 0.16)",
    border: "rgba(245, 158, 11, 0.3)",
    glow: "rgba(245, 158, 11, 0.18)"
  },
  rose: {
    enabled: true,
    accent: "#be123c",
    soft: "rgba(244, 63, 94, 0.12)",
    border: "rgba(244, 63, 94, 0.28)",
    glow: "rgba(244, 63, 94, 0.16)"
  },
  violet: {
    enabled: true,
    accent: "#7c3aed",
    soft: "rgba(139, 92, 246, 0.12)",
    border: "rgba(139, 92, 246, 0.28)",
    glow: "rgba(139, 92, 246, 0.16)"
  },
  slate: {
    enabled: true,
    accent: "#475569",
    soft: "rgba(100, 116, 139, 0.12)",
    border: "rgba(100, 116, 139, 0.28)",
    glow: "rgba(100, 116, 139, 0.16)"
  },
  basic: {
    enabled: false,
    accent: "#475569",
    soft: "rgba(100, 116, 139, 0.08)",
    border: "rgba(100, 116, 139, 0.22)",
    glow: "transparent"
  }
} as const;

function getBookTheme(theme?: string | null) {
  return bookThemes[(theme || "sky") as keyof typeof bookThemes] ?? bookThemes.sky;
}

function getSwatchStyle(color: string) {
  return { backgroundColor: color };
}

function getHighlightKey(item: Pick<HighlightRecord, "paragraphId" | "selectedText">) {
  return `${item.paragraphId}::${item.selectedText.trim().toLowerCase()}`;
}

function normalizeHighlightColor(color?: string | null) {
  if (color && allowedColors.has(color)) {
    return color;
  }

  return palette[0].color;
}


export function ReaderWorkspace({
  bookId,
  chapterId,
  initialSubjects
}: {
  bookId: string;
  chapterId: string;
  initialSubjects?: SubjectRecord[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { subjects, isReady } = useCatalog();
  const {
    addHighlight,
    removeHighlight,
    highlights,
    saveFlashcard,
    saveTestResult,
    saveSummary,
    saveLastRead,
    addReadingSeconds,
    continueReadingSettings,
    hasCompletedChapter,
    toggleChapterCompletion,
    session
  } = useAuth();

  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [highlightedParagraphId, setHighlightedParagraphId] = useState<string | null>(null);
  const [spokenParagraphId, setSpokenParagraphId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummaryMiniCollapsed, setIsSummaryMiniCollapsed] = useState(true);
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summaryContent, setSummaryContent] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [summaryTargetSubjectId, setSummaryTargetSubjectId] = useState("");
  const [summaryTargetBookId, setSummaryTargetBookId] = useState("");
  const [summaryTargetChapterId, setSummaryTargetChapterId] = useState("");
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
  const [draftHighlightColor, setDraftHighlightColor] = useState<HighlightColor>(palette[0].color);
  const [pinnedHighlightColor, setPinnedHighlightColor] = useState<HighlightColor>(palette[0].color);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [openChapterGroups, setOpenChapterGroups] = useState<string[]>([]);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioPanelOpen, setIsAudioPanelOpen] = useState(false);
  const [audioError, setAudioError] = useState("");
  // Қате емес, тек хабарлама: серверлік дауыс қолжетімсіз болып, браузер
  // дауысы оқып жатқан кезде қызыл «қате» көрсетудің қажеті жоқ.
  const [audioNotice, setAudioNotice] = useState("");
  // Оқу жылдамдығы — ойнатқыштың өз мәзірінде жасырын тұрады, сондықтан
  // бетте көрінетін таңдау қалдырылады. Дыбыс деңгейі ойнатқыштың өзінде.
  const [audioRate, setAudioRate] = useState(1);
  const [audioVolume] = useState(1);
  const [audioVoice, setAudioVoice] = useState<(typeof audioVoices)[number]["id"]>("kk-KZ-AigulNeural");
  const [flashcardBusyId, setFlashcardBusyId] = useState("");
  const [useBrowserVoice, setUseBrowserVoice] = useState(false);
  const [isBrowserSpeaking, setIsBrowserSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [spokenText, setSpokenText] = useState<string | null>(null);
  const [audioMarks, setAudioMarks] = useState<AudioMark[]>([]);
  const [isAudioPrepared, setIsAudioPrepared] = useState(false);
  const [isAudioChecking, setIsAudioChecking] = useState(false);
  // Аудио элементі аудио панелі ашылғанда ғана DOM-ға түседі — сөзді ерекшелеу
  // сол элементке жазылуы үшін оны күй ретінде ұстаймыз.
  const [audioNode, setAudioNode] = useState<HTMLAudioElement | null>(null);
  // Оқу видында әкімшінің тақырып мәтінін тікелей түзетуі
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [topicEditError, setTopicEditError] = useState("");
  const [contentOverrides, setContentOverrides] = useState<Record<string, string>>({});

  const contentRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const readingIntervalRef = useRef<number | null>(null);
  const lastSavedReadRef = useRef("");
  const lastReadingTickRef = useRef<number | null>(null);
  const isReadingActiveRef = useRef(false);
  const addReadingSecondsRef = useRef(addReadingSeconds);
  const selectedHighlightColorRef = useRef<HighlightColor>(palette[0].color);
  const speechSequenceTokenRef = useRef(0);
  addReadingSecondsRef.current = addReadingSeconds;

  // Жалпы каталог жеңіл (мәтінсіз) күйде жүктеледі, ал ағымдағы тақырыптың толық
  // мәтінін сервер initialSubjects арқылы береді — сондықтан оны үстіне қабаттаймыз.
  const sourceSubjects = useMemo(() => {
    const base = withFlatChapters(isReady && subjects.length ? subjects : initialSubjects ?? subjects);

    if (!initialSubjects?.length) {
      return base;
    }

    let serverChapter: ChapterRecord | null = null;
    for (const subject of initialSubjects) {
      const book = subject.books.find((item) => item.id === bookId);
      // Навигация жауабында жалпақ `chapters` тізімі бос (бөлімдердің көшірмесі
      // болмас үшін), сондықтан тақырыпты бөлімдер ішінен де іздейміз.
      const chapter =
        book?.chapters.find((item) => item.id === chapterId) ??
        book?.sections
          .flatMap((section) => section.chapters.flatMap((chapterGroup) => chapterGroup.topics))
          .find((item) => item.id === chapterId);
      if (chapter?.content) {
        serverChapter = chapter;
        break;
      }
    }

    if (!serverChapter) {
      return base;
    }

    const patch = serverChapter;
    const applyPatch = (chapter: ChapterRecord) =>
      chapter.id === patch.id
        ? { ...chapter, title: patch.title, excerpt: patch.excerpt, content: patch.content, pdfPage: patch.pdfPage }
        : chapter;

    return base.map((subject) => ({
      ...subject,
      books: subject.books.map((book) =>
        book.id !== bookId
          ? book
          : {
              ...book,
              chapters: book.chapters.map(applyPatch),
              sections: book.sections.map((section) => ({
                ...section,
                chapters: section.chapters.map((chapterGroup) => ({
                  ...chapterGroup,
                  topics: chapterGroup.topics.map(applyPatch)
                }))
              }))
            }
      )
    }));
  }, [bookId, chapterId, initialSubjects, isReady, subjects]);

  const browserSpeechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const activeAudioVoice = audioVoices.find((item) => item.id === audioVoice) ?? audioVoices[0];

  const resolved = useMemo(() => {
    const found = findBookById(sourceSubjects, bookId);
    if (!found) {
      return null;
    }

    const chapter = found.book.chapters.find((item) => item.id === chapterId) ?? found.book.chapters[0] ?? null;
    if (!chapter) {
      return null;
    }

    const section = found.book.sections.find((item) => item.id === chapter.sectionId) ?? null;
    const chapterGroup = section?.chapters.find((item) => item.id === chapter.chapterGroupId) ?? null;

    return {
      subject: found.subject,
      book: found.book,
      chapter,
      section,
      chapterGroup,
      // Кітаптағы тақырыптардың оқу реті (бөлім → тарау → тақырып) каталог
      // контекстінде жиналған. Мұнда `order` бойынша қайта сұрыптауға
      // болмайды: ол нөмір әр тарау ішінде 1-ден басталады да, «Келесі
      // тақырып» көрші бөлімнің тақырыбына секіріп кетеді.
      chapters: found.book.chapters,
      sections: [...found.book.sections]
        .sort((left, right) => left.order - right.order)
        .map((sectionItem) => ({
          ...sectionItem,
          chapters: [...sectionItem.chapters]
            .sort((left, right) => left.order - right.order)
            .map((chapterGroupItem) => ({
              ...chapterGroupItem,
              topics: [...chapterGroupItem.topics].sort((left, right) => left.order - right.order)
            }))
        }))
    };
  }, [bookId, chapterId, sourceSubjects]);

  const chapterIdValue = resolved?.chapter.id ?? "";
  const isAdmin = session?.role === "ADMIN" || session?.role === "SUPERADMIN";
  // Конспект, тест, маркер панелі — оқушының құралы. Әкімші кітапты
  // тексеріп не түзетіп отырғанда ол тек орын алады, сондықтан жасырылады.
  const showStudyPanel = !isAdmin;
  const displayedContent =
    resolved && contentOverrides[resolved.chapter.id] !== undefined
      ? contentOverrides[resolved.chapter.id]
      : resolved?.chapter.content ?? "";

  function startTopicEdit() {
    if (!resolved) {
      return;
    }
    setTopicDraft(displayedContent);
    setTopicEditError("");
    setIsEditingTopic(true);
  }

  function cancelTopicEdit() {
    setIsEditingTopic(false);
    setTopicEditError("");
  }

  async function saveTopicEdit() {
    if (!resolved) {
      return;
    }

    const topicId = resolved.chapter.id;
    setIsSavingTopic(true);
    setTopicEditError("");

    try {
      const cleaned = sanitizeRichText(topicDraft);
      const response = await fetch(`/api/admin/topics/${encodeURIComponent(topicId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: cleaned })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Мәтінді сақтау мүмкін болмады.");
      }

      const payload = (await response.json().catch(() => null)) as { topic?: { content?: string } } | null;
      const savedContent = typeof payload?.topic?.content === "string" ? payload.topic.content : cleaned;

      setContentOverrides((current) => ({ ...current, [topicId]: savedContent }));
      setIsEditingTopic(false);
    } catch (error) {
      setTopicEditError(error instanceof Error ? error.message : "Мәтінді сақтау мүмкін болмады.");
    } finally {
      setIsSavingTopic(false);
    }
  }

  // Басқа тақырыпқа ауысқанда түзету режимі жабылады
  useEffect(() => {
    setIsEditingTopic(false);
    setTopicEditError("");
  }, [chapterIdValue]);

  const activeBookTheme = getBookTheme(resolved?.book.theme);
  const noteTargetSubject =
    sourceSubjects.find((subject) => subject.id === summaryTargetSubjectId) ?? resolved?.subject ?? null;
  const noteTargetBooks = noteTargetSubject?.books ?? [];
  const noteTargetBook = noteTargetBooks.find((book) => book.id === summaryTargetBookId) ?? resolved?.book ?? null;
  const noteTargetTopics = noteTargetBook?.chapters ?? [];
  const noteTargetTopic = noteTargetTopics.find((topic) => topic.id === summaryTargetChapterId) ?? resolved?.chapter ?? null;
  const activeTopicIndex = resolved?.chapters.findIndex((topic) => topic.id === resolved.chapter.id) ?? -1;
  const nextTopic =
    resolved && activeTopicIndex >= 0 && activeTopicIndex < resolved.chapters.length - 1
      ? resolved.chapters[activeTopicIndex + 1]
      : null;
  const readerSurfaceStyle = {
    "--book-accent": activeBookTheme.accent,
    "--book-soft": activeBookTheme.soft,
    "--book-border": activeBookTheme.border,
    "--book-glow": activeBookTheme.glow
  } as CSSProperties;

  const chapterHighlights = useMemo(() => {
    const map = new Map<string, HighlightRecord>();

    for (const item of highlights) {
      if (item.bookId !== bookId || item.chapterId !== chapterIdValue) {
        continue;
      }

      const normalizedColor = normalizeHighlightColor(item.color);
      const key = getHighlightKey(item);

      if (!map.has(key)) {
        map.set(key, { ...item, color: normalizedColor });
      }
    }

    return Array.from(map.values());
  }, [bookId, chapterIdValue, highlights]);

  useEffect(() => {
    const storedColor = window.localStorage.getItem(PINNED_COLOR_KEY);
    const nextColor = normalizeHighlightColor(storedColor);
    setPinnedHighlightColor(nextColor);
    setDraftHighlightColor(nextColor);
    selectedHighlightColorRef.current = nextColor;
  }, []);

  useEffect(() => {
    if (!searchTerm.trim() || !contentRef.current || !resolved) {
      setSearchResults([]);
      return;
    }

    const normalizedSearch = sanitizePlainText(searchTerm).toLowerCase();
    const paragraphElements = Array.from(
      contentRef.current.querySelectorAll<HTMLElement>("[id^='p-']")
    );

    const nextResults = paragraphElements
      .map((element) => {
        const preview = element.textContent?.replace(/\s+/g, " ").trim() || "";
        const lowered = preview.toLowerCase();
        const matchIndex = lowered.indexOf(normalizedSearch);

        if (matchIndex === -1) {
          return null;
        }

        const start = Math.max(0, matchIndex - 70);
        const end = Math.min(preview.length, matchIndex + normalizedSearch.length + 90);
        const before = preview.slice(start, matchIndex).trimStart();
        const match = preview.slice(matchIndex, matchIndex + normalizedSearch.length);
        const after = preview.slice(matchIndex + normalizedSearch.length, end).trimEnd();

        return {
          paragraphId: element.id,
          before: start > 0 ? `...${before}` : before,
          match,
          after: end < preview.length ? `${after}...` : after
        };
      })
      .filter((item): item is SearchResultItem => Boolean(item))
      .slice(0, 8);

    setSearchResults(nextResults);
  }, [resolved, searchTerm, chapterId]);

  useEffect(() => {
    const sectionId = resolved?.section?.id;
    const chapterGroupId = resolved?.chapterGroup?.id;

    if (!sectionId || !chapterGroupId) {
      return;
    }

    setOpenSections((current) => (current.includes(sectionId) ? current : [...current, sectionId]));
    setOpenChapterGroups((current) =>
      current.includes(chapterGroupId) ? current : [...current, chapterGroupId]
    );
  }, [resolved?.chapterGroup?.id, resolved?.section?.id]);

  useEffect(() => {
    if (!resolved || isSummaryModalOpen) {
      return;
    }

    setSummaryTargetSubjectId(resolved.subject.id);
    setSummaryTargetBookId(resolved.book.id);
    setSummaryTargetChapterId(resolved.chapter.id);
  }, [isSummaryModalOpen, resolved]);

  // Басты беттегі іздеуден келгенде (?q=сөз) барлық кездесу мәтінде боялады,
  // ал ?hit=N берілсе — дәл сол реттегі сөз айқындалып, соған апарылады.
  // Белгілеуді ContentRenderer-дің өзі салады: DOM-ды қолмен өзгертсек,
  // React мәтінді қайта көрсеткенде белгілер жоғалып кетеді.
  const jumpQuery = (searchParams.get("q") || "").trim();
  const jumpHitRaw = Number(searchParams.get("hit"));
  const jumpHit = Number.isFinite(jumpHitRaw) && jumpHitRaw >= 0 ? Math.trunc(jumpHitRaw) : 0;

  useEffect(() => {
    if (!jumpQuery || !resolved) {
      return;
    }

    setSearchTerm(jumpQuery);

    let attempts = 0;
    const timers: number[] = [];

    const scrollToHit = () => {
      const container = contentRef.current;
      if (!container) {
        return false;
      }

      const target =
        container.querySelector<HTMLElement>('mark[data-search-hit="active"]') ??
        container.querySelector<HTMLElement>("mark[data-search-hit]");

      if (!target) {
        return false;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedParagraphId(target.closest("[id^='p-']")?.id ?? null);
      return true;
    };

    // Мәтін әлі салынып жатуы мүмкін — бірнеше рет қайталап көреміз.
    const attempt = () => {
      if (scrollToHit() || attempts >= 6) {
        return;
      }
      attempts += 1;
      timers.push(window.setTimeout(attempt, 350));
    };

    timers.push(window.setTimeout(attempt, 350));

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [chapterId, jumpHit, jumpQuery, resolved]);

  useEffect(() => {
    const focusId = searchParams.get("highlight");
    if (!focusId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const element = document.getElementById(focusId);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedParagraphId(element?.closest("[id^='p-']")?.id ?? focusId);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [chapterId, searchParams]);

  useEffect(() => {
    setActiveParagraphId(null);
    setHighlightedParagraphId(searchParams.get("highlight"));
    setSelectionBox(null);
  }, [chapterId, searchParams]);

  useEffect(() => {
    if (!resolved) {
      return;
    }

    const saveKey = `${resolved.subject.id}:${resolved.book.id}:${resolved.chapter.id}`;
    if (lastSavedReadRef.current === saveKey) {
      return;
    }

    lastSavedReadRef.current = saveKey;
    saveLastRead({
      subjectId: resolved.subject.id,
      bookId: resolved.book.id,
      chapterId: resolved.chapter.id,
      chapterTitle: resolved.chapter.title
    });
  }, [resolved?.book.id, resolved?.chapter.id, resolved?.chapter.title, resolved?.subject.id, saveLastRead]);

  useEffect(() => {
    function updateActiveState() {
      const active = document.visibilityState === "visible" && document.hasFocus();
      isReadingActiveRef.current = active;
      lastReadingTickRef.current = active ? Date.now() : null;
    }

    function flushReadingTime() {
      if (!isReadingActiveRef.current || !resolved?.book.id) {
        return;
      }

      const now = Date.now();
      const previous = lastReadingTickRef.current ?? now;
      const elapsedMs = now - previous;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      if (elapsedSeconds <= 0) {
        return;
      }

      // Толық секундқа жетпеген қалдықты келесі есепке тасымалдаймыз.
      // Әйтпесе әр тексеруде 1 секундқа дейін уақыт жоғалып, бір сағат оқығанда
      // жиналған су нақты уақыттан айтарлықтай аз болып шығады.
      lastReadingTickRef.current = now - (elapsedMs % 1000);

      // Компьютер ұйықтап кетсе, сол уақыт оқылған деп саналмауы керек.
      const safeSeconds = Math.min(elapsedSeconds, 20);
      addReadingSecondsRef.current(safeSeconds, resolved.book.id);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushReadingTime();
      }

      updateActiveState();
    }

    function handleWindowBlur() {
      flushReadingTime();
      updateActiveState();
    }

    function handleWindowFocus() {
      updateActiveState();
    }

    updateActiveState();
    // 10 секунд сайын: серверге сағатына 720 емес, 360 сұраныс кетеді.
    // Бет жабылса не фокус кетсе, қалған уақыт бірден сақталады.
    readingIntervalRef.current = window.setInterval(flushReadingTime, 10000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      if (readingIntervalRef.current) {
        window.clearInterval(readingIntervalRef.current);
      }
      isReadingActiveRef.current = false;
      lastReadingTickRef.current = null;
    };
  }, [resolved?.book.id]);

  function closeSelectionBox(clearSelection = true) {
    if (clearSelection) {
      window.getSelection()?.removeAllRanges();
    }
    setSelectionBox(null);
  }

  function setSelectedHighlightColor(color: HighlightColor) {
    const normalizedColor = normalizeHighlightColor(color);
    selectedHighlightColorRef.current = normalizedColor;
    setDraftHighlightColor(normalizedColor);
    return normalizedColor;
  }

  function pinHighlightColor(color: HighlightColor) {
    const normalizedColor = normalizeHighlightColor(color);
    selectedHighlightColorRef.current = normalizedColor;
    setPinnedHighlightColor(normalizedColor);
    setDraftHighlightColor(normalizedColor);
    window.localStorage.setItem(PINNED_COLOR_KEY, normalizedColor);
    return normalizedColor;
  }

  function scrollToHighlight(highlightId: string) {
    const target = document.getElementById(`highlight-${highlightId}`);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const paragraph = target.closest("[id^='p-']") as HTMLElement | null;
    setHighlightedParagraphId(paragraph?.id ?? `highlight-${highlightId}`);
  }

  function scrollToTextEvidence(value: string) {
    const cleanValue = value.replace(/\s+/g, " ").trim();
    if (!cleanValue || !contentRef.current) {
      return;
    }

    const candidates = cleanValue
      .split(/[.!?。！？\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 8)
      .sort((left, right) => right.length - left.length);
    const targets = candidates.length ? candidates : [cleanValue];
    const elements = Array.from(contentRef.current.querySelectorAll<HTMLElement>("p, div, li, td, blockquote"));

    for (const targetText of targets) {
      const normalizedTarget = targetText.toLowerCase();
      const found = elements.find((element) => element.textContent?.replace(/\s+/g, " ").toLowerCase().includes(normalizedTarget));

      if (found) {
        found.scrollIntoView({ behavior: "smooth", block: "center" });
        if (found.id) {
          setHighlightedParagraphId(found.id);
        }
        return;
      }
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetSummaryModal() {
    if (!resolved) {
      return;
    }

    setSummaryTitle("");
    setSummaryContent("");
    setSummaryError("");
    setSummaryTargetSubjectId(resolved.subject.id);
    setSummaryTargetBookId(resolved.book.id);
    setSummaryTargetChapterId(resolved.chapter.id);
    setIsSummaryModalOpen(false);
    setIsSummaryMiniCollapsed(false);
  }

  function handleSummarySave() {
    if (!summaryTitle.trim()) {
      setSummaryError("Конспект атауын енгізіңіз.");
      return;
    }

    if (!summaryContent.trim()) {
      setSummaryError("Конспект мәтінін жазыңыз.");
      return;
    }

    if (!noteTargetSubject || !noteTargetBook || !noteTargetTopic) {
      setSummaryError("Конспект сақталатын пән мен тақырыпты таңдаңыз.");
      return;
    }

    saveSummary({
      subjectId: noteTargetSubject.id,
      subjectName: noteTargetSubject.name,
      bookId: noteTargetBook.id,
      bookTitle: noteTargetBook.title,
      chapterId: noteTargetTopic.id,
      chapterTitle: noteTargetTopic.title,
      title: summaryTitle.trim(),
      content: summaryContent.trim()
    });

    resetSummaryModal();
  }

  function closeSummaryModal() {
    setSummaryError("");
    setIsSummaryModalOpen(false);
    setIsSummaryMiniCollapsed(false);
  }

  function clearSummaryDraft() {
    if (!summaryTitle.trim() && !summaryContent.trim()) {
      setSummaryError("");
      return;
    }

    const confirmed = window.confirm("Конспект қараламасын толық тазалауға сенімдісіз бе?");
    if (!confirmed) {
      return;
    }

    if (!resolved) {
      return;
    }

    setSummaryTitle("");
    setSummaryContent("");
    setSummaryError("");
    setSummaryTargetSubjectId(resolved.subject.id);
    setSummaryTargetBookId(resolved.book.id);
    setSummaryTargetChapterId(resolved.chapter.id);
  }

  function scrollToParagraph(paragraphId: string) {
    const target = document.getElementById(paragraphId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedParagraphId(paragraphId);
    setActiveParagraphId(paragraphId);
  }

  function splitTextForSpeech(value: string) {
    return value
      .split(/(?<=[.!?])\s+|\n+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function findBrowserVoice() {
    if (!browserSpeechSupported) {
      return null;
    }

    const voices = window.speechSynthesis.getVoices();
    const loweredLang = activeAudioVoice.lang.toLowerCase();

    return (
      voices.find((voice) => activeAudioVoice.browserHints.some((hint) => voice.name.toLowerCase().includes(hint))) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(loweredLang.slice(0, 2))) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(loweredLang)) ??
      null
    );
  }

  async function generateFlashcardFromHighlight(highlight: HighlightRecord) {
    if (!resolved) {
      return;
    }

    setFlashcardBusyId(highlight.id);
    try {
      const response = await fetch("/api/generate-flashcard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: highlight.selectedText,
          subjectName: resolved.subject.name,
          chapterTitle: resolved.chapter.title
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        flashcard?: { question: string; answer: string };
      };

      if (!response.ok || !payload.flashcard) {
        throw new Error(payload.error || "Flashcard жасау мүмкін болмады.");
      }

      saveFlashcard({
        subjectId: resolved.subject.id,
        subjectName: resolved.subject.name,
        bookId: resolved.book.id,
        bookTitle: resolved.book.title,
        chapterId: resolved.chapter.id,
        chapterTitle: resolved.chapter.title,
        sourceText: highlight.selectedText,
        question: payload.flashcard.question,
        answer: payload.flashcard.answer
      });
    } finally {
      setFlashcardBusyId("");
    }
  }

  async function generateTopicAudio() {
    if (!resolved) {
      return;
    }

    // Алдын ала дайындалған аудио бар болса, ешқандай сұраныс жіберілмейді
    if (isAudioPrepared && audioUrl) {
      setAudioError("");
      setAudioNotice("");
      setIsSpeechPaused(false);
      void audioRef.current?.play().catch(() => undefined);
      return;
    }

    setAudioMarks([]);
    setIsAudioLoading(true);
    setAudioError("");
    setAudioNotice("");
    setIsSpeechPaused(false);
    try {
      const plainText = resolved.chapter.content
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const topicText = `${resolved.chapter.title}. ${plainText}`;

      const response = await fetch("/api/audio/topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: topicText,
          voice: audioVoice
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Аудио жасау мүмкін болмады.");
      }

      const blob = await response.blob();
      if (browserSpeechSupported) {
        window.speechSynthesis.cancel();
      }
      setIsBrowserSpeaking(false);
      setUseBrowserVoice(false);
      setSpokenParagraphId(null);
      setSpokenText(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const nextAudioUrl = URL.createObjectURL(blob);
      setAudioUrl(nextAudioUrl);
      window.setTimeout(() => {
        audioRef.current?.play().catch(() => undefined);
      }, 120);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Аудио жасау кезінде қате пайда болды.";

      if (browserSpeechSupported) {
        const paragraphElements = Array.from(
          contentRef.current?.querySelectorAll<HTMLElement>("[id^='p-']") ?? []
        ).filter((element) => element.textContent?.trim());
        const browserVoice = findBrowserVoice();
        const speechQueue = paragraphElements.flatMap((element) =>
          splitTextForSpeech(element.textContent?.replace(/\s+/g, " ").trim() || "").map((text) => ({
            paragraphId: element.id,
            element,
            text
          }))
        );

        const token = Date.now();
        speechSequenceTokenRef.current = token;
        setUseBrowserVoice(true);
        setIsBrowserSpeaking(true);
        setIsSpeechPaused(false);
        // Дыбыс шығып тұрғанда «аудио шықпады» деп қызыл қатемен шошытпаймыз
        setAudioError("");
        setAudioNotice("Серверлік дауыс қазір қолжетімсіз — мәтінді браузер дауысы оқып жатыр.");
        window.speechSynthesis.cancel();

        const speakParagraph = (index: number) => {
          if (speechSequenceTokenRef.current !== token) {
            return;
          }

          const queueItem = speechQueue[index];
          if (!queueItem) {
            setIsBrowserSpeaking(false);
            setIsSpeechPaused(false);
            setSpokenParagraphId(null);
            setSpokenText(null);
            return;
          }

          if (!queueItem.text) {
            speakParagraph(index + 1);
            return;
          }

          // Ерекшелеуді бірден қоямыз: кейбір браузерде `onstart` мүлде
          // іске қосылмайды да, дыбыс шығып тұрса да мәтін боялмай қалады.
          setSpokenParagraphId(queueItem.paragraphId);
          setSpokenText(queueItem.text);
          queueItem.element.scrollIntoView({ behavior: "smooth", block: "center" });

          const utterance = new SpeechSynthesisUtterance(queueItem.text);
          utterance.lang = browserVoice?.lang || activeAudioVoice.lang;
          utterance.voice = browserVoice;
          utterance.rate = audioRate;
          utterance.volume = audioVolume;
          utterance.onstart = () => {
            setSpokenParagraphId(queueItem.paragraphId);
            setSpokenText(queueItem.text);
            queueItem.element.scrollIntoView({ behavior: "smooth", block: "center" });
          };
          utterance.onend = () => {
            if (speechSequenceTokenRef.current !== token) {
              return;
            }
            speakParagraph(index + 1);
          };
          utterance.onerror = () => {
            setIsBrowserSpeaking(false);
            setIsSpeechPaused(false);
            setSpokenParagraphId(null);
            setSpokenText(null);
          };

          speechUtteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        };

        speakParagraph(0);
      } else {
        setAudioError(message);
      }
    } finally {
      setIsAudioLoading(false);
    }
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioRate;
      audioRef.current.volume = audioVolume;
    }

    if (speechUtteranceRef.current) {
      speechUtteranceRef.current.rate = audioRate;
      speechUtteranceRef.current.volume = audioVolume;
    }
  }, [audioRate, audioVolume, audioUrl]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    const handlePlay = () => setIsSpeechPaused(false);
    const handlePause = () => {
      if (!audioElement.ended) {
        setIsSpeechPaused(true);
      }
    };
    const handleEnded = () => {
      setIsSpeechPaused(false);
      setSpokenParagraphId(null);
      setSpokenText(null);
    };

    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("ended", handleEnded);

    return () => {
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      // Дайын аудио сервер сілтемесі арқылы келеді — тек blob сілтемесін босатамыз
      if (audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(audioUrl);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [audioUrl]);

  // Тақырып ашылғанда алдын ала дайындалған аудио бар-жоғын тексереміз.
  // Бар болса — ИИ-ге сұраныс жіберілмейді, аудио бірден ойнатуға дайын тұрады.
  useEffect(() => {
    if (!chapterId) {
      return;
    }

    let cancelled = false;
    setIsAudioChecking(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/topic-audio?chapterId=${encodeURIComponent(chapterId)}&voice=${encodeURIComponent(audioVoice)}`,
          { credentials: "include" }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          ready?: boolean;
          audio?: { url: string; marks: AudioMark[] };
        };

        if (cancelled) {
          return;
        }

        if (payload.ready && payload.audio) {
          setAudioUrl((current) => {
            if (current.startsWith("blob:")) {
              URL.revokeObjectURL(current);
            }
            return payload.audio!.url;
          });
          setAudioMarks(payload.audio.marks ?? []);
          setIsAudioPrepared(true);
          setUseBrowserVoice(false);
          setAudioError("");
        } else {
          setIsAudioPrepared(false);
          setAudioMarks([]);
          setAudioUrl((current) => {
            if (current.startsWith("blob:")) {
              URL.revokeObjectURL(current);
            }
            return "";
          });
        }
      } catch {
        if (!cancelled) {
          setIsAudioPrepared(false);
        }
      } finally {
        if (!cancelled) {
          setIsAudioChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioVoice, chapterId]);

  // Аудио оқып жатқанда мәтіндегі дәл сол сөзді ерекшелейді
  const { isSupported: isWordHighlightSupported } = useAudioWordHighlight({
    containerRef: contentRef,
    audioElement: audioNode,
    marks: audioMarks,
    enabled: isAudioPrepared && Boolean(audioUrl)
  });

  function stopTopicAudio() {
    speechSequenceTokenRef.current = 0;
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    if (browserSpeechSupported) {
      window.speechSynthesis.cancel();
    }
    setIsBrowserSpeaking(false);
    setIsSpeechPaused(false);
    setSpokenParagraphId(null);
    setSpokenText(null);
  }

  function toggleAudioPlayback() {
    if (audioUrl && audioRef.current) {
      if (audioRef.current.paused) {
        void audioRef.current.play();
        setIsSpeechPaused(false);
      } else {
        audioRef.current.pause();
        setIsSpeechPaused(true);
      }
      return;
    }

    if (useBrowserVoice && browserSpeechSupported) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsSpeechPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsSpeechPaused(true);
      }
    }
  }

  function openTopic(topicId: string) {
    if (!resolved) {
      return;
    }

    router.push(`/books/${resolved.book.id}/chapters/${topicId}?subject=${resolved.subject.id}`);
  }

  function openSelectionBoxByRect({
    text,
    paragraphId,
    rect,
    existingHighlightId
  }: {
    text: string;
    paragraphId: string;
    rect: DOMRect;
    existingHighlightId?: string;
  }) {
    if (!contentRef.current) {
      return;
    }

    const articleRect = contentRef.current.getBoundingClientRect();
    const existingColor = existingHighlightId
      ? chapterHighlights.find((item) => item.id === existingHighlightId)?.color
      : null;

    setSelectionBox({
      x: rect.left - articleRect.left,
      y: rect.top - articleRect.top,
      text,
      paragraphId,
      existingHighlightId
    });
    setActiveParagraphId(paragraphId);
    setSelectedHighlightColor(existingColor ?? pinnedHighlightColor);
  }

  function applyHighlight(nextColor?: HighlightColor) {
    if (!resolved || !selectionBox) {
      return;
    }

    const normalizedColor = pinHighlightColor(nextColor ?? selectedHighlightColorRef.current);
    const existingHighlight = selectionBox.existingHighlightId
      ? chapterHighlights.find((item) => item.id === selectionBox.existingHighlightId) ?? null
      : null;

    if (existingHighlight?.color === normalizedColor) {
      closeSelectionBox();
      return;
    }

    if (existingHighlight) {
      removeHighlight(existingHighlight.id);
    }

    addHighlight({
      subjectId: resolved.subject.id,
      bookId: resolved.book.id,
      chapterId: resolved.chapter.id,
      paragraphId: selectionBox.paragraphId,
      selectedText: selectionBox.text,
      color: normalizedColor
    });

    closeSelectionBox();
  }

  useEffect(() => {
    const handleMouseUp = () => {
      if (!continueReadingSettings.highlightMenuEnabled) {
        closeSelectionBox(false);
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";

      if (!text || !selection || selection.rangeCount === 0 || !contentRef.current) {
        return;
      }

      const range = selection.getRangeAt(0);
      const container =
        range.commonAncestorContainer.nodeType === 3
          ? range.commonAncestorContainer.parentElement
          : (range.commonAncestorContainer as Element);

      if (!container || !contentRef.current.contains(container)) {
        return;
      }

      const paragraph = container.closest("[id^='p-']");
      if (!paragraph?.id) {
        return;
      }

      const existing = chapterHighlights.find(
        (item) =>
          item.paragraphId === paragraph.id &&
          item.selectedText.trim().toLowerCase() === text.toLowerCase()
      );

      openSelectionBoxByRect({
        text,
        paragraphId: paragraph.id,
        rect: range.getBoundingClientRect(),
        existingHighlightId: existing?.id
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (event.target.closest("[data-selection-box='true']")) {
        return;
      }

      setSelectionBox(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [chapterHighlights, continueReadingSettings.highlightMenuEnabled, pinnedHighlightColor]);

  function toggleSection(sectionId: string) {
    setOpenSections((current) =>
      current.includes(sectionId) ? current.filter((item) => item !== sectionId) : [...current, sectionId]
    );
  }

  function toggleChapterGroup(chapterGroupId: string) {
    setOpenChapterGroups((current) =>
      current.includes(chapterGroupId)
        ? current.filter((item) => item !== chapterGroupId)
        : [...current, chapterGroupId]
    );
  }

  /**
   * Бөлім мен тарау атауы бірдей болса, бір деңгейі артық болады.
   * Ондай жағдайда тақырыптар тікелей бөлімнің астында көрсетіледі.
   */
  function isRedundantGroup(section: { title: string; chapters: { title: string }[] }) {
    if (section.chapters.length !== 1) {
      return false;
    }

    const normalise = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
    return normalise(section.chapters[0].title) === normalise(section.title);
  }

  function renderTopicList(topics: { id: string; title: string }[]) {
    return (
      <div className="mt-3 space-y-1.5 border-l border-slate-200 pl-3 dark:border-zinc-800">
        {topics.map((topic) => {
          const active = topic.id === resolved?.chapter.id;
          const completed = hasCompletedChapter(topic.id);

          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => openTopic(topic.id)}
              className={`block w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                active
                  ? "text-slate-900 dark:text-zinc-50"
                  : completed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
              style={active ? { borderColor: activeBookTheme.border, background: activeBookTheme.soft } : undefined}
            >
              <p className="text-[0.82rem] font-medium leading-5">
                {topic.title}
                {completed ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500" /> : null}
              </p>
            </button>
          );
        })}
      </div>
    );
  }

  if (!isReady && !initialSubjects?.length) {
    return null;
  }

  return (
    <RouteGuard>
      <div className="page-shell" data-reader-page="true">
        <div className="page-glow z-0">
          {activeBookTheme.enabled ? (
            <>
              <div
                className="absolute right-[-18rem] top-0 h-[34rem] w-[34rem] rounded-full opacity-[0.06] blur-[160px]"
                style={{ background: activeBookTheme.accent }}
              />
              <div
                className="absolute bottom-[-18rem] left-[-18rem] h-[36rem] w-[36rem] rounded-full opacity-[0.05] blur-[160px]"
                style={{ background: activeBookTheme.accent }}
              />
            </>
          ) : null}
        </div>
        <SiteHeader />

        <main id="juz-main" className="mx-auto w-full max-w-[1680px] px-4 py-10 sm:px-6 lg:px-8 xl:px-10">
          {!resolved ? (
            <div className="glass-card p-8">Кітап немесе тақырып табылмады.</div>
          ) : (
            <>
              <div className="mb-6 text-sm text-slate-600 dark:text-zinc-400">
                <Link href="/catalog" className="hover:text-sky-700 dark:hover:text-cyan-300">
                  Кітаптар
                </Link>{" "}
                /{" "}
                <Link href={`/subjects/${resolved.subject.id}`} className="hover:text-sky-700 dark:hover:text-cyan-300">
                  {resolved.subject.name}
                </Link>{" "}
                / <span>{resolved.book.title}</span> / <span>{resolved.chapter.title}</span>
              </div>

              <div
                data-reader-grid="true"
                className={`relative grid grid-cols-1 items-start gap-8 ${
                  showStudyPanel
                    ? "xl:grid-cols-[300px_minmax(0,1fr)_340px] 2xl:grid-cols-[330px_minmax(0,1fr)_370px]"
                    : "xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[330px_minmax(0,1fr)]"
                }`}
              >
                <aside className="custom-scrollbar glass-card h-fit w-full min-w-0 self-start overflow-x-hidden p-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Кітап құрылымы</p>
                    <span className="text-xs text-emerald-600 dark:text-emerald-300">
                      {resolved.chapters.filter((topic) => hasCompletedChapter(topic.id)).length}/{resolved.chapters.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {resolved.sections.map((section) => {
                      const sectionOpen = openSections.includes(section.id);
                      const sectionCompleted = section.chapters
                        .flatMap((group) => group.topics)
                        .filter((topic) => hasCompletedChapter(topic.id)).length;
                      const sectionTotal = section.chapters.flatMap((group) => group.topics).length;

                      return (
                        <div key={section.id} className="rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <button type="button" onClick={() => toggleSection(section.id)} className="flex w-full items-start justify-between gap-3 text-left">
                            <div className="min-w-0">
                              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-zinc-500">
                                Бөлім
                              </p>
                              <p className="mt-1 text-[0.95rem] font-bold leading-6 text-slate-900 dark:text-zinc-50">{section.title}</p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                                {sectionCompleted}/{sectionTotal} тақырып оқылды
                              </p>
                            </div>
                            <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${sectionOpen ? "rotate-180" : ""}`} />
                          </button>

                          {sectionOpen ? (
                            <div className="mt-3 space-y-3">
                              {isRedundantGroup(section)
                                ? renderTopicList(section.chapters[0].topics)
                                : section.chapters.map((chapterGroup) => {
                                    const chapterGroupOpen = openChapterGroups.includes(chapterGroup.id);

                                    return (
                                      <div key={chapterGroup.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-zinc-950/60">
                                        <button type="button" onClick={() => toggleChapterGroup(chapterGroup.id)} className="flex w-full items-start justify-between gap-3 text-left">
                                          <div>
                                            <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">{chapterGroup.title}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{chapterGroup.topics.length} тақырып</p>
                                          </div>
                                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${chapterGroupOpen ? "rotate-180" : ""}`} />
                                        </button>

                                        {chapterGroupOpen ? renderTopicList(chapterGroup.topics) : null}
                                      </div>
                                    );
                                  })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <section data-reading-surface="true" className="reader-warm-surface relative z-10 min-w-0 overflow-hidden pb-6" style={readerSurfaceStyle}>
                  <div className="relative z-10 border-b border-slate-200/80 pb-6 dark:border-zinc-800">
                    <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
                      {nextTopic ? (
                        <button
                          type="button"
                          onClick={() => openTopic(nextTopic.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                        >
                          Келесі тақырып
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleChapterCompletion(resolved.chapter.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition ${
                          hasCompletedChapter(resolved.chapter.id)
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {hasCompletedChapter(resolved.chapter.id) ? "Оқылды деп белгіленді" : "Оқылды деп белгілеу"}
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm leading-6 text-slate-500 dark:text-zinc-400">{resolved.subject.name}</p>
                      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-zinc-50 md:text-5xl">{resolved.chapter.title}</h1>
                      <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600 dark:text-zinc-400">{resolved.chapter.excerpt}</p>
                    </div>
                  </div>

                  <div className="relative z-10 mt-6">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchTerm}
                        spellCheck={false}
                        onChange={(event) => setSearchTerm(event.target.value || "")}
                        placeholder="Осы тақырыптан іздеу"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-cyan-500/50"
                      />
                    </label>
                  </div>

                  {searchTerm ? (
                    <div className="relative z-10 mt-4 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <p className="text-sm font-semibold">Іздеу нәтижелері</p>
                      <div className="mt-3 space-y-2">
                        {searchResults.length ? (
                          searchResults.map((item) => (
                            <button
                              key={item.paragraphId}
                              type="button"
                              onClick={() => scrollToParagraph(item.paragraphId)}
                              className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                            >
                              <span>{item.before}</span>
                              <span className="font-black text-slate-950 dark:text-white">{item.match}</span>
                              <span>{item.after}</span>
                            </button>
                          ))
                        ) : (
                          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                            Осы тақырыптан нәтиже табылмады.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {isAdmin ? (
                    <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-3 dark:border-cyan-500/40 dark:bg-cyan-500/10">
                      <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-cyan-300">
                        <PencilLine className="h-4 w-4" />
                        <span>Әкімші режимі: тақырып мәтінін осы жерде түзете аласыз.</span>
                      </div>
                      {isEditingTopic ? (
                        <div className="flex items-center gap-2">
                          {topicEditError ? (
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{topicEditError}</span>
                          ) : null}
                          <button
                            type="button"
                            onClick={cancelTopicEdit}
                            disabled={isSavingTopic}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                          >
                            <X className="h-4 w-4" /> Болдырмау
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveTopicEdit()}
                            disabled={isSavingTopic}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                          >
                            <Save className="h-4 w-4" /> {isSavingTopic ? "Сақталуда..." : "Сақтау"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startTopicEdit}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                        >
                          <PencilLine className="h-4 w-4" /> Түзету
                        </button>
                      )}
                    </div>
                  ) : null}

                  {isAdmin && isEditingTopic ? (
                    // Мәтін кітаптағы қалпында тұрады, оны тікелей осы жерде түзетеміз;
                    // барлық құрал оң жақ бағанда.
                    <div className="relative z-10 mt-6 min-w-0">
                      <ChapterEditor
                        value={topicDraft}
                        onChange={(next) => setTopicDraft(next || "")}
                        layout="side"
                        heightClass="min-h-[60vh] max-h-[80vh]"
                        editorClassName="reader-prose max-w-none text-[19px] font-normal leading-[2.05] tracking-[0.005em] text-slate-900 dark:text-zinc-50"
                      />
                    </div>
                  ) : (
                  <article
                    ref={contentRef}
                    data-reading-column="true"
                    className="relative z-10 mt-10 min-w-0"
                  >
                    <ContentRenderer
                      content={displayedContent}
                      activeParagraphId={spokenParagraphId ?? activeParagraphId}
                      activeSentenceText={spokenText}
                      focusParagraphId={highlightedParagraphId}
                      highlights={chapterHighlights}
                      searchTerm={jumpQuery}
                      searchHitIndex={jumpHit}
                      onSelectParagraph={(paragraphId, text) => {
                        setActiveParagraphId(paragraphId);
                      }}
                      onSelectHighlight={(highlight, rect) => {
                        if (!continueReadingSettings.highlightMenuEnabled) {
                          closeSelectionBox();
                          return;
                        }

                        openSelectionBoxByRect({
                          text: highlight.selectedText,
                          paragraphId: highlight.paragraphId,
                          rect,
                          existingHighlightId: highlight.id
                        });
                      }}
                    />

                    {selectionBox ? (
                      <div
                        data-selection-box="true"
                        className="absolute z-40 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
                        style={{ left: Math.max(selectionBox.x - 20, 0), top: Math.max(selectionBox.y - 126, 0) }}
                      >
                        <p className="mb-2 text-xs text-slate-500 dark:text-zinc-400">Белгіленген мәтін</p>
                        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                          <span>Түсті таңдаңыз</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {palette.map((item) => {
                            const active = draftHighlightColor === item.color;

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setSelectedHighlightColor(item.color);
                                  applyHighlight(item.color);
                                }}
                                className={`h-8 w-8 rounded-full border-2 transition ${
                                  active ? "border-slate-900 dark:border-zinc-50" : "border-white dark:border-zinc-900"
                                }`}
                                style={getSwatchStyle(item.color)}
                                title={item.label}
                                aria-label={item.label}
                              />
                            );
                          })}
                        </div>
                        {selectionBox.existingHighlightId ? (
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              removeHighlight(selectionBox.existingHighlightId!);
                              closeSelectionBox();
                            }}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                            Маркерді өшіру
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-12 flex flex-col gap-3 border-t border-slate-200/80 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={scrollToTop}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                      >
                        <ArrowUp className="h-4 w-4" />
                        Жоғарыға көтерілу
                      </button>
                      {nextTopic ? (
                        <button
                          type="button"
                          onClick={() => openTopic(nextTopic.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 dark:text-zinc-950"
                          style={{ background: activeBookTheme.accent }}
                        >
                          Келесі тақырыпқа өту
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                          Бұл кітаптағы соңғы тақырып
                        </span>
                      )}
                    </div>
                  </article>
                  )}

                  <SourceAttributionBadge
                    sourceInfo={resolved.book.sourceInfo}
                    sourceLink={resolved.book.sourceLink}
                    className="relative z-10 mt-8"
                  />
                </section>

                {showStudyPanel ? (
                <aside className="glass-card h-fit w-full min-w-0 self-start p-5 xl:sticky xl:top-24">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-sky-600 dark:text-cyan-300" />
                    <h2 className="text-2xl font-semibold">Конспект және навигация</h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                    Осы жерде тест дайындап, маркерлерді қарап, конспект жазып отыра аласыз.
                  </p>

                  {resolved.book.hasPdf ? (
                    <div className="mt-5 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <p className="text-sm font-semibold">Оригинал кітап</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                        Қажет кезде PDF нұсқасын сайттың ішінде ашып, нақты бетіне қарай аласыз.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsPdfOpen(true)}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:brightness-95 dark:text-zinc-50"
                        style={{ borderColor: activeBookTheme.border, background: activeBookTheme.soft, color: activeBookTheme.accent }}
                      >
                        <FileText className="h-4 w-4" />
                        Оригинал PDF ашу
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <TestGenerator
                      topics={resolved.chapters.map((topic) => ({
                        id: topic.id,
                        title: topic.title,
                        content: topic.content
                      }))}
                      initialTopicId={resolved.chapter.id}
                      language={resolved.subject.name.toLowerCase().includes("ағылшын") ? "en" : "kk"}
                      theme={resolved.book.theme ?? "sky"}
                      onJumpToText={scrollToTextEvidence}
                      onTestFinished={saveTestResult}
                    />
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <button
                      type="button"
                      onClick={() => setIsAudioPanelOpen((current) => !current)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Podcast className="h-4 w-4 text-sky-700 dark:text-cyan-300" />
                        <p className="text-sm font-semibold">Тақырыпты аудиоға айналдыру</p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isAudioPanelOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isAudioPanelOpen ? (
                      <>
                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                          {isAudioPrepared
                            ? "Бұл тақырыптың аудиосы алдын ала дайындалған — күтудің қажеті жоқ. Оқылып жатқан сөз мәтінде ерекшеленіп отырады."
                            : "Осы тақырып мәтінін қазақша аудио форматта тыңдай аласыз."}
                        </p>

                        {isAudioPrepared ? (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Дайын аудио
                            {audioMarks.length ? ` · ${audioMarks.length} сөз белгісі` : ""}
                          </p>
                        ) : isAudioChecking ? (
                          <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500">Дайын аудио тексерілуде...</p>
                        ) : null}

                        {/* Дайын аудио болса, ойнатқыштың өзі жеткілікті — қосымша
                            «қосу» түймесі керек емес. Түйме тек аудио әлі
                            дайындалмаған тақырыпта ғана көрінеді. */}
                        {!isAudioPrepared ? (
                          <button
                            type="button"
                            onClick={() => void generateTopicAudio()}
                            disabled={isAudioLoading}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60 dark:text-zinc-950"
                            style={{ background: activeBookTheme.accent }}
                          >
                            <Podcast className="h-4 w-4" />
                            {isAudioLoading ? "Аудио дайындалып жатыр..." : "Аудио тыңдау"}
                          </button>
                        ) : null}
                        {audioError ? (
                          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                            {audioError}
                          </p>
                        ) : null}
                        {audioNotice ? (
                          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            {audioNotice}
                          </p>
                        ) : null}
                        <div className="mt-4 space-y-3">
                          <label className="block rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                            <span className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-zinc-200">
                              <Podcast className="h-3.5 w-3.5" />
                              Дауыс
                            </span>
                            <SelectMenu
                              size="sm"
                              ariaLabel="Дауыс"
                              value={audioVoice}
                              onChange={(next) => setAudioVoice(next as (typeof audioVoices)[number]["id"])}
                              options={audioVoices.map((voice) => ({ value: voice.id, label: voice.label }))}
                            />
                          </label>

                          <label className="block rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                            <span className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-zinc-200">
                              <Gauge className="h-3.5 w-3.5" />
                              Оқу жылдамдығы
                            </span>
                            <SelectMenu
                              size="sm"
                              ariaLabel="Оқу жылдамдығы"
                              value={String(audioRate)}
                              onChange={(next) => setAudioRate(Number(next))}
                              options={audioRates.map((rate) => ({ value: String(rate), label: `${rate}×` }))}
                            />
                          </label>

                          {audioUrl ? (
                            <>
                              <audio
                                ref={(element) => {
                                  audioRef.current = element;
                                  setAudioNode(element);
                                }}
                                controls
                                className="w-full"
                                src={audioUrl}
                              />
                              {isAudioPrepared && audioMarks.length ? (
                                <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                                  {isWordHighlightSupported
                                    ? "Аудио ойнағанда оқылып жатқан сөз мәтінде ерекшеленіп отырады."
                                    : "Бұл браузер сөзді ерекшелеуді қолдамайды, бірақ аудио толық жұмыс істейді."}
                                </p>
                              ) : null}
                            </>
                          ) : useBrowserVoice ? (
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                              {isBrowserSpeaking ? "Браузер дауысы қазір оқып тұр." : "Браузер дауысы дайын."}
                            </div>
                          ) : null}

                          {/* Ойнату/тоқтату түймелері тек браузер дауысында керек —
                              дайын аудионың өз ойнатқышында бәрі бар. */}
                          {!audioUrl && useBrowserVoice ? (
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={toggleAudioPlayback}
                                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                                title={isSpeechPaused ? "Жалғастыру" : "Кідірту"}
                                aria-label={isSpeechPaused ? "Жалғастыру" : "Кідірту"}
                              >
                                {isSpeechPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={stopTopicAudio}
                                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 dark:border-rose-500/30 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                title="Тоқтату"
                                aria-label="Тоқтату"
                              >
                                <Square className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}

                        </div>
                      </>
                    ) : (
                      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                        Қажет кезде ашып, осы тақырыпты аудио форматта тыңдай аласыз.
                      </p>
                    )}
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="mb-3 flex items-center gap-2">
                      <Highlighter className="h-4 w-4 text-sky-700 dark:text-cyan-300" />
                      <p className="text-sm font-semibold">Маркерлер тізімі</p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {chapterHighlights.slice(0, 8).map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => scrollToHighlight(item.id)}
                              className="min-w-0 flex-1 text-left transition hover:text-sky-700 dark:hover:text-cyan-300"
                            >
                              <span className="mr-2 inline-block h-3 w-3 rounded-full" style={getSwatchStyle(item.color)} />
                              {item.selectedText}
                            </button>
                            {continueReadingSettings.flashcardsEnabled ? (
                              <button
                                type="button"
                                onClick={() => void generateFlashcardFromHighlight(item)}
                                disabled={flashcardBusyId === item.id}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
                                title="Маркерден флешкарта жасау"
                                aria-label="Маркерден флешкарта жасау"
                              >
                                <BrainCircuit className="h-4 w-4" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeHighlight(item.id)}
                              className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Флешкарта мен жоспар профильдегі баптауға бағынады (тек оқу бетінде) */}
                  {continueReadingSettings.flashcardsEnabled ? (
                    <ReaderFlashcardsCard
                      subjectId={resolved.subject.id}
                      subjectName={resolved.subject.name}
                      bookId={resolved.book.id}
                      bookTitle={resolved.book.title}
                      chapterId={resolved.chapter.id}
                      chapterTitle={resolved.chapter.title}
                      accentColor={activeBookTheme.accent}
                    />
                  ) : null}

                  {continueReadingSettings.plannerEnabled ? (
                    <PlannerSidebarCard
                      subjectId={resolved.subject.id}
                      bookId={resolved.book.id}
                      topicId={resolved.chapter.id}
                      accentColor={activeBookTheme.accent}
                    />
                  ) : null}
                </aside>
                ) : null}
              </div>
            </>
          )}
        </main>
        {resolved && isSummaryModalOpen && continueReadingSettings.notesEnabled ? (
          <div className="fixed inset-0 z-[80] bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
            <div className="mx-auto max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-panel border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-zinc-800">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">Конспект</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-zinc-50">Жаңа конспект жазу</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                    Алдымен конспектті жазыңыз, содан кейін қай пән мен тақырыпқа сақталатынын таңдаңыз.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSummaryModal}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  Жабу
                </button>
              </div>

              <div className="max-h-[calc(92vh-154px)] overflow-y-auto px-6 py-6">
                <div className="grid gap-4">
                  <input
                    value={summaryTitle}
                    spellCheck={false}
                    onChange={(event) => {
                      setSummaryTitle(event.target.value || "");
                      setSummaryError("");
                    }}
                    placeholder="Конспект атауы"
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />

                  <NoteEditor
                    value={summaryContent}
                    onChange={(nextValue) => {
                      setSummaryContent(nextValue || "");
                      setSummaryError("");
                    }}
                    placeholder="Конспект мәтінін осы жерге жазыңыз..."
                  />

                  <div className="rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Қайда сақталады</p>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">Тек сақтау сәтінде қолданылады</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="grid min-w-0 gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-zinc-500">Пән</span>
                        <SelectMenu
                          ariaLabel="Пән"
                          value={summaryTargetSubjectId}
                          onChange={(nextSubjectId) => {
                            setSummaryTargetSubjectId(nextSubjectId);
                            const nextSubject = sourceSubjects.find((subject) => subject.id === nextSubjectId) ?? null;
                            const nextBook = nextSubject?.books[0] ?? null;
                            setSummaryTargetBookId(nextBook?.id ?? "");
                            setSummaryTargetChapterId(nextBook?.chapters[0]?.id ?? "");
                          }}
                          options={sourceSubjects.map((subject) => ({
                            value: subject.id,
                            label: subject.name,
                            badge: subject.books.length
                          }))}
                        />
                      </label>

                      <label className="grid min-w-0 gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-zinc-500">Кітап</span>
                        <SelectMenu
                          ariaLabel="Кітап"
                          value={summaryTargetBookId}
                          onChange={(nextBookId) => {
                            setSummaryTargetBookId(nextBookId);
                            const nextBook = noteTargetBooks.find((book) => book.id === nextBookId) ?? null;
                            setSummaryTargetChapterId(nextBook?.chapters[0]?.id ?? "");
                          }}
                          options={noteTargetBooks.map((book) => ({
                            value: book.id,
                            label: book.title,
                            badge: book.chapters.length
                          }))}
                        />
                      </label>

                      <label className="grid min-w-0 gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-zinc-500">Тақырып</span>
                        <SelectMenu
                          ariaLabel="Тақырып"
                          value={summaryTargetChapterId}
                          onChange={(next) => setSummaryTargetChapterId(next)}
                          options={noteTargetTopics.map((topic) => ({ value: topic.id, label: topic.title }))}
                        />
                      </label>
                    </div>
                  </div>

                  {summaryError ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                      {summaryError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-5 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={clearSummaryDraft}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:text-zinc-200"
                >
                  Тазалау
                </button>
                <button
                  type="button"
                  onClick={handleSummarySave}
                  className="rounded-2xl px-5 py-3 text-sm font-medium text-white transition hover:brightness-95 dark:text-zinc-950"
                  style={{ background: activeBookTheme.accent }}
                >
                  Конспектті сақтау
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {/* Конспект терезесі профильде өшірілсе, оқу бетінде көрінбейді */}
        {resolved && continueReadingSettings.notesEnabled ? (
          <div className="fixed bottom-20 right-6 z-50 flex max-h-[calc(100dvh-7rem)] w-[min(92vw,26rem)] flex-col">
            {isSummaryMiniCollapsed ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsSummaryMiniCollapsed(false)}
                  className="glass-card accent-ring inline-flex h-14 w-14 items-center justify-center rounded-full text-sky-700 transition hover:scale-[1.03] hover:text-sky-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                  aria-label="Конспект окошкасын ашу"
                  title="Конспект окошкасын ашу"
                >
                  <BookOpenText className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="glass-card accent-ring flex min-h-0 flex-col overflow-hidden p-4">
                <div className="flex shrink-0 items-start justify-between gap-3">
                  <div className="flex w-full items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSummaryMiniCollapsed(true)}
                      className="rounded-full bg-slate-100 p-3 text-sky-700 transition hover:bg-slate-200 dark:bg-zinc-800 dark:text-cyan-300 dark:hover:bg-zinc-700"
                      aria-label="Конспектті кішірейту"
                      title="Конспектті кішірейту"
                    >
                      <BookOpenText className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSummaryError("");
                        setIsSummaryModalOpen(true);
                      }}
                      className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                    >
                      Үлкейту
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid min-h-0 flex-1 auto-rows-min gap-3 overflow-y-auto pr-1">
                  <input
                    value={summaryTitle}
                    spellCheck={false}
                    onChange={(event) => {
                      setSummaryTitle(event.target.value || "");
                      setSummaryError("");
                    }}
                    placeholder="Конспект атауы"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                  <NoteEditor
                    value={summaryContent}
                    onChange={(nextValue) => {
                      setSummaryContent(nextValue || "");
                      setSummaryError("");
                    }}
                    placeholder="Қысқаша жазба..."
                    minHeightClass="min-h-[120px]"
                    maxHeightClass="max-h-none"
                  />
                  {summaryError ? (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                      {summaryError}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={clearSummaryDraft}
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:text-zinc-200"
                  >
                    Тазалау
                  </button>
                  <button
                    type="button"
                    onClick={handleSummarySave}
                    className="rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-95 dark:text-zinc-950"
                    style={{ background: activeBookTheme.accent }}
                  >
                    Сақтау
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
        {resolved ? (
          <button
            type="button"
            onClick={scrollToTop}
            className="fixed bottom-24 left-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition hover:-translate-y-1 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
            aria-label="Жоғарыға көтерілу"
            title="Жоғарыға көтерілу"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        ) : null}
        {resolved?.book.hasPdf && isPdfOpen ? (
          <div className="fixed inset-0 z-[80] bg-slate-950/70 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
            <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-panel border border-white/20 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{resolved.book.title}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    PDF беті: {resolved.chapter.pdfPage ?? 1}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPdfOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                >
                  Жабу
                </button>
              </div>
              <iframe
                title={`${resolved.book.title} PDF`}
                src={`/api/catalog/books/${resolved.book.id}/pdf#page=${resolved.chapter.pdfPage ?? 1}`}
                className="h-full w-full flex-1 bg-slate-100 dark:bg-zinc-900"
              />
            </div>
          </div>
        ) : null}
      </div>
    </RouteGuard>
  );
}



"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoAccounts } from "@/lib/demo-catalog";
import { sanitizePlainText, sanitizeRichText } from "@/lib/sanitize";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import type {
  AvatarLook,
  BookPreference,
  ComboCode,
  CompletedChapterRecord,
  ContinueReadingSettings,
  DailyTestRecord,
  FlashcardRecord,
  FlashcardStatus,
  DailyReadingRecord,
  HighlightRecord,
  LastReadRecord,
  NoteRecord,
  ReaderFeature,
  ReadingLeaderboardEntry,
  SessionUser,
  StudentProfile,
  SummaryRecord,
  TodoStatus,
  TodoTaskRecord,
  TreeStats
} from "@/lib/types";
import { GARDEN_TREE_COUNT } from "@/lib/types";
import { DEFAULT_AVATAR, normalizeAvatarLook } from "@/lib/avatar";

type LoginResult =
  | { ok: true; role: "USER" | "ADMIN" | "SUPERADMIN" }
  | { ok: false; message: string };

type AuthContextValue = {
  session: SessionUser | null;
  notes: NoteRecord[];
  highlights: HighlightRecord[];
  flashcards: FlashcardRecord[];
  summaries: SummaryRecord[];
  completedChapters: CompletedChapterRecord[];
  selectedCombo: ComboCode | null;
  continueReadingSettings: ContinueReadingSettings;
  lastReads: LastReadRecord[];
  todayReadingSeconds: number;
  totalReadingSeconds: number;
  readingLeaderboard: ReadingLeaderboardEntry[];
  profile: StudentProfile;
  treeStats: TreeStats;
  dailyTestStats: DailyTestRecord[];
  todoTasks: TodoTaskRecord[];
  /** Мини-персонаждың таңдалған түрі мен киімдері */
  avatar: AvatarLook;
  /** Пән бойынша кітаптар реті мен жасырылған кітаптар (subjectId → баптау) */
  bookPreferences: Record<string, BookPreference>;
  isReady: boolean;
  refreshSession: () => Promise<SessionUser | null>;
  logout: () => void;
  setSelectedCombo: (combo: ComboCode | null) => void;
  setContinueReadingEnabled: (enabled: boolean) => void;
  setHighlightMenuEnabled: (enabled: boolean) => void;
  /** Оқу бетіндегі конспект / жоспар / флешкартаны қосу-өшіру */
  setReaderFeatureEnabled: (feature: ReaderFeature, enabled: boolean) => void;
  updateProfile: (profile: StudentProfile) => void;
  addNote: (note: Omit<NoteRecord, "id" | "userEmail" | "createdAt">) => void;
  addHighlight: (highlight: Omit<HighlightRecord, "id" | "userEmail" | "createdAt">) => void;
  removeHighlight: (highlightId: string) => void;
  saveFlashcard: (flashcard: Omit<FlashcardRecord, "id" | "userEmail" | "createdAt">) => void;
  removeFlashcard: (flashcardId: string) => void;
  /** Қолмен жазылған флешкарта (сұрақ + жауап, тақырыпқа байлау міндетті емес) */
  addFlashcard: (
    flashcard: Pick<FlashcardRecord, "question" | "answer"> &
      Partial<Pick<FlashcardRecord, "subjectId" | "subjectName" | "bookId" | "bookTitle" | "chapterId" | "chapterTitle">>
  ) => void;
  updateFlashcard: (
    flashcardId: string,
    updates: Partial<
      Pick<FlashcardRecord, "question" | "answer" | "subjectId" | "subjectName" | "bookId" | "bookTitle" | "chapterId" | "chapterTitle">
    >
  ) => void;
  saveTestResult: (correctAnswers: number, totalQuestions: number) => void;
  saveSummary: (summary: Omit<SummaryRecord, "id" | "userEmail" | "createdAt" | "updatedAt">) => void;
  updateSummary: (summaryId: string, summary: Pick<SummaryRecord, "title" | "content">) => void;
  moveSummary: (summaryId: string, direction: "up" | "down") => void;
  removeSummary: (summaryId: string) => void;
  removeNote: (noteId: string) => void;
  toggleChapterCompletion: (chapterId: string) => void;
  hasCompletedChapter: (chapterId: string) => boolean;
  saveLastRead: (record: Omit<LastReadRecord, "updatedAt">) => void;
  addReadingSeconds: (seconds: number, bookId?: string) => void;
  waterTree: (seconds?: number, treeIndex?: number) => void;
  addTodoTask: (task: Omit<TodoTaskRecord, "id" | "createdAt" | "updatedAt">) => void;
  updateTodoTask: (taskId: string, updates: Partial<Omit<TodoTaskRecord, "id" | "createdAt" | "updatedAt">>) => void;
  removeTodoTask: (taskId: string) => void;
  toggleTodoTask: (taskId: string) => void;
  setTodoTaskStatus: (taskId: string, status: TodoStatus) => void;
  moveTodoTask: (taskId: string, targetTaskId: string, placeAfter?: boolean) => void;
  /** Бір не бірнеше флешкартаның жаттау күйін қояды (мысалы, «білемін» не «басынан») */
  setFlashcardStatus: (flashcardIds: string[], status: FlashcardStatus) => void;
  setAvatarLook: (patch: Partial<AvatarLook>) => void;
  saveBookPreference: (subjectId: string, preference: BookPreference) => void;
};

const SESSION_KEY = "juzbook-session";
const NOTES_KEY = "juzbook-notes";
const HIGHLIGHTS_KEY = "juzbook-highlights";
const FLASHCARDS_KEY = "juzbook-flashcards";
const SUMMARIES_KEY = "juzbook-summaries";
const COMPLETED_KEY = "juzbook-completed";
const STREAK_KEY = "juzbook-streak-records";
const COMBO_KEY = "juzbook-selected-combo";
const SETTINGS_KEY = "juzbook-settings";
const LAST_READS_KEY = "juzbook-last-reads";
const READING_TIME_KEY = "juzbook-reading-time";
const DAILY_TESTS_KEY = "juzbook-daily-tests";
const TREE_KEY = "juzbook-tree-stats";
const PROFILE_KEY = "juzbook-profile";
const TODO_KEY = "juzbook-todo-tasks";
const AVATAR_KEY = "juzbook-avatar";
const BOOK_PREFS_KEY = "juzbook-book-preferences";
/** Серверге жіберілген соңғы күйдің уақыты — құрылғылар арасында салыстыру үшін */
const STATE_VERSION_KEY = "juzbook-state-version";

/** Ескі TODO жазбаларына күй қосады (status болмаса, completed-тен алынады) */
function normalizeTodoTask(task: TodoTaskRecord): TodoTaskRecord {
  const status: TodoStatus = task.status ?? (task.completed ? "done" : "todo");
  return { ...task, status, completed: status === "done" };
}

function normalizeTodoTasks(tasks: TodoTaskRecord[]): TodoTaskRecord[] {
  return tasks.map(normalizeTodoTask);
}

/** Кітап баптауларын тексереді: тек жол түріндегі id-лер қалады */
function normalizeBookPreferences(raw: unknown): Record<string, BookPreference> {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result: Record<string, BookPreference> = {};
  for (const [subjectId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const record = value as Partial<BookPreference>;
    result[subjectId] = {
      order: Array.isArray(record.order) ? record.order.filter((id): id is string => typeof id === "string") : [],
      hidden: Array.isArray(record.hidden) ? record.hidden.filter((id): id is string => typeof id === "string") : []
    };
  }

  return result;
}

const defaultProfile: StudentProfile = {
  fullName: "Жантөре",
  schoolName: "",
  grade: "11-сынып",
  direction: "IT бағыты"
};

const defaultSettings: ContinueReadingSettings = {
  enabled: true,
  highlightMenuEnabled: true,
  notesEnabled: true,
  plannerEnabled: true,
  flashcardsEnabled: true
};

/** Ескі жазбада жаңа баптаулар болмауы мүмкін — оларды әдепкі мәнмен толтырамыз */
function normalizeSettings(settings: Partial<ContinueReadingSettings> | null | undefined): ContinueReadingSettings {
  return {
    enabled: settings?.enabled ?? true,
    highlightMenuEnabled: settings?.highlightMenuEnabled ?? true,
    notesEnabled: settings?.notesEnabled ?? true,
    plannerEnabled: settings?.plannerEnabled ?? true,
    flashcardsEnabled: settings?.flashcardsEnabled ?? true
  };
}

const defaultTreeStats: TreeStats = {
  totalWateredSeconds: 0,
  availableWaterSeconds: 0,
  lastWateredAt: null,
  trees: Array.from({ length: GARDEN_TREE_COUNT }, () => 0)
};

/**
 * Бұрын бір ғана ағаш болғандықтан, ескі деректе trees тізімі жоқ.
 * Сондай жағдайда бұрынғы барлық су бірінші ағашқа жазылады.
 */
function normalizeTreeStats(stats: TreeStats): TreeStats {
  const trees = Array.from({ length: GARDEN_TREE_COUNT }, (_, index) => {
    const value = stats.trees?.[index];
    return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
  });

  const hasSplit = trees.some((value) => value > 0);
  if (!hasSplit && stats.totalWateredSeconds > 0) {
    trees[0] = stats.totalWateredSeconds;
  }

  return {
    ...stats,
    trees,
    totalWateredSeconds: trees.reduce((sum, value) => sum + value, 0)
  };
}

const allowedHighlightColors = new Set([
  "#fde68a",
  "#fbbf24",
  "#fca5a5",
  "#fb7185",
  "#86efac",
  "#34d399",
  "#93c5fd",
  "#c4b5fd"
]);

function normalizeHighlightColor(color: string) {
  const normalized = (color || "").trim().toLowerCase();
  if (allowedHighlightColors.has(normalized)) {
    return normalized;
  }

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    return normalized;
  }

  return "#fde68a";
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getDayStamp(dateValue: string) {
  const date = new Date(dateValue);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function diffDays(left: string, right: string) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((getDayStamp(left) - getDayStamp(right)) / dayMs);
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [highlights, setHighlights] = useState<HighlightRecord[]>([]);
  const [flashcards, setFlashcards] = useState<FlashcardRecord[]>([]);
  const [summaries, setSummaries] = useState<SummaryRecord[]>([]);
  const [completedChapters, setCompletedChapters] = useState<CompletedChapterRecord[]>([]);
  const [selectedCombo, setSelectedComboState] = useState<ComboCode | null>(null);
  const [continueReadingSettings, setContinueReadingSettings] = useState<ContinueReadingSettings>(defaultSettings);
  const [lastReads, setLastReads] = useState<LastReadRecord[]>([]);
  const [readingTime, setReadingTime] = useState<DailyReadingRecord[]>([]);
  const [dailyTestStats, setDailyTestStats] = useState<DailyTestRecord[]>([]);
  const [serverTotalReadingSeconds, setServerTotalReadingSeconds] = useState(0);
  const [profile, setProfile] = useState<StudentProfile>(defaultProfile);
  const [treeStats, setTreeStats] = useState<TreeStats>(defaultTreeStats);
  const [todoTasks, setTodoTasks] = useState<TodoTaskRecord[]>([]);
  const [avatar, setAvatar] = useState<AvatarLook>(DEFAULT_AVATAR);
  const [bookPreferences, setBookPreferences] = useState<Record<string, BookPreference>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  // Сервердегі күй жүктелгенше жергілікті күйді серверге жазбаймыз
  const stateLoadedRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  // Бет жабылғанда соңғы күйді алу үшін
  const collectStateRef = useRef<() => Record<string, unknown>>(() => ({}));
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  // Серверден сессия тексерілгенше isReady=true болмайды: әйтпесе RouteGuard
  // кірген пайдаланушыны да қорғалған беттен шығарып жібереді.
  const isReady = isHydrated && isSessionChecked;

  const todayKey = getLocalDateKey();
  const todayReadingSeconds = readingTime.find((item) => item.dateKey === todayKey)?.seconds ?? 0;
  const localTotalReadingSeconds = readingTime.reduce((sum, item) => sum + item.seconds, 0);
  const totalReadingSeconds = Math.max(localTotalReadingSeconds, serverTotalReadingSeconds);
  const readingLeaderboard = useMemo<ReadingLeaderboardEntry[]>(
    () =>
      demoAccounts
        .filter((account) => account.role === "USER")
        .map((account) => {
          const isCurrent = session?.email === account.email;
          return {
            email: account.email,
            name: isCurrent ? profile.fullName || session?.name || account.name : account.name,
            role: account.role,
            totalSeconds: isCurrent ? totalReadingSeconds : 0,
            todaySeconds: isCurrent ? todayReadingSeconds : 0,
            isCurrent
          };
        })
        .sort((left, right) => right.totalSeconds - left.totalSeconds || left.name.localeCompare(right.name, "kk")),
    [profile.fullName, session?.email, session?.name, todayReadingSeconds, totalReadingSeconds]
  );

  /** Барлық жергілікті күйді бір нысанға жинайды */
  function collectState() {
    return {
      notes,
      highlights,
      flashcards,
      summaries,
      completedChapters,
      selectedCombo,
      continueReadingSettings,
      lastReads,
      readingTime,
      dailyTestStats,
      profile,
      treeStats,
      todoTasks,
      avatar,
      bookPreferences
    };
  }

  /** Серверден келген күйді қолданады */
  function applyState(data: Record<string, unknown>) {
    if (Array.isArray(data.notes)) setNotes(data.notes as NoteRecord[]);
    if (Array.isArray(data.highlights)) setHighlights(data.highlights as HighlightRecord[]);
    if (Array.isArray(data.flashcards)) setFlashcards(data.flashcards as FlashcardRecord[]);
    if (Array.isArray(data.summaries)) setSummaries(data.summaries as SummaryRecord[]);
    if (Array.isArray(data.completedChapters)) {
      setCompletedChapters(data.completedChapters as CompletedChapterRecord[]);
    }
    if (Array.isArray(data.lastReads)) setLastReads(data.lastReads as LastReadRecord[]);
    if (Array.isArray(data.readingTime)) setReadingTime(data.readingTime as DailyReadingRecord[]);
    if (Array.isArray(data.dailyTestStats)) setDailyTestStats(data.dailyTestStats as DailyTestRecord[]);
    if (Array.isArray(data.todoTasks)) setTodoTasks(normalizeTodoTasks(data.todoTasks as TodoTaskRecord[]));
    if (data.selectedCombo !== undefined) setSelectedComboState(data.selectedCombo as ComboCode | null);
    if (data.continueReadingSettings) {
      setContinueReadingSettings(normalizeSettings(data.continueReadingSettings as Partial<ContinueReadingSettings>));
    }
    if (data.profile) {
      const stored = data.profile as Partial<StudentProfile>;
      setProfile({
        fullName: stored.fullName ?? defaultProfile.fullName,
        schoolName: stored.schoolName ?? defaultProfile.schoolName,
        grade: stored.grade ?? defaultProfile.grade,
        direction: stored.direction ?? defaultProfile.direction
      });
    }
    if (data.treeStats) setTreeStats(normalizeTreeStats(data.treeStats as TreeStats));
    if (data.avatar) setAvatar(normalizeAvatarLook(data.avatar));
    if (data.bookPreferences) setBookPreferences(normalizeBookPreferences(data.bookPreferences));
  }

  useEffect(() => {
    setSession(null);
    setServerTotalReadingSeconds(0);
    setNotes(loadFromStorage<NoteRecord[]>(NOTES_KEY, []));
    setHighlights(loadFromStorage<HighlightRecord[]>(HIGHLIGHTS_KEY, []));
    setFlashcards(loadFromStorage<FlashcardRecord[]>(FLASHCARDS_KEY, []));
    setSummaries(loadFromStorage<SummaryRecord[]>(SUMMARIES_KEY, []));
    setCompletedChapters(loadFromStorage<CompletedChapterRecord[]>(COMPLETED_KEY, []));
    setSelectedComboState(loadFromStorage<ComboCode | null>(COMBO_KEY, null));

    setContinueReadingSettings(
      normalizeSettings(loadFromStorage<Partial<ContinueReadingSettings>>(SETTINGS_KEY, defaultSettings))
    );

    setLastReads(loadFromStorage<LastReadRecord[]>(LAST_READS_KEY, []));
    setReadingTime(loadFromStorage<DailyReadingRecord[]>(READING_TIME_KEY, []));
    setDailyTestStats(loadFromStorage<DailyTestRecord[]>(DAILY_TESTS_KEY, []));
    setTodoTasks(normalizeTodoTasks(loadFromStorage<TodoTaskRecord[]>(TODO_KEY, [])));

    const storedProfile = loadFromStorage<Partial<StudentProfile>>(PROFILE_KEY, defaultProfile);
    setProfile({
      fullName: storedProfile.fullName ?? defaultProfile.fullName,
      schoolName: storedProfile.schoolName ?? defaultProfile.schoolName,
      grade: storedProfile.grade ?? defaultProfile.grade,
      direction: storedProfile.direction ?? defaultProfile.direction
    });

    setTreeStats(normalizeTreeStats(loadFromStorage<TreeStats>(TREE_KEY, defaultTreeStats)));
    setAvatar(normalizeAvatarLook(loadFromStorage<unknown>(AVATAR_KEY, DEFAULT_AVATAR)));
    setBookPreferences(normalizeBookPreferences(loadFromStorage<unknown>(BOOK_PREFS_KEY, {})));
    setIsHydrated(true);
  }, []);

  async function refreshSession() {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "same-origin"
      });

      if (!response.ok) {
        setSession(null);
        setServerTotalReadingSeconds(0);
        return null;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        session?: Pick<SessionUser, "id" | "email" | "name" | "role"> & { totalReadingSeconds?: number };
      };

      if (!payload.session) {
        setSession(null);
        setServerTotalReadingSeconds(0);
        return null;
      }

      const nextSession: SessionUser = {
        id: payload.session.id,
        email: payload.session.email,
        name: payload.session.name,
        role: payload.session.role,
        currentStreak: session?.currentStreak ?? 1,
        lastLoginDate: session?.lastLoginDate ?? new Date().toISOString(),
        treeMood: session?.treeMood ?? "healthy"
      };

      setServerTotalReadingSeconds(payload.session.totalReadingSeconds ?? 0);
      setSession(nextSession);
      return nextSession;
    } catch {
      setSession(null);
      setServerTotalReadingSeconds(0);
      return null;
    }
  }

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void refreshSession().finally(() => setIsSessionChecked(true));
  }, [isHydrated]);

  // Аккаунтқа кіргенде күйді серверден аламыз: басқа компьютерде жасалған
  // прогресс, маркерлер мен ағаш бағы осында да көрінуі керек.
  useEffect(() => {
    // Аккаунт ауысқанда жаңа күй жүктелгенше серверге ешнәрсе жазылмайды
    stateLoadedRef.current = false;

    if (!isHydrated || !session) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/user/state", { credentials: "same-origin", cache: "no-store" });
        const payload = (await response.json()) as {
          found?: boolean;
          version?: number;
          data?: Record<string, unknown> | null;
        };

        if (cancelled) {
          return;
        }

        const serverVersion = Number(payload.version || 0);

        if (payload.found && payload.data) {
          // Аккаунт бір — нәтиже де бір болуы керек. Сондықтан кірген сайын
          // сервердегі күй басты дереккөз болып саналады: құрылғыдағы ескі
          // жергілікті дерек оны басып қалмайды.
          applyState(payload.data);
          saveToStorage(STATE_VERSION_KEY, serverVersion);
        } else {
          // Серверде әлі дерек жоқ — осы құрылғыдағы күйді бірінші рет жүктейміз
          saveToStorage(STATE_VERSION_KEY, 0);
        }

        stateLoadedRef.current = true;
      } catch {
        stateLoadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, session?.email]);

  // Бет жабылғанда немесе фонға кеткенде кідірісті күтпей бірден жібереміз
  useEffect(() => {
    if (!isHydrated || !session) {
      return;
    }

    const flush = () => {
      if (!stateLoadedRef.current) {
        return;
      }

      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      const version = Date.now();
      saveToStorage(STATE_VERSION_KEY, version);
      const body = JSON.stringify({ version, data: collectStateRef.current() });

      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/user/state", new Blob([body], { type: "application/json" }));
        return;
      }

      void fetch("/api/user/state", {
        method: "PUT",
        credentials: "same-origin",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body
      }).catch(() => undefined);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isHydrated, session?.email]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    collectStateRef.current = collectState;

    saveToStorage(SESSION_KEY, session);
    saveToStorage(NOTES_KEY, notes);
    saveToStorage(HIGHLIGHTS_KEY, highlights);
    saveToStorage(FLASHCARDS_KEY, flashcards);
    saveToStorage(SUMMARIES_KEY, summaries);
    saveToStorage(COMPLETED_KEY, completedChapters);
    saveToStorage(COMBO_KEY, selectedCombo);
    saveToStorage(SETTINGS_KEY, continueReadingSettings);
    saveToStorage(LAST_READS_KEY, lastReads);
    saveToStorage(READING_TIME_KEY, readingTime);
    saveToStorage(DAILY_TESTS_KEY, dailyTestStats);
    saveToStorage(PROFILE_KEY, profile);
    saveToStorage(TREE_KEY, treeStats);
    saveToStorage(TODO_KEY, todoTasks);
    saveToStorage(AVATAR_KEY, avatar);
    saveToStorage(BOOK_PREFS_KEY, bookPreferences);

    // Сервермен үндестіру: соңғы өзгерістен кейін 2,5 секундта бір рет жіберіледі
    if (!session || !stateLoadedRef.current) {
      return;
    }

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(() => {
      const version = Date.now();
      saveToStorage(STATE_VERSION_KEY, version);

      void fetch("/api/user/state", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, data: collectState() })
      }).catch(() => undefined);
    }, 2500);
  }, [
    completedChapters,
    continueReadingSettings,
    highlights,
    flashcards,
    isHydrated,
    lastReads,
    notes,
    profile,
    readingTime,
    dailyTestStats,
    selectedCombo,
    session,
    summaries,
    todoTasks,
    treeStats,
    avatar,
    bookPreferences
  ]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      notes: session ? notes.filter((note) => note.userEmail === session.email) : [],
      highlights: session ? highlights.filter((item) => item.userEmail === session.email) : [],
      flashcards: session ? flashcards.filter((item) => item.userEmail === session.email) : [],
      summaries: session ? summaries.filter((item) => item.userEmail === session.email) : [],
      completedChapters,
      selectedCombo,
      continueReadingSettings,
      lastReads,
      todayReadingSeconds,
      totalReadingSeconds,
      readingLeaderboard,
      profile,
      treeStats,
      dailyTestStats,
      todoTasks,
      avatar,
      bookPreferences,
      isReady,
      refreshSession,
      logout: () => {
        setServerTotalReadingSeconds(0);
        setSession(null);
      },
      setSelectedCombo: (combo) => {
        setSelectedComboState(combo);
      },
      setContinueReadingEnabled: (enabled) => {
        setContinueReadingSettings((current) => ({ ...current, enabled }));
      },
      setHighlightMenuEnabled: (enabled) => {
        setContinueReadingSettings((current) => ({ ...current, highlightMenuEnabled: enabled }));
      },
      setReaderFeatureEnabled: (feature, enabled) => {
        const key =
          feature === "notes" ? "notesEnabled" : feature === "planner" ? "plannerEnabled" : "flashcardsEnabled";
        setContinueReadingSettings((current) => ({ ...current, [key]: enabled }));
      },
      updateProfile: (nextProfile) => {
        setProfile({
          fullName: sanitizePlainText(nextProfile.fullName || ""),
          schoolName: sanitizePlainText(nextProfile.schoolName || ""),
          grade: sanitizePlainText(nextProfile.grade || ""),
          direction: sanitizePlainText(nextProfile.direction || "")
        });
      },
      addNote: (note) => {
        if (!session) {
          return;
        }

        const nextNote: NoteRecord = {
          ...note,
          noteText: sanitizePlainText(note.noteText),
          selectedText: sanitizePlainText(note.selectedText),
          id: `note-${Math.random().toString(36).slice(2, 10)}`,
          userEmail: session.email,
          createdAt: new Date().toISOString()
        };

        setNotes((current) => [nextNote, ...current]);
      },
      addHighlight: (highlight) => {
        if (!session) {
          return;
        }

        setHighlights((current) => {
          const cleanSelectedText = sanitizePlainText(highlight.selectedText);
          const cleanColor = normalizeHighlightColor(highlight.color);
          const sameSelection = current.find(
            (item) =>
              item.userEmail === session.email &&
              item.chapterId === highlight.chapterId &&
              item.paragraphId === highlight.paragraphId &&
              item.selectedText.trim().toLowerCase() === cleanSelectedText.trim().toLowerCase()
          );

          if (sameSelection && sameSelection.color === cleanColor) {
            return current;
          }

          const nextHighlight: HighlightRecord = {
            ...highlight,
            selectedText: cleanSelectedText,
            color: cleanColor,
            id: `highlight-${Math.random().toString(36).slice(2, 10)}`,
            userEmail: session.email,
            createdAt: new Date().toISOString()
          };

          const filtered = current.filter(
            (item) =>
              !(
                item.userEmail === session.email &&
                item.chapterId === highlight.chapterId &&
                item.paragraphId === highlight.paragraphId &&
                item.selectedText.trim().toLowerCase() === cleanSelectedText.trim().toLowerCase()
              )
          );

          return [nextHighlight, ...filtered];
        });
      },
      removeHighlight: (highlightId) => {
        setHighlights((current) => current.filter((item) => item.id !== highlightId));
      },
      saveFlashcard: (flashcard) => {
        if (!session) {
          return;
        }

        const nextFlashcard: FlashcardRecord = {
          ...flashcard,
          id: `flashcard-${Math.random().toString(36).slice(2, 10)}`,
          userEmail: session.email,
          sourceText: sanitizePlainText(flashcard.sourceText),
          question: sanitizePlainText(flashcard.question),
          answer: sanitizePlainText(flashcard.answer),
          createdAt: new Date().toISOString()
        };

        setFlashcards((current) => [nextFlashcard, ...current]);
      },
      removeFlashcard: (flashcardId) => {
        setFlashcards((current) => current.filter((item) => item.id !== flashcardId));
      },
      addFlashcard: (flashcard) => {
        if (!session) {
          return;
        }

        const question = sanitizePlainText(flashcard.question || "");
        const answer = sanitizePlainText(flashcard.answer || "");
        if (!question || !answer) {
          return;
        }

        const now = new Date().toISOString();
        const nextFlashcard: FlashcardRecord = {
          id: `flashcard-${Math.random().toString(36).slice(2, 10)}`,
          userEmail: session.email,
          subjectId: flashcard.subjectId ?? "",
          subjectName: sanitizePlainText(flashcard.subjectName ?? ""),
          bookId: flashcard.bookId ?? "",
          bookTitle: sanitizePlainText(flashcard.bookTitle ?? ""),
          chapterId: flashcard.chapterId ?? "",
          chapterTitle: sanitizePlainText(flashcard.chapterTitle ?? ""),
          sourceText: "",
          question,
          answer,
          status: "new",
          createdAt: now,
          updatedAt: now
        };

        setFlashcards((current) => [nextFlashcard, ...current]);
      },
      updateFlashcard: (flashcardId, updates) => {
        if (!session) {
          return;
        }

        const now = new Date().toISOString();
        setFlashcards((current) =>
          current.map((item) => {
            if (item.id !== flashcardId || item.userEmail !== session.email) {
              return item;
            }

            const question = updates.question !== undefined ? sanitizePlainText(updates.question) : item.question;
            const answer = updates.answer !== undefined ? sanitizePlainText(updates.answer) : item.answer;

            return {
              ...item,
              ...updates,
              subjectName: updates.subjectName !== undefined ? sanitizePlainText(updates.subjectName) : item.subjectName,
              bookTitle: updates.bookTitle !== undefined ? sanitizePlainText(updates.bookTitle) : item.bookTitle,
              chapterTitle: updates.chapterTitle !== undefined ? sanitizePlainText(updates.chapterTitle) : item.chapterTitle,
              // Бос сұрақ/жауап сақталмайды — бұрынғы мәні қалады
              question: question || item.question,
              answer: answer || item.answer,
              updatedAt: now
            };
          })
        );
      },
      saveTestResult: (correctAnswers, totalQuestions) => {
        if (totalQuestions <= 0) {
          return;
        }

        const score = Math.round((correctAnswers / totalQuestions) * 100);

        setDailyTestStats((current) => {
          const existing = current.find((item) => item.dateKey === todayKey);
          if (existing) {
            return current.map((item) =>
              item.dateKey === todayKey
                ? {
                    ...item,
                    bestScore: Math.max(item.bestScore, score),
                    bestCorrectAnswers:
                      score >= item.bestScore ? Math.max(item.bestCorrectAnswers, correctAnswers) : item.bestCorrectAnswers,
                    bestTotalQuestions:
                      score >= item.bestScore ? Math.max(item.bestTotalQuestions, totalQuestions) : item.bestTotalQuestions,
                    completedCount: item.completedCount + 1,
                    perfectCount: item.perfectCount + (correctAnswers === totalQuestions ? 1 : 0)
                  }
                : item
            );
          }

          return [
            ...current,
            {
              dateKey: todayKey,
              bestScore: score,
              bestCorrectAnswers: correctAnswers,
              bestTotalQuestions: totalQuestions,
              completedCount: 1,
              perfectCount: correctAnswers === totalQuestions ? 1 : 0
            }
          ];
        });

        // Әр дұрыс жауап бақтағы суды бір минутқа толтырады
        if (correctAnswers > 0) {
          setTreeStats((current) => ({
            ...current,
            availableWaterSeconds: current.availableWaterSeconds + correctAnswers * 60
          }));
        }
      },
      saveSummary: (summary) => {
        if (!session) {
          return;
        }

        const now = new Date().toISOString();
        setSummaries((current) => {
          const existing = current.find(
            (item) => item.userEmail === session.email && item.chapterId === summary.chapterId && item.title === summary.title
          );

          if (existing) {
            return current.map((item) =>
              item.id === existing.id
                ? {
                    ...item,
                    ...summary,
                    title: sanitizePlainText(summary.title),
                    content: sanitizeRichText(summary.content),
                    updatedAt: now
                  }
                : item
            );
          }

          const nextSummary: SummaryRecord = {
            ...summary,
            title: sanitizePlainText(summary.title),
            content: sanitizeRichText(summary.content),
            id: `summary-${Math.random().toString(36).slice(2, 10)}`,
            userEmail: session.email,
            createdAt: now,
            updatedAt: now
          };

          return [nextSummary, ...current];
        });
      },
      updateSummary: (summaryId, summary) => {
        if (!session) {
          return;
        }

        const now = new Date().toISOString();
        setSummaries((current) =>
          current.map((item) =>
            item.id === summaryId && item.userEmail === session.email
              ? {
                  ...item,
                  title: sanitizePlainText(summary.title),
                  content: sanitizeRichText(summary.content),
                  updatedAt: now
                }
              : item
          )
        );
      },
      moveSummary: (summaryId, direction) => {
        if (!session) {
          return;
        }

        setSummaries((current) => {
          const ownIndices = current
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.userEmail === session.email);
          const ownPosition = ownIndices.findIndex(({ item }) => item.id === summaryId);

          if (ownPosition === -1) {
            return current;
          }

          const targetOwnPosition = direction === "up" ? ownPosition - 1 : ownPosition + 1;
          if (targetOwnPosition < 0 || targetOwnPosition >= ownIndices.length) {
            return current;
          }

          const sourceIndex = ownIndices[ownPosition].index;
          const targetIndex = ownIndices[targetOwnPosition].index;
          const next = [...current];
          const [sourceItem] = next.splice(sourceIndex, 1);
          next.splice(targetIndex, 0, sourceItem);
          return next;
        });
      },
      removeSummary: (summaryId) => {
        setSummaries((current) => current.filter((summary) => summary.id !== summaryId));
      },
      removeNote: (noteId) => {
        setNotes((current) => current.filter((note) => note.id !== noteId));
      },
      toggleChapterCompletion: (chapterId) => {
        setCompletedChapters((current) => {
          const exists = current.some((item) => item.chapterId === chapterId);
          if (exists) {
            return current.filter((item) => item.chapterId !== chapterId);
          }

          return [...current, { chapterId, completedAt: new Date().toISOString() }];
        });
      },
      hasCompletedChapter: (chapterId) => completedChapters.some((item) => item.chapterId === chapterId),
      saveLastRead: (record) => {
        setLastReads((current) => {
          const next: LastReadRecord = {
            ...record,
            updatedAt: new Date().toISOString()
          };
          const filtered = current.filter((item) => !(item.bookId === record.bookId && item.chapterId === record.chapterId));
          return [next, ...filtered].slice(0, 20);
        });
      },
      addReadingSeconds: (seconds, bookId) => {
        setServerTotalReadingSeconds((current) => current + seconds);
        setReadingTime((current) => {
          const existing = current.find((item) => item.dateKey === todayKey);
          if (existing) {
            return current.map((item) => (item.dateKey === todayKey ? { ...item, seconds: item.seconds + seconds } : item));
          }

          return [...current, { dateKey: todayKey, seconds }];
        });

        setTreeStats((current) => ({
          ...current,
          availableWaterSeconds: current.availableWaterSeconds + seconds
        }));

        if (session && bookId) {
          void fetch("/api/reading/progress", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              bookId,
              seconds
            })
          }).catch(() => undefined);
        }
      },
      waterTree: (seconds, treeIndex = 0) => {
        setTreeStats((current) => {
          const normalized = normalizeTreeStats(current);
          const amount = Math.min(seconds ?? normalized.availableWaterSeconds, normalized.availableWaterSeconds);
          if (amount <= 0) {
            return current;
          }

          const target = Math.min(Math.max(0, Math.trunc(treeIndex)), GARDEN_TREE_COUNT - 1);
          const trees = (normalized.trees ?? []).map((value, index) => (index === target ? value + amount : value));

          return {
            trees,
            totalWateredSeconds: trees.reduce((sum, value) => sum + value, 0),
            availableWaterSeconds: normalized.availableWaterSeconds - amount,
            lastWateredAt: new Date().toISOString()
          };
        });

        setSession((current) => (current ? { ...current, treeMood: "healthy" } : current));
      },
      addTodoTask: (task) => {
        const now = new Date().toISOString();
        setTodoTasks((current) => [
          {
            ...task,
            title: sanitizePlainText(task.title),
            description: sanitizePlainText(task.description),
            dueTime: task.dueTime ?? null,
            remindWhileReading: Boolean(task.remindWhileReading),
            subtasks: (task.subtasks || []).map((item) => ({
              id: item.id,
              title: sanitizePlainText(item.title),
              completed: Boolean(item.completed)
            })),
            status: task.status ?? (task.completed ? "done" : "todo"),
            completed: (task.status ?? (task.completed ? "done" : "todo")) === "done",
            id: `todo-${Math.random().toString(36).slice(2, 10)}`,
            createdAt: now,
            updatedAt: now
          },
          ...current
        ]);
      },
      updateTodoTask: (taskId, updates) => {
        const now = new Date().toISOString();
        setTodoTasks((current) =>
          current.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...updates,
                  title: updates.title !== undefined ? sanitizePlainText(updates.title) : task.title,
                  description:
                    updates.description !== undefined ? sanitizePlainText(updates.description) : task.description,
                  dueTime: updates.dueTime !== undefined ? updates.dueTime ?? null : task.dueTime ?? null,
                  remindWhileReading:
                    updates.remindWhileReading !== undefined
                      ? Boolean(updates.remindWhileReading)
                      : Boolean(task.remindWhileReading),
                  subtasks:
                    updates.subtasks !== undefined
                      ? updates.subtasks.map((item) => ({
                          id: item.id,
                          title: sanitizePlainText(item.title),
                          completed: Boolean(item.completed)
                        }))
                      : task.subtasks,
                  updatedAt: now
                }
              : task
          )
        );
      },
      removeTodoTask: (taskId) => {
        setTodoTasks((current) => current.filter((task) => task.id !== taskId));
      },
      toggleTodoTask: (taskId) => {
        const now = new Date().toISOString();
        setTodoTasks((current) =>
          current.map((task) => {
            if (task.id !== taskId) {
              return task;
            }
            const nextDone = !(task.status ? task.status === "done" : task.completed);
            return {
              ...task,
              status: nextDone ? "done" : "todo",
              completed: nextDone,
              updatedAt: now
            };
          })
        );
      },
      setTodoTaskStatus: (taskId, status) => {
        const now = new Date().toISOString();
        setTodoTasks((current) =>
          current.map((task) =>
            task.id === taskId
              ? { ...task, status, completed: status === "done", updatedAt: now }
              : task
          )
        );
      },
      moveTodoTask: (taskId, targetTaskId, placeAfter = false) => {
        setTodoTasks((current) => {
          const sourceIndex = current.findIndex((task) => task.id === taskId);
          const targetIndex = current.findIndex((task) => task.id === targetTaskId);

          if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
            return current;
          }

          const next = [...current];
          const [moved] = next.splice(sourceIndex, 1);
          // Мақсатты тапсырма алынған соң индекс жылжуы мүмкін — қайта табамыз.
          const insertBase = next.findIndex((task) => task.id === targetTaskId);
          next.splice(insertBase + (placeAfter ? 1 : 0), 0, moved);
          return next;
        });
      },
      setFlashcardStatus: (flashcardIds, status) => {
        if (!session || !flashcardIds.length) {
          return;
        }

        const ids = new Set(flashcardIds);
        const now = new Date().toISOString();
        setFlashcards((current) =>
          current.map((item) =>
            ids.has(item.id) && item.userEmail === session.email ? { ...item, status, reviewedAt: now } : item
          )
        );
      },
      setAvatarLook: (patch) => {
        setAvatar((current) => normalizeAvatarLook({ ...current, ...patch }));
      },
      saveBookPreference: (subjectId, preference) => {
        setBookPreferences((current) => ({
          ...current,
          [subjectId]: {
            order: Array.from(new Set(preference.order)),
            hidden: Array.from(new Set(preference.hidden))
          }
        }));
      }
    }),
    [
      completedChapters,
      continueReadingSettings,
      highlights,
      flashcards,
      isReady,
      lastReads,
      notes,
      profile,
      readingLeaderboard,
      refreshSession,
      selectedCombo,
      session,
      summaries,
      todayKey,
      todayReadingSeconds,
      todoTasks,
      totalReadingSeconds,
      treeStats,
      dailyTestStats,
      avatar,
      bookPreferences
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

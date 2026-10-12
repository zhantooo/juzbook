export type Role = "USER" | "ADMIN" | "SUPERADMIN";

export type TopicRecord = {
  id: string;
  title: string;
  order: number;
  isHidden?: boolean;
  content: string;
  excerpt: string;
  pdfPage?: number | null;
  bookId: string;
  sectionId: string;
  chapterGroupId: string;
  originalTitle?: string;
  originalExcerpt?: string;
  originalContent?: string;
  lastSavedAt?: string;
};

export type ChapterRecord = TopicRecord;

export type ChapterGroupRecord = {
  id: string;
  title: string;
  order: number;
  isHidden?: boolean;
  bookId: string;
  sectionId: string;
  topics: TopicRecord[];
};

export type SectionRecord = {
  id: string;
  title: string;
  order: number;
  isHidden?: boolean;
  bookId: string;
  chapters: ChapterGroupRecord[];
};

export type BookRecord = {
  id: string;
  title: string;
  subjectId: string;
  isHidden?: boolean;
  coverImage?: string | null;
  sourceInfo?: string | null;
  sourceLink?: string | null;
  theme?: string | null;
  pdfFileName?: string | null;
  hasPdf?: boolean;
  sections: SectionRecord[];
  chapters: TopicRecord[];
};

export type SubjectRecord = {
  id: string;
  name: string;
  description: string;
  /// Әкімші жасырған пән оқырманға көрінбейді, әкімшіде тұра береді.
  isHidden?: boolean;
  books: BookRecord[];
};

export type SpecificationTopicRecord = {
  id: string;
  topicId: string;
  title: string;
  excerpt: string;
  bookId: string;
  bookTitle: string;
  sectionId: string;
  sectionTitle: string;
  chapterGroupId: string;
  chapterGroupTitle: string;
  order: number;
};

export type SpecificationRecord = {
  id: string;
  title: string;
  description: string;
  order: number;
  subjectId: string;
  topics: SpecificationTopicRecord[];
};

export type NoteRecord = {
  id: string;
  userEmail: string;
  subjectId: string;
  subjectName: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  paragraphId: string;
  selectedText: string;
  noteText: string;
  createdAt: string;
};

export type HighlightColor = string;

export type HighlightRecord = {
  id: string;
  userEmail: string;
  subjectId: string;
  bookId: string;
  chapterId: string;
  paragraphId: string;
  selectedText: string;
  color: HighlightColor;
  createdAt: string;
};

export type SummaryRecord = {
  id: string;
  userEmail: string;
  subjectId: string;
  subjectName: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CompletedChapterRecord = {
  chapterId: string;
  completedAt: string;
};

export type TreeStats = {
  /** Үш ағаштың қосындысы */
  totalWateredSeconds: number;
  availableWaterSeconds: number;
  lastWateredAt: string | null;
  /** Әр ағашқа бөлек құйылған секунд (үшеуі) */
  trees?: number[];
};

export const GARDEN_TREE_COUNT = 3;

/** Жаттау күйі: жаңа, қайталау керек, біледі (жаттау кезегіне қайта шықпайды) */
export type FlashcardStatus = "new" | "review" | "known";

export type FlashcardRecord = {
  id: string;
  userEmail: string;
  subjectId: string;
  subjectName: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  sourceText: string;
  question: string;
  answer: string;
  createdAt: string;
  updatedAt?: string;
  /** Ескі карточкаларда болмауы мүмкін — «new» деп саналады */
  status?: FlashcardStatus;
  reviewedAt?: string;
};

export type DailyTestRecord = {
  dateKey: string;
  bestScore: number;
  bestCorrectAnswers: number;
  bestTotalQuestions: number;
  completedCount: number;
  perfectCount: number;
};

export type StudentProfile = {
  fullName: string;
  schoolName: string;
  grade: string;
  direction: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  currentStreak: number;
  lastLoginDate: string;
  treeMood: "healthy" | "wilted";
};

export type PomodoroMode = "focus" | "break";

export type GlossaryEntry = {
  id: string;
  word: string;
  definition: string;
};

export type ComboCode =
  | "BIO-CHEM"
  | "GEO-BIO"
  | "GEO-MATH"
  | "GEO-WORLD"
  | "WORLD-ENG"
  | "GEO-ENG"
  | "WORLD-LAW"
  | "PHYS-MATH"
  | "PHYS-CHEM"
  | "INFO-MATH"
  | "LIT-LANG"
  | "RUSLIT"
  | "CREATIVE";

export type ContinueReadingSettings = {
  enabled: boolean;
  highlightMenuEnabled: boolean;
  /** Кітап оқығанда конспект терезесін көрсету */
  notesEnabled: boolean;
  /** Кітап оқығанда жоспар карточкасы мен еске салуларды көрсету */
  plannerEnabled: boolean;
  /** Кітап оқығанда флешкарта құралдарын көрсету */
  flashcardsEnabled: boolean;
};

/** Оқу бетінде профильден қосып-өшіруге болатын функциялар */
export type ReaderFeature = "notes" | "planner" | "flashcards";

/** Мини-персонаждың таңдалған түрі мен киімдері (id — lib/avatar.ts каталогынан) */
export type AvatarLook = {
  base: string;
  hat: string;
  /** Бетке киетін зат: көзілдірік, маска т.б. (ескі жазбада болмауы мүмкін) */
  mask: string;
  top: string;
  bottom: string;
  shoes: string;
};

/** Оқушының пән ішіндегі кітаптар реті мен жасырған кітаптары */
export type BookPreference = {
  order: string[];
  hidden: string[];
};

export type LastReadRecord = {
  subjectId: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  updatedAt: string;
};

export type DailyReadingRecord = {
  dateKey: string;
  seconds: number;
};

export type ReadingLeaderboardEntry = {
  email: string;
  name: string;
  role: Role;
  totalSeconds: number;
  todaySeconds: number;
  isCurrent: boolean;
};

export type TodoSubtask = {
  id: string;
  title: string;
  completed: boolean;
};

/** any.do стиліндегі үш күй: орындалатын, орындалуда, орындалды */
export type TodoStatus = "todo" | "doing" | "done";

export type TodoTaskRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  /** Орындалу күйі. Ескі жазбаларда болмауы мүмкін — completed-тен алынады. */
  status?: TodoStatus;
  dueTime?: string | null;
  remindWhileReading?: boolean;
  createdAt: string;
  updatedAt: string;
  subjectId?: string | null;
  subjectName?: string | null;
  bookId?: string | null;
  bookTitle?: string | null;
  topicId?: string | null;
  topicTitle?: string | null;
  subtasks: TodoSubtask[];
};

/**
 * Arena-ның бүкіл серверлік шақыруы осы бір қабаттан өтеді.
 *
 * Интерфейс алдымен жазылады да, интерфейске қарсы екі іске асыру болады:
 * `service.mock.ts` (жадта, backend-сіз) және `service.http.ts` (нағыз API).
 * Сол арқылы интерфейсті backend дайын болмай тұрып толық құрастыруға болады,
 * ал `openapi.yaml` келісімшарты осы типтерден жазылады.
 */

/** Матчтың күйі */
export type MatchStatus = "waiting" | "active" | "finished" | "abandoned";

/** Ойыншының матчтағы көрінісі */
export type MatchSide = {
  playerId: string;
  displayName: string;
  score: number;
  /** Ағымдағы сұраққа жауап берді ме (қайсысын таңдағаны көрсетілмейді) */
  answered: boolean;
};

/** Ойыншыға берілетін сұрақ: дұрыс жауабы жоқ */
export type PublicQuestion = {
  position: number;
  prompt: string;
  options: string[];
  /** Сұрақ ашылған сәт (ISO) — таймерді сервер белгілейді */
  opensAt: string;
  /** Жабылатын сәт (ISO) */
  closesAt: string;
};

/** Сұрақ жабылған соң ашылатын нәтиже */
export type QuestionResult = {
  position: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  you: { chosenIndex: number | null; isCorrect: boolean; points: number; elapsedMs: number };
  opponent: { chosenIndex: number | null; isCorrect: boolean; points: number; elapsedMs: number };
};

/** Клиент көретін матч күйі */
export type MatchState = {
  matchId: string;
  subjectId: string;
  subjectName: string;
  status: MatchStatus;
  /** Жеке матчтың коды — қарсыласты шақыру үшін */
  code?: string;
  currentIndex: number;
  totalQuestions: number;
  you: MatchSide;
  opponent: MatchSide | null;
  /** Матч жүріп жатса — ағымдағы сұрақ */
  question: PublicQuestion | null;
  /** Соңғы жабылған сұрақтың нәтижесі */
  lastResult: QuestionResult | null;
};

/** Матч біткендегі қорытынды */
export type MatchOutcome = {
  matchId: string;
  subjectId: string;
  subjectName: string;
  status: Extract<MatchStatus, "finished" | "abandoned">;
  /** Жеңімпаздың playerId-і; тең болса — null */
  winnerId: string | null;
  you: { playerId: string; displayName: string; score: number; ratingBefore: number; ratingAfter: number };
  opponent: { playerId: string; displayName: string; score: number; ratingBefore: number; ratingAfter: number } | null;
  /** Он сұрақтың талдауы — матч біткен соң оқуға арналған */
  review: QuestionResult[];
};

/** Пән бойынша рейтинг */
export type SubjectRating = {
  subjectId: string;
  subjectName: string;
  rating: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  /** Пән ішіндегі орны; әлі ойнамаса — null */
  rank: number | null;
};

export type LeaderboardRow = {
  rank: number;
  playerId: string;
  displayName: string;
  rating: number;
  played: number;
  won: number;
  isYou: boolean;
};

export type HistoryRow = {
  matchId: string;
  subjectId: string;
  subjectName: string;
  finishedAt: string;
  opponentName: string;
  yourScore: number;
  opponentScore: number;
  result: "won" | "lost" | "drawn";
  ratingDelta: number;
};

/** Матч ағынының оқиғалары */
export type MatchEvent =
  | { type: "state"; state: MatchState }
  | { type: "question"; question: PublicQuestion; state: MatchState }
  | { type: "answer-result"; result: QuestionResult; state: MatchState }
  | { type: "match-end"; outcome: MatchOutcome };

/** Кезекке тұру нәтижесі: бірден қарсылас табылуы да мүмкін */
export type QueueResult = { status: "queued" } | { status: "matched"; matchId: string };

export interface ArenaService {
  /** Пән бойынша кезекке тұру */
  joinQueue(subjectId: string): Promise<QueueResult>;
  /** Кезектен шығу */
  leaveQueue(): Promise<void>;
  /** Кезектің күйін сұрау (SSE қолжетімсіз болғанда) */
  pollQueue(subjectId: string): Promise<QueueResult>;

  /** Жеке матч құру — қарсыласқа жіберілетін код қайтады */
  createPrivateMatch(subjectId: string): Promise<{ matchId: string; code: string }>;
  /** Код арқылы қосылу */
  joinByCode(code: string): Promise<{ matchId: string }>;

  /** Матчтың ағымдағы күйі */
  getMatch(matchId: string): Promise<MatchState>;
  /** Жауап жіберу. Уақытын сервер белгілейді. */
  submitAnswer(matchId: string, position: number, chosenIndex: number): Promise<void>;
  /** Матч біткендегі қорытынды */
  getOutcome(matchId: string): Promise<MatchOutcome>;

  /**
   * Матч оқиғаларына жазылу. Қайтаратын функция жазылымды тоқтатады.
   */
  subscribe(matchId: string, onEvent: (event: MatchEvent) => void): () => void;

  /** Ойыншының барлық пәндегі рейтингі */
  getRatings(): Promise<SubjectRating[]>;
  /** Пән бойынша лидерлер тізімі */
  getLeaderboard(subjectId: string, limit?: number): Promise<LeaderboardRow[]>;
  /** Аяқталған матчтар */
  getHistory(subjectId?: string, limit?: number): Promise<HistoryRow[]>;
}

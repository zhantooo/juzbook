import { QUESTION_MS, decideWinner, scoreAnswer } from "@/lib/arena/scoring";
import type {
  ArenaService,
  HistoryRow,
  LeaderboardRow,
  MatchEvent,
  MatchOutcome,
  MatchState,
  PublicQuestion,
  QuestionResult,
  QueueResult,
  SubjectRating
} from "@/lib/arena/service";

/**
 * Backend жоқ кездегі іске асыру.
 *
 * Бүкіл матч браузердің жадында жүреді: қарсылас — таймермен жауап беретін
 * жасанды ойыншы. Сол арқылы интерфейсті backend дайын болмай тұрып толық
 * құрастыруға әрі тексеруге болады.
 *
 * Нағыз қызмет (`service.http.ts`) дәл осы интерфейсті іске асырады,
 * сондықтан ауысу бір жолмен болады.
 */

const QUESTION_COUNT = 10;
/** Сұрақ жабылған соң нәтиже көрсетіліп тұратын уақыт */
const REVEAL_MS = 2500;

type MockQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

/** Мок сұрақтары — нағыз банктің орнына */
const SAMPLE: MockQuestion[] = [
  {
    prompt: "Жасуша мембранасының негізгі қызметі қандай?",
    options: ["Зат алмасуды реттеу", "Ақуыз синтездеу", "Энергия жинау", "Тұқым қуалау"],
    answerIndex: 0,
    explanation: "Мембрана жасушаға не кіріп, не шығатынын реттейді."
  },
  {
    prompt: "Фотосинтез қай органоидта жүреді?",
    options: ["Митохондрия", "Хлоропласт", "Рибосома", "Ядро"],
    answerIndex: 1,
    explanation: "Хлоропласттағы хлорофилл жарық энергиясын сіңіреді."
  },
  {
    prompt: "ДНҚ молекуласының құрылымын кім ашты?",
    options: ["Мендель", "Дарвин", "Уотсон мен Крик", "Пастер"],
    answerIndex: 2,
    explanation: "1953 жылы Джеймс Уотсон мен Фрэнсис Крик қос спиральды сипаттады."
  },
  {
    prompt: "Митоз нәтижесінде қанша жасуша түзіледі?",
    options: ["Бір", "Екі", "Төрт", "Сегіз"],
    answerIndex: 1,
    explanation: "Митозда бір жасушадан екі бірдей жасуша пайда болады."
  },
  {
    prompt: "Ферменттердің табиғаты қандай?",
    options: ["Көмірсу", "Липид", "Ақуыз", "Витамин"],
    answerIndex: 2,
    explanation: "Ферменттер — биологиялық катализатор болып табылатын ақуыздар."
  },
  {
    prompt: "Қанның қай жасушасы оттегі тасымалдайды?",
    options: ["Лейкоцит", "Тромбоцит", "Эритроцит", "Лимфоцит"],
    answerIndex: 2,
    explanation: "Эритроциттегі гемоглобин оттегімен байланысады."
  },
  {
    prompt: "Экожүйедегі продуценттер кім?",
    options: ["Өсімдіктер", "Жыртқыштар", "Саңырауқұлақтар", "Бактериялар"],
    answerIndex: 0,
    explanation: "Продуценттер — органикалық затты өзі түзетін өсімдіктер."
  },
  {
    prompt: "Генотип дегеніміз не?",
    options: ["Сыртқы белгілер", "Гендер жиынтығы", "Хромосома саны", "Жасуша түрі"],
    answerIndex: 1,
    explanation: "Генотип — организмнің барлық гендерінің жиынтығы."
  },
  {
    prompt: "Бауырдың негізгі қызметтерінің бірі қандай?",
    options: ["Оттегі тасымалдау", "Зиянды затты бейтараптау", "Дыбыс шығару", "Жарық сіңіру"],
    answerIndex: 1,
    explanation: "Бауыр улы заттарды бейтараптап, зат алмасуды реттейді."
  },
  {
    prompt: "Табиғи сұрыпталу ұғымын кім ұсынды?",
    options: ["Ламарк", "Дарвин", "Линней", "Вернадский"],
    answerIndex: 1,
    explanation: "Чарльз Дарвин түрлердің табиғи сұрыпталу арқылы дамуын негіздеді."
  },
  {
    prompt: "Вирустың жасушадан басты айырмашылығы неде?",
    options: ["Ядросы бар", "Өз бетінше көбеймейді", "Мембранасы жоқ", "Қозғалады"],
    answerIndex: 1,
    explanation: "Вирус тек басқа жасушаның ішінде ғана көбейе алады."
  },
  {
    prompt: "Гомеостаз дегеніміз не?",
    options: ["Ішкі ортаның тұрақтылығы", "Жасуша бөлінуі", "Түр өзгеруі", "Энергия алмасу"],
    answerIndex: 0,
    explanation: "Гомеостаз — организмнің ішкі ортасын тұрақты ұстауы."
  }
];

const BOT_NAMES = ["Айдана", "Нұрлан", "Әсем", "Дәурен", "Жанель", "Ерасыл"];

function pickQuestions(): MockQuestion[] {
  const pool = [...SAMPLE];
  const picked: MockQuestion[] = [];
  while (picked.length < QUESTION_COUNT && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

type MockMatch = {
  matchId: string;
  subjectId: string;
  subjectName: string;
  code?: string;
  status: MatchState["status"];
  questions: MockQuestion[];
  index: number;
  openedAt: number;
  you: { score: number; answered: boolean; chosen: number | null; elapsed: number };
  bot: { name: string; score: number; answered: boolean; chosen: number | null; elapsed: number };
  review: QuestionResult[];
  listeners: Set<(event: MatchEvent) => void>;
  timers: ReturnType<typeof setTimeout>[];
  /**
   * Әр сұраққа жаңа нөмір беріледі. Сұрақ ерте жабылғанда оның таймерлері
   * әлі кезекте тұруы мүмкін — олар осы нөмір арқылы өзінің ескіргенін
   * біліп, келесі сұраққа тимейді.
   */
  epoch: number;
};

const matches = new Map<string, MockMatch>();
const ratings = new Map<string, number>();

function subjectNameFor(subjectId: string) {
  const names: Record<string, string> = {
    biology: "Биология",
    chemistry: "Химия",
    geography: "География",
    informatics: "Информатика",
    "kazakh-history": "Қазақстан тарихы",
    "world-history": "Дүниежүзі тарихы"
  };
  return names[subjectId] ?? subjectId;
}

function publicQuestion(match: MockMatch): PublicQuestion {
  const question = match.questions[match.index];
  return {
    position: match.index,
    prompt: question.prompt,
    options: question.options,
    opensAt: new Date(match.openedAt).toISOString(),
    closesAt: new Date(match.openedAt + QUESTION_MS).toISOString()
  };
}

function stateOf(match: MockMatch): MatchState {
  return {
    matchId: match.matchId,
    subjectId: match.subjectId,
    subjectName: match.subjectName,
    status: match.status,
    code: match.code,
    currentIndex: match.index,
    totalQuestions: match.questions.length,
    you: { playerId: "you", displayName: "Сен", score: match.you.score, answered: match.you.answered },
    opponent: { playerId: "bot", displayName: match.bot.name, score: match.bot.score, answered: match.bot.answered },
    question: match.status === "active" ? publicQuestion(match) : null,
    lastResult: match.review.at(-1) ?? null
  };
}

function emit(match: MockMatch, event: MatchEvent) {
  for (const listener of match.listeners) {
    listener(event);
  }
}

function clearTimers(match: MockMatch) {
  for (const timer of match.timers) {
    clearTimeout(timer);
  }
  match.timers = [];
}

function closeQuestion(match: MockMatch) {
  // Ерте жабылса, осы сұрақтың таймерлері енді керек емес
  clearTimers(match);
  match.epoch += 1;
  const question = match.questions[match.index];

  // Жауап бермегендер үлгермеген болып саналады
  const result: QuestionResult = {
    position: match.index,
    prompt: question.prompt,
    options: question.options,
    correctIndex: question.answerIndex,
    explanation: question.explanation,
    you: {
      chosenIndex: match.you.chosen,
      isCorrect: match.you.chosen === question.answerIndex,
      points: match.you.chosen === question.answerIndex ? scoreAnswer({ isCorrect: true, elapsedMs: match.you.elapsed }) : 0,
      elapsedMs: match.you.elapsed
    },
    opponent: {
      chosenIndex: match.bot.chosen,
      isCorrect: match.bot.chosen === question.answerIndex,
      points: match.bot.chosen === question.answerIndex ? scoreAnswer({ isCorrect: true, elapsedMs: match.bot.elapsed }) : 0,
      elapsedMs: match.bot.elapsed
    }
  };

  match.you.score += result.you.points;
  match.bot.score += result.opponent.points;
  match.review.push(result);

  emit(match, { type: "answer-result", result, state: stateOf(match) });

  const timer = setTimeout(() => {
    if (match.index + 1 >= match.questions.length) {
      finish(match);
      return;
    }
    match.index += 1;
    openQuestion(match);
  }, REVEAL_MS);
  match.timers.push(timer);
}

function openQuestion(match: MockMatch) {
  const epoch = match.epoch;
  match.openedAt = Date.now();
  match.you = { score: match.you.score, answered: false, chosen: null, elapsed: QUESTION_MS };
  match.bot = { ...match.bot, answered: false, chosen: null, elapsed: QUESTION_MS };

  emit(match, { type: "question", question: publicQuestion(match), state: stateOf(match) });

  // Жасанды қарсылас кездейсоқ уақытта жауап береді
  const botDelay = 2000 + Math.random() * 9000;
  const botTimer = setTimeout(() => {
    if (match.status !== "active" || match.bot.answered || match.epoch !== epoch) {
      return;
    }
    const question = match.questions[match.index];
    // Шамамен 70% дұрыс жауап береді
    const correct = Math.random() < 0.7;
    const wrong = [0, 1, 2, 3].filter((index) => index !== question.answerIndex);
    match.bot.chosen = correct ? question.answerIndex : wrong[Math.floor(Math.random() * wrong.length)];
    match.bot.elapsed = Math.round(botDelay);
    match.bot.answered = true;
    emit(match, { type: "state", state: stateOf(match) });
    if (match.you.answered) {
      closeQuestion(match);
    }
  }, botDelay);
  match.timers.push(botTimer);

  const closeTimer = setTimeout(() => {
    // Сұрақ ерте жабылған болса, бұл таймер ескірген
    if (match.status === "active" && match.epoch === epoch) {
      closeQuestion(match);
    }
  }, QUESTION_MS);
  match.timers.push(closeTimer);
}

function finish(match: MockMatch) {
  match.status = "finished";
  clearTimers(match);

  const before = ratings.get(match.subjectId) ?? 1000;
  const verdict = decideWinner(match.you.score, match.bot.score);
  const delta = verdict === "first" ? 18 : verdict === "second" ? -16 : 1;
  const after = before + delta;
  ratings.set(match.subjectId, after);

  const outcome: MatchOutcome = {
    matchId: match.matchId,
    subjectId: match.subjectId,
    subjectName: match.subjectName,
    status: "finished",
    winnerId: verdict === "first" ? "you" : verdict === "second" ? "bot" : null,
    you: { playerId: "you", displayName: "Сен", score: match.you.score, ratingBefore: before, ratingAfter: after },
    opponent: {
      playerId: "bot",
      displayName: match.bot.name,
      score: match.bot.score,
      ratingBefore: 1000,
      ratingAfter: 1000 - delta
    },
    review: match.review
  };

  emit(match, { type: "match-end", outcome });
}

function createMatch(subjectId: string, code?: string): MockMatch {
  const match: MockMatch = {
    matchId: `mock-${Math.random().toString(36).slice(2, 9)}`,
    subjectId,
    subjectName: subjectNameFor(subjectId),
    code,
    status: "active",
    questions: pickQuestions(),
    index: 0,
    openedAt: Date.now(),
    you: { score: 0, answered: false, chosen: null, elapsed: QUESTION_MS },
    bot: {
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
      score: 0,
      answered: false,
      chosen: null,
      elapsed: QUESTION_MS
    },
    review: [],
    listeners: new Set(),
    timers: [],
    epoch: 0
  };
  matches.set(match.matchId, match);
  return match;
}

function requireMatch(matchId: string) {
  const match = matches.get(matchId);
  if (!match) {
    throw new Error("Матч табылмады.");
  }
  return match;
}

export const mockArenaService: ArenaService = {
  async joinQueue(subjectId) {
    // Мокта қарсылас бірден табылады
    const match = createMatch(subjectId);
    return { status: "matched", matchId: match.matchId };
  },

  async leaveQueue() {
    // Мокта кезек жоқ
  },

  async pollQueue(subjectId) {
    const match = createMatch(subjectId);
    return { status: "matched", matchId: match.matchId };
  },

  async createPrivateMatch(subjectId) {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    const match = createMatch(subjectId, code);
    return { matchId: match.matchId, code };
  },

  async joinByCode(code) {
    const existing = [...matches.values()].find((match) => match.code === code);
    if (existing) {
      return { matchId: existing.matchId };
    }
    const match = createMatch("biology", code);
    return { matchId: match.matchId };
  },

  async getMatch(matchId) {
    return stateOf(requireMatch(matchId));
  },

  async submitAnswer(matchId, position, chosenIndex) {
    const match = requireMatch(matchId);
    if (match.status !== "active" || position !== match.index || match.you.answered) {
      return;
    }
    match.you.chosen = chosenIndex;
    match.you.elapsed = Date.now() - match.openedAt;
    match.you.answered = true;
    emit(match, { type: "state", state: stateOf(match) });
    if (match.bot.answered) {
      closeQuestion(match);
    }
  },

  async getOutcome(matchId) {
    const match = requireMatch(matchId);
    const before = 1000;
    const verdict = decideWinner(match.you.score, match.bot.score);
    return {
      matchId: match.matchId,
      subjectId: match.subjectId,
      subjectName: match.subjectName,
      status: "finished",
      winnerId: verdict === "first" ? "you" : verdict === "second" ? "bot" : null,
      you: {
        playerId: "you",
        displayName: "Сен",
        score: match.you.score,
        ratingBefore: before,
        ratingAfter: ratings.get(match.subjectId) ?? before
      },
      opponent: {
        playerId: "bot",
        displayName: match.bot.name,
        score: match.bot.score,
        ratingBefore: 1000,
        ratingAfter: 1000
      },
      review: match.review
    };
  },

  subscribe(matchId, onEvent) {
    const match = requireMatch(matchId);
    match.listeners.add(onEvent);
    // Жазылған бойда ағымдағы күй жіберіледі — қайта қосылған клиент те дұрыс көреді
    onEvent({ type: "state", state: stateOf(match) });
    if (match.status === "active" && match.index === 0 && !match.review.length) {
      openQuestion(match);
    }
    return () => {
      match.listeners.delete(onEvent);
    };
  },

  async getRatings(): Promise<SubjectRating[]> {
    return [...ratings.entries()].map(([subjectId, rating]) => ({
      subjectId,
      subjectName: subjectNameFor(subjectId),
      rating,
      played: 1,
      won: 0,
      lost: 0,
      drawn: 0,
      rank: null
    }));
  },

  async getLeaderboard(subjectId, limit = 20): Promise<LeaderboardRow[]> {
    const mine = ratings.get(subjectId) ?? 1000;
    return BOT_NAMES.slice(0, limit - 1)
      .map((name, index) => ({
        rank: index + 1,
        playerId: `bot-${index}`,
        displayName: name,
        rating: 1200 - index * 37,
        played: 20 - index,
        won: 12 - index,
        isYou: false
      }))
      .concat([
        {
          rank: BOT_NAMES.length,
          playerId: "you",
          displayName: "Сен",
          rating: mine,
          played: 1,
          won: 0,
          isYou: true
        }
      ]);
  },

  async getHistory(): Promise<HistoryRow[]> {
    return [];
  }
};

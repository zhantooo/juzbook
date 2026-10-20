/**
 * Arena-ның серверлік қозғалтқышы.
 *
 * Бүкіл шешім осы жерде қабылданады: сұрақтар таңдалады, уақыт өлшенеді,
 * ұпай есептеледі, рейтинг жаңартылады. Клиент ештеңе шешпейді — ол тек
 * күйді сұрап, жауап жібереді. Сондықтан екі ойыншы бір матчты бірдей
 * көреді, ал уақытты алдау мүмкін емес.
 *
 * Матч «тірі процесс» емес: әр оқу кезінде уақыты өткен сұрақ жабылып,
 * келесісі ашылады (`tick`). Осылайша serverless ортада да (Vercel) жұмыс
 * істейді — фондық таймер керек емес.
 */
import { arenaPrisma } from "@/lib/arena/db";
import { QUESTION_MS, decideWinner, scoreAnswer } from "@/lib/arena/scoring";
import { START_RATING, nextRatings } from "@/lib/arena/rating";
import type {
  HistoryRow,
  LeaderboardRow,
  MatchOutcome,
  MatchState,
  PublicQuestion,
  QueueResult,
  QuestionResult,
  SubjectRating
} from "@/lib/arena/service";

/** Матчтағы сұрақ саны */
export const TOTAL_QUESTIONS = 10;
/** Сұрақ жабылған соң жауап талдауына берілетін уақыт */
export const REVEAL_MS = 4000;
/** Қатарынан осы саннан көп сұраққа жауап бермеген ойыншы матчты тастаған болып саналады */
const MISS_LIMIT = 3;
/** Деңгейлер қоспасы: орташа сұрақ көп, шеттері аздан */
const MIX: Array<{ difficulty: string; count: number }> = [
  { difficulty: "medium", count: 6 },
  { difficulty: "easy", count: 2 },
  { difficulty: "hard", count: 2 }
];
/** Жаттығу боты — кезекте тірі қарсылас болмаған кезде ғана қосылады */
export const BOT_USER_ID = "arena-bot";
const BOT_NAME = "Жаттығу боты";
/** Кезекте тірі қарсыласты осы уақыт күтеміз, сосын бот қосылады */
export const QUEUE_BOT_AFTER_MS = 15_000;

/**
 * Матчтың өмір жолын журналға жазады.
 *
 * Бір жолда, тұрақты префикспен: Vercel журналынан `[arena]` деп іздеп,
 * бір матчтың бүкіл тарихын `matchId` бойынша жинап алуға болады. Жеке
 * деректер жазылмайды — тек идентификаторлар мен сандар.
 */
function logMatch(event: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  console.info(`[arena] ${event}`, JSON.stringify(data));
}

export type ArenaViewer = { id: string; name: string };

type MatchRow = Awaited<ReturnType<typeof loadMatch>>;
type LoadedMatch = NonNullable<MatchRow>;

/** Ойыншының Arena ішіндегі жазбасы — алғашқы кіргенде құрылады */
export async function ensurePlayer(viewer: ArenaViewer) {
  const displayName = viewer.name.trim() || "Оқушы";

  return arenaPrisma.arenaPlayer.upsert({
    where: { userId: viewer.id },
    create: { userId: viewer.id, displayName },
    update: { displayName }
  });
}

export async function ensureBotPlayer() {
  return arenaPrisma.arenaPlayer.upsert({
    where: { userId: BOT_USER_ID },
    create: { userId: BOT_USER_ID, displayName: BOT_NAME },
    update: {}
  });
}

/** Матч коды: ұқсас таңбалар (0/O, 1/I) алынбайды — ауызша айтуға жарамды болуы керек */
function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 5; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

type BankRow = {
  id: string;
  prompt: string;
  optionsJson: string;
  answerIndex: number;
  explanation: string;
  difficulty: string;
};

/**
 * Матчқа он сұрақ таңдайды.
 *
 * `ORDER BY RANDOM()` SQLite-тың өз функциясы — Turso-да да бірдей жұмыс
 * істейді. Бір деңгейде сұрақ жетпесе, қалғаны басқа деңгейлерден толтырылады.
 */
async function pickQuestions(subjectId: string): Promise<BankRow[]> {
  const picked: BankRow[] = [];
  const seen = new Set<string>();

  for (const part of MIX) {
    const rows = await arenaPrisma.$queryRaw<BankRow[]>`
      SELECT id, prompt, optionsJson, answerIndex, explanation, difficulty
      FROM ArenaQuestionBank
      WHERE subjectId = ${subjectId} AND difficulty = ${part.difficulty}
      ORDER BY RANDOM()
      LIMIT ${part.count}
    `;
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        picked.push(row);
      }
    }
  }

  // Деңгейлер бойынша жетпесе — кез келгенінен толтырамыз
  if (picked.length < TOTAL_QUESTIONS) {
    const rows = await arenaPrisma.$queryRaw<BankRow[]>`
      SELECT id, prompt, optionsJson, answerIndex, explanation, difficulty
      FROM ArenaQuestionBank
      WHERE subjectId = ${subjectId}
      ORDER BY RANDOM()
      LIMIT ${TOTAL_QUESTIONS * 2}
    `;
    for (const row of rows) {
      if (picked.length >= TOTAL_QUESTIONS) {
        break;
      }
      if (!seen.has(row.id)) {
        seen.add(row.id);
        picked.push(row);
      }
    }
  }

  return picked.slice(0, TOTAL_QUESTIONS);
}

/** Жаңа матч құрады: сұрақтары бірден көшіріледі, екі ойыншы да бірдей көреді */
async function createMatch(options: {
  subjectId: string;
  playerIds: string[];
  code?: string;
  start: boolean;
}) {
  const questions = await pickQuestions(options.subjectId);
  if (questions.length < TOTAL_QUESTIONS) {
    throw new Error("Бұл пәнде матчқа жететін сұрақ жоқ.");
  }

  const now = new Date();

  const created = await arenaPrisma.arenaMatch.create({
    data: {
      subjectId: options.subjectId,
      status: options.start ? "active" : "waiting",
      code: options.code,
      currentIndex: 0,
      questionOpenedAt: options.start ? now : null,
      startedAt: options.start ? now : null,
      players: {
        create: options.playerIds.map((playerId) => ({ playerId }))
      },
      questions: {
        create: questions.map((row, index) => ({
          position: index,
          prompt: row.prompt,
          optionsJson: row.optionsJson,
          answerIndex: row.answerIndex,
          explanation: row.explanation,
          difficulty: row.difficulty
        }))
      }
    }
  });

  logMatch("match-created", {
    matchId: created.id,
    subjectId: options.subjectId,
    players: options.playerIds.length,
    private: Boolean(options.code),
    started: options.start
  });

  return created;
}

async function loadMatch(matchId: string) {
  return arenaPrisma.arenaMatch.findUnique({
    where: { id: matchId },
    include: {
      players: { include: { player: true }, orderBy: { id: "asc" } },
      questions: { orderBy: { position: "asc" } },
      answers: true
    }
  });
}

/**
 * Боттың жауабы.
 *
 * Матч пен сұрақтың нөмірінен есептеледі, сондықтан қайта оқығанда да
 * нәтиже бірдей: бот «ойланып» отырған кезде күй өзгермейді.
 */
function botDecision(matchId: string, position: number, answerIndex: number, optionCount: number) {
  let hash = 2166136261;
  const seed = `${matchId}:${position}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  const second = ((hash >>> 8) & 0xffff) / 0xffff;
  const count = Math.max(1, optionCount);

  // Боттың дәлдігі ~65%: тым күшті де, тым нашар да болмауы керек
  const isCorrect = normalized < 0.65;
  const chosenIndex = isCorrect
    ? answerIndex
    : (answerIndex + 1 + Math.floor(second * Math.max(1, count - 1))) % count;
  // Жауап беру уақыты: 2.5–9 секунд
  const elapsedMs = Math.round(2500 + second * 6500);

  return { chosenIndex, elapsedMs };
}

export function parseOptions(optionsJson: string): string[] {
  try {
    const parsed = JSON.parse(optionsJson) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function scoreOf(match: LoadedMatch, playerId: string) {
  return match.answers
    .filter((answer) => answer.playerId === playerId)
    .reduce((sum, answer) => sum + answer.points, 0);
}

async function finishMatch(match: LoadedMatch, status: "finished" | "abandoned") {
  const [first, second] = match.players;
  const firstScore = first ? scoreOf(match, first.playerId) : 0;
  const secondScore = second ? scoreOf(match, second.playerId) : 0;

  let winnerId: string | null = null;
  if (first && second) {
    const decision = decideWinner(firstScore, secondScore);
    winnerId = decision === "first" ? first.playerId : decision === "second" ? second.playerId : null;

    // Матчты тастаған ойыншы ұпайына қарамастан жеңілген болып саналады
    if (status === "abandoned") {
      if (first.missedInRow >= MISS_LIMIT && second.missedInRow < MISS_LIMIT) {
        winnerId = second.playerId;
      } else if (second.missedInRow >= MISS_LIMIT && first.missedInRow < MISS_LIMIT) {
        winnerId = first.playerId;
      }
    }
  }

  const ratings = new Map<string, { before: number; after: number }>();

  for (const side of match.players) {
    const rating = await arenaPrisma.arenaRating.upsert({
      where: { playerId_subjectId: { playerId: side.playerId, subjectId: match.subjectId } },
      create: { playerId: side.playerId, subjectId: match.subjectId },
      update: {}
    });
    ratings.set(side.playerId, { before: rating.rating, after: rating.rating });
  }

  if (first && second) {
    const firstBefore = ratings.get(first.playerId)?.before ?? START_RATING;
    const secondBefore = ratings.get(second.playerId)?.before ?? START_RATING;
    const result = winnerId === null ? "drawn" : winnerId === first.playerId ? "won" : "lost";
    const next = nextRatings({ first: firstBefore, second: secondBefore, result });

    ratings.set(first.playerId, { before: firstBefore, after: next.first });
    ratings.set(second.playerId, { before: secondBefore, after: next.second });
  }

  for (const side of match.players) {
    const change = ratings.get(side.playerId);
    if (!change) {
      continue;
    }

    const isWinner = winnerId === side.playerId;
    const isDraw = winnerId === null;

    await arenaPrisma.arenaRating.update({
      where: { playerId_subjectId: { playerId: side.playerId, subjectId: match.subjectId } },
      data: {
        rating: change.after,
        played: { increment: 1 },
        won: { increment: isWinner ? 1 : 0 },
        lost: { increment: !isWinner && !isDraw ? 1 : 0 },
        drawn: { increment: isDraw ? 1 : 0 }
      }
    });

    await arenaPrisma.arenaMatchPlayer.update({
      where: { id: side.id },
      data: {
        score: scoreOf(match, side.playerId),
        ratingBefore: change.before,
        ratingAfter: change.after
      }
    });
  }

  await arenaPrisma.arenaMatch.update({
    where: { id: match.id },
    data: { status, finishedAt: new Date(), winnerId }
  });

  logMatch("match-ended", {
    matchId: match.id,
    subjectId: match.subjectId,
    status,
    winnerId,
    scores: match.players.map((side) => scoreOf(match, side.playerId))
  });
}

/**
 * Матчтың уақытын алға жылжытады: жабылған сұрақтарды жабады, келесісін ашады.
 *
 * Әр оқу сайын шақырылады, сондықтан екі ойыншы бір мезетте шақырса да
 * нәтиже бірдей: қайталанған жауап бірегейлік шектеуімен тойтарылады.
 */
export async function tick(matchId: string): Promise<LoadedMatch> {
  const loaded = await loadMatch(matchId);
  if (!loaded) {
    throw new Error("Матч табылмады.");
  }

  // Түрі бірден бос емес деп жарияланады: төмендегі тұйықталымдар (closure)
  // `match`-ты бос емес деп көруі керек.
  let match: LoadedMatch = loaded;

  // Қауіпсіздік шегі: бір шақыруда шексіз айналмауы керек
  for (let guard = 0; guard < TOTAL_QUESTIONS * 2 + 4; guard += 1) {
    if (match.status !== "active" || !match.questionOpenedAt) {
      return match;
    }

    const openedAt = match.questionOpenedAt.getTime();
    const now = Date.now();

    // Талдау кезеңі: келесі сұрақ әлі ашылмаған
    if (now < openedAt) {
      return match;
    }

    const position = match.currentIndex;
    const question = match.questions.find((item) => item.position === position);
    if (!question) {
      await finishMatch(match, "finished");
      return (await loadMatch(matchId)) ?? match;
    }

    const bot = match.players.find((side) => side.player.userId === BOT_USER_ID);
    const answeredHere = (playerId: string) =>
      match.answers.some((answer) => answer.position === position && answer.playerId === playerId);

    // Бот өз уақыты келгенде жауап береді
    if (bot && !answeredHere(bot.playerId)) {
      const options = parseOptions(question.optionsJson);
      const decision = botDecision(matchId, position, question.answerIndex, options.length || 4);
      if (now - openedAt >= decision.elapsedMs) {
        const isCorrect = decision.chosenIndex === question.answerIndex;
        await arenaPrisma.arenaAnswer
          .create({
            data: {
              matchId,
              questionId: question.id,
              playerId: bot.playerId,
              position,
              chosenIndex: decision.chosenIndex,
              isCorrect,
              elapsedMs: decision.elapsedMs,
              points: scoreAnswer({ isCorrect, elapsedMs: decision.elapsedMs })
            }
          })
          .catch(() => undefined);
        match = (await loadMatch(matchId)) ?? match;
        continue;
      }
    }

    const everyoneAnswered =
      match.players.length > 0 && match.players.every((side) => answeredHere(side.playerId));
    const timeIsUp = now - openedAt >= QUESTION_MS;

    if (!everyoneAnswered && !timeIsUp) {
      return match;
    }

    // Үлгермегендерге бос жауап жазамыз — нәтиже толық болуы керек
    for (const side of match.players) {
      if (answeredHere(side.playerId)) {
        await arenaPrisma.arenaMatchPlayer.update({
          where: { id: side.id },
          data: { missedInRow: 0 }
        });
        continue;
      }

      await arenaPrisma.arenaAnswer
        .create({
          data: {
            matchId,
            questionId: question.id,
            playerId: side.playerId,
            position,
            chosenIndex: null,
            isCorrect: false,
            elapsedMs: QUESTION_MS,
            points: 0
          }
        })
        .catch(() => undefined);

      await arenaPrisma.arenaMatchPlayer.update({
        where: { id: side.id },
        data: { missedInRow: { increment: 1 } }
      });
    }

    match = (await loadMatch(matchId)) ?? match;

    // Матчты тастап кеткен ойыншы бар ма
    if (match.players.some((side) => side.missedInRow >= MISS_LIMIT)) {
      await finishMatch(match, "abandoned");
      return (await loadMatch(matchId)) ?? match;
    }

    logMatch("question-closed", {
      matchId,
      position,
      reason: timeIsUp ? "timeout" : "all-answered",
      answers: match.answers.filter((answer) => answer.position === position).length
    });

    if (position + 1 >= TOTAL_QUESTIONS) {
      await finishMatch(match, "finished");
      return (await loadMatch(matchId)) ?? match;
    }

    // Келесі сұрақ талдау кезеңінен кейін ашылады
    await arenaPrisma.arenaMatch.update({
      where: { id: matchId },
      data: {
        currentIndex: position + 1,
        questionOpenedAt: new Date(now + REVEAL_MS)
      }
    });

    match = (await loadMatch(matchId)) ?? match;
  }

  return match;
}

/** Екінші ойыншы қосылғанда матч басталады */
async function startMatch(matchId: string) {
  const now = new Date();
  await arenaPrisma.arenaMatch.update({
    where: { id: matchId },
    data: { status: "active", startedAt: now, questionOpenedAt: now }
  });
  logMatch("match-started", { matchId });
}

/**
 * Кезекке тұру.
 *
 * Сол пәнде күтіп тұрған басқа ойыншы болса, екеуі бірден матчқа түседі.
 * Болмаса, өзі кезекке жазылады да, `pollQueue` арқылы күтеді.
 */
export async function joinQueue(viewer: ArenaViewer, subjectId: string): Promise<QueueResult> {
  const player = await ensurePlayer(viewer);

  // Бұрыннан ойнап жатқан матчы болса, соған қайтарамыз
  const running = await findRunningMatch(player.id);
  if (running) {
    return { status: "matched", matchId: running };
  }

  const waiting = await arenaPrisma.arenaQueueEntry.findFirst({
    where: { subjectId, playerId: { not: player.id } },
    orderBy: { joinedAt: "asc" }
  });

  if (waiting) {
    // Қарсылас табылды: кезектен екеуін де шығарып, матч құрамыз
    await arenaPrisma.arenaQueueEntry.deleteMany({
      where: { playerId: { in: [waiting.playerId, player.id] } }
    });
    const match = await createMatch({
      subjectId,
      playerIds: [waiting.playerId, player.id],
      start: true
    });
    return { status: "matched", matchId: match.id };
  }

  await arenaPrisma.arenaQueueEntry.upsert({
    where: { playerId: player.id },
    create: { playerId: player.id, subjectId },
    update: { subjectId, joinedAt: new Date() }
  });

  return { status: "queued" };
}

/** Кезектің күйін сұрау. Тірі қарсылас табылмаса, біраздан соң бот қосылады. */
export async function pollQueue(viewer: ArenaViewer, subjectId: string): Promise<QueueResult> {
  const player = await ensurePlayer(viewer);

  const running = await findRunningMatch(player.id);
  if (running) {
    return { status: "matched", matchId: running };
  }

  const mine = await arenaPrisma.arenaQueueEntry.findUnique({ where: { playerId: player.id } });
  if (!mine) {
    // Кезектен шығып қалған — қайта тұрамыз
    return joinQueue(viewer, subjectId);
  }

  const rival = await arenaPrisma.arenaQueueEntry.findFirst({
    where: { subjectId: mine.subjectId, playerId: { not: player.id } },
    orderBy: { joinedAt: "asc" }
  });

  if (rival) {
    await arenaPrisma.arenaQueueEntry.deleteMany({
      where: { playerId: { in: [rival.playerId, player.id] } }
    });
    const match = await createMatch({
      subjectId: mine.subjectId,
      playerIds: [rival.playerId, player.id],
      start: true
    });
    return { status: "matched", matchId: match.id };
  }

  // Ұзақ күттік — жаттығу ботымен ойнайды
  if (Date.now() - mine.joinedAt.getTime() >= QUEUE_BOT_AFTER_MS) {
    const bot = await ensureBotPlayer();
    await arenaPrisma.arenaQueueEntry.delete({ where: { playerId: player.id } }).catch(() => undefined);
    const match = await createMatch({
      subjectId: mine.subjectId,
      playerIds: [player.id, bot.id],
      start: true
    });
    return { status: "matched", matchId: match.id };
  }

  return { status: "queued" };
}

export async function leaveQueue(viewer: ArenaViewer) {
  const player = await ensurePlayer(viewer);
  await arenaPrisma.arenaQueueEntry.delete({ where: { playerId: player.id } }).catch(() => undefined);
}

/** Ойыншының аяқталмаған матчы (болса) */
async function findRunningMatch(playerId: string) {
  const row = await arenaPrisma.arenaMatchPlayer.findFirst({
    where: { playerId, match: { status: "active" } },
    orderBy: { match: { createdAt: "desc" } },
    select: { matchId: true }
  });
  return row?.matchId ?? null;
}

/** Жеке матч құру: қарсыласқа жіберілетін код қайтады */
export async function createPrivateMatch(viewer: ArenaViewer, subjectId: string) {
  const player = await ensurePlayer(viewer);
  await arenaPrisma.arenaQueueEntry.delete({ where: { playerId: player.id } }).catch(() => undefined);

  // Код бірегей болуы керек — сирек те болса қайталануы мүмкін
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateCode();
    const taken = await arenaPrisma.arenaMatch.findUnique({ where: { code }, select: { id: true } });
    if (taken) {
      continue;
    }

    const match = await createMatch({ subjectId, playerIds: [player.id], code, start: false });
    return { matchId: match.id, code };
  }

  throw new Error("Код жасау мүмкін болмады, қайта көріңіз.");
}

/** Код арқылы қосылу */
export async function joinByCode(viewer: ArenaViewer, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const player = await ensurePlayer(viewer);

  const match = await arenaPrisma.arenaMatch.findUnique({
    where: { code },
    include: { players: true }
  });

  if (!match) {
    throw new Error("Бұл код бойынша матч табылмады.");
  }

  // Өз матчына қайта кіру — қалыпты жағдай
  if (match.players.some((side) => side.playerId === player.id)) {
    return { matchId: match.id };
  }

  if (match.status !== "waiting" || match.players.length >= 2) {
    throw new Error("Бұл матч басталып кеткен.");
  }

  await arenaPrisma.arenaMatchPlayer.create({ data: { matchId: match.id, playerId: player.id } });
  await startMatch(match.id);

  return { matchId: match.id };
}

/** Ойыншыға көрінетін матч күйі */
export async function getMatchState(viewer: ArenaViewer, matchId: string): Promise<MatchState> {
  const player = await ensurePlayer(viewer);
  const match = await tick(matchId);

  const mine = match.players.find((side) => side.playerId === player.id);
  if (!mine) {
    throw new Error("Бұл матч сізге тиесілі емес.");
  }

  const other = match.players.find((side) => side.playerId !== player.id) ?? null;
  const subject = await arenaPrisma.arenaSubject.findUnique({ where: { id: match.subjectId } });

  const openedAt = match.questionOpenedAt?.getTime() ?? 0;
  // Келесі сұрақтың ашылу сәті әлі келмесе — талдау кезеңіндеміз
  const isRevealing = openedAt > Date.now() && match.currentIndex > 0;

  // Талдау кезеңінде экранда жабылған сұрақ тұрады: оқушы жауабын көреді.
  // Сондықтан «ағымдағы» деп сол сұрақты көрсетеміз.
  const position = isRevealing ? match.currentIndex - 1 : match.currentIndex;
  const current = match.questions.find((item) => item.position === position) ?? null;
  // Жабылған сұрақтың уақыты өтіп кеткен — таймер нөлде тұрады
  const shownOpenedAt = isRevealing ? openedAt - REVEAL_MS - QUESTION_MS : openedAt;

  const sideOf = (target: typeof mine | null) =>
    target
      ? {
          playerId: target.playerId,
          displayName: target.player.displayName,
          score: scoreOf(match, target.playerId),
          answered: match.answers.some(
            (answer) => answer.position === position && answer.playerId === target.playerId
          )
        }
      : null;

  const lastResult = isRevealing
    ? buildResult(match, position, mine.playerId, other?.playerId ?? null)
    : null;

  const question: PublicQuestion | null =
    match.status === "active" && current
      ? {
          position,
          prompt: current.prompt,
          options: parseOptions(current.optionsJson),
          opensAt: new Date(shownOpenedAt).toISOString(),
          closesAt: new Date(shownOpenedAt + QUESTION_MS).toISOString()
        }
      : null;

  return {
    matchId: match.id,
    subjectId: match.subjectId,
    subjectName: subject?.name ?? "Пән",
    status: match.status as MatchState["status"],
    code: match.code ?? undefined,
    currentIndex: position,
    totalQuestions: TOTAL_QUESTIONS,
    you: sideOf(mine)!,
    opponent: sideOf(other),
    question,
    lastResult
  };
}

function buildResult(
  match: LoadedMatch,
  position: number,
  youId: string,
  opponentId: string | null
): QuestionResult | null {
  const question = match.questions.find((item) => item.position === position);
  if (!question) {
    return null;
  }

  const pick = (playerId: string | null) => {
    const answer = playerId
      ? match.answers.find((item) => item.position === position && item.playerId === playerId)
      : null;
    return {
      chosenIndex: answer?.chosenIndex ?? null,
      isCorrect: answer?.isCorrect ?? false,
      points: answer?.points ?? 0,
      elapsedMs: answer?.elapsedMs ?? QUESTION_MS
    };
  };

  return {
    position,
    prompt: question.prompt,
    options: parseOptions(question.optionsJson),
    correctIndex: question.answerIndex,
    explanation: question.explanation,
    you: pick(youId),
    opponent: pick(opponentId)
  };
}

/** Жауап қабылдау. Уақытты сервер өлшейді, сондықтан клиентке сенім жоқ. */
export async function submitAnswer(
  viewer: ArenaViewer,
  matchId: string,
  position: number,
  chosenIndex: number
) {
  const player = await ensurePlayer(viewer);
  const match = await tick(matchId);

  if (match.status !== "active" || !match.questionOpenedAt) {
    throw new Error("Матч жүріп жатқан жоқ.");
  }

  if (position !== match.currentIndex) {
    // Кешігіп келген жауап — үнсіз өткізіледі
    return;
  }

  if (!match.players.some((side) => side.playerId === player.id)) {
    throw new Error("Бұл матч сізге тиесілі емес.");
  }

  const question = match.questions.find((item) => item.position === position);
  if (!question) {
    return;
  }

  const openedAt = match.questionOpenedAt.getTime();
  const elapsedMs = Date.now() - openedAt;
  if (elapsedMs < 0 || elapsedMs >= QUESTION_MS) {
    return;
  }

  const isCorrect = chosenIndex === question.answerIndex;

  await arenaPrisma.arenaAnswer
    .create({
      data: {
        matchId,
        questionId: question.id,
        playerId: player.id,
        position,
        chosenIndex,
        isCorrect,
        elapsedMs,
        points: scoreAnswer({ isCorrect, elapsedMs })
      }
    })
    .catch(() => undefined);

  // Екеуі де жауап берсе, сұрақ бірден жабылады
  await tick(matchId);
}

/** Матч біткендегі қорытынды */
export async function getOutcome(viewer: ArenaViewer, matchId: string): Promise<MatchOutcome> {
  const player = await ensurePlayer(viewer);
  const match = await tick(matchId);

  if (match.status !== "finished" && match.status !== "abandoned") {
    throw new Error("Матч әлі бітпеген.");
  }

  const mine = match.players.find((side) => side.playerId === player.id);
  if (!mine) {
    throw new Error("Бұл матч сізге тиесілі емес.");
  }

  const other = match.players.find((side) => side.playerId !== player.id) ?? null;
  const subject = await arenaPrisma.arenaSubject.findUnique({ where: { id: match.subjectId } });

  const review: QuestionResult[] = [];
  for (let position = 0; position < TOTAL_QUESTIONS; position += 1) {
    const row = buildResult(match, position, mine.playerId, other?.playerId ?? null);
    if (row) {
      review.push(row);
    }
  }

  const describe = (side: typeof mine) => ({
    playerId: side.playerId,
    displayName: side.player.displayName,
    score: side.score || scoreOf(match, side.playerId),
    ratingBefore: side.ratingBefore ?? START_RATING,
    ratingAfter: side.ratingAfter ?? side.ratingBefore ?? START_RATING
  });

  return {
    matchId: match.id,
    subjectId: match.subjectId,
    subjectName: subject?.name ?? "Пән",
    status: match.status as "finished" | "abandoned",
    winnerId: match.winnerId,
    you: describe(mine),
    opponent: other ? describe(other) : null,
    review
  };
}

/** Ойыншының барлық пәндегі рейтингі */
export async function getRatings(viewer: ArenaViewer): Promise<SubjectRating[]> {
  const player = await ensurePlayer(viewer);
  const [rows, subjects] = await Promise.all([
    arenaPrisma.arenaRating.findMany({ where: { playerId: player.id } }),
    arenaPrisma.arenaSubject.findMany()
  ]);

  const names = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const result: SubjectRating[] = [];

  for (const row of rows) {
    const better = await arenaPrisma.arenaRating.count({
      where: { subjectId: row.subjectId, rating: { gt: row.rating }, played: { gt: 0 } }
    });

    result.push({
      subjectId: row.subjectId,
      subjectName: names.get(row.subjectId) ?? "Пән",
      rating: row.rating,
      played: row.played,
      won: row.won,
      lost: row.lost,
      drawn: row.drawn,
      rank: row.played > 0 ? better + 1 : null
    });
  }

  return result.sort((first, second) => second.rating - first.rating);
}

/** Пән бойынша лидерлер тізімі */
export async function getLeaderboard(
  viewer: ArenaViewer,
  subjectId: string,
  limit = 20
): Promise<LeaderboardRow[]> {
  const player = await ensurePlayer(viewer);
  const rows = await arenaPrisma.arenaRating.findMany({
    where: { subjectId, played: { gt: 0 } },
    orderBy: [{ rating: "desc" }, { won: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
    include: { player: true }
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.playerId,
    displayName: row.player.displayName,
    rating: row.rating,
    played: row.played,
    won: row.won,
    isYou: row.playerId === player.id
  }));
}

/** Аяқталған матчтар тарихы */
export async function getHistory(
  viewer: ArenaViewer,
  subjectId?: string,
  limit = 20
): Promise<HistoryRow[]> {
  const player = await ensurePlayer(viewer);
  const rows = await arenaPrisma.arenaMatchPlayer.findMany({
    where: {
      playerId: player.id,
      match: {
        status: { in: ["finished", "abandoned"] },
        ...(subjectId ? { subjectId } : {})
      }
    },
    orderBy: { match: { finishedAt: "desc" } },
    take: Math.min(Math.max(limit, 1), 100),
    include: {
      match: { include: { players: { include: { player: true } } } }
    }
  });

  const subjects = await arenaPrisma.arenaSubject.findMany();
  const names = new Map(subjects.map((subject) => [subject.id, subject.name]));

  return rows.map((row) => {
    const other = row.match.players.find((side) => side.playerId !== player.id) ?? null;
    const yourScore = row.score;
    const opponentScore = other?.score ?? 0;

    return {
      matchId: row.matchId,
      subjectId: row.match.subjectId,
      subjectName: names.get(row.match.subjectId) ?? "Пән",
      finishedAt: (row.match.finishedAt ?? row.match.createdAt).toISOString(),
      opponentName: other?.player.displayName ?? "Қарсылас",
      yourScore,
      opponentScore,
      result:
        row.match.winnerId === null
          ? ("drawn" as const)
          : row.match.winnerId === player.id
            ? ("won" as const)
            : ("lost" as const),
      ratingDelta: (row.ratingAfter ?? 0) - (row.ratingBefore ?? 0)
    };
  });
}

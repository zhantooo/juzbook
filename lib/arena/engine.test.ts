import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { arenaPrisma } from "@/lib/arena/db";
import {
  QUEUE_BOT_AFTER_MS,
  TOTAL_QUESTIONS,
  createPrivateMatch,
  getHistory,
  getLeaderboard,
  getMatchState,
  getOutcome,
  getRatings,
  joinByCode,
  joinQueue,
  leaveQueue,
  pollQueue,
  submitAnswer,
  type ArenaViewer
} from "@/lib/arena/engine";
import { QUESTION_MS } from "@/lib/arena/scoring";
import { START_RATING } from "@/lib/arena/rating";

/**
 * Қозғалтқыштың нағыз дерекқормен тексерілуі.
 *
 * Уақытты жалған функциямен емес, дерекқордағы `questionOpenedAt` мәнін
 * артқа жылжыту арқылы басқарамыз: сонда нағыз жол тексеріледі — сервер
 * уақытты қалай оқыса, тест те солай оқиды.
 */

const SUBJECT = "test-subject";
const ALICE: ArenaViewer = { id: "test-alice", name: "Әлия" };
const BOB: ArenaViewer = { id: "test-bob", name: "Бағдат" };
const CAROL: ArenaViewer = { id: "test-carol", name: "Қарлығаш" };
const ALL = [ALICE, BOB, CAROL];

/** Матчқа жететін сұрақ банкін құрамыз */
async function seedQuestions() {
  await arenaPrisma.arenaSubject.upsert({
    where: { id: SUBJECT },
    create: { id: SUBJECT, name: "Тест пәні", description: "Тек тестке арналған" },
    update: {}
  });

  const existing = await arenaPrisma.arenaQuestionBank.count({ where: { subjectId: SUBJECT } });
  if (existing >= 60) {
    return;
  }

  const rows: Array<{
    sourceId: string;
    subjectId: string;
    chapterId: string;
    prompt: string;
    optionsJson: string;
    answerIndex: number;
    explanation: string;
    difficulty: string;
  }> = [];

  const mix: Array<[string, number]> = [
    ["medium", 30],
    ["easy", 15],
    ["hard", 15]
  ];

  for (const [difficulty, count] of mix) {
    for (let index = 0; index < count; index += 1) {
      rows.push({
        sourceId: `${SUBJECT}-${difficulty}-${index}`,
        subjectId: SUBJECT,
        chapterId: "test-chapter",
        prompt: `${difficulty} сұрақ №${index}`,
        optionsJson: JSON.stringify(["A нұсқа", "B нұсқа", "C нұсқа", "D нұсқа"]),
        // Дұрыс жауап әр сұрақта әртүрлі орында тұрсын
        answerIndex: index % 4,
        explanation: `${difficulty} түсіндірмесі №${index}`,
        difficulty
      });
    }
  }

  await arenaPrisma.arenaQuestionBank.createMany({ data: rows });
}

/** Тест ойыншыларының барлық ізін өшіреміз */
async function resetPlayers() {
  const players = await arenaPrisma.arenaPlayer.findMany({
    where: { userId: { in: [...ALL.map((v) => v.id), "arena-bot"] } },
    select: { id: true }
  });
  const ids = players.map((p) => p.id);
  if (!ids.length) {
    return;
  }

  const matches = await arenaPrisma.arenaMatchPlayer.findMany({
    where: { playerId: { in: ids } },
    select: { matchId: true }
  });

  await arenaPrisma.arenaQueueEntry.deleteMany({ where: { playerId: { in: ids } } });
  await arenaPrisma.arenaMatch.deleteMany({ where: { id: { in: matches.map((m) => m.matchId) } } });
  await arenaPrisma.arenaRating.deleteMany({ where: { playerId: { in: ids } } });
  await arenaPrisma.arenaPlayer.deleteMany({ where: { id: { in: ids } } });
}

/** Талдау кезеңін күтпей, келесі сұрақты бірден ашады */
async function skipReveal(matchId: string) {
  await arenaPrisma.arenaMatch.update({
    where: { id: matchId },
    data: { questionOpenedAt: new Date(Date.now() - 50) }
  });
}

/** Ағымдағы сұрақтың уақытын бітірген етіп көрсетеді */
async function expireQuestion(matchId: string) {
  await arenaPrisma.arenaMatch.update({
    where: { id: matchId },
    data: { questionOpenedAt: new Date(Date.now() - QUESTION_MS - 100) }
  });
}

/** Сұрақтың дұрыс жауабы — тек тексеру үшін дерекқордан оқылады */
async function correctIndexAt(matchId: string, position: number) {
  const row = await arenaPrisma.arenaQuestion.findFirst({
    where: { matchId, position },
    select: { answerIndex: true }
  });
  return row?.answerIndex ?? 0;
}

/** Екі ойыншы бір матчқа түседі */
async function pairUp() {
  await joinQueue(ALICE, SUBJECT);
  const result = await joinQueue(BOB, SUBJECT);
  if (result.status !== "matched") {
    throw new Error("қарсылас табылмады");
  }
  return result.matchId;
}

/**
 * Он сұрақты ойнап шығады.
 *
 * Сұрақтар 0..9 ретімен ашылатындықтан, әр айналымда күйді қайта оқудың
 * қажеті жоқ — ол әр шақыруда матчтың уақытын жылжытып, тестті бірнеше есе
 * баяулатады.
 *
 * `right` — Әлия дұрыс жауап бере ме. Жалған болса, екеуі де бірдей жауап
 * береді де, матч тең аяқталады.
 */
async function playFullMatch(options: { bobCorrect?: boolean } = {}) {
  const matchId = await pairUp();

  for (let position = 0; position < TOTAL_QUESTIONS; position += 1) {
    const correct = await correctIndexAt(matchId, position);
    await submitAnswer(ALICE, matchId, position, correct);
    await submitAnswer(BOB, matchId, position, options.bobCorrect ? correct : (correct + 1) % 4);

    if (position < TOTAL_QUESTIONS - 1) {
      await skipReveal(matchId);
    }
  }

  return matchId;
}

beforeAll(async () => {
  await seedQuestions();
});

beforeEach(async () => {
  await resetPlayers();
});

afterAll(async () => {
  await resetPlayers();
  await arenaPrisma.$disconnect();
});

describe("кезекке тұру", () => {
  it("бірінші ойыншы күтеді, екіншісі матчқа түседі", async () => {
    const first = await joinQueue(ALICE, SUBJECT);
    expect(first.status).toBe("queued");

    const second = await joinQueue(BOB, SUBJECT);
    expect(second.status).toBe("matched");
  });

  it("кезектен шыққан соң қарсылас табылмайды", async () => {
    await joinQueue(ALICE, SUBJECT);
    await leaveQueue(ALICE);

    const second = await joinQueue(BOB, SUBJECT);
    expect(second.status).toBe("queued");
  });

  it("бір ойыншы екі рет тұрса, өзімен қосылмайды", async () => {
    await joinQueue(ALICE, SUBJECT);
    const again = await joinQueue(ALICE, SUBJECT);
    expect(again.status).toBe("queued");
  });

  it("ойнап жатқан матчы барды жаңа матчқа жібермейді", async () => {
    const matchId = await pairUp();
    const again = await joinQueue(ALICE, SUBJECT);
    expect(again).toEqual({ status: "matched", matchId });
  });

  it("ұзақ күткен ойыншыға жаттығу боты қосылады", async () => {
    await joinQueue(CAROL, SUBJECT);

    const player = await arenaPrisma.arenaPlayer.findUnique({ where: { userId: CAROL.id } });
    await arenaPrisma.arenaQueueEntry.update({
      where: { playerId: player!.id },
      data: { joinedAt: new Date(Date.now() - QUEUE_BOT_AFTER_MS - 1000) }
    });

    const result = await pollQueue(CAROL, SUBJECT);
    expect(result.status).toBe("matched");

    if (result.status === "matched") {
      const state = await getMatchState(CAROL, result.matchId);
      expect(state.opponent?.displayName).toBe("Жаттығу боты");
    }
  });
});

describe("матч күйі", () => {
  it("екі ойыншыға бірдей сұрақ беріледі", async () => {
    const matchId = await pairUp();
    const alice = await getMatchState(ALICE, matchId);
    const bob = await getMatchState(BOB, matchId);

    expect(alice.question).not.toBeNull();
    expect(alice.question?.prompt).toBe(bob.question?.prompt);
    expect(alice.question?.options).toEqual(bob.question?.options);
    expect(alice.totalQuestions).toBe(TOTAL_QUESTIONS);
  });

  it("ашық сұрақпен бірге дұрыс жауап берілмейді", async () => {
    const matchId = await pairUp();
    const state = await getMatchState(ALICE, matchId);

    expect(state.question).not.toBeNull();
    expect(state.lastResult).toBeNull();
    expect(JSON.stringify(state.question)).not.toContain("correctIndex");
  });

  it("қарсыластың аты көрінеді, жауабы көрінбейді", async () => {
    const matchId = await pairUp();
    const correct = await correctIndexAt(matchId, 0);
    await submitAnswer(BOB, matchId, 0, correct);

    const state = await getMatchState(ALICE, matchId);
    expect(state.opponent?.displayName).toBe(BOB.name);
    expect(state.opponent?.answered).toBe(true);
    expect(state.opponent).not.toHaveProperty("chosenIndex");
  });

  it("бөтен ойыншы матчты аша алмайды", async () => {
    const matchId = await pairUp();
    await expect(getMatchState(CAROL, matchId)).rejects.toThrow();
  });
});

describe("жауап беру", () => {
  it("дұрыс жауап ұпай әкеледі, қате жауап әкелмейді", async () => {
    const matchId = await pairUp();
    const correct = await correctIndexAt(matchId, 0);

    await submitAnswer(ALICE, matchId, 0, correct);
    await submitAnswer(BOB, matchId, 0, (correct + 1) % 4);

    const state = await getMatchState(ALICE, matchId);
    expect(state.you.score).toBeGreaterThan(0);
    expect(state.opponent?.score).toBe(0);
  });

  it("екеуі жауап бергенде сұрақ уақытынан бұрын жабылады", async () => {
    const matchId = await pairUp();
    const correct = await correctIndexAt(matchId, 0);

    await submitAnswer(ALICE, matchId, 0, correct);
    await submitAnswer(BOB, matchId, 0, correct);

    const state = await getMatchState(ALICE, matchId);
    expect(state.lastResult).not.toBeNull();
    expect(state.lastResult?.position).toBe(0);
    expect(state.lastResult?.correctIndex).toBe(correct);
  });

  it("бір сұраққа екінші жауап еленбейді", async () => {
    const matchId = await pairUp();
    const correct = await correctIndexAt(matchId, 0);

    await submitAnswer(ALICE, matchId, 0, (correct + 1) % 4);
    await submitAnswer(ALICE, matchId, 0, correct);

    const answers = await arenaPrisma.arenaAnswer.findMany({ where: { matchId, position: 0 } });
    const mine = answers.filter((a) => a.isCorrect);
    expect(mine).toHaveLength(0);
  });

  it("басқа сұрақтың нөмірі үнсіз өткізіледі", async () => {
    const matchId = await pairUp();
    await submitAnswer(ALICE, matchId, 7, 0);

    const answers = await arenaPrisma.arenaAnswer.findMany({ where: { matchId } });
    expect(answers).toHaveLength(0);
  });

  it("уақыт біткен соң келген жауап қабылданбайды", async () => {
    const matchId = await pairUp();
    const correct = await correctIndexAt(matchId, 0);
    await expireQuestion(matchId);

    await submitAnswer(ALICE, matchId, 0, correct);

    const answer = await arenaPrisma.arenaAnswer.findFirst({
      where: { matchId, position: 0 },
      orderBy: { answeredAt: "asc" }
    });
    expect(answer?.chosenIndex).toBeNull();
    expect(answer?.points).toBe(0);
  });
});

describe("уақыт бітуі", () => {
  it("үлгермегендерге бос жауап жазылады да, келесі сұрақ ашылады", async () => {
    const matchId = await pairUp();
    await expireQuestion(matchId);

    const state = await getMatchState(ALICE, matchId);

    const answers = await arenaPrisma.arenaAnswer.findMany({ where: { matchId, position: 0 } });
    expect(answers).toHaveLength(2);
    expect(answers.every((a) => a.chosenIndex === null && a.points === 0)).toBe(true);
    expect(state.lastResult?.position).toBe(0);
  });

  it("талдау кезеңінен кейін келесі сұрақ ашылады", async () => {
    const matchId = await pairUp();
    await expireQuestion(matchId);
    await getMatchState(ALICE, matchId);
    await skipReveal(matchId);

    const state = await getMatchState(ALICE, matchId);
    expect(state.currentIndex).toBe(1);
    expect(state.question?.position).toBe(1);
    expect(state.lastResult).toBeNull();
  });
});

describe("матчты тастап кету", () => {
  it("қатарынан үш сұраққа жауап бермеген ойыншы жеңіледі", async () => {
    const matchId = await pairUp();

    for (let round = 0; round < 3; round += 1) {
      const correct = await correctIndexAt(matchId, round);
      await submitAnswer(ALICE, matchId, round, correct);
      await expireQuestion(matchId);
      await getMatchState(ALICE, matchId);
      await skipReveal(matchId);
    }

    const state = await getMatchState(ALICE, matchId);
    expect(state.status).toBe("abandoned");

    const outcome = await getOutcome(ALICE, matchId);
    expect(outcome.status).toBe("abandoned");
    expect(outcome.winnerId).toBe(outcome.you.playerId);
  });

  it("жауап берген ойыншының есебі нөлденеді", async () => {
    const matchId = await pairUp();

    // Бірінші сұраққа жауап бермейміз
    await expireQuestion(matchId);
    await getMatchState(ALICE, matchId);
    await skipReveal(matchId);

    // Екіншісіне екеуі де жауап береді
    const correct = await correctIndexAt(matchId, 1);
    await submitAnswer(ALICE, matchId, 1, correct);
    await submitAnswer(BOB, matchId, 1, correct);
    await getMatchState(ALICE, matchId);

    const players = await arenaPrisma.arenaMatchPlayer.findMany({ where: { matchId } });
    expect(players.every((p) => p.missedInRow === 0)).toBe(true);
  });
});

describe("жеке матч", () => {
  it("бөлме коды беріледі де, матч қарсыласты күтеді", async () => {
    const room = await createPrivateMatch(ALICE, SUBJECT);
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);

    const state = await getMatchState(ALICE, room.matchId);
    expect(state.status).toBe("waiting");
    expect(state.code).toBe(room.code);
    expect(state.opponent).toBeNull();
  });

  it("кодпен қосылғанда матч басталады", async () => {
    const room = await createPrivateMatch(ALICE, SUBJECT);
    const joined = await joinByCode(BOB, room.code);
    expect(joined.matchId).toBe(room.matchId);

    const state = await getMatchState(ALICE, room.matchId);
    expect(state.status).toBe("active");
    expect(state.opponent?.displayName).toBe(BOB.name);
  });

  it("код регистрге тәуелсіз", async () => {
    const room = await createPrivateMatch(ALICE, SUBJECT);
    const joined = await joinByCode(BOB, room.code.toLowerCase());
    expect(joined.matchId).toBe(room.matchId);
  });

  it("үшінші ойыншы толған бөлмеге кіре алмайды", async () => {
    const room = await createPrivateMatch(ALICE, SUBJECT);
    await joinByCode(BOB, room.code);
    await expect(joinByCode(CAROL, room.code)).rejects.toThrow();
  });

  it("бөлме иесі өз кодымен қайта кіре алады", async () => {
    const room = await createPrivateMatch(ALICE, SUBJECT);
    const again = await joinByCode(ALICE, room.code);
    expect(again.matchId).toBe(room.matchId);
  });

  it("жалған код қабылданбайды", async () => {
    await expect(joinByCode(ALICE, "ZZZZZ")).rejects.toThrow();
  });
});

describe("деректің сақталуы", () => {
  it("матчтың сұрақтары құрылған сәтте жазылады", async () => {
    const matchId = await pairUp();
    const questions = await arenaPrisma.arenaQuestion.findMany({
      where: { matchId },
      orderBy: { position: "asc" }
    });

    expect(questions).toHaveLength(TOTAL_QUESTIONS);
    expect(questions.map((q) => q.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(TOTAL_QUESTIONS);
  });

  it("қайта қосылғанда дәл сол сұрақтар көрінеді", async () => {
    const matchId = await pairUp();
    const before = await getMatchState(ALICE, matchId);

    // «Қайта қосылу»: күйді қайтадан нөлден оқимыз
    const after = await getMatchState(ALICE, matchId);

    expect(after.question?.prompt).toBe(before.question?.prompt);
    expect(after.question?.position).toBe(before.question?.position);
    expect(after.currentIndex).toBe(before.currentIndex);
  });

  it("жауаптар дерекқорда қалады", async () => {
    const matchId = await pairUp();
    const correct = await correctIndexAt(matchId, 0);
    await submitAnswer(ALICE, matchId, 0, correct);

    const stored = await arenaPrisma.arenaAnswer.findFirst({
      where: { matchId, position: 0 },
      include: { player: true }
    });

    expect(stored?.player.userId).toBe(ALICE.id);
    expect(stored?.chosenIndex).toBe(correct);
    expect(stored?.isCorrect).toBe(true);
    expect(stored?.points).toBeGreaterThan(0);
  });

  it("кезек дерекқорда сақталады", async () => {
    await joinQueue(ALICE, SUBJECT);
    const entry = await arenaPrisma.arenaQueueEntry.findFirst({
      where: { player: { userId: ALICE.id } }
    });
    expect(entry?.subjectId).toBe(SUBJECT);
  });
});

describe("толық матч", () => {
  /**
   * Бір толық матч жергілікті SQLite-та ондаған жазу операциясын талап етеді
   * де, ондаған секунд алады. Сондықтан бір матч ойналып, барлық тұжырым
   * сол бір нәтижеге қарсы тексеріледі — әр тұжырымға жаңа матч ойнау тек
   * уақытты алар еді, ал тексерілетіні бірдей.
   */
  it("он сұрақ ойналып, қорытынды мен рейтинг дұрыс шығады", async () => {
    const matchId = await playFullMatch();

    const state = await getMatchState(ALICE, matchId);
    expect(state.status).toBe("finished");

    const outcome = await getOutcome(ALICE, matchId);

    // Талдау толық әрі түсіндірмелі
    expect(outcome.review).toHaveLength(TOTAL_QUESTIONS);
    expect(outcome.review.every((row) => row.you.isCorrect)).toBe(true);
    expect(outcome.review.every((row) => row.explanation.length > 0)).toBe(true);

    // Дұрыс жауап берген жеңеді
    expect(outcome.you.score).toBeGreaterThan(outcome.opponent!.score);
    expect(outcome.winnerId).toBe(outcome.you.playerId);

    // Рейтинг жаңарады, жалпы сома сақталады
    expect(outcome.you.ratingBefore).toBe(START_RATING);
    expect(outcome.you.ratingAfter).toBeGreaterThan(outcome.you.ratingBefore);
    expect(outcome.opponent!.ratingAfter).toBeLessThan(outcome.opponent!.ratingBefore);
    expect(outcome.you.ratingAfter + outcome.opponent!.ratingAfter).toBe(
      outcome.you.ratingBefore + outcome.opponent!.ratingBefore
    );

    // Екі жақ бір нәтижені көреді
    const theirs = await getOutcome(BOB, matchId);
    expect(theirs.winnerId).toBe(outcome.winnerId);
    expect(theirs.you.score).toBe(outcome.opponent!.score);
    expect(theirs.opponent!.score).toBe(outcome.you.score);
  });

  it("аяқталмаған матчтың қорытындысы берілмейді", async () => {
    const matchId = await pairUp();
    await expect(getOutcome(ALICE, matchId)).rejects.toThrow();
  });
});

describe("рейтинг, лидерлер, тарих", () => {
  it("ойнағаннан кейін пән рейтингі пайда болады", async () => {
    const matchId = await playFullMatch({ bobCorrect: true });

    const ratings = await getRatings(ALICE);
    const mine = ratings.find((row) => row.subjectId === SUBJECT);
    expect(mine).toBeDefined();
    expect(mine?.played).toBe(1);
    expect(mine?.rank).toBe(1);

    const board = await getLeaderboard(ALICE, SUBJECT);
    expect(board.length).toBeGreaterThanOrEqual(2);
    expect(board[0].rank).toBe(1);
    expect(board.some((row) => row.isYou)).toBe(true);

    const history = await getHistory(ALICE, SUBJECT);
    expect(history).toHaveLength(1);
    expect(history[0].matchId).toBe(matchId);
    expect(history[0].opponentName).toBe(BOB.name);
  });

  it("ойнамаған ойыншыда рейтинг жазбасы болмайды", async () => {
    const ratings = await getRatings(CAROL);
    expect(ratings).toHaveLength(0);
  });
});

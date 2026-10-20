import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockArenaService } from "@/lib/arena/service.mock";
import { QUESTION_MS } from "@/lib/arena/scoring";
import type { MatchEvent, MatchState } from "@/lib/arena/service";

/**
 * Мок қызмет — backend дайын болмай тұрып интерфейсті құрастыруға арналған
 * жадтағы іске асыру. Ол әлі де керек: dev режиміндегі көзбен тексеру беті
 * кіруді талап етпей сол арқылы жұмыс істейді.
 *
 * Уақытты жалған таймермен басқарамыз: мок `setTimeout` арқылы сұрақты
 * жауып, келесісін ашады.
 *
 * Бір ерекшелігі: матчтың сағаты `subscribe` шақырылғанда ғана жүре
 * бастайды. Сондықтан уақытқа тәуелді тұжырымдар алдымен жазылады.
 */

const SUBJECT = "biology";

async function startMatch() {
  const queue = await mockArenaService.joinQueue(SUBJECT);
  if (queue.status !== "matched") {
    throw new Error("мок бірден қарсылас беруі керек");
  }
  return queue.matchId;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("кезек", () => {
  it("қарсылас бірден табылады", async () => {
    const queue = await mockArenaService.joinQueue(SUBJECT);
    expect(queue.status).toBe("matched");
  });

  it("кезекті сұрау да матч береді", async () => {
    const queue = await mockArenaService.pollQueue(SUBJECT);
    expect(queue.status).toBe("matched");
  });

  it("жеке матч коды беріледі", async () => {
    const room = await mockArenaService.createPrivateMatch(SUBJECT);
    expect(room.code.length).toBeGreaterThanOrEqual(4);
    expect(room.matchId).toBeTruthy();
  });
});

describe("матч күйі", () => {
  it("бірінші сұрақ ашық тұрады", async () => {
    const matchId = await startMatch();
    const state = await mockArenaService.getMatch(matchId);

    expect(state.status).toBe("active");
    expect(state.currentIndex).toBe(0);
    expect(state.question).not.toBeNull();
    expect(state.question?.options.length).toBeGreaterThanOrEqual(2);
    expect(state.lastResult).toBeNull();
  });

  it("қарсылас бар", async () => {
    const matchId = await startMatch();
    const state = await mockArenaService.getMatch(matchId);
    expect(state.opponent).not.toBeNull();
    expect(state.opponent?.displayName.length).toBeGreaterThan(0);
  });

  it("ашық сұрақта дұрыс жауап берілмейді", async () => {
    const matchId = await startMatch();
    const state = await mockArenaService.getMatch(matchId);
    expect(JSON.stringify(state.question)).not.toContain("correctIndex");
  });

  it("белгісіз матч қатемен аяқталады", async () => {
    await expect(mockArenaService.getMatch("жоқ-матч")).rejects.toThrow();
  });
});

describe("жауап", () => {
  it("жауап бергенде белгіленеді", async () => {
    const matchId = await startMatch();
    await mockArenaService.submitAnswer(matchId, 0, 0);

    const state = await mockArenaService.getMatch(matchId);
    expect(state.you.answered).toBe(true);
  });

  it("уақыт біткенде сұрақ жабылады", async () => {
    const matchId = await startMatch();
    // Мокта матчтың сағаты жазылым басталғанда ғана жүреді
    const stop = mockArenaService.subscribe(matchId, () => undefined);

    await vi.advanceTimersByTimeAsync(QUESTION_MS + 50);
    const state = await mockArenaService.getMatch(matchId);
    stop();

    expect(state.lastResult).not.toBeNull();
    expect(state.lastResult?.position).toBe(0);
  });
});

describe("оқиғалар ағыны", () => {
  it("жазылған соң күй оқиғасы келеді", async () => {
    const matchId = await startMatch();
    const events: MatchEvent[] = [];
    const stop = mockArenaService.subscribe(matchId, (event) => events.push(event));

    await vi.advanceTimersByTimeAsync(10);
    stop();

    expect(events.some((event) => event.type === "state" || event.type === "question")).toBe(true);
  });

  it("жазылымды тоқтатқан соң оқиға келмейді", async () => {
    const matchId = await startMatch();
    const events: MatchEvent[] = [];
    const stop = mockArenaService.subscribe(matchId, (event) => events.push(event));

    await vi.advanceTimersByTimeAsync(10);
    stop();
    const countAfterStop = events.length;

    await vi.advanceTimersByTimeAsync(QUESTION_MS * 2);
    expect(events.length).toBe(countAfterStop);
  });

  /**
   * #93 регрессиясы: сұрақ ерте жабылғанда ескі таймер кейін іске қосылып,
   * бір сұрақты аттап кететін. Әр жабылуда «дәуір» өсетін болды.
   */
  it("сұрақтар аттап кетпейді — ретімен ашылады", async () => {
    const matchId = await startMatch();
    const seen: number[] = [];

    const stop = mockArenaService.subscribe(matchId, (event) => {
      if (event.type === "question") {
        seen.push(event.question.position);
      }
    });

    // Үш сұрақты тез жауап беріп өтеміз
    for (let round = 0; round < 3; round += 1) {
      const state: MatchState = await mockArenaService.getMatch(matchId);
      if (state.question) {
        await mockArenaService.submitAnswer(matchId, state.question.position, 0);
      }
      await vi.advanceTimersByTimeAsync(QUESTION_MS + 3000);
    }

    stop();

    // Көрінген нөмірлер қатаң өсіп, бірде-бір саны аттап кетпеуі керек
    for (let index = 1; index < seen.length; index += 1) {
      expect(seen[index]).toBe(seen[index - 1] + 1);
    }
  });
});

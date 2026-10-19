import { describe, expect, it } from "vitest";
import { CORRECT_POINTS, QUESTION_MS, SPEED_BONUS, decideWinner, isInTime, scoreAnswer } from "./scoring";

describe("scoreAnswer", () => {
  it("қате жауап ұпай әкелмейді", () => {
    expect(scoreAnswer({ isCorrect: false, elapsedMs: 0 })).toBe(0);
  });

  it("бірден берілген дұрыс жауап ең жоғары ұпай алады", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: 0 })).toBe(CORRECT_POINTS + SPEED_BONUS);
  });

  it("жартылай уақытта берілген жауап бонустың жартысын алады", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: QUESTION_MS / 2 })).toBe(CORRECT_POINTS + SPEED_BONUS / 2);
  });

  it("уақыт біткен соң дұрыс жауап та ұпай әкелмейді", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: QUESTION_MS })).toBe(0);
    expect(scoreAnswer({ isCorrect: true, elapsedMs: QUESTION_MS + 100 })).toBe(0);
  });

  it("соңғы сәтте берілген жауап әлі де ұпай әкеледі", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: QUESTION_MS - 1 })).toBe(CORRECT_POINTS);
  });

  it("теріс уақыт нөл деп есептеледі", () => {
    expect(scoreAnswer({ isCorrect: true, elapsedMs: -500 })).toBe(CORRECT_POINTS + SPEED_BONUS);
  });
});

describe("isInTime", () => {
  it("шекараны дәл белгілейді", () => {
    expect(isInTime(QUESTION_MS - 1)).toBe(true);
    expect(isInTime(QUESTION_MS)).toBe(false);
    expect(isInTime(-1)).toBe(false);
  });
});

describe("decideWinner", () => {
  it("ұпайы көп ойыншы жеңеді", () => {
    expect(decideWinner(150, 100)).toBe("first");
    expect(decideWinner(100, 150)).toBe("second");
  });

  it("тең ұпай тең ойын", () => {
    expect(decideWinner(120, 120)).toBe("draw");
  });
});

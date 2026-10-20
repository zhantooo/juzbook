import { describe, expect, it } from "vitest";
import {
  K_FACTOR,
  START_RATING,
  expectedScore,
  nextRatings,
  ratingDelta,
  resultValue
} from "@/lib/arena/rating";

describe("expectedScore", () => {
  it("тең рейтингте екеуінің мүмкіндігі бірдей", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it("400 ұпай артықшылық ≈ 10 есе мүмкіндік", () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 3);
  });

  it("екі жақтың күтілген нәтижесі бірді құрайды", () => {
    expect(expectedScore(1250, 980) + expectedScore(980, 1250)).toBeCloseTo(1, 10);
  });
});

describe("resultValue", () => {
  it("жеңіс, тең, жеңіліс", () => {
    expect(resultValue("won")).toBe(1);
    expect(resultValue("drawn")).toBe(0.5);
    expect(resultValue("lost")).toBe(0);
  });
});

describe("ratingDelta", () => {
  it("тең рейтингте жеңіс жарты коэффициент әкеледі", () => {
    expect(ratingDelta({ mine: 1000, theirs: 1000, result: "won" })).toBe(K_FACTOR / 2);
  });

  it("тең рейтингте тең ойын ештеңе өзгертпейді", () => {
    expect(ratingDelta({ mine: 1000, theirs: 1000, result: "drawn" })).toBe(0);
  });

  it("әлсіз қарсыласты жеңу аз ұпай әкеледі", () => {
    const easy = ratingDelta({ mine: 1400, theirs: 1000, result: "won" });
    const fair = ratingDelta({ mine: 1000, theirs: 1000, result: "won" });
    expect(easy).toBeLessThan(fair);
    expect(easy).toBeGreaterThan(0);
  });

  it("күшті қарсыласты жеңу көп ұпай әкеледі", () => {
    const upset = ratingDelta({ mine: 1000, theirs: 1400, result: "won" });
    expect(upset).toBeGreaterThan(ratingDelta({ mine: 1000, theirs: 1000, result: "won" }));
    expect(upset).toBeLessThanOrEqual(K_FACTOR);
  });

  it("күшті ойыншыға жеңілу қымбатқа түседі", () => {
    expect(ratingDelta({ mine: 1400, theirs: 1000, result: "lost" })).toBeLessThan(
      ratingDelta({ mine: 1000, theirs: 1400, result: "lost" })
    );
  });

  it("өзгеріс ешқашан коэффициенттен аспайды", () => {
    for (const mine of [600, 1000, 1800, 2400]) {
      for (const theirs of [600, 1000, 1800, 2400]) {
        for (const result of ["won", "lost", "drawn"] as const) {
          expect(Math.abs(ratingDelta({ mine, theirs, result }))).toBeLessThanOrEqual(K_FACTOR);
        }
      }
    }
  });
});

describe("nextRatings", () => {
  it("бір ойыншы алғанды екіншісі береді — жалпы сома сақталады", () => {
    const before = START_RATING + START_RATING;
    const after = nextRatings({ first: START_RATING, second: START_RATING, result: "won" });
    expect(after.first + after.second).toBe(before);
  });

  it("әртүрлі рейтингте де сома сақталады", () => {
    const after = nextRatings({ first: 1320, second: 970, result: "lost" });
    expect(after.first + after.second).toBe(1320 + 970);
  });

  it("жеңімпаздың рейтингі өседі, жеңілгендікі түседі", () => {
    const after = nextRatings({ first: 1000, second: 1000, result: "won" });
    expect(after.first).toBeGreaterThan(1000);
    expect(after.second).toBeLessThan(1000);
    expect(after.delta).toBe(K_FACTOR / 2);
  });

  it("тең ойын тең рейтингте ештеңені өзгертпейді", () => {
    const after = nextRatings({ first: 1000, second: 1000, result: "drawn" });
    expect(after.first).toBe(1000);
    expect(after.second).toBe(1000);
  });

  it("тең ойын әркелкі рейтингте әлсізге пайда әкеледі", () => {
    const after = nextRatings({ first: 900, second: 1300, result: "drawn" });
    expect(after.first).toBeGreaterThan(900);
    expect(after.second).toBeLessThan(1300);
  });
});

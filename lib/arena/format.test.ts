import { describe, expect, it } from "vitest";
import { formatCount } from "./format";

describe("formatCount", () => {
  it("мыңдықты бөледі", () => {
    expect(formatCount(22024)).toBe("22\u00a0024");
    expect(formatCount(1000)).toBe("1\u00a0000");
    expect(formatCount(1234567)).toBe("1\u00a0234\u00a0567");
  });

  it("шағын сандарды өзгертпейді", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(7)).toBe("7");
    expect(formatCount(999)).toBe("999");
  });

  it("теріс сан мен бөлшекті дұрыс өңдейді", () => {
    expect(formatCount(-4200)).toBe("-4\u00a0200");
    expect(formatCount(1500.9)).toBe("1\u00a0500");
  });

  it("нәтижесі ортаға тәуелді емес", () => {
    // Дәл осы жол сервер мен браузерде бірдей болуы керек
    expect(formatCount(82638)).toBe("82\u00a0638");
  });
});

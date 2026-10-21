import { describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO, escapeLikePattern, foldKazakh, splitSearchWords } from "@/lib/search-folding";

describe("бүктеу кестесі", () => {
  it("екі жол бірдей ұзындықта (Postgres translate талабы)", () => {
    expect([...FOLD_FROM]).toHaveLength([...FOLD_TO].length);
  });
});

describe("foldKazakh", () => {
  it("қазақ әріптерін бүктейді", () => {
    expect(foldKazakh("Тәуке")).toBe("тауке");
    expect(foldKazakh("Тауке")).toBe("тауке");
    expect(foldKazakh("Әбілқайыр")).toBe("абилкайыр");
    expect(foldKazakh("ғылым")).toBe("гылым");
    expect(foldKazakh("Ұлытау")).toBe("улытау");
    expect(foldKazakh("Іле")).toBe("иле");
    expect(foldKazakh("таң")).toBe("тан");
  });

  it("екі жазылым бір түрге келеді", () => {
    expect(foldKazakh("Тәуке хан")).toBe(foldKazakh("Тауке хан"));
    expect(foldKazakh("Әбілқайыр")).toBe(foldKazakh("Абилкайыр"));
  });

  it("басқа таңбаларға тиіспейді", () => {
    expect(foldKazakh("XVIII ғасыр, 1710 жыл")).toBe("xviii гасыр, 1710 жыл");
  });
});

describe("splitSearchWords", () => {
  it("сөздерге бөліп, бүктейді", () => {
    expect(splitSearchWords("Тәуке хан")).toEqual(["тауке", "хан"]);
  });

  it("тыныс белгілері мен артық бос орынды алып тастайды", () => {
    expect(splitSearchWords("  Тәуке,  хан!  ")).toEqual(["тауке", "хан"]);
  });

  it("бір әріптік сөздер алынбайды", () => {
    expect(splitSearchWords("а Тәуке")).toEqual(["тауке"]);
  });

  it("сөз саны шектеледі", () => {
    expect(splitSearchWords("бір екі үш төрт бес алты жеті сегіз", 3)).toHaveLength(3);
  });

  it("бос сұрау бос тізім береді", () => {
    expect(splitSearchWords("   ")).toEqual([]);
  });
});

describe("escapeLikePattern", () => {
  it("ILIKE таңбаларын қорғайды", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
    expect(escapeLikePattern("c\\d")).toBe("c\\\\d");
  });

  it("қалыпты мәтінді өзгертпейді", () => {
    expect(escapeLikePattern("тауке хан")).toBe("тауке хан");
  });
});

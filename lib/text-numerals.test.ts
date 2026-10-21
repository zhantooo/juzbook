import { describe, expect, it } from "vitest";
import {
  expandRomanNumerals,
  kazakhCardinal,
  kazakhOrdinal,
  normalizeRomanLetters,
  romanToNumber
} from "@/lib/text-numerals";

describe("romanToNumber", () => {
  it("қарапайым сандар", () => {
    expect(romanToNumber("I")).toBe(1);
    expect(romanToNumber("IV")).toBe(4);
    expect(romanToNumber("IX")).toBe(9);
    expect(romanToNumber("XVIII")).toBe(18);
    expect(romanToNumber("XIX")).toBe(19);
    expect(romanToNumber("XX")).toBe(20);
    expect(romanToNumber("MCMXCIX")).toBe(1999);
  });

  it("кирилл әріптерімен терілген жазуды да таниды", () => {
    // Оқулықтағы нақты жағдай: Х — кириллицалық Ха
    expect(romanToNumber("ХVIII")).toBe(8 + 10);
    expect(romanToNumber("ХІХ")).toBe(19);
    expect(romanToNumber("С")).toBe(100);
  });

  it("жарамсыз жазуды қабылдамайды", () => {
    expect(romanToNumber("IIII")).toBeNull();
    expect(romanToNumber("VV")).toBeNull();
    expect(romanToNumber("ABC")).toBeNull();
    expect(romanToNumber("")).toBeNull();
  });
});

describe("normalizeRomanLetters", () => {
  it("кирилл ұқсастарын латынға келтіреді", () => {
    expect(normalizeRomanLetters("ХІХ")).toBe("XIX");
  });

  it("басқа әріптерге тиіспейді", () => {
    expect(normalizeRomanLetters("Қазақстан")).toBe("Қазақстан");
  });
});

describe("kazakhCardinal", () => {
  it("бірлік пен ондық", () => {
    expect(kazakhCardinal(1)).toBe("бір");
    expect(kazakhCardinal(7)).toBe("жеті");
    expect(kazakhCardinal(10)).toBe("он");
    expect(kazakhCardinal(18)).toBe("он сегіз");
    expect(kazakhCardinal(20)).toBe("жиырма");
    expect(kazakhCardinal(21)).toBe("жиырма бір");
  });

  it("жүздік пен мыңдық", () => {
    expect(kazakhCardinal(100)).toBe("жүз");
    expect(kazakhCardinal(200)).toBe("екі жүз");
    expect(kazakhCardinal(1000)).toBe("мың");
    expect(kazakhCardinal(1999)).toBe("мың тоғыз жүз тоқсан тоғыз");
  });
});

describe("kazakhOrdinal", () => {
  it("жұрнақ соңғы сөзге ғана жалғанады", () => {
    expect(kazakhOrdinal(1)).toBe("бірінші");
    expect(kazakhOrdinal(8)).toBe("сегізінші");
    expect(kazakhOrdinal(18)).toBe("он сегізінші");
    expect(kazakhOrdinal(19)).toBe("он тоғызыншы");
    expect(kazakhOrdinal(21)).toBe("жиырма бірінші");
  });

  it("дөңгелек сандар", () => {
    expect(kazakhOrdinal(10)).toBe("оныншы");
    expect(kazakhOrdinal(20)).toBe("жиырмасыншы");
    expect(kazakhOrdinal(100)).toBe("жүзінші");
    expect(kazakhOrdinal(1000)).toBe("мыңыншы");
  });
});

describe("expandRomanNumerals", () => {
  it("ғасырды реттік санмен оқиды", () => {
    expect(expandRomanNumerals("XVIII ғасыр")).toBe("он сегізінші ғасыр");
    expect(expandRomanNumerals("XIX ғасырдың басы")).toBe("он тоғызыншы ғасырдың басы");
  });

  it("кирилл әріптерімен терілген ғасырды да оқиды", () => {
    expect(expandRomanNumerals("ХVIII–ХІХ ғасырлар")).toBe(
      "он сегізінші–он тоғызыншы ғасырлар"
    );
  });

  it("тарау мен сыныпты да реттік санға айналдырады", () => {
    expect(expandRomanNumerals("III тарау")).toBe("үшінші тарау");
    expect(expandRomanNumerals("II Николай")).toBe("екінші Николай");
  });

  it("жеке тұрған бір әріпке тиіспейді", () => {
    // «В» мен «С» — қазақ мәтінінде кәдімгі әріп
    expect(expandRomanNumerals("А және В нүктелері")).toBe("А және В нүктелері");
    expect(expandRomanNumerals("I әрпі")).toBe("I әрпі");
  });

  it("бір әріп ғасырмен келсе — оқылады", () => {
    expect(expandRomanNumerals("X ғасыр")).toBe("оныншы ғасыр");
  });

  it("сөздің ішіндегі әріптерге тиіспейді", () => {
    expect(expandRomanNumerals("Civic")).toBe("Civic");
  });

  it("қысқарған сөз сан болып оқылмайды", () => {
    // «MIX» (1009) мен «CD» (400) — жарамды рим сандары, бірақ мәтінде
    // олар сан емес. Контекссіз отыздан үлкен сан қабылданбайды.
    expect(expandRomanNumerals("MIX форматы")).toBe("MIX форматы");
    expect(expandRomanNumerals("CD дискісі")).toBe("CD дискісі");
    // Ал ғасырмен келсе — оқылады
    expect(expandRomanNumerals("MIX ғасыр")).toBe("мың тоғызыншы ғасыр");
  });

  it("жарамсыз рим жазуы сол күйінде қалады", () => {
    expect(expandRomanNumerals("IIII ғасыр")).toBe("IIII ғасыр");
  });

  it("қалған мәтінді өзгертпейді", () => {
    const text = "Түрік қағанаты 552 жылы құрылды.";
    expect(expandRomanNumerals(text)).toBe(text);
  });
});

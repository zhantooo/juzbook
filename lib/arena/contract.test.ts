import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  answerRequestSchema,
  codeRequestSchema,
  ratingsQuerySchema,
  subjectRequestSchema
} from "@/lib/arena/schemas";

/**
 * Келісімшарт тесті.
 *
 * Екі нәрсені ұстап тұрады:
 *
 * 1. `openapi.yaml` нағыз маршруттармен сәйкес. Жаңа маршрут қосылып,
 *    құжатқа жазылмай қалса, тест құлайды — құжат ескірмейді.
 * 2. Кіріс деректің сұлбалары дәл сипатталғандай қабылдайды әрі қабылдамайды.
 *
 * YAML толық талданбайды: жоба тәуелсіздіктерінде талдағыш жоқ, ал оны тек
 * тест үшін қосудың қажеті жоқ. Сондықтан мәтіндік тексеру жеткілікті —
 * маршрут пен әдіс құжатта бар ма, жоқ па.
 */

const ROOT = process.cwd();
const SPEC = fs.readFileSync(path.join(ROOT, "openapi.yaml"), "utf8");

/** `app/api/arena` ішіндегі маршруттарды жинайды */
function collectRoutes(dir: string, prefix = "/api/arena"): Array<{ path: string; methods: string[] }> {
  const out: Array<{ path: string; methods: string[] }> = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // `[matchId]` → `{matchId}`: OpenAPI солай жазады
      const segment = entry.name.replace(/^\[(.+)\]$/, "{$1}");
      out.push(...collectRoutes(full, `${prefix}/${segment}`));
      continue;
    }

    if (entry.name === "route.ts") {
      const source = fs.readFileSync(full, "utf8");
      const methods = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map(
        (match) => match[1].toLowerCase()
      );
      if (methods.length) {
        out.push({ path: prefix, methods });
      }
    }
  }

  return out;
}

const routes = collectRoutes(path.join(ROOT, "app/api/arena"));

describe("openapi.yaml нағыз маршруттармен сәйкес", () => {
  it("маршруттар табылды", () => {
    expect(routes.length).toBeGreaterThanOrEqual(5);
  });

  it.each(routes)("$path құжатта сипатталған", ({ path: route }) => {
    expect(SPEC).toContain(`  ${route}:`);
  });

  it("әр маршруттың әр әдісі құжатта бар", () => {
    for (const route of routes) {
      const start = SPEC.indexOf(`  ${route.path}:`);
      expect(start, `${route.path} құжатта жоқ`).toBeGreaterThan(-1);

      // Келесі маршрутқа дейінгі бөлікті аламыз
      const rest = SPEC.slice(start + 1);
      const nextIndex = rest.search(/\n {2}\/api\//);
      const block = nextIndex === -1 ? rest : rest.slice(0, nextIndex);

      for (const method of route.methods) {
        expect(block, `${route.path} ішінде ${method.toUpperCase()} жоқ`).toContain(`    ${method}:`);
      }
    }
  });

  it("құжатта артық маршрут жоқ", () => {
    const documented = [...SPEC.matchAll(/^ {2}(\/api\/arena[^\s:]*):/gm)].map((match) => match[1]);
    const real = new Set(routes.map((route) => route.path));

    for (const route of documented) {
      expect(real.has(route), `${route} құжатта бар, бірақ маршрут жоқ`).toBe(true);
    }
  });

  it("кіру тәсілі сипатталған", () => {
    expect(SPEC).toContain("sessionCookie");
    expect(SPEC).toContain("juzbook_session");
  });
});

describe("пән сұлбасы", () => {
  it("дұрыс пәнді қабылдайды", () => {
    expect(subjectRequestSchema.parse({ subjectId: "biology" })).toEqual({ subjectId: "biology" });
  });

  it("бос мәнді қабылдамайды", () => {
    expect(subjectRequestSchema.safeParse({ subjectId: "" }).success).toBe(false);
    expect(subjectRequestSchema.safeParse({ subjectId: "   " }).success).toBe(false);
    expect(subjectRequestSchema.safeParse({}).success).toBe(false);
  });

  it("бос орындарды кесіп тастайды", () => {
    expect(subjectRequestSchema.parse({ subjectId: "  biology  " }).subjectId).toBe("biology");
  });
});

describe("код сұлбасы", () => {
  it("кодты бас әріпке келтіреді", () => {
    expect(codeRequestSchema.parse({ code: "ab4k2" }).code).toBe("AB4K2");
  });

  it("тым қысқа не тым ұзын кодты қабылдамайды", () => {
    expect(codeRequestSchema.safeParse({ code: "abc" }).success).toBe(false);
    expect(codeRequestSchema.safeParse({ code: "abcdefghij" }).success).toBe(false);
  });

  it("бос орындарды кесіп тастайды", () => {
    expect(codeRequestSchema.parse({ code: "  ab4k2 " }).code).toBe("AB4K2");
  });
});

describe("жауап сұлбасы", () => {
  it("дұрыс жауапты қабылдайды", () => {
    expect(answerRequestSchema.parse({ position: 0, chosenIndex: 3 })).toEqual({
      position: 0,
      chosenIndex: 3
    });
  });

  it("теріс не бөлшек санды қабылдамайды", () => {
    expect(answerRequestSchema.safeParse({ position: -1, chosenIndex: 0 }).success).toBe(false);
    expect(answerRequestSchema.safeParse({ position: 1.5, chosenIndex: 0 }).success).toBe(false);
    expect(answerRequestSchema.safeParse({ position: 0, chosenIndex: -2 }).success).toBe(false);
  });

  it("жол түрінде келген санды қабылдамайды", () => {
    expect(answerRequestSchema.safeParse({ position: "0", chosenIndex: "1" }).success).toBe(false);
  });

  it("шектен асқан нұсқаны қабылдамайды", () => {
    expect(answerRequestSchema.safeParse({ position: 0, chosenIndex: 99 }).success).toBe(false);
  });
});

describe("рейтинг сұрауының сұлбасы", () => {
  it("әдепкі көрініс — ratings", () => {
    expect(ratingsQuerySchema.parse({}).view).toBe("ratings");
  });

  it("белгісіз көріністі қабылдамайды", () => {
    expect(ratingsQuerySchema.safeParse({ view: "барлығы" }).success).toBe(false);
  });

  it("limit санға айналады әрі шектеледі", () => {
    expect(ratingsQuerySchema.parse({ limit: "25" }).limit).toBe(25);
    expect(ratingsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(ratingsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });
});

/**
 * Gemini API кілттерін оқиды және кезекпен ұсынады.
 *
 * Әр тіркелгінің өз тәуліктік шектеуі бар, сондықтан бірнеше кілт қосылса,
 * тәуліктік көлем сол есе артады. Кілттер `.env` файлында былай жазылады:
 *
 *   GEMINI_API_KEY=...
 *   GEMINI_API_KEY_2=...
 *   GEMINI_API_KEY_3=...
 *
 * Лимиті біткен кілт уақытша шетке қойылады да, келесісі қолданылады.
 */
import fs from "node:fs";
import path from "node:path";

/** Лимит біткен кілт осынша уақыт бойы қолданылмайды */
const COOLDOWN_MS = 15 * 60 * 1000;

function fromEnvFile() {
  try {
    const text = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
    const result = [];

    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^GEMINI_API_KEY(?:_\d+)?=(.*)$/);
      if (match) {
        result.push(match[1].trim().replace(/^"|"$/g, ""));
      }
    }

    return result;
  } catch {
    return [];
  }
}

export function readApiKeys() {
  const keys = [];

  for (const [name, value] of Object.entries(process.env)) {
    if (/^GEMINI_API_KEY(_\d+)?$/.test(name) && value && value.trim()) {
      keys.push(value.trim());
    }
  }

  for (const key of fromEnvFile()) {
    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  }

  return keys.filter(Boolean);
}

export function createKeyPool(keys) {
  const pool = keys.map((key) => ({ key, blockedUntil: 0 }));
  let cursor = 0;

  return {
    size: pool.length,

    /** Қолжетімді кілтті қайтарады; бәрі бітсе, ең ертерек босайтынын береді */
    next() {
      const now = Date.now();

      for (let step = 0; step < pool.length; step += 1) {
        const entry = pool[(cursor + step) % pool.length];
        if (entry.blockedUntil <= now) {
          cursor = (cursor + step + 1) % pool.length;
          return entry.key;
        }
      }

      return pool.reduce((best, item) => (item.blockedUntil < best.blockedUntil ? item : best), pool[0]).key;
    },

    /**
     * Кілтті уақытша шетке қояды.
     * Минуттық шектеу болса — қысқа уақытқа, тәуліктік болса — ұзаққа.
     */
    block(key, milliseconds, daily) {
      const entry = pool.find((item) => item.key === key);
      if (entry) {
        const wait = daily ? Math.max(milliseconds || 0, COOLDOWN_MS) : Math.max(milliseconds || 0, 5000);
        entry.blockedUntil = Date.now() + wait;
      }
    },

    /** Барлық кілт бітті ме және қашан босайды */
    blockedFor() {
      const now = Date.now();
      const soonest = pool.reduce(
        (best, item) => Math.min(best, item.blockedUntil),
        Number.POSITIVE_INFINITY
      );
      return soonest <= now ? 0 : soonest - now;
    }
  };
}

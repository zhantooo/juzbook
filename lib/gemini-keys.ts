/**
 * Gemini API кілттерінің кезегі.
 *
 * Бір кілттің тәуліктік шектеуі бітсе, сұраныс келесі кілтпен қайталанады.
 * Кілттер `.env` файлында былай жазылады:
 *
 *   GEMINI_API_KEY=...
 *   GEMINI_API_KEY_2=...
 *   GEMINI_API_KEY_3=...   (нөмірі шектелмеген)
 *
 * Шектеуге тірелген кілт уақытша шетке қойылады: минуттық шектеу — қысқа
 * мерзімге, тәуліктік — ұзаққа. Барлық кілт бітсе, соңғы қате қайтарылады.
 */
import { GoogleGenAI } from "@google/genai";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Тәуліктік шектеуге тірелген кілт осынша уақыт қолданылмайды */
const DAILY_COOLDOWN_MS = 60 * 60 * 1000;
/** Минуттық шектеу — қысқа үзіліс */
const SHORT_COOLDOWN_MS = 60 * 1000;

/** Кілт → қашанға дейін бос емес (мс) */
const blockedUntil = new Map<string, number>();
/** Жүктемені тең бөлу үшін кезектің жылжымалы басы */
let cursor = 0;

function readEnvFileKeys(fileName: string) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return [];
  }

  const result: string[] = [];

  try {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:GEMINI_API_KEY|GOOGLE_API_KEY)(?:_\d+)?\s*=(.*)$/);
      if (match) {
        const value = match[1].trim().replace(/^["']|["']$/g, "");
        if (value) {
          result.push(value);
        }
      }
    }
  } catch {
    return result;
  }

  return result;
}

/** Барлық қолжетімді кілт: алдымен орта айнымалылары, сосын .env файлдары */
export function readGeminiApiKeys(): string[] {
  const keys: string[] = [];

  const names = Object.keys(process.env)
    .filter((name) => /^(GEMINI_API_KEY|GOOGLE_API_KEY)(_\d+)?$/.test(name))
    .sort((first, second) => {
      const order = (name: string) => Number(name.match(/_(\d+)$/)?.[1] || 1);
      return order(first) - order(second);
    });

  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      keys.push(value);
    }
  }

  for (const value of [...readEnvFileKeys(".env.local"), ...readEnvFileKeys(".env")]) {
    if (!keys.includes(value)) {
      keys.push(value);
    }
  }

  return keys;
}

/** Кем дегенде бір кілт бапталған ба */
export function hasGeminiApiKey() {
  return readGeminiApiKeys().length > 0;
}

/** Шектеуге (квотаға) тірелген қате ме — сонда келесі кілтке көшеміз */
export function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof maybeError.status === "number" ? maybeError.status : Number(maybeError.code);
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";

  return (
    status === 429 ||
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("exceeded your current")
  );
}

/**
 * Кілттің өзі жарамсыз ба (қате жазылған, өшірілген, рұқсаты жоқ).
 * Мұндай кілт те шетке қойылып, сұраныс келесісімен қайталанады.
 */
export function isKeyRejectedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof maybeError.status === "number" ? maybeError.status : Number(maybeError.code);
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";

  const rejected =
    message.includes("api key not valid") ||
    message.includes("api_key_invalid") ||
    message.includes("invalid api key") ||
    message.includes("permission denied") ||
    message.includes("permission_denied") ||
    message.includes("api key expired");

  return rejected || status === 401 || status === 403;
}

/** Тәуліктік шектеу ме (әйтпесе — минуттық) */
function isDailyQuota(error: unknown) {
  const message =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? ((error as { message: string }).message.toLowerCase())
      : "";
  return message.includes("perday") || message.includes("per day") || message.includes("daily");
}

/** Кілттерді қолжетімділігі бойынша реттейді: бос кілттер алда */
function orderKeys(keys: string[]) {
  const now = Date.now();
  const rotated = keys.map((_, index) => keys[(cursor + index) % keys.length]);
  const free = rotated.filter((key) => (blockedUntil.get(key) || 0) <= now);
  const busy = rotated
    .filter((key) => (blockedUntil.get(key) || 0) > now)
    .sort((first, second) => (blockedUntil.get(first) || 0) - (blockedUntil.get(second) || 0));
  return [...free, ...busy];
}

/**
 * Тапсырманы кілттерді кезектеп сынап орындайды.
 * Шектеуден басқа қате шықса — бірден қайта лақтырылады.
 */
export async function runWithGeminiKey<T>(task: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const keys = readGeminiApiKeys();

  if (!keys.length) {
    throw new Error("GEMINI_API_KEY бапталмаған.");
  }

  let lastError: unknown = null;

  for (const key of orderKeys(keys)) {
    try {
      const result = await task(new GoogleGenAI({ apiKey: key }));
      // Сәтті кілттен кейін кезек келесіге жылжиды — жүктеме тең бөлінеді
      cursor = (keys.indexOf(key) + 1) % keys.length;
      blockedUntil.delete(key);
      return result;
    } catch (error) {
      const quota = isQuotaError(error);

      // Шектеу де, жарамсыз кілт те — келесі кілтпен қайталанады.
      // Басқа қате (мәтін жарамсыз, желі үзілді) бірден қайтарылады.
      if (!quota && !isKeyRejectedError(error)) {
        throw error;
      }

      lastError = error;
      blockedUntil.set(
        key,
        Date.now() + (!quota || isDailyQuota(error) ? DAILY_COOLDOWN_MS : SHORT_COOLDOWN_MS)
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Барлық Gemini кілтінің шектеуі бітті. Сәлден соң қайталап көріңіз.");
}

/** Диагностика үшін: қанша кілт бар, қаншасы қазір бос */
export function getGeminiKeyStats() {
  const keys = readGeminiApiKeys();
  const now = Date.now();
  return {
    total: keys.length,
    available: keys.filter((key) => (blockedUntil.get(key) || 0) <= now).length
  };
}

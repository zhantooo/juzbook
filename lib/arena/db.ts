import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/arena-client";

/**
 * Arena дерекқорының жалғыз клиенті.
 *
 * Екі режимде жұмыс істейді:
 *
 * - **жергілікті**: `ARENA_DATABASE_URL` → `prisma/arena.db` файлы;
 * - **орналастырылған**: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` → Turso.
 *   Turso — сол SQLite, бірақ желі арқылы. Vercel-дің файл жүйесі уақытша
 *   болғандықтан, файлдық дерекқор онда сақталмайды.
 *
 * Схема екеуінде де бірдей: SQLite диалектінен шықпаймыз.
 *
 * Оқу бөлігінің клиенті (`lib/prisma.ts`) бөлек PostgreSQL-ге қосылады.
 * Екеуі бір-біріне тәуелсіз: Arena-дағы қате оқу бөлігіне тимеуі керек.
 */
const globalForArena = globalThis as unknown as { arenaPrisma?: PrismaClient };

function createClient() {
  const url = process.env.TURSO_DATABASE_URL?.trim();

  if (url) {
    // Turso: адаптер арқылы. Токен жергілікті файлда керек емес.
    const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
    return new PrismaClient({ adapter, log: ["error"] });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

export const arenaPrisma = globalForArena.arenaPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForArena.arenaPrisma = arenaPrisma;
}

/** Қай дерекқорға қосылып тұрғанын білдіреді (диагностикаға) */
export const arenaStorage = process.env.TURSO_DATABASE_URL?.trim() ? "turso" : "sqlite-file";

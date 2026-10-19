import { PrismaClient } from "@/generated/arena-client";

/**
 * Arena дерекқорының жалғыз клиенті.
 *
 * Оқу бөлігінің клиенті (`lib/prisma.ts`) PostgreSQL-ге қосылады, ал бұл —
 * бөлек SQLite файлына. Екеуі бір-біріне тәуелсіз: Arena-дағы қате оқу
 * бөлігіне тимеуі керек.
 *
 * Dev режимінде ыстық қайта жүктеу сайын жаңа қосылым ашылып кетпес үшін
 * клиент global айнымалыда сақталады.
 */
const globalForArena = globalThis as unknown as { arenaPrisma?: PrismaClient };

export const arenaPrisma =
  globalForArena.arenaPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForArena.arenaPrisma = arenaPrisma;
}

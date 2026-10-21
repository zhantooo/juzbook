import { Prisma, PrismaClient } from "@/generated/prisma-client";

/**
 * `Prisma` кеңістігі де осы жерден шығарылады.
 *
 * Себебі: `$queryRaw` ішіндегі `Prisma.sql` үзінділері клиент қай модуль
 * данасынан құрылғанын тексереді. Маршрут оны бөлек жолмен импорттаса,
 * Next бөлек көшірме жинайды да, үзінді SQL емес, қарапайым мән болып
 * саналып, параметр ретінде JSON-ға айналады. Қате сол кезде мүлде
 * басқаша көрінеді: «оператор не существует: jsonb ~~ text».
 */
export { Prisma };

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaRevision?: string;
};

const PRISMA_CLIENT_REVISION = "2026-10-19-database-url-fallback";

/**
 * Дерекқор мекенжайын табады.
 *
 * Схемада `env("DATABASE_URL")` жазылған, бірақ орналастыру қызметтері
 * оны басқа атпен қоюы мүмкін: Vercel-дің Prisma Postgres интеграциясы
 * `POSTGRES_URL` деп қояды да, қосымша `DATABASE_URL` жоқ болып шығады.
 * Сондықтан клиентті құрғанда мекенжайды өзіміз беріп жіберген дұрыс.
 *
 * `prisma+postgres://` түріндегі мекенжай әдейі алынбайды: ол Accelerate
 * кеңейтімін талап етеді, ал бізде кәдімгі TCP қосылымы.
 */
function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && /^postgres(ql)?:\/\//i.test(value)) {
      return value;
    }
  }

  return undefined;
}

function createPrismaClient() {
  const url = resolveDatabaseUrl();

  return new PrismaClient({
    log: ["error"],
    // Мекенжай табылмаса, Prisma схемадағы `DATABASE_URL`-ге жүгінеді де,
    // әдеттегі қатесін береді — оны жасырудың қажеті жоқ.
    ...(url ? { datasources: { db: { url } } } : {})
  });
}

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaRevision === PRISMA_CLIENT_REVISION
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRevision = PRISMA_CLIENT_REVISION;
}

import { createClient, type Client } from "@libsql/client";

/**
 * Мағына бойынша іздеудің векторлық қоймасы.
 *
 * Неге Turso: векторды дерекқордың өзі іздеуі керек. Serverless функция
 * әр суық іске қосылуда 36 МБ индексті жадқа жүктей алмайды, ал Postgres-те
 * `pgvector` кеңейтімі жоқ. Turso-да вектор іздеу нативті: `F32_BLOB` бағаны
 * мен DiskANN индексі.
 *
 * Неге Арена базасымен бір орында: Turso данасы Arena-ға тиесілі емес, ол
 * жобаның «желі арқылы жүретін SQLite» қоймасы. Кестелер бөлек әрі `Search`
 * префиксімен аталады, ал оларды тек `scripts/search_index_schema.mjs`
 * құрады — ол ештеңе өшірмейді. Arena схемасы Turso-ға `prisma db push`
 * арқылы ешқашан жазылмайды (Prisma libSQL-ге қосыла алмайды), сондықтан
 * бұл кестелер қауіпсіз.
 */

/** Эмбеддингтің өлшемі. Gemini `outputDimensionality` арқылы қысқартады. */
export const EMBEDDING_DIMENSIONS = 768;

/** Векторлық индекстің аты — сұрауда сол арқылы шақырылады */
export const VECTOR_INDEX = "SearchChunk_vector_idx";

const globalForSearch = globalThis as unknown as { searchDb?: Client | null };

function createSearchClient(): Client | null {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    return null;
  }

  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
}

/**
 * Қойма қолжетімді ме. Жергілікті әзірлеуде Turso кілттері қойылмаса,
 * мағыналық іздеу жай ғана өшірулі тұрады да, кілт сөзбен іздеу жұмыс істей
 * береді — бет құламауы керек.
 */
export function hasVectorSearch(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim());
}

export function getSearchDb(): Client | null {
  if (globalForSearch.searchDb === undefined) {
    globalForSearch.searchDb = createSearchClient();
  }
  return globalForSearch.searchDb;
}

/**
 * Векторды Turso-ға берілетін түрге келтіреді.
 *
 * Шикі екілік буферді беруге де болар еді, бірақ libSQL-дің құжатталған жолы —
 * `vector32('[1,2,3]')`. Сондықтан вектор мәтін болып беріледі де, SQL жағында
 * `vector32()` арқылы түрлендіріледі: байт реті мен түрі үшін жауапкершілік
 * дерекқорда қалады.
 */
export function toVectorText(values: number[]): string {
  return `[${values.join(",")}]`;
}

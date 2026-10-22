/**
 * Іздеуді жылдамдататын үшграммалық (trigram) индекстерді құрады.
 *
 * Мәселе: `LIKE '%сөз%'` жай индексті пайдалана алмайды — іздеу сөзі
 * басынан емес, ортасынан келеді. Сондықтан Postgres бүкіл кестені оқуға
 * мәжбүр: он мегабайттан астам мәтін, желі арқылы екі-үш секунд.
 *
 * `pg_trgm` кеңейтімі мұны шешеді: мәтін үш әріптік бөліктерге бөлініп
 * индекстеледі де, `LIKE '%сөз%'` сол индекспен жүреді.
 *
 * Индекс дәл сол өрнекке қойылады — іздеу қай түрде жүрсе, индекс те сол
 * түрде болуы керек, әйтпесе жоспарлаушы оны пайдаланбайды.
 *
 * Қайта қосуға болады: бар индекске тимейді.
 *
 *   node --env-file=.env scripts/search_text_index.mjs
 *   node scripts/search_text_index.mjs --prod   (.env.production.local ішінен)
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/prisma-client/index.js";

const ROOT = "C:/Users/user/Documents/JUZBOOKS";
const useProd = process.argv.includes("--prod");

function readUrl() {
  const files = useProd ? [".env.production.local"] : [".env.local", ".env"];
  for (const file of files) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const match = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(fs.readFileSync(full, "utf8"));
    if (match && /^postgres(ql)?:\/\//i.test(match[1].trim())) {
      return match[1].trim();
    }
  }
  throw new Error(useProd ? ".env.production.local ішінде DATABASE_URL жоқ" : "DATABASE_URL табылмады");
}

const FOLD_FROM = "әөүұқғіңһ";
const FOLD_TO = "аоуукгинх";
const folded = (column) => `translate(lower("${column}"), '${FOLD_FROM}', '${FOLD_TO}')`;

const prisma = new PrismaClient({ datasources: { db: { url: readUrl() } } });

console.log(useProd ? "дерекқор: орналастырылған" : "дерекқор: жергілікті");

await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm");
console.log("pg_trgm дайын");

const indexes = [
  ["Chapter_title_trgm_idx", "Chapter", folded("title")],
  ["Chapter_excerpt_trgm_idx", "Chapter", folded("excerpt")],
  ["Chapter_content_trgm_idx", "Chapter", folded("content")]
];

for (const [name, table, expression] of indexes) {
  const startedAt = Date.now();
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "${name}" ON "${table}" USING gin (${expression} gin_trgm_ops)`
  );
  console.log(`${name}: дайын (${Math.round((Date.now() - startedAt) / 1000)} с)`);
}

const rows = await prisma.$queryRawUnsafe(
  `SELECT indexname FROM pg_indexes WHERE tablename = 'Chapter' AND indexname LIKE '%trgm%' ORDER BY indexname`
);
console.log("кестедегі индекстер:", rows.map((row) => row.indexname).join(", "));

await prisma.$disconnect();

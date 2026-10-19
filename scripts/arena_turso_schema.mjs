/**
 * Arena схемасын Turso-ға жазады.
 *
 * `prisma db push` libSQL-ге тікелей қосыла алмайды: оның SQLite коннекторы
 * тек `file:` жолын біледі. Сондықтан Prisma-ның өзіне SQL-ді генерациялатып
 * (migrate diff), оны Turso-ға libSQL клиенті арқылы орындаймыз.
 *
 * Қайта қосуға болады: бар кестелерге тимейді.
 *
 * node --env-file=.env scripts/arena_turso_schema.mjs
 */
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url) {
  console.error("TURSO_DATABASE_URL берілмеген");
  process.exit(1);
}

console.log("схема SQL-і генерацияланып жатыр…");

// Windows-та execFileSync + npx шығысты қайтармайды, сондықтан қабық арқылы
const sql = execSync(
  "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/arena.prisma --script",
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
);

// Prisma әр мәлімдемені `-- CreateTable` деген түсініктемеден бастайды.
// Алдымен түсініктеме жолдарын алып тастаймыз, сосын `;` бойынша бөлеміз.
const withoutComments = sql
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = withoutComments
  .split(";")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0)
  // Қайта қосқанда бар объектілерге тимеу үшін
  .map((statement) =>
    statement
      .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
      .replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
      .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ")
  );

console.log(`мәлімдеме саны: ${statements.length}`);

const client = createClient({ url, authToken });
let applied = 0;

for (const statement of statements) {
  try {
    await client.execute(statement);
    applied += 1;
  } catch (error) {
    const message = String(error?.message ?? error);
    // Бар объект туралы хабар — қалыпты жағдай
    if (/already exists/i.test(message)) {
      continue;
    }
    console.error(`\nмәлімдеме орындалмады:\n${statement.slice(0, 160)}\n${message.slice(0, 200)}`);
    client.close();
    process.exit(1);
  }
}

const tables = await client.execute(
  "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"
);

console.log(`\nорындалды: ${applied}`);
console.log(`Turso кестелері (${tables.rows.length}): ${tables.rows.map((row) => row.name).join(", ")}`);
client.close();

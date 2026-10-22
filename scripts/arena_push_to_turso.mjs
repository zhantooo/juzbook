/**
 * Жергілікті Arena базасын Turso-ға көшіреді.
 *
 * Vercel-дің файл жүйесі уақытша, сондықтан орналастырылған нұсқа SQLite
 * файлын емес, Turso-ны (сол SQLite, бірақ желі арқылы) қолданады. Бұл
 * скрипт схеманы да, деректі де сол жаққа апарады.
 *
 * Алдымен схема: `npx prisma db push --schema=prisma/arena.prisma`
 * TURSO_DATABASE_URL қойылған күйде орындалады.
 *
 * node --env-file=.env scripts/arena_push_to_turso.mjs [--questions=20000]
 *
 * Әдепкіде бүкіл банк көшіріледі.
 */
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/arena-client/index.js";

const url = process.env.TURSO_DATABASE_URL?.trim();
if (!url) {
  console.error("TURSO_DATABASE_URL берілмеген — .env файлына қосыңыз");
  process.exit(1);
}

const args = process.argv.slice(2);
/** Сынақ үшін ғана: берілмесе, бүкіл банк көшіріледі */
const limit = Number((args.find((value) => value.startsWith("--questions=")) || "").split("=")[1] || "0");

// Жергілікті файл
const local = new PrismaClient({ datasources: { arena: { url: process.env.ARENA_DATABASE_URL } } });
// Turso
const remote = new PrismaClient({
  adapter: new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() })
});

const subjects = await local.arenaSubject.findMany();
for (const subject of subjects) {
  await remote.arenaSubject.upsert({
    where: { id: subject.id },
    create: subject,
    update: { name: subject.name, description: subject.description }
  });
}
console.log(`пән көшірілді: ${subjects.length}`);

// SQLite `createMany` ішінде `skipDuplicates`-ты қолдамайды, сондықтан
// бұрын көшірілгенін өзіміз есте сақтап, қайталанбасын өзіміз сүземіз.
const already = new Set(
  (await remote.arenaQuestionBank.findMany({ select: { sourceId: true } })).map((row) => row.sourceId)
);
console.log(`Turso-да бұрыннан: ${already.size} сұрақ`);

/**
 * Бүкіл банк көшіріледі.
 *
 * Бұрын пәнге мың сұрақтан ғана алынатын: матчқа оны сұрақ керек, сондықтан
 * мыңы да жетеді деп есептелген. Бірақ бір оқушы көп ойнағанда сұрақтар
 * қайталана бастайды, әрі пән бойынша толық банк болғаны дұрыс. 97 мың сұрақ
 * Turso-да 50 МБ-тан аспайды, ал тегін шек — 9 ГБ.
 *
 * `--questions=<сан>` берілсе, сол шамамен шектеледі (сынақ үшін).
 */
let copied = 0;
let cursorId = undefined;
const hardLimit = limit || Number.POSITIVE_INFINITY;
const startedAt = Date.now();

for (;;) {
  if (copied >= hardLimit) {
    break;
  }

  const page = await local.arenaQuestionBank.findMany({
    take: 500,
    ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
    orderBy: { id: "asc" }
  });

  if (!page.length) {
    break;
  }
  cursorId = page.at(-1).id;

  const fresh = page.filter((row) => !already.has(row.sourceId)).slice(0, hardLimit - copied);
  for (let index = 0; index < fresh.length; index += 100) {
    const chunk = fresh.slice(index, index + 100);
    await remote.arenaQuestionBank.createMany({ data: chunk });
    for (const row of chunk) {
      already.add(row.sourceId);
    }
    copied += chunk.length;
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  process.stdout.write("\rкөшірілді: " + copied + " | " + seconds + " с");
}

const total = await remote.arenaQuestionBank.count();
console.log(`\n\nTurso-дағы сұрақ: ${total}`);

await local.$disconnect();
await remote.$disconnect();

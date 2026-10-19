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
 */
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/arena-client/index.js";

const url = process.env.TURSO_DATABASE_URL?.trim();
if (!url) {
  console.error("TURSO_DATABASE_URL берілмеген — .env файлына қосыңыз");
  process.exit(1);
}

const args = process.argv.slice(2);
/** Тегін жоспардың шегіне сыю үшін сұрақ санын шектеуге болады */
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

const already = await remote.arenaQuestionBank.count();
console.log(`Turso-да бұрыннан: ${already} сұрақ`);

/**
 * Пән мен деңгей бойынша теңдей аламыз: матчқа 6 орташа, 2 жеңіл, 2 күрделі
 * керек, сондықтан бәрін көшірудің қажеті жоқ — әр пәнге жеткілікті мөлшер
 * алсақ, тегін жоспар да сыяды.
 */
const PER_SUBJECT = limit ? Math.floor(limit / Math.max(1, subjects.length)) : 3000;
const MIX = { medium: 0.6, easy: 0.2, hard: 0.2 };

let copied = 0;
for (const subject of subjects) {
  for (const [difficulty, share] of Object.entries(MIX)) {
    const take = Math.round(PER_SUBJECT * share);
    const rows = await local.arenaQuestionBank.findMany({
      where: { subjectId: subject.id, difficulty },
      take,
      orderBy: { id: "asc" }
    });
    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100);
      await remote.arenaQuestionBank.createMany({ data: chunk, skipDuplicates: true });
      copied += chunk.length;
      process.stdout.write(`\rкөшірілді: ${copied}`);
    }
  }
}

const total = await remote.arenaQuestionBank.count();
console.log(`\n\nTurso-дағы сұрақ: ${total}`);

await local.$disconnect();
await remote.$disconnect();

/**
 * Оқу бөлігінің сұрақ банкінен Arena-ның SQLite базасына сұрақ көшіреді.
 *
 * Матч кезінде PostgreSQL-ге сұраныс жіберілмеуі керек: ойын жылдам
 * басталуы тиіс әрі екі дерекқор бір-біріне тәуелді болмауы керек.
 * Сондықтан сұрақтар алдын ала көшіріліп қойылады.
 *
 * Қайта қосуға болады: `sourceId` бойынша бұрын көшірілгені екінші рет
 * жазылмайды.
 *
 * node --env-file=.env scripts/arena_seed_questions.mjs [--limit=500] [--subject=<id>]
 */
import { PrismaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/prisma-client/index.js";
import { PrismaClient as ArenaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/arena-client/index.js";

const reader = new PrismaClient();
const arena = new ArenaClient();

const args = process.argv.slice(2);
const limit = Number((args.find((value) => value.startsWith("--limit=")) || "").split("=")[1] || "0");
const onlySubject = (args.find((value) => value.startsWith("--subject=")) || "").split("=")[1] || null;

/** Бір жолы осынша жазба оқылады — жады толып кетпеуі үшін */
const PAGE = 2000;

const existing = new Set(
  (await arena.arenaQuestionBank.findMany({ select: { sourceId: true } })).map((row) => row.sourceId)
);
console.log(`Arena базасында бұрыннан: ${existing.size} сұрақ`);

let cursor = null;
let copied = 0;
let skipped = 0;
const perSubject = new Map();

while (true) {
  const batch = await reader.topicQuestion.findMany({
    where: {
      chapter: {
        isHidden: false,
        book: { isHidden: false, ...(onlySubject ? { subjectId: onlySubject } : {}) }
      }
    },
    select: {
      id: true,
      prompt: true,
      options: true,
      answerIndex: true,
      explanation: true,
      difficulty: true,
      chapterId: true,
      chapter: { select: { book: { select: { subjectId: true } } } }
    },
    orderBy: { id: "asc" },
    take: PAGE,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
  });

  if (!batch.length) {
    break;
  }
  cursor = batch[batch.length - 1].id;

  const rows = [];
  for (const question of batch) {
    if (existing.has(question.id)) {
      skipped += 1;
      continue;
    }
    // Нұсқалары бүтін емес сұрақ ойынға жарамайды
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      continue;
    }
    if (question.answerIndex < 0 || question.answerIndex > 3) {
      continue;
    }

    const subjectId = question.chapter.book.subjectId;
    rows.push({
      sourceId: question.id,
      subjectId,
      chapterId: question.chapterId,
      prompt: question.prompt,
      optionsJson: JSON.stringify(question.options),
      answerIndex: question.answerIndex,
      explanation: question.explanation ?? "",
      difficulty: question.difficulty
    });
    perSubject.set(subjectId, (perSubject.get(subjectId) ?? 0) + 1);
  }

  if (rows.length) {
    // SQLite бір сұранысқа енгізілетін айнымалы санын шектейді
    for (let index = 0; index < rows.length; index += 200) {
      await arena.arenaQuestionBank.createMany({ data: rows.slice(index, index + 200) });
    }
    copied += rows.length;
  }

  process.stdout.write(`\rкөшірілді: ${copied}`);
  if (limit && copied >= limit) {
    break;
  }
}

console.log(`\n\nкөшірілді: ${copied} | бұрыннан бар: ${skipped}`);
console.log("\nпән бойынша:");
for (const [subject, count] of [...perSubject].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(6)}  ${subject}`);
}

const total = await arena.arenaQuestionBank.count();
console.log(`\nArena банкінде барлығы: ${total} сұрақ`);

await reader.$disconnect();
await arena.$disconnect();

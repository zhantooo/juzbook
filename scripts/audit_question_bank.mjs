/**
 * Сұрақ банкінің сапасын тексереді және есеп береді.
 *
 * Банк ИИ арқылы құрылады, сондықтан оны «жасалды» деп қабылдауға
 * болмайды: модель кейде нұсқаларды қайталайды, дұрыс жауапты бір әріпке
 * үйіреді немесе түсіндірмені бос қалдырады. Құрастырғыштың өз сүзгісі
 * бар, бірақ тәуелсіз тексеру бөлек тұруы тиіс — сүзгінің өзі қателессе,
 * оны сол сүзгімен ұстау мүмкін емес.
 *
 * Тексерілетіні:
 *   1. әр тақырыпта 50 сұрақ: 30 орташа, 10 жеңіл, 10 күрделі;
 *   2. әр сұрақта төрт түрлі нұсқа және бос емес түсіндірме;
 *   3. дұрыс жауап A–D арасында 20–30 % аралығында таралған;
 *   4. бір тақырып ішінде қайталанатын сұрақ жоқ — мәтіні бойынша да,
 *      ұзын сөздердің қабаттасуы бойынша да (≥ 0,8).
 *
 * Қайталануды тексеру құрастырғыштағы ережемен бірдей: екеуі бір-біріне
 * сәйкес болмаса, есеп жаңылыс болар еді.
 *
 * node --env-file=.env scripts/audit_question_bank.mjs [--subject=<id>] [--book=<id>] [--examples=5]
 */
import { PrismaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/prisma-client/index.js";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const value = (name) => (args.find((item) => item.startsWith(`--${name}=`)) || "").split("=")[1] || "";
const subjectId = value("subject");
const bookId = value("book");
const examples = Number(value("examples") || 5);

const TARGET = { medium: 30, easy: 10, hard: 10 };
const TOTAL_PER_TOPIC = 50;

/** Салыстыруға арналған қалып — құрастырғыштағымен бірдей */
function normalise(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Екі сұрақтың мағынасы жақын ба — құрастырғыштағымен бірдей */
function tooSimilar(left, right) {
  const words = (text) => new Set(normalise(text).split(" ").filter((word) => word.length > 3));
  const first = words(left);
  const second = words(right);
  if (!first.size || !second.size) {
    return false;
  }
  let shared = 0;
  for (const word of first) {
    if (second.has(word)) {
      shared += 1;
    }
  }
  return shared / Math.min(first.size, second.size) >= 0.8;
}

const chapters = await prisma.chapter.findMany({
  where: {
    isHidden: false,
    book: {
      isHidden: false,
      ...(bookId ? { id: bookId } : {}),
      subject: { isHidden: false, ...(subjectId ? { id: subjectId } : {}) }
    }
  },
  select: { id: true, title: true, book: { select: { title: true, subject: { select: { name: true } } } } },
  orderBy: { id: "asc" }
});

console.log(`тақырып: ${chapters.length}\n`);

const position = [0, 0, 0, 0];
let questions = 0;
let full = 0;
let empty = 0;

const levelOff = [];
const badOptions = [];
const noExplanation = [];
const duplicates = [];
const short = [];
const bySubject = new Map();

for (const chapter of chapters) {
  const rows = await prisma.topicQuestion.findMany({
    where: { chapterId: chapter.id },
    select: { id: true, prompt: true, options: true, answerIndex: true, explanation: true, difficulty: true }
  });

  questions += rows.length;

  const name = chapter.book.subject.name;
  const stat = bySubject.get(name) ?? { topics: 0, questions: 0, full: 0 };
  stat.topics += 1;
  stat.questions += rows.length;

  if (!rows.length) {
    empty += 1;
    bySubject.set(name, stat);
    continue;
  }

  // 1) сан және деңгей бөлінісі
  const levels = { medium: 0, easy: 0, hard: 0 };
  for (const row of rows) {
    if (row.difficulty in levels) {
      levels[row.difficulty] += 1;
    }
  }

  const exact =
    rows.length === TOTAL_PER_TOPIC &&
    levels.medium === TARGET.medium &&
    levels.easy === TARGET.easy &&
    levels.hard === TARGET.hard;

  if (exact) {
    full += 1;
    stat.full += 1;
  } else if (rows.length < TOTAL_PER_TOPIC) {
    short.push({ chapter, count: rows.length, levels });
  } else {
    levelOff.push({ chapter, count: rows.length, levels });
  }

  // 2) нұсқалар мен түсіндірме
  for (const row of rows) {
    const options = row.options ?? [];
    const distinct = new Set(options.map(normalise));
    if (options.length !== 4 || distinct.size !== 4) {
      badOptions.push({ chapter, prompt: row.prompt, options });
    }
    if (!(row.explanation || "").trim()) {
      noExplanation.push({ chapter, prompt: row.prompt });
    }
    if (row.answerIndex >= 0 && row.answerIndex < 4) {
      position[row.answerIndex] += 1;
    }
  }

  // 4) тақырып ішіндегі қайталанулар
  const seen = [];
  for (const row of rows) {
    const key = normalise(row.prompt);
    const clash = seen.find((known) => normalise(known) === key || tooSimilar(known, row.prompt));
    if (clash) {
      duplicates.push({ chapter, prompt: row.prompt, clash });
    } else {
      seen.push(row.prompt);
    }
  }

  bySubject.set(name, stat);
}

const share = (n) => (questions ? (100 * n) / questions : 0);

console.log("1. САН ЖӘНЕ ДЕҢГЕЙ");
console.log(`   сұрақ жиыны          : ${questions}`);
console.log(`   дәл 50 (30/10/10)    : ${full} / ${chapters.length} тақырып`);
console.log(`   елуден кем           : ${short.length}`);
console.log(`   елуден көп/бөлінісі ө: ${levelOff.length}`);
console.log(`   мүлде сұрағы жоқ     : ${empty}`);

console.log("\n2. НҰСҚА ЖӘНЕ ТҮСІНДІРМЕ");
console.log(`   төрт түрлі нұсқасы жоқ: ${badOptions.length}`);
console.log(`   түсіндірмесі бос      : ${noExplanation.length}`);

console.log("\n3. ДҰРЫС ЖАУАПТЫҢ ОРНЫ (20–30 % болуы керек)");
["A", "B", "C", "D"].forEach((letter, index) => {
  const percent = share(position[index]);
  const mark = percent >= 20 && percent <= 30 ? "жарайды" : "ШЕКТЕН ТЫС";
  console.log(`   ${letter}: ${position[index]} (${percent.toFixed(1)} %) ${mark}`);
});

console.log("\n4. ҚАЙТАЛАНУ");
console.log(`   тақырып ішіндегі қайталанған сұрақ: ${duplicates.length}`);

if (examples > 0) {
  const show = (title, list, render) => {
    if (!list.length) {
      return;
    }
    console.log(`\n   ${title} (алғашқы ${Math.min(examples, list.length)}):`);
    for (const item of list.slice(0, examples)) {
      console.log(`     ${render(item)}`);
    }
  };

  show("елуден кем тақырыптар", short, (item) =>
    `${item.count} сұрақ (${item.levels.easy}/${item.levels.medium}/${item.levels.hard}) — ${item.chapter.book.title} / ${item.chapter.title}`
  );
  show("нұсқа ақауы", badOptions, (item) => `${item.chapter.title}: ${item.prompt.slice(0, 70)}`);
  show("түсіндірмесі бос", noExplanation, (item) => `${item.chapter.title}: ${item.prompt.slice(0, 70)}`);
  show("қайталанған сұрақ", duplicates, (item) => `${item.chapter.title}: ${item.prompt.slice(0, 70)}`);
}

console.log("\nПӘН БОЙЫНША");
for (const [name, stat] of [...bySubject].sort((left, right) => right[1].questions - left[1].questions)) {
  console.log(
    `   ${name.padEnd(24)} ${String(stat.questions).padStart(7)} сұрақ | толық ${stat.full}/${stat.topics} тақырып`
  );
}

await prisma.$disconnect();

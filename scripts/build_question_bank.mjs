/**
 * Әр тақырыпқа дайын тест сұрақтарының банкін құрады.
 *
 * Оқушы тест бастағанда ИИ-ді әр жолы мазаламау үшін сұрақтар алдын ала
 * дайындалады: әр тақырыпқа 50 сұрақ — 30 орташа (B), 10 жеңіл (A) және
 * 10 күрделі (C). Банк таусылғанда ғана оқушы өзі жаңа сұрақ құрай алады.
 *
 * Екі талап қатаң сақталады:
 *   1. Сұрақтар қайталанбайды — мәтіні бойынша да, мағынасы бойынша да
 *      (сөздердің қабаттасуы тексеріледі).
 *   2. Дұрыс жауап бір әріпке үйіріліп қалмайды — нұсқалар әр сұрақта
 *      араластырылып, дұрыс жауап A/B/C/D арасында тең таралады.
 *
 * node --env-file=.env scripts/build_question_bank.mjs [--limit=50] [--jobs=8] [--book=<id>] [--subject=<id>] [--dry-run]
 *
 * Жұмыс үзілсе, қайта қосуға болады: толық банкі бар тақырыптар аттап кетіледі.
 */
import { PrismaClient } from "file:///C:/Users/user/Documents/JUZBOOKS/generated/prisma-client/index.js";

import { createKeyPool, readApiKeys } from "./gemini_keys.mjs";

const prisma = new PrismaClient();

/** Деңгейлер: A — жеңіл, B — орташа, C — күрделі */
const TARGET = [
  { difficulty: "medium", label: "B", count: 30 },
  { difficulty: "easy", label: "A", count: 10 },
  { difficulty: "hard", label: "C", count: 10 }
];

const MODELS = (process.env.QUESTION_MODEL || "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const MIN_TEXT = 400;
const MAX_TEXT = 24000;

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_answer: { type: "string" },
          explanation: { type: "string" }
        },
        required: ["question", "options", "correct_answer", "explanation"]
      }
    }
  },
  required: ["questions"]
};

const LEVEL_PROMPT = {
  easy: "Деңгей A (жеңіл): анықтама, атау, тура факт — мәтінде тікелей жазылған нәрсені сұра.",
  medium:
    "Деңгей B (орташа): ұғымды түсінуді, себеп-салдарды, жіктеуді және негізгі ойды ажыратуды сұра.",
  hard:
    "Деңгей C (күрделі): салыстыру, талдау, қорытынды жасау және мәтіндегі бірнеше дерекді байланыстыруды сұра."
};

const SYSTEM = [
  "Сен — ҰБТ-ға дайындық тест сұрақтарын құрастырушысың.",
  "Тек берілген мәтін аясында жұмыс істе, өз ойыңнан факт қоспа.",
  "Әр сұрақта дәл 4 жауап нұсқасы болсын, correct_answer нұсқалардың бірімен сөзбе-сөз бірдей болсын.",
  "Дұрыс емес нұсқалар да сенімді көрінсін, бірақ мәтін бойынша анық қате болсын.",
  "Сұрақтар бір-бірін қайталамасын: әрқайсысы мәтіннің басқа бөлігін тексерсін.",
  "explanation ішінде дұрыс жауаптың мәтіндегі қысқа дәлелін жаз.",
  "Барлық сұрақ, нұсқа және түсіндірме қазақ тілінде болсын."
].join(" ");

function stripHtml(value) {
  return value
    .replace(/\[\/?[a-z-]+[^\]]*\]/gi, " ")
    .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Салыстыруға арналған қалып: тыныс белгісі мен регистр еленбейді */
function normalise(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Екі сұрақтың мағынасы жақын ба: ұзын сөздердің қабаттасуы */
function tooSimilar(left, right) {
  const words = (value) => new Set(normalise(value).split(" ").filter((word) => word.length > 3));
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

function shuffle(items) {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [list[index], list[other]] = [list[other], list[index]];
  }
  return list;
}

async function ask({ pools, exhausted, keys, model, prompt }) {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: SYSTEM }] },
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: SCHEMA
    }
  };

  const pool = pools.get(model);
  // Тегін шектеу минутына есептелетіндіктен, күту қадамдап ұзарады:
  // қысқа күтумен қайталай берсек, сұраныс қайта шектеуге тіреледі.
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    let key = pool.next();
    if (exhausted.get(model).has(key)) {
      key = keys.find((item) => !exhausted.get(model).has(item));
      if (!key) {
        throw new Error("DAILY_LIMIT");
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    if (response.status === 401 || response.status === 403) {
      exhausted.get(model).add(key);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      const text = await response.text();
      if (/"quotaId":\s*"[^"]*PerDay/i.test(text)) {
        exhausted.get(model).add(key);
        continue;
      }
      const waitMs = Math.min(45000, 3000 * attempt);
      pool.block(key, waitMs, false);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!response.ok) {
      throw new Error(`${response.status}: ${(await response.text()).slice(0, 160)}`);
    }

    const payload = await response.json();
    const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(raw).questions || [];
  }

  throw new Error("жауап алынбады");
}

/** Модельдер тізімін кезекпен сынайды: біріншісінің лимиті бітсе, келесісі */
async function askWithFallback(context, prompt) {
  let lastError = null;
  for (const model of MODELS) {
    if (context.exhausted.get(model).size >= context.keys.length) {
      continue;
    }
    try {
      return await ask({ ...context, model, prompt });
    } catch (error) {
      lastError = error;
      if (error.message !== "DAILY_LIMIT") {
        throw error;
      }
    }
  }
  throw lastError || new Error("DAILY_LIMIT");
}

function buildPrompt({ title, text, level, count, avoid }) {
  const avoidBlock = avoid.length
    ? `\n\nМЫНА СҰРАҚТАР БҰРЫН ҚҰРЫЛҒАН — оларды қайталама және мағынасы жақынын да жазба:\n${avoid
        .slice(-30)
        .map((item, index) => `${index + 1}. ${item}`)
        .join("\n")}`
    : "";

  return `Тақырып: ${title}

${LEVEL_PROMPT[level]}

Мәтін:
${text}

Осы мәтін бойынша ${count} тест сұрағын құрастыр. Әр сұрақ мәтіннің әртүрлі бөлігін тексерсін.${avoidBlock}`;
}

/**
 * Дұрыс жауаптың орнын тең таратады.
 *
 * Модель дұрыс жауапты жиі бірінші орынға қояды. Сондықтан нұсқалар
 * араластырылып, дұрыс жауап әзірге ең аз кездескен орынға қойылады.
 */
function placeAnswer(question, counts) {
  const correct = question.correct_answer;
  const others = shuffle(question.options.filter((option) => option !== correct));
  const target = counts.indexOf(Math.min(...counts));
  const options = [];
  let cursor = 0;
  for (let index = 0; index < 4; index += 1) {
    options.push(index === target ? correct : others[cursor++]);
  }
  counts[target] += 1;
  return { options, answerIndex: target };
}

function usable(question) {
  if (typeof question?.question !== "string" || !Array.isArray(question.options)) {
    return false;
  }
  const options = question.options.map((option) => String(option).trim()).filter(Boolean);
  const unique = new Set(options.map(normalise));
  return (
    options.length === 4 &&
    unique.size === 4 &&
    question.question.trim().length > 10 &&
    options.includes(String(question.correct_answer).trim())
  );
}

async function fillTopic(context, topic, counts) {
  const text = stripHtml(topic.content).slice(0, MAX_TEXT);
  if (text.length < MIN_TEXT) {
    return { skipped: "мәтін қысқа" };
  }

  const existing = await prisma.topicQuestion.findMany({
    where: { chapterId: topic.id },
    select: { prompt: true, difficulty: true, answerIndex: true }
  });

  const prompts = existing.map((item) => item.prompt);
  for (const item of existing) {
    if (item.answerIndex >= 0 && item.answerIndex < 4) {
      counts[item.answerIndex] += 1;
    }
  }

  let added = 0;
  for (const { difficulty, count } of TARGET) {
    const have = existing.filter((item) => item.difficulty === difficulty).length;
    const missing = count - have;
    if (missing <= 0) {
      continue;
    }

    // Үлкен топтаманы екіге бөлеміз: бір жауапта 30 сұрақ сұрасақ, сапасы
    // түсіп, қайталанатыны көбейеді.
    let left = missing;
    while (left > 0) {
      const batch = Math.min(left, 10);
      const generated = await askWithFallback(
        context,
        buildPrompt({ title: topic.title, text, level: difficulty, count: batch, avoid: prompts })
      );

      const rows = [];
      for (const question of generated) {
        if (!usable(question)) {
          continue;
        }
        const prompt = question.question.trim();
        if (prompts.some((known) => normalise(known) === normalise(prompt) || tooSimilar(known, prompt))) {
          continue;
        }
        const { options, answerIndex } = placeAnswer(
          { correct_answer: String(question.correct_answer).trim(), options: question.options.map((o) => String(o).trim()) },
          counts
        );
        prompts.push(prompt);
        rows.push({
          chapterId: topic.id,
          prompt,
          options,
          answerIndex,
          explanation: String(question.explanation || "").trim(),
          difficulty,
          source: "ai"
        });
        if (rows.length >= batch) {
          break;
        }
      }

      if (!rows.length) {
        break;
      }

      if (!context.dryRun) {
        await prisma.topicQuestion.createMany({ data: rows });
      }
      added += rows.length;
      left -= rows.length;

      // Модель сұралғаннан әлдеқайда аз берсе, қайта сұраудың мәні жоқ
      if (rows.length < Math.ceil(batch / 3)) {
        break;
      }
    }
  }

  return { added };
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number((args.find((value) => value.startsWith("--limit=")) || "").split("=")[1] || "0");
  const bookId = (args.find((value) => value.startsWith("--book=")) || "").split("=")[1] || null;
  // Бір пәннің бүкіл кітабын қамту үшін: ДЖТ сияқты банкі мүлде жоқ пәнді
  // кітап-кітаппен жүгірту ыңғайсыз
  const subjectId = (args.find((value) => value.startsWith("--subject=")) || "").split("=")[1] || null;
  const dryRun = args.includes("--dry-run");
  const concurrency = Number((args.find((value) => value.startsWith("--jobs=")) || "").split("=")[1] || "5");

  const keys = readApiKeys();
  const context = {
    keys,
    pools: new Map(MODELS.map((model) => [model, createKeyPool(keys)])),
    exhausted: new Map(MODELS.map((model) => [model, new Set()])),
    dryRun
  };

  const topics = await prisma.chapter.findMany({
    where: {
      isHidden: false,
      book: {
        isHidden: false,
        ...(bookId ? { id: bookId } : {}),
        ...(subjectId ? { subjectId } : {})
      },
      ...(bookId ? { bookId } : {})
    },
    orderBy: [{ bookId: "asc" }, { order: "asc" }],
    select: {
      id: true,
      title: true,
      content: true,
      book: { select: { title: true } },
      _count: { select: { questions: true } }
    }
  });

  // 48-49 сұрағы бар тақырыпты қайта сұраудың мәні жоқ: қалған бір-екеуі
  // қайталанып шығады да, модель оны тастайды — лимит бекер жұмсалады.
  const pending = topics.filter((topic) => topic._count.questions < 48);
  console.log(`тақырып: ${topics.length} | толтыру керек: ${pending.length}${limit ? ` | бұл жүгірісте: ${limit}` : ""}`);

  const queue = limit ? pending.slice(0, limit) : pending;
  let done = 0;
  let total = 0;
  let stopped = false;
  let next = 0;

  // Бір тақырып ~6 минут алады (төрт ұзын сұраныс), сондықтан тақырыптар
  // қатар өңделеді. Кілттер кезегі жүктемені өзі таратады.
  async function worker() {
    while (!stopped) {
      const index = next++;
      if (index >= queue.length) {
        return;
      }
      const topic = queue[index];
      const counts = [0, 0, 0, 0];
      try {
        const result = await fillTopic(context, topic, counts);
        done += 1;
        total += result.added || 0;
        console.log(
          `${String(done).padStart(4)}/${queue.length}  +${String(result.added ?? 0).padStart(2)}  ${topic.book.title.slice(0, 26)} / ${topic.title.slice(0, 40)}${result.skipped ? ` (${result.skipped})` : ""}`
        );
      } catch (error) {
        if (error.message === "DAILY_LIMIT") {
          console.log("барлық кілттің тәуліктік шектеуі бітті — кейін жалғастыруға болады");
          stopped = true;
          return;
        }
        console.error(`${topic.title.slice(0, 40)}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));

  console.log(`\nдайын: ${done} тақырып | қосылған сұрақ: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

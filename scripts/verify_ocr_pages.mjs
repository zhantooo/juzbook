/**
 * Танылған мәтінді бет суретімен салыстырып тексереді.
 *
 * Бірінші өтпеде (ocr_pages.mjs) кеткен қателерді — латын әрпі араласқан сөздер,
 * қосылмаған тасымал, түсіп қалған әріп, өзгеріп кеткен сөз — түзетеді.
 * Модель бүкіл мәтінді қайта жазбайды: тек {before, after} жұптарын қайтарады,
 * сондықтан мәтін өз бетінше «жақсартылып» кетпейді.
 *
 * Қолдану: node scripts/verify_ocr_pages.mjs <config.json>
 */

import fs from "node:fs";
import path from "node:path";

import { createKeyPool, readApiKeys } from "./gemini_keys.mjs";

const MODEL = process.env.OCR_MODEL || "gemini-flash-lite-latest";

const PROMPT = `Саған мектеп оқулығының сканерленген беті мен сол беттен бұрын
танылған мәтін беріледі. Мәтінді суретпен СӨЗБЕ-СӨЗ салыстыр.

Тек ҚАТЕЛЕРДІ тап:
- суретте басқаша жазылған сөздер (әріп қате танылған: ң/н, қ/к, ә/а, і/i);
- ішіне латын әрпі кіріп кеткен сөздер;
- жол соңындағы дефиспен бөлініп, біріктірілмей қалған сөздер ("адам-нан" → "адамнан");
- ішінде артық бос орын пайда болған сөздер ("өзін ің" → "өзінің");
- түсіп қалған немесе өзгеріп кеткен сөздер.

ҚАТАҢ ЕРЕЖЕЛЕР:
- Кітаптың өз емлесін ТҮЗЕТПЕ. Суретте "казак", "корыккан", "шегаралық" деп
  жазылса, солай қалады. Сен тек ТАНУ қатесін түзетесің.
- Стильді, сөз ретін, тыныс белгісін өзгертпе.
- Дұрыс танылған сөзді тізімге қоспа.
- Егер қате болмаса, бос тізім қайтар.

Жауап: {"fixes":[{"before":"қате жазылған сөз немесе тіркес","after":"суреттегі дұрыс нұсқасы"}]}
"before" мәтінде дәл сол күйінде кездесуі керек.

ДЕФИС ТУРАЛЫ: қазақ тілінде "ұлт-азаттық", "ашу-ыза", "генерал-губернатор",
"салт-дәстүр" сияқты нағыз қос сөздер бар — оларды БІРІКТІРМЕ. Тек жол соңында
тасымалданып бөлінген сөздерді біріктір ("адам-нан" → "адамнан", "наурыз-да" →
"наурызда"). Суретке қарап шеш: сөз екі жолға бөлініп тұрса — тасымал.`;

const SCHEMA = {
  type: "object",
  properties: {
    fixes: {
      type: "array",
      items: {
        type: "object",
        properties: { before: { type: "string" }, after: { type: "string" } },
        required: ["before", "after"]
      }
    }
  },
  required: ["fixes"]
};

let nextSlot = 0;

async function waitForSlot(minIntervalMs) {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + minIntervalMs;
  if (slot > now) {
    await new Promise((resolve) => setTimeout(resolve, slot - now));
  }
}

function parseRetryDelay(text) {
  const match = /retry in ([\d.]+)s/i.exec(text || "");
  return match ? Math.ceil(Number(match[1]) * 1000) : 0;
}

function readApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const text = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
  const line = text.split(/\r?\n/).find((item) => item.startsWith("GEMINI_API_KEY="));
  return line ? line.slice("GEMINI_API_KEY=".length).trim().replace(/^"|"$/g, "") : "";
}

/** Тасымал мен артық бос орыннан пайда болған күдікті сөздерді табады */
function suspiciousTokens(text) {
  const found = new Set();

  for (const match of text.matchAll(/[\wа-яәғқңөұүіһ]+-[а-яәғқңөұүіһ]+/gi)) {
    found.add(match[0]);
  }

  const splitPattern =
    /[а-яәғқңөұүіһ]{3,}\s+(?:ің|ың|ин|ім|ым|ды|ді|ты|ті|нан|нен|дан|ден|тан|тен|ға|ге|қа|ке|да|де|та|те|сы|сі|ны|ні)\b/gi;
  for (const match of text.matchAll(splitPattern)) {
    found.add(match[0]);
  }

  return Array.from(found).slice(0, 40);
}

/** Беттегі барлық мәтінді бір жолға жинайды */
function collectText(page) {
  const parts = [];
  for (const paragraph of page.body || []) {
    parts.push(paragraph);
  }
  for (const box of page.boxes || []) {
    parts.push(box.text || "");
  }
  return parts.join("\n");
}

/** Түзетуді беттің барлық мәтін өрісіне қолданады */
function applyFixes(page, fixes) {
  let applied = 0;

  const replaceIn = (value) => {
    let result = value;
    for (const fix of fixes) {
      if (!fix.before || fix.before === fix.after) {
        continue;
      }
      if (result.includes(fix.before)) {
        result = result.split(fix.before).join(fix.after);
        applied += 1;
      }
    }
    return result;
  };

  page.body = (page.body || []).map(replaceIn);
  page.boxes = (page.boxes || []).map((box) => ({ ...box, text: replaceIn(box.text || "") }));
  page.tables = (page.tables || []).map(replaceIn);
  page.figures = (page.figures || []).map((figure) => ({
    ...figure,
    caption: replaceIn(figure.caption || "")
  }));

  return applied;
}

async function verifyPage(keyPool, imagePath, text, minIntervalMs) {
  const imageBase64 = fs.readFileSync(imagePath).toString("base64");

  const suspicious = suspiciousTokens(text);
  const hintBlock = suspicious.length
    ? "МІНДЕТТІ ТҮРДЕ ТЕКСЕР (тасымал ма, әлде нағыз сөз бе?):\n" +
      suspicious.join(", ") +
      "\n\n"
    : "";

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await waitForSlot(minIntervalMs);
      const apiKey = keyPool.next();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: PROMPT },
                  { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
                  { text: hintBlock + "ТАНЫЛҒАН МӘТІН:\n" + text }
                ]
              }
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
              responseSchema: SCHEMA
            }
          })
        }
      );

      clearTimeout(timer);

      if (response.status === 429 || response.status >= 500) {
        const body = await response.text();
        const wait = Math.max(parseRetryDelay(body), attempt * 5000);

        if (response.status === 429) {
          // Осы кілттің лимиті бітті — келесі кілтке ауысамыз
          keyPool.block(apiKey, wait);
          const blocked = keyPool.blockedFor();
          if (blocked === 0) {
            continue;
          }
          nextSlot = Math.max(nextSlot, Date.now() + blocked);
          await new Promise((resolve) => setTimeout(resolve, blocked));
          continue;
        }

        nextSlot = Math.max(nextSlot, Date.now() + wait);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload).slice(0, 160));
      }

      const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) {
        throw new Error("бос жауап");
      }

      return JSON.parse(raw).fixes || [];
    } catch (error) {
      if (attempt === 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }

  return [];
}

async function main() {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
  const keyPool = createKeyPool(readApiKeys());
  if (!keyPool.size) {
    throw new Error("GEMINI_API_KEY табылмады");
  }
  console.log(`кілт саны: ${keyPool.size}`);

  const { imageDir, outDir } = config;
  const doneDir = config.verifiedDir || path.join(path.dirname(outDir), "verified");
  fs.mkdirSync(doneDir, { recursive: true });

  const firstPage = config.firstPage ?? 1;
  const lastPage = config.lastPage ?? 100000;
  const minIntervalMs = config.minIntervalMs ?? 4200;

  const names = fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => {
      const page = Number(name.replace(/\D/g, ""));
      return page >= firstPage && page <= lastPage;
    })
    .sort();

  const pending = names.filter((name) => !fs.existsSync(path.join(doneDir, name)));
  console.log(`тексеру: ${pending.length} / ${names.length}`);

  let index = 0;
  let done = 0;
  let failed = 0;
  let totalFixes = 0;

  async function worker() {
    for (;;) {
      const current = index;
      index += 1;
      if (current >= pending.length) {
        return;
      }

      const name = pending[current];
      const jsonPath = path.join(outDir, name);
      const imagePath = path.join(imageDir, name.replace(".json", ".jpg"));

      try {
        const page = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        const text = collectText(page);

        if (text.trim().length < 40) {
          fs.writeFileSync(path.join(doneDir, name), JSON.stringify(page, null, 1), "utf-8");
          done += 1;
          continue;
        }

        const fixes = await verifyPage(keyPool, imagePath, text, minIntervalMs);
        const applied = applyFixes(page, fixes);
        page.verifiedFixes = fixes.length;
        totalFixes += applied;

        fs.writeFileSync(path.join(doneDir, name), JSON.stringify(page, null, 1), "utf-8");
        done += 1;
      } catch (error) {
        failed += 1;
        console.error(`${name}: ${error.message}`);
      }

      process.stdout.write(`  ${done + failed}/${pending.length} (түзету: ${totalFixes}, қате: ${failed})\n`);
    }
  }

  await Promise.all(Array.from({ length: config.concurrency ?? 3 }, () => worker()));
  console.log(`тексерілді: ${done}, түзетілген орын: ${totalFixes}, қате: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

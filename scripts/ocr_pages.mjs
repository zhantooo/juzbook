/**
 * Сканерленген оқулық беттерін Gemini арқылы таниды.
 *
 * Әр беттің нәтижесі бөлек JSON файлға жазылады — жұмыс үзілсе, қайта
 * қосқанда танылған беттер қайталанбайды.
 *
 * Қолдану: node scripts/ocr_pages.mjs <config.json>
 */

import fs from "node:fs";
import path from "node:path";

import { createKeyPool, readApiKeys } from "./gemini_keys.mjs";

const MODEL = process.env.OCR_MODEL || "gemini-flash-lite-latest";

const PROMPT = `Бұл — қазақ тіліндегі мектеп оқулығының сканерленген беті.

МІНДЕТІҢ: беттегі мәтінді СӨЗБЕ-СӨЗ көшіріп жаз. Ештеңені түзетуге, өз сөзіңмен
айтуға, қысқартуға немесе қосып жазуға ҚАТАҢ ТЫЙЫМ САЛЫНАДЫ. Кітапта қалай
жазылса, солай жаз (ескі емле, «i» әрпі, тыныс белгілері сол күйінде қалады).
Егер сөз жол соңында дефиспен бөлінген болса, оны біріктіріп бір сөз қылып жаз.

Бетте мыналарды АНЫҚТА:
-1. pageKind — беттің түрі: "content" (оқулықтың негізгі мәтіні), "toc" (мазмұны),
   "glossary" (терминдер сөздігі), "references" (әдебиеттер тізімі),
   "chronology" (даталар тізімі), "cover" (мұқаба, титул, алғы сөз),
   "tasks" (тек тапсырмалар мен қайталау сұрақтары), "other".
0. sectionTitle — бетте жаңа БӨЛІМ немесе ТАРАУ басталса (мысалы "I бөлім.
   ҚАЗАҚ-ЖОҢҒАР СОҒЫСТАРЫ" немесе "Бірінші тарау"), оның толық атауы. Болмаса null.
1. paragraphNumber — беттегі "§" белгісі бар жаңа параграф басталса, оның нөмірі
   (мысалы "12" немесе "12-13"). Болмаса null.
2. paragraphTitle — сол параграфтың атауы. Болмаса null.
3. body — негізгі мәтіннің абзацтары. Әр абзац бөлек жол. Абзац басындағы қалың
   қаріппен жазылған тақырыпша болса, оны <b>...</b> ішіне ал.
4. boxes — түсті/жақтаулы блоктар. Әрқайсысы: label (блоктың атауы, мысалы
   "Ойлан!", "Есте сақта!", "Біліп жүр!") және text (толық мәтіні).
5. figures — суреттер, карталар, сызбалар. Әрқайсысы: caption (сурет асты жазуы,
   болмаса қысқаша сипаттама) және box (суреттің орны: [ymin,xmin,ymax,xmax],
   0-1000 аралығындағы сандар).
6. tables — кестелер. Әрқайсысы markdown түрінде.

АЛЫП ТАСТА (жауапқа мүлдем қоспа):
- Беттің жоғарғы/төменгі колонтитулы, бет нөмірі, "OKULYK" су таңбасы,
  "Все учебники Казахстана", "Книга предоставлена" деген жазулар.
- Тарау/параграф соңындағы сұрақтар, тапсырмалар, тесттер, жаттығулар.

Жауапты тек JSON түрінде қайтар.`;

const SCHEMA = {
  type: "object",
  properties: {
    pageKind: { type: "string" },
    sectionTitle: { type: "string", nullable: true },
    paragraphNumber: { type: "string", nullable: true },
    paragraphTitle: { type: "string", nullable: true },
    body: { type: "array", items: { type: "string" } },
    boxes: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, text: { type: "string" } },
        required: ["text"]
      }
    },
    figures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          caption: { type: "string" },
          box: { type: "array", items: { type: "number" } }
        },
        required: ["caption"]
      }
    },
    tables: { type: "array", items: { type: "string" } }
  },
  required: ["body"]
};

/** Сұраныстар арасындағы ең аз үзіліс — тегін тарифтің шегінен аспау үшін */
let nextSlot = 0;

async function waitForSlot(minIntervalMs) {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + minIntervalMs;
  if (slot > now) {
    await new Promise((resolve) => setTimeout(resolve, slot - now));
  }
}

/** 429 жауабындағы «Please retry in 41s» мәнін оқиды */
function parseRetryDelay(text) {
  const match = /retry in ([\d.]+)s/i.exec(text || "");
  return match ? Math.ceil(Number(match[1]) * 1000) : 0;
}

function readApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.trim();
  }

  const envPath = path.join(process.cwd(), ".env");
  const text = fs.readFileSync(envPath, "utf-8");
  const line = text.split(/\r?\n/).find((item) => item.startsWith("GEMINI_API_KEY="));
  return line ? line.slice("GEMINI_API_KEY=".length).trim().replace(/^"|"$/g, "") : "";
}

async function recognisePage(keyPool, imagePath, minIntervalMs, prompt = PROMPT) {
  const imageBase64 = fs.readFileSync(imagePath).toString("base64");

  for (let attempt = 1; attempt <= 6; attempt += 1) {
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
                  { text: prompt },
                  { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
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

      // 403/401 — кілттің өзі жарамсыз (жобаға тыйым салынған, кілт өшірілген).
      // Оны ұзаққа шетке қоймасақ, кезек сол кілтті қайта-қайта беріп,
      // беттер тізбегімен «танылмады» болып қалады.
      if (response.status === 403 || response.status === 401) {
        await response.text();
        keyPool.block(apiKey, 6 * 60 * 60 * 1000, true);
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        const body = await response.text();
        const wait = Math.max(parseRetryDelay(body), attempt * 5000);

        if (response.status === 429) {
          // Тәуліктік шектеу ұзақ, ал минуттық шектеу бірнеше секунд қана.
          // Осы кілт бос емес — келесі кілтпен жалғастырамыз.
          // Екеуінің метрикасы бірдей (generate_content_free_tier_requests) — тек quotaId ажыратады.
          const daily = /"quotaId":\s*"[^"]*PerDay/i.test(body);
          keyPool.block(apiKey, daily ? wait : Math.min(wait, 30000), daily);

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
        throw new Error(JSON.stringify(payload).slice(0, 200));
      }

      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("бос жауап");
      }

      return JSON.parse(text);
    } catch (error) {
      if (attempt === 6) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }

  throw new Error("танылмады");
}

async function main() {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
  const keyPool = createKeyPool(readApiKeys());
  if (!keyPool.size) {
    throw new Error("GEMINI_API_KEY табылмады");
  }
  console.log(`кілт саны: ${keyPool.size}`);

  // Пәнге тән қосымша нұсқау (мысалы, информатикадағы код пен кесте)
  const prompt = config.promptExtra ? `${PROMPT}

${config.promptExtra}` : PROMPT;
  const imageDir = config.imageDir;
  const outDir = config.outDir;
  fs.mkdirSync(outDir, { recursive: true });

  const firstPage = config.firstPage ?? 1;
  const lastPage = config.lastPage ?? 100000;

  const images = fs
    .readdirSync(imageDir)
    .filter((name) => name.endsWith(".jpg"))
    .filter((name) => {
      const pageNumber = Number(name.replace(/\D/g, ""));
      return pageNumber >= firstPage && pageNumber <= lastPage;
    })
    .sort();

  const pending = images.filter(
    (name) => !fs.existsSync(path.join(outDir, name.replace(".jpg", ".json")))
  );

  console.log(`барлығы ${images.length} бет, тану керек: ${pending.length}`);

  const concurrency = config.concurrency ?? 3;
  // Тегін тарифте минутына 20 сұраныс — 3.6 секунд сайын бір сұраныс жібереміз
  const minIntervalMs = config.minIntervalMs ?? 3600;
  let index = 0;
  let done = 0;
  let failed = 0;

  async function worker() {
    for (;;) {
      const current = index;
      index += 1;
      if (current >= pending.length) {
        return;
      }

      const name = pending[current];
      try {
        const result = await recognisePage(keyPool, path.join(imageDir, name), minIntervalMs, prompt);
        fs.writeFileSync(
          path.join(outDir, name.replace(".jpg", ".json")),
          JSON.stringify(result, null, 1),
          "utf-8"
        );
        done += 1;
      } catch (error) {
        failed += 1;
        console.error(`${name}: ${error.message}`);

        // Мазмұны жоқ бет (мұқаба, бос бет) модельден бос жауап алады.
        // Ондай бет кезекті бөгеп тұрмауы үшін бос нәтиже жазылады.
        if (/бос жауап/.test(error.message)) {
          fs.writeFileSync(
            path.join(outDir, name.replace(".jpg", ".json")),
            JSON.stringify(
              {
                pageKind: "other",
                sectionTitle: null,
                paragraphNumber: null,
                paragraphTitle: null,
                body: [],
                boxes: [],
                figures: [],
                tables: [],
                emptyResponse: true
              },
              null,
              1
            ),
            "utf-8"
          );
        }
      }

      process.stdout.write(`  ${done + failed}/${pending.length} (қате: ${failed})
`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`дайын: ${done}, қате: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

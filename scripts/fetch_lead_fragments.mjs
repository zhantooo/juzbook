/**
 * Беттің ең басындағы, алдыңғы беттен жалғасқан сөйлем үзіндісін алады.
 *
 * Тану кезінде модель кейде жаңа § тақырыбынан бұрын тұрған қысқа үзіндіні
 * («…жата-» + «ды.») тастап кетеді. Сонда сөз ортасынан үзіліп қалады.
 * Бұл скрипт тек сондай беттерге қысқа, нақты сұрау жібереді де, нәтижені
 * беттің JSON файлына `leadFragment` етіп жазады.
 *
 * Қолдану: node scripts/fetch_lead_fragments.mjs <ocr-config.json>
 */
import fs from "node:fs";
import path from "node:path";

import { createKeyPool, readApiKeys } from "./gemini_keys.mjs";

const MODEL = process.env.OCR_MODEL || "gemini-flash-lite-latest";
const SENTENCE_END = /[.!?:»…)]\s*$/;

function unfinished(text) {
  const value = (text || "").trim();
  if (!value) {
    return false;
  }
  return value.endsWith("-") || !SENTENCE_END.test(value);
}

function startsLower(text) {
  const head = (text || "").replace(/^[\s<b>]+/, "").trim().charAt(0);
  return Boolean(head) && head === head.toLowerCase() && head !== head.toUpperCase();
}

async function askFragment(keyPool, imagePath, previousTail) {
  const prompt = `Бұл — қазақ тіліндегі мектеп оқулығының беті.
Алдыңғы бет мына сөзбен бітті: «${previousTail}»
Осы беттің ЕҢ БАСЫНДА, бөлім/тарау/§ тақырыбынан БҰРЫН, сол сөйлемнің жалғасы тұр ма?
Болса, тек сол жалғасты сөзбе-сөз көшіріп жаз (жаңа тақырып басталғанға дейін).
Ештеңені түзетпе, қоспа. Жалғасы жоқ болса, бос жол қайтар.
Жауап тек JSON: {"fragment": "..."}`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(imagePath).toString("base64") } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: { fragment: { type: "string" } },
        required: ["fragment"]
      }
    }
  };

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const apiKey = keyPool.next();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    if (response.status === 429 || response.status >= 500) {
      const text = await response.text();
      // Минуттық лимит пен тәуліктік лимиттің метрикасы бірдей — тек quotaId ажыратады
      const daily = /"quotaId":\s*"[^"]*PerDay/i.test(text);
      keyPool.block(apiKey, daily ? 0 : 20000, daily);
      const wait = keyPool.blockedFor();
      await new Promise((resolve) => setTimeout(resolve, Math.max(wait, 3000)));
      continue;
    }

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(payload).slice(0, 160));
    }

    const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return (JSON.parse(raw).fragment || "").trim();
  }

  throw new Error("жауап алынбады");
}

async function main() {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
  const keyPool = createKeyPool(readApiKeys());
  const names = fs
    .readdirSync(config.outDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  let asked = 0;
  let found = 0;

  for (let index = 1; index < names.length; index += 1) {
    const previousPath = path.join(config.outDir, names[index - 1]);
    const currentPath = path.join(config.outDir, names[index]);
    const previous = JSON.parse(fs.readFileSync(previousPath, "utf-8"));
    const current = JSON.parse(fs.readFileSync(currentPath, "utf-8"));

    if (current.leadChecked) {
      continue;
    }

    const previousBody = previous.body || [];
    const tail = previousBody[previousBody.length - 1] || "";
    const head = (current.body || [])[0] || "";

    // Алдыңғы бет сөйлем ортасында бітпесе, не жалғасы бұл бетте бар болса — сұрамаймыз
    if (!unfinished(tail) || startsLower(head)) {
      continue;
    }

    const imagePath = path.join(config.imageDir, names[index].replace(".json", ".jpg"));
    if (!fs.existsSync(imagePath)) {
      continue;
    }

    asked += 1;
    try {
      const fragment = await askFragment(keyPool, imagePath, tail.slice(-60));
      current.leadChecked = true;
      if (fragment && startsLower(fragment)) {
        current.leadFragment = fragment;
        found += 1;
        console.log(`${names[index]}: «${fragment.slice(0, 60)}»`);
      }
      fs.writeFileSync(currentPath, JSON.stringify(current, null, 1), "utf-8");
    } catch (error) {
      console.error(`${names[index]}: ${error.message}`);
    }
  }

  console.log(`сұралды: ${asked}, табылды: ${found}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

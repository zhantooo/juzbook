/**
 * Беттегі суреттердің дәл шекарасын бөлек сұраумен алады.
 *
 * Негізгі тану сұрауы көп міндетті қатар атқарады да, суреттің шекарасы
 * жуықтап қана беріледі: скриншот кесіліп, жазуы («N-сурет …») не беттің
 * безендіру жолағы кіріп кетеді. Бұл сұрау тек суреттерді іздейді; нәтижесі
 * беттің JSON файлына `figureBoxes` етіп жазылады, ал builder оны
 * `figures` орнына қолданады (қолтаңба OCR-дағы суреттен алынады).
 *
 * Қолдану: node scripts/figure_boxes.mjs <ocr-config.json> [--only=16,24] [--force] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";

import { createKeyPool, readApiKeys } from "./gemini_keys.mjs";

const MODELS = (process.env.FIGURE_MODEL || "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const PROMPT = `Бұл — оқулықтың беті. Беттегі барлық иллюстрацияларды тап: экран суреті
(скриншот, терезе, мәзір, құралдар тақтасы, Excel парағының суреті), сызба, схема,
диаграмма, фотосурет. Әрқайсысы үшін ТОЛЫҚ әрі ДӘЛ шекарасын бер:
[ymin, xmin, ymax, xmax], 0–1000 аралығындағы сандар.

Кітапта мәтінмен терілген кесте (торлы, бағандары мен жолдары бар мәтін кестесі,
«1-кесте. …») иллюстрация ЕМЕС — оны жазба.

Ережелер:
- Иллюстрацияның барлық бөлігі кірсін (терезенің жиегі, сызбадағы жебелер мен
  жазулар, бірнеше бөліктен тұратын сызба — бір бүтін).
- Астындағы жазу («12-сурет. …», «3-сызба. …») шекараға КІРМЕЙДІ; оны caption
  өрісіне жаз.
- Айналадағы негізгі мәтін, беттің түсті безендіру жолағы, бет нөмірі, су таңбасы,
  бөлік белгісінің шағын иконкасы кірмейді.
- Мәтін арасындағы кішкентай иконкаларды иллюстрация деп есептеме.

Жауап тек JSON: {"figures": [{"box": [ymin, xmin, ymax, xmax], "caption": "..."}]}`;

const SCHEMA = {
  type: "object",
  properties: {
    figures: {
      type: "array",
      items: {
        type: "object",
        properties: { box: { type: "array", items: { type: "number" } }, caption: { type: "string" } },
        required: ["box"]
      }
    }
  },
  required: ["figures"]
};

async function ask(pools, exhausted, keys, imagePath) {
  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(imagePath).toString("base64") } }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA }
  };
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const model = MODELS.find((name) => exhausted.get(name).size < keys.length);
    if (!model) {
      throw new Error("барлық модельдің тәуліктік лимиті бітті");
    }
    const pool = pools.get(model);
    let key = pool.next();
    if (exhausted.get(model).has(key)) {
      key = keys.find((item) => !exhausted.get(model).has(item));
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    // 403/401 — кілттің өзі жарамсыз (жобаға тыйым салынған, кілт өшірілген).
    // Ондай кілт қайта-қайта берілсе, беттер тізбегімен сәтсіз болады.
    if (response.status === 403 || response.status === 401) {
      exhausted.get(model).add(key);
      pool.block(key, 6 * 60 * 60 * 1000, true);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      const text = await response.text();
      if (/"quotaId":\s*"[^"]*PerDay/i.test(text)) {
        exhausted.get(model).add(key);
        continue;
      }
      pool.block(key, 20000, false);
      await new Promise((resolve) => setTimeout(resolve, Math.max(pool.blockedFor(), 3000)));
      continue;
    }
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(payload).slice(0, 160));
    }
    const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return { ...JSON.parse(raw), model };
  }
  throw new Error("жауап алынбады");
}

async function main() {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
  const keys = readApiKeys();
  const pools = new Map(MODELS.map((model) => [model, createKeyPool(keys)]));
  const exhausted = new Map(MODELS.map((model) => [model, new Set()]));
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map((value) => `p${value.padStart(4, "0")}.json`)) : null;

  const names = fs.readdirSync(config.outDir).filter((name) => name.endsWith(".json")).sort();
  let asked = 0;
  for (const name of names) {
    if (only && !only.has(name)) {
      continue;
    }
    const file = path.join(config.outDir, name);
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!(data.figures || []).length || (data.figureBoxes && !force)) {
      continue;
    }
    const imagePath = path.join(config.imageDir, name.replace(".json", ".jpg"));
    if (!fs.existsSync(imagePath)) {
      continue;
    }
    asked += 1;
    try {
      const result = await ask(pools, exhausted, keys, imagePath);
      data.figureBoxes = { figures: result.figures || [], model: result.model };
      if (!dryRun) {
        fs.writeFileSync(file, JSON.stringify(data, null, 1), "utf-8");
      }
      console.log(`${name}: ${JSON.stringify((result.figures || []).map((item) => item.box))} [${result.model}]`);
    } catch (error) {
      console.error(`${name}: ${error.message}`);
      if (/тәуліктік лимиті бітті/.test(error.message)) {
        break;
      }
    }
  }
  console.log(`сұралды: ${asked}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

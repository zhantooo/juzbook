/**
 * § соңындағы қосымша бөлікті (терминдер, тұлғалар, тапсырмалар, тест,
 * тапсырмадан кейінгі дерек блогы) белгілейді.
 *
 * Тану кезінде модельге тапсырмаларды жазба деп айтылады. Сондықтан тапсырма
 * қай жерден басталғаны JSON-да көрінбейді де, одан кейін тұрған дерек
 * блогы, терминдер тізімі негізгі мәтінге кіріп кетеді. Бұл скрипт тек §
 * соңы мен басы түскен беттерге сұрау жібереді: беттің кескіні мен сол беттен
 * алынған элементтер тізімін беріп, қайсысы қосымша бөлікке жататынын
 * сұрайды. Нәтиже беттің JSON файлына `apparatus` етіп жазылады.
 *
 * Қолдану: node scripts/mark_apparatus.mjs <ocr-config.json>
 */
import fs from "node:fs";
import path from "node:path";

import { createKeyPool, readApiKeys } from "./gemini_keys.mjs";

// flash-lite бұл жерде негізгі мәтінді де белгілеп жібереді — күштірек модель керек.
// Тегін деңгейде әр модельге бір кілтпен күніне 20 сұрау ғана, сондықтан
// біреуінің тәуліктік лимиті біткенде келесі модельге көшеміз.
const MODELS = (process.env.APPARATUS_MODEL || "gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-flash-latest")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
// § басталған беттен бұрынғы осынша бет тексеріледі
const TAIL_PAGES = 3;

function plain(value) {
  return (value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function describeItems(page) {
  const lines = [];
  (page.body || []).forEach((item, index) => {
    lines.push(`body[${index}]: ${plain(item).slice(0, 140)}`);
  });
  (page.boxes || []).forEach((item, index) => {
    lines.push(`boxes[${index}]: [${plain(item.label)}] ${plain(item.text).slice(0, 120)}`);
  });
  (page.tables || []).forEach((item, index) => {
    lines.push(`tables[${index}]: ${plain(item).slice(0, 100)}`);
  });
  (page.figures || []).forEach((item, index) => {
    lines.push(`figures[${index}]: ${plain(item.caption).slice(0, 80)}`);
  });
  return lines.join("\n");
}

function createModelPool(keys) {
  const pools = new Map(MODELS.map((model) => [model, createKeyPool(keys)]));
  const exhausted = new Map(MODELS.map((model) => [model, new Set()]));
  return {
    /** Тәуліктік лимиті бітпеген алғашқы модель мен оның кілті */
    next() {
      for (const model of MODELS) {
        const spent = exhausted.get(model);
        if (spent.size >= keys.length) {
          continue;
        }
        const pool = pools.get(model);
        for (let step = 0; step < keys.length; step += 1) {
          const key = pool.next();
          if (!spent.has(key)) {
            return { model, key, pool };
          }
        }
      }
      return null;
    },
    exhaust(model, key) {
      exhausted.get(model).add(key);
    }
  };
}

// Информатика оқулығы: тапсырма бөліктері өз белгісімен басталады
const INFORMATICS_PROMPT = `Бұл — қазақ тіліндегі информатика оқулығының беті. Төменде осы беттен
бұрын алынған элементтер тізімі берілген (әрқайсысының басы ғана).

Оқулықта сабақтың негізгі мәтіні («Жаңа білім», түсіндірме, шешімі көрсетілген
мысал есептер «N-мысал», «Берілгені/Шешуі», программа коды мен оның түсіндірмесі,
«Қосымша ақпарат», «Есте сақта» блоктары) және ТАПСЫРМА бөліктері бар.

Тапсырма бөлігі өз белгісімен басталады: «Практикалық жұмыс», «Практикум» тапсырмалары,
«Тапсырма», «N-тапсырма», «Үй тапсырмасы», «Ойлануға берілген сұрақтар», «Ойлан»,
«Сұрақтарға жауап берейік», «Ойланайық, талқылайық», «Талдап, салыстырайық»,
«Дәптерге орындайық», «Компьютерде орындайық», «Ой бөлісейік», «Шығармашылық тапсырма»,
«Өзіңді тексер», тест, «Жиынтық бағалау». Тапсырма бөлігіне оның ішіндегі мәтін,
суреттер (тапсырманы түсіндіретін сурет), кестелер (толтыруға арналған) жатады.

Кескінге қарап, тізімдегі қай элементтер ТАПСЫРМА бөлігінің ішінде тұрғанын анықта.
Негізгі мәтінге жататын элементтерді (соның ішінде беттің басындағы мысалдың
жалғасын) белгілеме. Беттің ең соңғы элементі тапсырма бөлігінде тұрса,
endsInApparatus: true.`;

async function askApparatus(modelPool, imagePath, page) {
  const historyPrompt = `Бұл — қазақ тіліндегі тарих оқулығының беті. Төменде осы беттен бұрын
алынған элементтер тізімі берілген (әрқайсысының басы ғана).

Әр параграфтың (§) негізгі мәтінінен КЕЙІН «қосымша бөлік» тұрады:
- терминдердің түсіндірмесі (сөз – анықтамасы, көбіне шам белгісімен);
- тұлғалар туралы қысқа анықтама (портрет белгісімен);
- «Шығармашылық тапсырмалар», «1-тапсырма», сұрақтар, тест сұрақтары мен
  жауап нұсқалары (A) … E)), «зерттеу жұмысы»;
- тапсырмалардан кейін тұрған дерек мәтіні (жасыл блок), оның авторы/дереккөзі
  және соңындағы сұрағы.
Жаңа § атауының ҮСТІНДЕ алдыңғы беттегі осындай бөліктің жалғасы тұруы мүмкін —
ол да қосымша бөлікке жатады.

Негізгі мәтін (§ атауынан кейінгі, тапсырмалардан бұрынғы абзацтар, ондағы
деректер, суреттер мен блоктар) қосымша бөлікке ЖАТПАЙДЫ.

Тізімдегі қай элементтер қосымша бөлікке жатады? Кескінге қарап, әр элементтің
бетте қай жерде тұрғанын анықта. Сонымен қатар беттің ең соңғы элементі қосымша
бөлікке жатса, endsInApparatus: true.

Элементтер:
${describeItems(page)}

Жауап тек JSON: {"body": [нөмірлер], "boxes": [...], "tables": [...], "figures": [...], "endsInApparatus": true/false}`;
  const prompt =
    process.env.APPARATUS_KIND === "informatics"
      ? `${INFORMATICS_PROMPT}

Элементтер:
${describeItems(page)}

Жауап тек JSON: {"body": [нөмірлер], "boxes": [...], "tables": [...], "figures": [...], "endsInApparatus": true/false}`
      : historyPrompt;

  const list = { type: "array", items: { type: "integer" } };
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
        properties: { body: list, boxes: list, tables: list, figures: list, endsInApparatus: { type: "boolean" } },
        required: ["body", "boxes", "tables", "figures", "endsInApparatus"]
      }
    }
  };

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const choice = modelPool.next();
    if (!choice) {
      throw new Error("барлық модельдің тәуліктік лимиті бітті");
    }
    const { model, key: apiKey, pool } = choice;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    // 403/401 — кілттің жобасына тыйым салынған не кілт жарамсыз: оны шетке қоямыз
    if (response.status === 403 || response.status === 401) {
      modelPool.exhaust(model, apiKey);
      pool.block(apiKey, 6 * 60 * 60 * 1000, true);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      const text = await response.text();
      // Минуттық лимит пен тәуліктік лимиттің метрикасы бірдей — тек quotaId ажыратады
      if (/"quotaId":\s*"[^"]*PerDay/i.test(text)) {
        modelPool.exhaust(model, apiKey);
        continue;
      }
      pool.block(apiKey, 20000, false);
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

// § соңы мен басы түскен беттер: тапсырма беттері, жаңа § басталған бет
// және оның алдындағы бірнеше бет
function candidatePages(pages) {
  if (process.env.APPARATUS_KIND === "informatics") {
    return pages.filter((page) => (page.data.pageKind || "").toLowerCase() === "tasks");
  }
  const chosen = new Set();
  let running = null;
  pages.forEach((page, index) => {
    const kind = (page.data.pageKind || "content").toLowerCase();
    if (kind === "tasks") {
      chosen.add(index);
      // Тапсырма бетінің алдындағы бетте де дерек блогы тұруы мүмкін
      if (index > 0) {
        chosen.add(index - 1);
      }
    }
    // § нөмірлері үзіліссіз өседі: жаңа § нөмірі алдыңғысынан үлкен
    // (build_ocr_payload.is_inner_point-пен бірдей ереже)
    const bounds = ((page.data.paragraphNumber || "").match(/\d+/g) || []).slice(0, 2).map(Number);
    const summary = /(бөлімге|бөлім\s+бойынша)\s+қорытынды/i.test(page.data.sectionTitle || "");
    const opensParagraph =
      bounds.length > 0 && (running === null || (bounds[0] > running && bounds[0] <= running + 3));
    const endsBefore = opensParagraph || summary || !["content", "tasks", "other"].includes(kind);
    if (opensParagraph) {
      running = bounds[bounds.length - 1];
      chosen.add(index);
    }
    if (endsBefore) {
      for (let back = 1; back <= TAIL_PAGES; back += 1) {
        if (index - back >= 0) {
          chosen.add(index - back);
        }
      }
    }
  });
  return [...chosen].sort((a, b) => a - b).map((index) => pages[index]);
}

async function main() {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
  const modelPool = createModelPool(readApiKeys());
  const pages = fs
    .readdirSync(config.outDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, file: path.join(config.outDir, name), data: JSON.parse(fs.readFileSync(path.join(config.outDir, name), "utf-8")) }));

  // --force: бұрын белгіленген беттерді қайта сұрау; --only=0100,0101: тек сол беттер
  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map((value) => `p${value.padStart(4, "0")}.json`)) : null;
  const dryRun = process.argv.includes("--dry-run");

  let asked = 0;
  for (const page of candidatePages(pages)) {
    if (only && !only.has(page.name)) {
      continue;
    }
    // flash-lite белгілеріне сенбейміз — оларды қайта сұраймыз
    const model = page.data.apparatus?.model || "";
    if (model && !model.includes("lite") && !force) {
      continue;
    }
    const kind = (page.data.pageKind || "content").toLowerCase();
    if (!["content", "tasks", "other"].includes(kind)) {
      continue;
    }
    const itemCount =
      (page.data.body || []).length + (page.data.boxes || []).length +
      (page.data.tables || []).length + (page.data.figures || []).length;
    if (!itemCount) {
      continue;
    }
    const imagePath = path.join(config.imageDir, page.name.replace(".json", ".jpg"));
    if (!fs.existsSync(imagePath)) {
      continue;
    }

    asked += 1;
    try {
      const result = await askApparatus(modelPool, imagePath, page.data);
      page.data.apparatus = {
        body: result.body || [],
        boxes: result.boxes || [],
        tables: result.tables || [],
        figures: result.figures || [],
        endsInApparatus: Boolean(result.endsInApparatus),
        model: result.model
      };
      if (!dryRun) {
        fs.writeFileSync(page.file, JSON.stringify(page.data, null, 1), "utf-8");
      }
      const marked = page.data.apparatus;
      console.log(
        `${page.name}: body ${JSON.stringify(marked.body)} boxes ${JSON.stringify(marked.boxes)} ` +
          `tables ${JSON.stringify(marked.tables)} figures ${JSON.stringify(marked.figures)} end=${marked.endsInApparatus} [${marked.model}]`
      );
    } catch (error) {
      console.error(`${page.name}: ${error.message}`);
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

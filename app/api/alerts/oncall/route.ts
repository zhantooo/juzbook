/**
 * Дабылға жауап беретін кезекші агент.
 *
 * Бақылау жүйесі (Grafana не басқа OTLP жинаушы) дабыл шыққанда осы
 * маршрутқа webhook жібереді. Агент дабылды оқиды, қолданбаның сол
 * сәттегі күйін өзі тексереді де, диагноз жазып, GitHub-та issue ашады.
 *
 * ШЕКАРАСЫ ӘДЕЙІ ТАР. Агент тек ОҚИДЫ және issue ЖАЗАДЫ. Ол код
 * өзгертпейді, деплой жасамайды, дерекқорға тимейді. Кезекшінің жұмысы —
 * не болғанын түсіндіріп, адамды дұрыс жерге бағыттау.
 *
 * Қауіпсіздік: маршрут ашық тұрады (жинаушы сырттан шақырады), сондықтан
 * `ONCALL_WEBHOOK_SECRET` арқылы қорғалған. Құпия берілмесе, маршрут
 * мүлде жұмыс істемейді — байқаусыз ашық қалып қоймауы үшін.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runWithGeminiKey, hasGeminiApiKey } from "@/lib/gemini-keys";
import { resolveEnvironment } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONCALL_MODEL = process.env.ONCALL_MODEL?.trim() || "gemini-3.5-flash";

const alertSchema = z.object({
  /** Дабылдың аты, мысалы «Каталог жауабы 1 МБ-тан асты» */
  title: z.string().trim().min(3).max(300),
  /** Қай метрика іске қосты */
  metric: z.string().trim().max(200).optional(),
  /** Шегі мен қазіргі мәні */
  threshold: z.union([z.number(), z.string()]).optional(),
  value: z.union([z.number(), z.string()]).optional(),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  /** Жинаушының өз сілтемесі */
  dashboardUrl: z.string().trim().max(500).optional(),
  /** Қосымша сипаттама */
  description: z.string().trim().max(4000).optional()
});

/** Құпияны уақыт бойынша ағып кетпейтіндей салыстырады */
function secretMatches(provided: string, expected: string) {
  const a = createHmac("sha256", expected).update(provided).digest();
  const b = createHmac("sha256", expected).update(expected).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Агентке беретін нақты дерек.
 *
 * Модельге «бірдеңе бұзылды» деп қана айтудың пайдасы аз. Сондықтан
 * қолданбаның сол сәттегі өлшенетін күйін өзіміз жинап береміз.
 */
async function collectContext(origin: string) {
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  const probe = async (name: string, path: string) => {
    const started = Date.now();
    try {
      const response = await fetch(origin + path, { cache: "no-store" });
      const text = await response.text();
      checks.push({
        name,
        ok: response.ok,
        detail: `HTTP ${response.status}, ${text.length} байт, ${Date.now() - started} мс`
      });
    } catch (error) {
      checks.push({ name, ok: false, detail: error instanceof Error ? error.message : "қосыла алмады" });
    }
  };

  await probe("Басты бет", "/");
  await probe("Каталог (навигация)", "/api/catalog?view=navigation");

  return checks;
}

export async function POST(request: Request) {
  const secret = process.env.ONCALL_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Кезекші агент бапталмаған." }, { status: 503 });
  }

  const provided = request.headers.get("x-juzbook-alert-secret") || "";
  if (!provided || !secretMatches(provided, secret)) {
    return NextResponse.json({ error: "Рұқсат жоқ." }, { status: 401 });
  }

  let parsed;
  try {
    parsed = alertSchema.safeParse((await request.json()) as unknown);
  } catch {
    return NextResponse.json({ error: "Дерек жарамсыз." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Дабылдың пішімі дұрыс емес." }, { status: 400 });
  }

  const alert = parsed.data;
  const env = resolveEnvironment();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
  const checks = await collectContext(origin);

  if (!hasGeminiApiKey()) {
    // Модель жоқ болса да, жиналған дерек пайдалы — оны сол күйінде береміз.
    return NextResponse.json({ ok: true, diagnosis: null, checks, note: "Gemini кілті жоқ." });
  }

  const prompt = [
    "Сен — JUZBOOK оқу платформасының кезекші инженерісің.",
    "JUZBOOK: Next.js қолданбасы, Vercel-де тұрады, PostgreSQL (каталог пен оқушылар),",
    "Turso (іздеу индексі мен Arena), R2 (оқулық суреттері).",
    "",
    "ДАБЫЛ:",
    `  атауы: ${alert.title}`,
    alert.metric ? `  метрика: ${alert.metric}` : "",
    alert.value !== undefined ? `  қазіргі мәні: ${alert.value}` : "",
    alert.threshold !== undefined ? `  шегі: ${alert.threshold}` : "",
    `  маңыздылығы: ${alert.severity}`,
    alert.description ? `  сипаттамасы: ${alert.description}` : "",
    `  ортасы: ${env.label} (${env.databaseHost})`,
    "",
    "ҚАЗІРГІ КҮЙІ (нақты өлшенген):",
    ...checks.map((c) => `  ${c.ok ? "сау" : "ҚҰЛАДЫ"} — ${c.name}: ${c.detail}`),
    "",
    "Жауапты ҚАЗАҚША, үш бөліммен жаз:",
    "1. Не болды — бір-екі сөйлем, қарапайым тілмен.",
    "2. Ықтимал себептері — ең ықтималынан бастап, әрқайсысын қалай тексеруге болатынын қоса.",
    "3. Қазір не істеу керек — нақты қадамдар.",
    "Болжамды факт ретінде айтпа. Дерек жетпесе, нені білу керегін жаз."
  ]
    .filter(Boolean)
    .join("\n");

  let diagnosis: string | null = null;
  try {
    diagnosis = await runWithGeminiKey(async (ai) => {
      const result = await ai.models.generateContent({ model: ONCALL_MODEL, contents: prompt });
      return result.text?.trim() || null;
    });
  } catch (error) {
    diagnosis = null;
    checks.push({
      name: "Агент",
      ok: false,
      detail: error instanceof Error ? error.message : "модельге сұраныс сәтсіз"
    });
  }

  /**
   * Issue ашу — агенттің ЖАЛҒЫЗ сыртқа жазатын әрекеті.
   *
   * Токен берілмесе, ештеңе жазылмайды да, диагноз жауапта қайтарылады.
   * Сонда агентті алдымен «жазбай» сынап көруге болады.
   */
  let issueUrl: string | null = null;
  const token = process.env.ONCALL_GITHUB_TOKEN?.trim();
  const repo = process.env.ONCALL_GITHUB_REPO?.trim();
  if (token && repo && diagnosis) {
    try {
      const body = [
        `**Дабыл:** ${alert.title}`,
        alert.metric ? `**Метрика:** \`${alert.metric}\`` : "",
        alert.value !== undefined ? `**Мәні:** ${alert.value}` : "",
        alert.threshold !== undefined ? `**Шегі:** ${alert.threshold}` : "",
        `**Орта:** ${env.label}`,
        alert.dashboardUrl ? `**Тақта:** ${alert.dashboardUrl}` : "",
        "",
        "### Кезекші агенттің диагнозы",
        diagnosis,
        "",
        "### Сол сәттегі тексеру",
        ...checks.map((c) => `- ${c.ok ? "сау" : "**құлады**"} — ${c.name}: ${c.detail}`),
        "",
        "_Бұл issue-ді кезекші агент автоматты түрде ашты. Диагноз — болжам, растау керек._"
      ]
        .filter(Boolean)
        .join("\n");

      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: `[${alert.severity}] ${alert.title}`,
          body,
          labels: ["oncall", alert.severity === "critical" ? "type:bug" : "area:infra"]
        })
      });
      if (response.ok) {
        const payload = (await response.json()) as { html_url?: string };
        issueUrl = payload.html_url ?? null;
      }
    } catch {
      issueUrl = null;
    }
  }

  return NextResponse.json({ ok: true, environment: env.environment, diagnosis, checks, issueUrl });
}

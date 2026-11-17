/**
 * JUZBOOK-қа тән өлшемдер.
 *
 * Жалпы HTTP өлшемдерін OpenTelemetry өзі жинайды. Мұндағылар —
 * қолданбаның өз мәселелерін көрсететіндер, яғни тақтаға қарап тұрып
 * «бірдеңе бұзылды» деп айтуға келетіндер:
 *
 *   juzbook.reader.payload_bytes  — оқу бетіне жіберілген навигация көлемі.
 *       Бұл бір рет 532 КБ-қа дейін өсіп, бетті ауырлатқан. Өссе, қайталанды.
 *   juzbook.catalog.query_ms      — каталогты базадан оқу уақыты.
 *   juzbook.gemini.key_rotated    — Gemini кілті шектеуге тіреліп ауысты.
 *       Жиілесе, кілт пулы таусылып жатыр деген сөз.
 *   juzbook.search.latency_ms     — іздеу кідірісі (кілт сөз / мағына бөлек).
 *   juzbook.search.empty          — нәтижесіз іздеу саны.
 *   juzbook.test.generated        — құрастырылған тест (дайын банк / ИИ).
 *   juzbook.arena.match_finished  — аяқталған жекпе-жек.
 *
 * Жинаушы қосылмаған болса, OpenTelemetry API-і ештеңе істемейтін
 * нұсқаларын береді, сондықтан бұл функцияларды шақыру әрқашан
 * қауіпсіз — шарт жазудың қажеті жоқ.
 */
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("juzbook", "1.0.0");

const readerPayloadBytes = meter.createHistogram("juzbook.reader.payload_bytes", {
  description: "Оқу бетіне жіберілген навигация жауабының көлемі",
  unit: "By"
});

const catalogQueryMs = meter.createHistogram("juzbook.catalog.query_ms", {
  description: "Каталогты дерекқордан оқу уақыты",
  unit: "ms"
});

const searchLatencyMs = meter.createHistogram("juzbook.search.latency_ms", {
  description: "Іздеу сұранымының кідірісі",
  unit: "ms"
});

const searchEmpty = meter.createCounter("juzbook.search.empty", {
  description: "Ештеңе таппаған іздеу сұранымдары"
});

const geminiKeyRotated = meter.createCounter("juzbook.gemini.key_rotated", {
  description: "Шектеуге тірелгендіктен Gemini кілтінің ауысуы"
});

const testGenerated = meter.createCounter("juzbook.test.generated", {
  description: "Құрастырылған тестілер"
});

const arenaMatchFinished = meter.createCounter("juzbook.arena.match_finished", {
  description: "Аяқталған Arena жекпе-жектері"
});

/** Навигация жауабының көлемі (байт) */
export function recordReaderPayload(bytes: number, attributes: { view: "navigation" | "full"; admin: boolean }) {
  readerPayloadBytes.record(bytes, { view: attributes.view, admin: String(attributes.admin) });
}

/** Каталог сұранысының уақыты */
export function recordCatalogQuery(ms: number, attributes: { view: "navigation" | "full"; cached: boolean }) {
  catalogQueryMs.record(ms, { view: attributes.view, cached: String(attributes.cached) });
}

/** Іздеу кідірісі. `kind` — кілт сөз бе, мағына ма. */
export function recordSearch(ms: number, attributes: { kind: "keyword" | "semantic" | "merged"; hits: number }) {
  searchLatencyMs.record(ms, { kind: attributes.kind });
  if (attributes.hits === 0) {
    searchEmpty.add(1, { kind: attributes.kind });
  }
}

/** Gemini кілті ауысты (шектеу немесе қате себепті) */
export function recordGeminiKeyRotation(reason: "rate_limit" | "daily_limit" | "error") {
  geminiKeyRotated.add(1, { reason });
}

/** Тест құрастырылды. `source` — дайын банктен бе, ИИ-ден бе. */
export function recordTestGenerated(source: "bank" | "ai", questions: number) {
  testGenerated.add(1, { source, bucket: questions >= 20 ? "20+" : questions >= 10 ? "10-19" : "1-9" });
}

/** Жекпе-жек аяқталды */
export function recordArenaMatch(outcome: "finished" | "abandoned") {
  arenaMatchFinished.add(1, { outcome });
}

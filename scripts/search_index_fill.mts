/**
 * Мағыналық іздеу индексін толтырады.
 *
 * Бұл скрипт `lib/search/indexer.ts` ішіндегі сол бір кодты шақырады —
 * түнгі cron да, әкімші маршруты да соны пайдаланады. Айырмасы: мұнда
 * уақыт шегі жоқ, сондықтан бүкіл каталогты бір жүгіріспен алуға болады.
 *
 * Неге бөлек скрипт керек болды: индексті dev маршруты арқылы толтырғанда
 * екі кедергі шықты. Біріншісі — serverless функцияның 300 секундтық шегі,
 * оған 2 282 тақырып сыймайды. Екіншісі — Node-тың `fetch`-і де 300
 * секундтен кейін үзіледі де, сервер жұмысын жалғастырып жатқанда клиент
 * оны «сәтсіз» деп есептеп, есебін жоғалтады. Әрі әр HTTP айналымында
 * бүкіл каталогтың мазмұны Postgres-тен қайтадан оқылатын (~30 с). Мұнда
 * ол бір рет оқылады.
 *
 * Талаптар (AGENTS.md 7) сақталады:
 *   - қайта қосуға болады: әр тақырыптың мазмұн таңбасы сақталады, екінші
 *     жүгіріс өңделгенін қайта эмбеддемейді;
 *   - ештеңені жоймайды: `prune` тек жанама түрде, деректен жоғалған
 *     тақырыптарды тазалау үшін;
 *   - өзін тексереді: соңында индекстің күйі қайта оқылып көрсетіледі.
 *
 * npx tsx --env-file=.env --env-file=.env.local scripts/search_index_fill.mts [--limit=<сан>] [--status] [--no-prune]
 *
 * Екі env файлы керек: Turso деректері `.env`-те, Cloudflare кілті
 * `.env.local`-да тұр.
 */
import { getEmbeddingProvider, hasEmbeddingProvider } from "@/lib/search/embeddings";
import { getIndexStatus, runIndexing } from "@/lib/search/indexer";
import { hasVectorSearch } from "@/lib/search/vector-db";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) =>
  (args.find((item) => item.startsWith(`--${name}=`)) || "").split("=")[1] || "";

const limit = Number(value("limit") || "0") || Number.POSITIVE_INFINITY;

function report(status: Awaited<ReturnType<typeof getIndexStatus>>) {
  console.log(
    `  тақырып ${status.chapters} | индекстелген ${status.indexedChapters} | ` +
      `бөлік ${status.chunks} | қалды ${status.pending}`
  );
}

if (!hasVectorSearch()) {
  console.error(
    hasEmbeddingProvider()
      ? "TURSO_DATABASE_URL берілмеген."
      : "Эмбеддинг қызметінің кілті берілмеген (CLOUDFLARE_AI_TOKEN немесе Gemini)."
  );
  process.exit(1);
}

console.log(`қызмет: ${getEmbeddingProvider()}`);
console.log("бастапқы күй:");
report(await getIndexStatus());

if (flag("status")) {
  process.exit(0);
}

const startedAt = Date.now();
let lastShown = 0;

const result = await runIndexing({
  limit,
  prune: !flag("no-prune"),
  onProgress: ({ done, total, chunks, title }) => {
    // Әр тақырыпты жазбаймыз: 2 282 жол логты тұншықтырады
    const now = Date.now();
    if (done === total || now - lastShown > 15000) {
      lastShown = now;
      const minutes = (now - startedAt) / 60000;
      const rate = done / Math.max(minutes, 0.01);
      const left = rate > 0 ? Math.round((total - done) / rate) : 0;
      console.log(
        `  ${done}/${total} | ${chunks} бөлік | ${rate.toFixed(1)} тақырып/мин | ` +
          `болжам ${left} мин | ${title.slice(0, 40)}`
      );
    }
  }
});

const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);
console.log(
  `\nиндекстелді: ${result.indexed} тақырып, ${result.chunks} бөлік | ` +
    `өткізілді ${result.skipped} | тазаланды ${result.removed} | қалды ${result.pending} | ${minutes} мин`
);

// Өзін-өзі тексеру: күйді базадан қайта оқып көрсетеміз
console.log("соңғы күй:");
const final = await getIndexStatus();
report(final);

if (final.pending > 0) {
  console.log(`\n${final.pending} тақырып қалды — скриптті қайта қосуға болады.`);
}

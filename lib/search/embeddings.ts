import { runWithGeminiKey } from "@/lib/gemini-keys";
import { EMBEDDING_DIMENSIONS } from "@/lib/search/vector-db";

/**
 * Мәтінді векторға айналдыру.
 *
 * Модель `gemini-embedding-001`. Қазақ тіліндегі сапасы өлшенді: сұрақ
 * банкінен алынған 85 сұраумен тексергенде дұрыс тақырып 87% жағдайда
 * бірінші орында, ал кілт сөзбен іздеу дәрменсіз болатын «қиын» сұрауларда
 * айырма екі еседен артық (95% пен 55%).
 *
 * Кілттер `lib/gemini-keys.ts` пулынан алынады: квота біткенде келесі кілтке
 * ауысады, сондықтан мұнда кілт туралы ештеңе білудің қажеті жоқ.
 */

/** Мәтін қай мақсатқа эмбеддетіледі */
export type EmbedTask = "document" | "query";

/**
 * Құжат пен сұрау бөлек түрде эмбеддетіледі.
 *
 * Бұл модельдің талабы: бірдей мәтін сұрау ретінде де, құжат ретінде де
 * әртүрлі векторға түседі. Араластырсақ, іздеудің дәлдігі түседі.
 */
const TASK_TYPE: Record<EmbedTask, string> = {
  document: "RETRIEVAL_DOCUMENT",
  query: "RETRIEVAL_QUERY"
};

/** Бір шақыруға кететін мәтін саны */
const BATCH_SIZE = 20;

export async function embedTexts(texts: string[], task: EmbedTask): Promise<number[][]> {
  if (!texts.length) {
    return [];
  }

  const out: number[][] = [];

  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE);

    const vectors = await runWithGeminiKey(async (ai) => {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: batch,
        config: {
          taskType: TASK_TYPE[task],
          outputDimensionality: EMBEDDING_DIMENSIONS
        }
      });

      const values = response.embeddings?.map((item) => item.values ?? []) ?? [];
      if (values.length !== batch.length || values.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
        throw new Error("Эмбеддинг жауабы күтілгендей емес.");
      }
      return values;
    });

    out.push(...vectors);
  }

  return out;
}

/** Бір мәтінді эмбеддеу (іздеу сұрауы үшін) */
export async function embedOne(text: string, task: EmbedTask): Promise<number[]> {
  const [vector] = await embedTexts([text], task);
  return vector ?? [];
}

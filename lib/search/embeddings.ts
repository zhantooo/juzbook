import { runWithGeminiKey } from "@/lib/gemini-keys";

/**
 * Мәтінді векторға айналдыру.
 *
 * Екі қызмет қолдау табады, біреуі таңдалады. Қазақ тіліндегі сапасы
 * өлшенді: сұрақ банкінен алынған 85 сұраумен, 200 тақырыптың ішінен
 * дұрысын табу бойынша —
 *
 *   Gemini embedding-001 : Recall@1 87,1% | қиын сұрауларда 95,2%
 *   Cloudflare BGE-M3    : Recall@1 85,9% | қиын сұрауларда 90,5%
 *
 * Әдепкісі — Cloudflare. Себебі сапа емес, квота: Gemini кілттері сұрақ
 * банкін құрастыруға және оқушының тест жасауына керек, ал іздеу оларды
 * жеп қоймауы тиіс. Bge-m3-тің тегін шегі (күніне 10 000 нейрон) бүкіл
 * каталогты индекстеуге де, күнделікті іздеуге де молынан жетеді.
 */

export type EmbeddingProvider = "cloudflare" | "gemini";

/** Әр қызметтің векторының өлшемі — араластыруға болмайды */
const DIMENSIONS: Record<EmbeddingProvider, number> = {
  cloudflare: 1024,
  gemini: 768
};

export function getEmbeddingProvider(): EmbeddingProvider {
  const configured = process.env.SEARCH_EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (configured === "gemini") {
    return "gemini";
  }
  return "cloudflare";
}

export function getEmbeddingDimensions(): number {
  return DIMENSIONS[getEmbeddingProvider()];
}

/** Қызмет қолжетімді ме */
export function hasEmbeddingProvider(): boolean {
  if (getEmbeddingProvider() === "gemini") {
    return true;
  }
  return Boolean(cloudflareAccountId() && process.env.CLOUDFLARE_AI_TOKEN?.trim());
}

function cloudflareAccountId(): string {
  // R2 де, Workers AI де бір аккаунтта — екінші айнымалы қоюдың қажеті жоқ
  return (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "").trim();
}

/** Мәтін қай мақсатқа эмбеддетіледі */
export type EmbedTask = "document" | "query";

/**
 * Құжат пен сұрау бөлек түрде эмбеддетіледі.
 *
 * Gemini-дің талабы: бірдей мәтін сұрау ретінде де, құжат ретінде де
 * әртүрлі векторға түседі. BGE-M3-те мұндай бөліну жоқ, сондықтан ол
 * параметрді елемейді.
 */
const GEMINI_TASK: Record<EmbedTask, string> = {
  document: "RETRIEVAL_DOCUMENT",
  query: "RETRIEVAL_QUERY"
};

/** Бір шақыруға кететін мәтін саны */
const BATCH_SIZE: Record<EmbeddingProvider, number> = {
  cloudflare: 25,
  gemini: 20
};

async function embedWithGemini(batch: string[], task: EmbedTask): Promise<number[][]> {
  return runWithGeminiKey(async (ai) => {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: batch,
      config: { taskType: GEMINI_TASK[task], outputDimensionality: DIMENSIONS.gemini }
    });

    const values = response.embeddings?.map((item) => item.values ?? []) ?? [];
    if (values.length !== batch.length) {
      throw new Error("Эмбеддинг жауабы күтілгендей емес.");
    }
    return values;
  });
}

async function embedWithCloudflare(batch: string[]): Promise<number[][]> {
  const accountId = cloudflareAccountId();
  const token = process.env.CLOUDFLARE_AI_TOKEN?.trim();

  if (!accountId || !token) {
    throw new Error("CLOUDFLARE_AI_TOKEN немесе аккаунт идентификаторы берілмеген.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text: batch })
    }
  );

  const payload = (await response.json()) as {
    success?: boolean;
    result?: { data?: number[][] };
    errors?: unknown;
  };

  if (!response.ok || !payload.success || !payload.result?.data) {
    throw new Error(`Workers AI қатесі: ${JSON.stringify(payload.errors ?? payload).slice(0, 200)}`);
  }

  return payload.result.data;
}

/** Қайталап көру: желі үзілуі мен уақытша шектеу өтпелі жағдай */
async function withRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }
  }

  throw lastError;
}

export async function embedTexts(texts: string[], task: EmbedTask): Promise<number[][]> {
  if (!texts.length) {
    return [];
  }

  const provider = getEmbeddingProvider();
  const size = BATCH_SIZE[provider];
  const expected = DIMENSIONS[provider];
  const out: number[][] = [];

  for (let index = 0; index < texts.length; index += size) {
    const batch = texts.slice(index, index + size);

    const vectors = await withRetry(() =>
      provider === "gemini" ? embedWithGemini(batch, task) : embedWithCloudflare(batch)
    );

    if (vectors.length !== batch.length || vectors.some((vector) => vector.length !== expected)) {
      throw new Error("Эмбеддингтің өлшемі күтілгендей емес.");
    }

    out.push(...vectors);
  }

  return out;
}

/** Бір мәтінді эмбеддеу (іздеу сұрауы үшін) */
export async function embedOne(text: string, task: EmbedTask): Promise<number[]> {
  const [vector] = await embedTexts([text], task);
  return vector ?? [];
}

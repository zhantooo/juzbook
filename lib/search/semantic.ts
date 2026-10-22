import { embedOne } from "@/lib/search/embeddings";
import { VECTOR_INDEX, getSearchDb, hasVectorSearch, toVectorText } from "@/lib/search/vector-db";

/**
 * Мағына бойынша іздеу.
 *
 * Сұрау векторға айналады да, ең жақын бөліктер Turso-дың векторлық
 * индексінен алынады. Нәтиже тақырып деңгейіне жиналады: бір тақырыптың
 * бірнеше бөлігі табылса, ең жақыны ғана есептеледі.
 */

export type SemanticHit = {
  chapterId: string;
  /** 0-ден 1-ге дейін: үлкені — жақынырақ */
  score: number;
  /** Табылған бөліктің мәтіні — үзінді көрсетуге жарайды */
  text: string;
};

/**
 * Индекстен қанша бөлік алынады.
 *
 * Векторлық индекс пәнге қарамай ең жақындарын береді, ал бізге бір пәннің
 * ішіндегісі керек. Сондықтан артығымен алып, сосын сүземіз — әйтпесе
 * сүзгіден кейін қолда ештеңе қалмай қалуы мүмкін.
 */
const CANDIDATES = 300;

export async function semanticSearch(options: {
  term: string;
  subjectId: string;
  limit?: number;
}): Promise<SemanticHit[]> {
  const { term, subjectId, limit = 24 } = options;

  const db = getSearchDb();
  if (!db || !hasVectorSearch()) {
    return [];
  }

  const vector = await embedOne(term, "query");
  if (!vector.length) {
    return [];
  }

  const query = toVectorText(vector);

  const rows = await db.execute({
    sql: `
      SELECT c.chapterId AS chapterId,
             c.text AS text,
             vector_distance_cos(c.embedding, vector32(?)) AS distance
      FROM vector_top_k(?, vector32(?), ?) AS v
      JOIN SearchChunk c ON c.rowid = v.id
      WHERE c.subjectId = ?
      ORDER BY distance ASC
      LIMIT ?
    `,
    args: [query, VECTOR_INDEX, query, CANDIDATES, subjectId, limit * 3]
  });

  // Бір тақырыптың бірнеше бөлігі табылуы мүмкін — ең жақынын қалдырамыз
  const best = new Map<string, SemanticHit>();

  for (const row of rows.rows) {
    const chapterId = String(row.chapterId);
    const distance = Number(row.distance);
    const score = 1 - distance;

    const current = best.get(chapterId);
    if (!current || score > current.score) {
      best.set(chapterId, { chapterId, score, text: String(row.text) });
    }
  }

  return [...best.values()].sort((first, second) => second.score - first.score).slice(0, limit);
}

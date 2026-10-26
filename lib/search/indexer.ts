import type { InValue } from "@libsql/client";
import { prisma } from "@/lib/prisma";
import { hashChapter, splitIntoChunks } from "@/lib/search/chunking";
import { embedTexts, getEmbeddingDimensions, getEmbeddingProvider } from "@/lib/search/embeddings";
import { VECTOR_INDEX, getSearchDb, toVectorText } from "@/lib/search/vector-db";

/**
 * Мағыналық іздеудің индексін құрады және жаңартып отырады.
 *
 * Талаптар (AGENTS.md 7): қайта қосуға болады, қайталамайды, ештеңені
 * жоғалтпайды, өзін-өзі тексереді.
 *
 * Қалай жаңарып отырады: әр тақырыптың мазмұнының таңбасы (`contentHash`)
 * сақталады. Жаңа кітап қосылса немесе әкімші мәтінді өңдесе, таңба
 * өзгереді де, индекстеуші сол тақырыпты ғана қайта эмбеддейді. Сондықтан
 * кітап қосылған сайын бүкіл банкті қайта құрудың қажеті жоқ.
 */

/** Бір уақытта өңделетін тақырып саны */
const INDEX_CONCURRENCY = 4;

export type IndexProgress = {
  chapterId: string;
  title: string;
  chunks: number;
  done: number;
  total: number;
};

export type IndexResult = {
  indexed: number;
  chunks: number;
  skipped: number;
  removed: number;
  pending: number;
};

/**
 * Кестелер мен векторлық индекс.
 *
 * Эмбеддинг қызметі ауысса, ескі векторлар жарамсыз болады: әр модельдің
 * векторы өз кеңістігінде тұрады да, арақашықтықты салыстыру мағынасын
 * жоғалтады. Әрі өлшемі де басқа. Сондықтан қолданылған қызмет пен өлшем
 * жазылып отырады: сәйкес келмесе, индекс толық тазаланып, нөлден құрылады.
 * Бұл жай ғана қолайлылық емес — араласып кеткен индекс үнсіз жұмыс істейді
 * де, нәтижесі мәнсіз болады.
 */
export async function ensureSearchSchema(): Promise<void> {
  const db = getSearchDb();
  if (!db) {
    throw new Error("TURSO_DATABASE_URL берілмеген.");
  }

  const provider = getEmbeddingProvider();
  const dimensions = getEmbeddingDimensions();

  await db.execute(
    `CREATE TABLE IF NOT EXISTS SearchMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );

  const meta = await db.execute("SELECT key, value FROM SearchMeta");
  const stored = new Map(meta.rows.map((row) => [String(row.key), String(row.value)]));

  /**
   * Кестенің өз сипаттамасынан өлшемді оқимыз.
   *
   * Мета-жазбаға ғана сенуге болмайды: кесте бұрын жазба қоймай құрылған
   * болуы мүмкін. Ал `F32_BLOB(768)` деп жарияланған бағанға 1024 өлшемді
   * вектор жазылмайды — қате кеш шығады.
   */
  const ddl = await db.execute(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'SearchChunk'"
  );
  const declared = /F32_BLOB\s*\(\s*(\d+)\s*\)/i.exec(String(ddl.rows[0]?.sql ?? ""))?.[1];

  const changed =
    (declared !== undefined && declared !== String(dimensions)) ||
    (stored.size > 0 &&
      (stored.get("provider") !== provider || stored.get("dimensions") !== String(dimensions)));

  if (changed) {
    await db.batch(
      [
        `DROP INDEX IF EXISTS ${VECTOR_INDEX}`,
        "DROP TABLE IF EXISTS SearchChunk",
        "DROP TABLE IF EXISTS SearchChapterState"
      ],
      "write"
    );
  }

  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS SearchChunk (
        id TEXT PRIMARY KEY,
        chapterId TEXT NOT NULL,
        bookId TEXT NOT NULL,
        subjectId TEXT NOT NULL,
        position INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding F32_BLOB(${dimensions}) NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS SearchChunk_chapter_idx ON SearchChunk(chapterId)`,
      `CREATE INDEX IF NOT EXISTS SearchChunk_subject_idx ON SearchChunk(subjectId)`,
      `CREATE INDEX IF NOT EXISTS ${VECTOR_INDEX} ON SearchChunk(libsql_vector_idx(embedding))`,
      `CREATE TABLE IF NOT EXISTS SearchChapterState (
        chapterId TEXT PRIMARY KEY,
        contentHash TEXT NOT NULL,
        chunkCount INTEGER NOT NULL,
        indexedAt TEXT NOT NULL
      )`
    ],
    "write"
  );

  await db.batch(
    [
      { sql: "INSERT INTO SearchMeta (key, value) VALUES ('provider', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [provider] },
      { sql: "INSERT INTO SearchMeta (key, value) VALUES ('dimensions', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [String(dimensions)] }
    ],
    "write"
  );
}

type ChapterRow = {
  id: string;
  title: string;
  content: string;
  bookId: string;
  book: { subjectId: string };
};

/** Индекске кіруге тиіс тақырыптар: жасырылмаған кітаптағы жасырылмаған тақырып */
async function loadVisibleChapters(): Promise<ChapterRow[]> {
  return prisma.chapter.findMany({
    where: { isHidden: false, book: { isHidden: false, subject: { isHidden: false } } },
    select: {
      id: true,
      title: true,
      content: true,
      bookId: true,
      book: { select: { subjectId: true } }
    },
    orderBy: { id: "asc" }
  });
}

/** Қазір индексте не бар */
async function loadState(): Promise<Map<string, string>> {
  const db = getSearchDb();
  if (!db) {
    return new Map();
  }

  const rows = await db.execute("SELECT chapterId, contentHash FROM SearchChapterState");
  return new Map(rows.rows.map((row) => [String(row.chapterId), String(row.contentHash)]));
}

/** Бір тақырыптың бөліктерін жазады (бұрынғысын ауыстырып) */
async function writeChapter(chapter: ChapterRow, vectors: number[][], texts: string[], hash: string) {
  const db = getSearchDb();
  if (!db) {
    return;
  }

  const statements: Array<{ sql: string; args: InValue[] }> = [
    { sql: "DELETE FROM SearchChunk WHERE chapterId = ?", args: [chapter.id] }
  ];

  texts.forEach((text, position) => {
    statements.push({
      sql: `INSERT INTO SearchChunk (id, chapterId, bookId, subjectId, position, text, embedding)
            VALUES (?, ?, ?, ?, ?, ?, vector32(?))`,
      args: [
        `${chapter.id}:${position}`,
        chapter.id,
        chapter.bookId,
        chapter.book.subjectId,
        position,
        text,
        toVectorText(vectors[position])
      ]
    });
  });

  statements.push({
    sql: `INSERT INTO SearchChapterState (chapterId, contentHash, chunkCount, indexedAt)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(chapterId) DO UPDATE SET
            contentHash = excluded.contentHash,
            chunkCount = excluded.chunkCount,
            indexedAt = excluded.indexedAt`,
    args: [chapter.id, hash, texts.length, new Date().toISOString()]
  });

  await db.batch(statements, "write");
}

/** Дерекқордан жоғалған тақырыптардың бөліктерін тазалайды */
async function pruneRemoved(visibleIds: Set<string>): Promise<number> {
  const db = getSearchDb();
  if (!db) {
    return 0;
  }

  const rows = await db.execute("SELECT chapterId FROM SearchChapterState");
  const stale = rows.rows.map((row) => String(row.chapterId)).filter((id) => !visibleIds.has(id));

  if (!stale.length) {
    return 0;
  }

  // Параметр саны шектеулі, сондықтан шағын топтармен
  for (let index = 0; index < stale.length; index += 100) {
    const batch = stale.slice(index, index + 100);
    const holes = batch.map(() => "?").join(", ");
    await db.batch(
      [
        { sql: `DELETE FROM SearchChunk WHERE chapterId IN (${holes})`, args: batch },
        { sql: `DELETE FROM SearchChapterState WHERE chapterId IN (${holes})`, args: batch }
      ],
      "write"
    );
  }

  return stale.length;
}

/**
 * Индексті жаңартады.
 *
 * `limit` — бір жүгірісте қанша тақырып өңделеді. Әкімші маршруты оны кіші
 * етіп береді (сұраныс тым ұзаққа созылмауы үшін), ал скрипт шектеусіз
 * жүргізе алады. Қалғаны `pending` болып қайтады да, келесі жүгіріс соларды
 * алады — үзіліп қалса, жалғастыра беруге келеді.
 */
export async function runIndexing(options: {
  limit?: number;
  prune?: boolean;
  onProgress?: (progress: IndexProgress) => void;
} = {}): Promise<IndexResult> {
  const { limit = Number.POSITIVE_INFINITY, prune = true, onProgress } = options;

  await ensureSearchSchema();

  const chapters = await loadVisibleChapters();
  const state = await loadState();
  const visibleIds = new Set(chapters.map((chapter) => chapter.id));

  const pendingChapters = chapters.filter(
    (chapter) => state.get(chapter.id) !== hashChapter(chapter.title, chapter.content)
  );

  const batch = pendingChapters.slice(0, Math.max(0, limit));

  let indexed = 0;
  let chunks = 0;

  /**
   * Тақырыптар қатар өңделеді.
   *
   * Бір тақырыпқа екі желілік сапар кетеді: бірі эмбеддеуге, екіншісі
   * Turso-ға жазуға. Екісі де күтуден тұрады, есептеуден емес, сондықтан
   * реттілікпен жүргенде уақыттың басы босқа кетеді. Төртеуін қатар
   * жібергенде бүкіл каталог сағаттардың орнына бірден аз уақытта бітеді.
   *
   * Артық қатардың қажеті жоқ: тегін Workers AI шектеуі бар, артық қыссаң
   * 429 қайтарады да, қайта күтуге кеткен уақыт үнемделгенін жоқ қылады.
   */
  let cursor = 0;

  async function processOne(chapter: ChapterRow) {
    const pieces = splitIntoChunks(chapter.title, chapter.content);
    const hash = hashChapter(chapter.title, chapter.content);

    if (!pieces.length) {
      // Мазмұны бос тақырып та белгіленеді, әйтпесе әр жүгірісте қайта келеді
      await writeChapter(chapter, [], [], hash);
      indexed += 1;
      return;
    }

    const texts = pieces.map((piece) => piece.text);
    const vectors = await embedTexts(texts, "document");
    await writeChapter(chapter, vectors, texts, hash);

    indexed += 1;
    chunks += texts.length;
    onProgress?.({
      chapterId: chapter.id,
      title: chapter.title,
      chunks: texts.length,
      done: indexed,
      total: batch.length
    });
  }

  async function worker() {
    for (;;) {
      const chapter = batch[cursor];
      cursor += 1;
      if (!chapter) {
        return;
      }
      await processOne(chapter);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(INDEX_CONCURRENCY, batch.length) }, () => worker())
  );

  const removed = prune ? await pruneRemoved(visibleIds) : 0;

  return {
    indexed,
    chunks,
    skipped: chapters.length - pendingChapters.length,
    removed,
    pending: Math.max(0, pendingChapters.length - batch.length)
  };
}

/**
 * Бір тақырыпты бірден қайта индекстейді.
 *
 * Әкімші мәтінді өңдегенде шақырылады: түнгі жүгірісті күтпей-ақ, өзгеріс
 * іздеуде сол сәтте көрінеді. Бүкіл каталогты оқымайды — тек сол тақырыпты.
 */
export async function indexChapter(chapterId: string): Promise<boolean> {
  const db = getSearchDb();
  if (!db) {
    return false;
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, isHidden: false, book: { isHidden: false, subject: { isHidden: false } } },
    select: {
      id: true,
      title: true,
      content: true,
      bookId: true,
      book: { select: { subjectId: true } }
    }
  });

  await ensureSearchSchema();

  // Тақырып жасырылған немесе өшірілген болса — индекстен де алып тастаймыз
  if (!chapter) {
    await db.batch(
      [
        { sql: "DELETE FROM SearchChunk WHERE chapterId = ?", args: [chapterId] },
        { sql: "DELETE FROM SearchChapterState WHERE chapterId = ?", args: [chapterId] }
      ],
      "write"
    );
    return true;
  }

  const pieces = splitIntoChunks(chapter.title, chapter.content);
  const hash = hashChapter(chapter.title, chapter.content);
  const texts = pieces.map((piece) => piece.text);
  const vectors = texts.length ? await embedTexts(texts, "document") : [];

  await writeChapter(chapter, vectors, texts, hash);
  return true;
}

/** Индекстің жай-күйі — әкімшіге көрсету үшін */
export async function getIndexStatus(): Promise<{
  chapters: number;
  indexedChapters: number;
  chunks: number;
  pending: number;
}> {
  const db = getSearchDb();
  const chapters = await loadVisibleChapters();

  if (!db) {
    return { chapters: chapters.length, indexedChapters: 0, chunks: 0, pending: chapters.length };
  }

  await ensureSearchSchema();
  const state = await loadState();
  const counted = await db.execute("SELECT COUNT(*) AS n FROM SearchChunk");

  const pending = chapters.filter(
    (chapter) => state.get(chapter.id) !== hashChapter(chapter.title, chapter.content)
  ).length;

  return {
    chapters: chapters.length,
    indexedChapters: state.size,
    chunks: Number(counted.rows[0]?.n ?? 0),
    pending
  };
}

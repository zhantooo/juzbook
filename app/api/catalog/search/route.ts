import { Prisma, prisma } from "@/lib/prisma";
import { buildHighlightedSearchSnippet } from "@/lib/search-preview";
import { FOLD_FROM, FOLD_TO, escapeLikePattern, splitSearchWords } from "@/lib/search-folding";
import { semanticSearch } from "@/lib/search/semantic";
import { hasVectorSearch } from "@/lib/search/vector-db";

export const runtime = "nodejs";

const RESULT_LIMIT = 24;

type SearchRow = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  bookId: string;
  bookTitle: string;
  bookSubjectId: string;
  titleHit: boolean;
};

/**
 * Екі іздеу біріктіріледі.
 *
 * Кілт сөзбен іздеу нақты атауда дәлірек («Тәуке хан», «1465 жыл»), ал
 * мағыналық іздеу оқушы өз сөзімен сұрағанда дәлірек. Өлшеп көргенде
 * айырма айқын болды: мәтінмен сөзі аз қабысатын сұрауларда кілт сөз
 * 55%, ал эмбеддинг 95% дәлдік берді. Сондықтан екеуі де жүргізіледі.
 *
 * Реттілік: кілт сөзбен табылғандар жоғары тұрады (олар әдетте дәл сәйкес),
 * ал мағына бойынша ғана табылғандар соңынан қосылады. Мағыналық іздеу
 * істемей қалса (кілт жоқ, квота бітті), бет бұрынғыдай жұмыс істей береді.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = (searchParams.get("q") || "").trim();
    const subjectId = (searchParams.get("subjectId") || "").trim();

    if (term.length < 2 || !subjectId) {
      return Response.json({ results: [] });
    }

    const words = splitSearchWords(term);
    if (!words.length) {
      return Response.json({ results: [] });
    }

    const folded = (column: string) =>
      Prisma.sql`translate(lower(${Prisma.raw(column)}), ${FOLD_FROM}, ${FOLD_TO})`;

    const titlePattern = `%${escapeLikePattern(words[0])}%`;

    /**
     * `LIKE '%сөз%'` жай индексті пайдалана алмайды — іздеу сөзі мәтіннің
     * ортасынан келеді. Сондықтан `scripts/search_text_index.mjs` дәл осы
     * өрнекке (`translate(lower(...))`) үшграммалық GIN индексін қояды.
     * Индекс пен сұраудың өрнегі бірдей болуы міндетті: сәл айырмашылық
     * болса, жоспарлаушы индексті елемей, бүкіл кестені оқиды.
     *
     * Назар аудар: сұрау `Prisma.sql` арқылы құрылып, `$queryRaw`-қа
     * **аргумент** болып беріледі. Тегтелген шаблон түрінде жазсаң,
     * Prisma әр `${}`-ны параметр деп санайды да, ұя салынған SQL
     * үзінділерін JSON-ға айналдырып жібереді.
     */
    const runKeyword = () => {
      const wordConditions = words.map((word) => {
        const pattern = `%${escapeLikePattern(word)}%`;
        return Prisma.sql`(
          ${folded('c."title"')} LIKE ${pattern} ESCAPE '\\'
          OR ${folded('c."excerpt"')} LIKE ${pattern} ESCAPE '\\'
          OR ${folded('c."content"')} LIKE ${pattern} ESCAPE '\\'
        )`;
      });

      return prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT
        c."id",
        c."title",
        c."excerpt",
        c."content",
        c."bookId",
        b."title" AS "bookTitle",
        b."subjectId" AS "bookSubjectId",
        (${folded('c."title"')} LIKE ${titlePattern} ESCAPE '\\') AS "titleHit"
      FROM "Chapter" c
      JOIN "Book" b ON b."id" = c."bookId"
      WHERE c."isHidden" = false
        AND b."isHidden" = false
        AND b."subjectId" = ${subjectId}
        AND ${Prisma.join(wordConditions, " AND ")}
      ORDER BY "titleHit" DESC, c."order" ASC
      LIMIT ${RESULT_LIMIT}
    `);
    };

    // Мағыналық іздеу қосымша: құласа да, кілт сөз нәтижесі қалады
    const semanticPromise = hasVectorSearch()
      ? semanticSearch({ term, subjectId, limit: RESULT_LIMIT }).catch(() => [])
      : Promise.resolve([]);

    const [keywordRows, semanticHits] = await Promise.all([runKeyword(), semanticPromise]);

    const seen = new Set(keywordRows.map((row) => row.id));
    const extraIds = semanticHits
      .filter((hit) => !seen.has(hit.chapterId))
      .slice(0, RESULT_LIMIT)
      .map((hit) => hit.chapterId);

    let extraRows: SearchRow[] = [];
    if (extraIds.length) {
      const rows = await prisma.chapter.findMany({
        where: { id: { in: extraIds }, isHidden: false, book: { isHidden: false, subjectId } },
        select: {
          id: true,
          title: true,
          excerpt: true,
          content: true,
          bookId: true,
          book: { select: { title: true, subjectId: true } }
        }
      });

      const order = new Map(extraIds.map((id, index) => [id, index]));
      extraRows = rows
        .sort((first, second) => (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0))
        .map((row) => ({
          id: row.id,
          title: row.title,
          excerpt: row.excerpt,
          content: row.content,
          bookId: row.bookId,
          bookTitle: row.book.title,
          bookSubjectId: row.book.subjectId,
          titleHit: false
        }));
    }

    const semanticTextById = new Map(semanticHits.map((hit) => [hit.chapterId, hit.text]));

    const results = [...keywordRows, ...extraRows].slice(0, RESULT_LIMIT).map((chapter) => {
      // Үзінді ең алдымен тақырып мәтінінен құрылады: `data-hit` нөмірлері оқу
      // бетіндегі мәтінмен дәл сәйкес келуі керек.
      const contentSnippet = buildHighlightedSearchSnippet(chapter.content, term);
      let excerpt = contentSnippet.includes("<mark")
        ? contentSnippet
        : buildHighlightedSearchSnippet(`${chapter.excerpt} ${chapter.content}`, term);

      // Мағына бойынша ғана табылған тақырыпта сөз сөзбе-сөз кездеспеуі
      // мүмкін — ондайда табылған бөліктің өзін көрсетеміз
      if (!excerpt.includes("<mark") && semanticTextById.has(chapter.id)) {
        excerpt = `${semanticTextById.get(chapter.id)!.slice(0, 220)}…`;
      }

      return {
        id: `${chapter.bookId}-${chapter.id}`,
        bookId: chapter.bookId,
        chapterId: chapter.id,
        subjectId: chapter.bookSubjectId,
        bookTitle: chapter.bookTitle,
        chapterTitle: chapter.title,
        excerpt
      };
    });

    return Response.json({ results });
  } catch (error) {
    return Response.json(
      {
        results: [],
        error: error instanceof Error ? error.message : "Іздеу кезінде қате пайда болды."
      },
      { status: 500 }
    );
  }
}

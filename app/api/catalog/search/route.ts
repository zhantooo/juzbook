import { Prisma, prisma } from "@/lib/prisma";
import { buildHighlightedSearchSnippet } from "@/lib/search-preview";
import { FOLD_FROM, FOLD_TO, escapeLikePattern, splitSearchWords } from "@/lib/search-folding";

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

    /**
     * Іздеу әріп бүктеумен жүреді.
     *
     * Оқушы «Тауке хан» деп жазса да, кітаптағы «Тәуке хан» табылуы керек:
     * қазақ әліпбиінің тоғыз әрпі жиі орыс әліпбиіндегі ұқсасымен
     * алмастырылады. Сондықтан екі жақты да `translate()` арқылы бір түрге
     * келтіреміз — қосымша кеңейтім керек емес.
     *
     * Әр сөз бөлек ізделеді де, бәрі табылуы талап етіледі. Сол себепті
     * сөздердің реті маңызды емес, ал артық сөз нәтижені шектейді.
     */
    const folded = (column: string) =>
      Prisma.sql`translate(lower(${Prisma.raw(column)}), ${FOLD_FROM}, ${FOLD_TO})`;

    const wordConditions = words.map((word) => {
      const pattern = `%${escapeLikePattern(word)}%`;
      return Prisma.sql`(
        ${folded('c."title"')} LIKE ${pattern} ESCAPE '\\'
        OR ${folded('c."excerpt"')} LIKE ${pattern} ESCAPE '\\'
        OR ${folded('c."content"')} LIKE ${pattern} ESCAPE '\\'
      )`;
    });

    // Тақырып атауында табылғаны жоғары тұруы керек
    const titlePattern = `%${escapeLikePattern(words[0])}%`;

    /**
     * Назар аудар: сұрау `Prisma.sql` арқылы құрылып, `$queryRaw`-қа
     * **аргумент** болып беріледі. Тегтелген шаблон түрінде жазсаң
     * (`$queryRaw\`...\``), Prisma әр `${}`-ны параметр деп санайды да,
     * ұя салынған SQL үзінділерін JSON-ға айналдырып жібереді. Қате сонда
     * «оператор не существует: jsonb ~~ text» болып шығады.
     */
    const rows = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
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

    const results = rows.map((chapter) => {
      // Үзінді ең алдымен тақырып мәтінінен құрылады: `data-hit` нөмірлері оқу
      // бетіндегі мәтінмен дәл сәйкес келуі керек. Мәтінде табылмаса ғана
      // қысқаша сипаттама қосылады (ол жерде сөзге өту болмайды).
      const contentSnippet = buildHighlightedSearchSnippet(chapter.content, term);
      const excerpt = contentSnippet.includes("<mark")
        ? contentSnippet
        : buildHighlightedSearchSnippet(`${chapter.excerpt} ${chapter.content}`, term);

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

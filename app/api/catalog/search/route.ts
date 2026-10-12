import { prisma } from "@/lib/prisma";
import { buildHighlightedSearchSnippet } from "@/lib/search-preview";

export const runtime = "nodejs";

const RESULT_LIMIT = 24;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = (searchParams.get("q") || "").trim();
    const subjectId = (searchParams.get("subjectId") || "").trim();

    if (term.length < 2 || !subjectId) {
      return Response.json({ results: [] });
    }

    const chapters = await prisma.chapter.findMany({
      where: {
        isHidden: false,
        book: { isHidden: false, subjectId },
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { excerpt: { contains: term, mode: "insensitive" } },
          { content: { contains: term, mode: "insensitive" } }
        ]
      },
      orderBy: { order: "asc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        title: true,
        excerpt: true,
        content: true,
        bookId: true,
        book: { select: { title: true, subjectId: true } }
      }
    });

    const results = chapters.map((chapter) => {
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
        subjectId: chapter.book.subjectId,
        bookTitle: chapter.book.title,
        chapterTitle: chapter.title,
        excerpt
      };
    });

    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { results: [], error: error instanceof Error ? error.message : "Іздеу мүмкін болмады." },
      { status: 500 }
    );
  }
}

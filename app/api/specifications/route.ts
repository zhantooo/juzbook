import { unstable_cache, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueTopicIds(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((item) => normalizeText(item)).filter(Boolean)));
}

/**
 * Спецификациялар әр бет ашылғанда сұралады, бірақ сирек өзгереді.
 * Сондықтан нәтиже кэштеледі де, әкімші өзгеріс енгізгенде тег арқылы жаңарады.
 */
const loadSpecifications = unstable_cache(
  async (subjectId: string) =>
    prisma.specification.findMany({
      where: subjectId ? { subjectId } : undefined,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        order: true,
        subjectId: true,
        topics: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            topicId: true,
            order: true,
            topic: {
              select: {
                id: true,
                title: true,
                excerpt: true,
                bookId: true,
                sectionId: true,
                sectionChapterId: true,
                book: { select: { title: true } },
                section: { select: { title: true } },
                sectionChapter: { select: { title: true } }
              }
            }
          }
        }
      }
    }),
  ["specifications-list"],
  { revalidate: 3600, tags: ["specifications"] }
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = normalizeText(searchParams.get("subjectId"));
    const specifications = await loadSpecifications(subjectId);

    return NextResponse.json({
      specifications: specifications.map((specification) => ({
        id: specification.id,
        title: specification.title,
        description: specification.description,
        order: specification.order,
        subjectId: specification.subjectId,
        topics: specification.topics.map((item) => ({
          id: item.id,
          topicId: item.topicId,
          title: item.topic.title,
          excerpt: item.topic.excerpt,
          bookId: item.topic.bookId,
          bookTitle: item.topic.book.title,
          sectionId: item.topic.sectionId ?? "",
          sectionTitle: item.topic.section?.title ?? "Бөлім",
          chapterGroupId: item.topic.sectionChapterId ?? "",
          chapterGroupTitle: item.topic.sectionChapter?.title ?? "Тақырыптар",
          order: item.order
        }))
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Спецификацияларды жүктеу мүмкін болмады." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const subjectId = normalizeText(body.subjectId);
    const title = normalizeText(body.title);
    const description = normalizeText(body.description);
    const topicIds = uniqueTopicIds(body.topicIds);

    if (!subjectId || !title) {
      return NextResponse.json({ error: "Спецификация атауы мен пәні міндетті." }, { status: 400 });
    }

    const lastSpec = await prisma.specification.findFirst({
      where: { subjectId },
      orderBy: { order: "desc" },
      select: { order: true }
    });

    const specification = await prisma.specification.create({
      data: {
        subjectId,
        title,
        description,
        order: (lastSpec?.order ?? 0) + 1,
        topics: {
          create: topicIds.map((topicId, index) => ({
            topicId,
            order: index + 1
          }))
        }
      },
      select: { id: true }
    });

    revalidateTag("specifications");

    return NextResponse.json({ ok: true, specificationId: specification.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Спецификацияны сақтау мүмкін болмады." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const specificationId = normalizeText(body.specificationId);
    const subjectId = normalizeText(body.subjectId);
    const title = normalizeText(body.title);
    const description = normalizeText(body.description);
    const topicIds = uniqueTopicIds(body.topicIds);

    if (!specificationId || !subjectId || !title) {
      return NextResponse.json({ error: "Спецификация деректері толық емес." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.specification.update({
        where: { id: specificationId },
        data: { subjectId, title, description }
      });

      await tx.specificationTopic.deleteMany({
        where: { specificationId }
      });

      if (topicIds.length) {
        await tx.specificationTopic.createMany({
          data: topicIds.map((topicId, index) => ({
            specificationId,
            topicId,
            order: index + 1
          }))
        });
      }
    });

    revalidateTag("specifications");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Спецификацияны жаңарту мүмкін болмады." },
      { status: 500 }
    );
  }
}

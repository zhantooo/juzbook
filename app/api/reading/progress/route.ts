import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/security/auth";

export const runtime = "nodejs";

const readingProgressSchema = z.object({
  bookId: z.string().trim().min(1, "Кітап идентификаторы қажет."),
  seconds: z.number().int().min(1).max(600)
});

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const rawBody = (await request.json()) as unknown;
    const parsedBody = readingProgressSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues[0]?.message || "Сұраныс дерегі жарамсыз." }, { status: 400 });
    }

    const { bookId, seconds } = parsedBody.data;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: authResult.user.id },
        data: {
          totalReadingSeconds: {
            increment: seconds
          }
        }
      }),
      prisma.bookReadingStat.upsert({
        where: {
          userId_bookId: {
            userId: authResult.user.id,
            bookId
          }
        },
        update: {
          totalSeconds: {
            increment: seconds
          }
        },
        create: {
          userId: authResult.user.id,
          bookId,
          totalSeconds: seconds
        }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Оқу уақытын сақтау мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

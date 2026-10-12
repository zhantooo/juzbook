import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/security/auth";

export const runtime = "nodejs";

const schema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        isCorrect: z.boolean()
      })
    )
    .min(1)
    .max(60)
});

/**
 * Оқушының қай сұраққа жауап бергенін сақтайды.
 * Осы жазба арқылы келесі тестте бұрын өткен сұрақтар қайталанбайды.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const parsed = schema.safeParse((await request.json()) as unknown);
    if (!parsed.success) {
      return NextResponse.json({ error: "Сұраныс деректері жарамсыз." }, { status: 400 });
    }

    const userId = auth.user.id;

    // Демо аккаунт дерекқорда болмаса, жазба жасалмайды — қате де шығармаймыз.
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!dbUser) {
      return NextResponse.json({ ok: true, saved: 0, skipped: "demo" });
    }

    await prisma.$transaction(
      parsed.data.answers.map((answer) =>
        prisma.questionAttempt.upsert({
          where: { userId_questionId: { userId, questionId: answer.questionId } },
          create: { userId, questionId: answer.questionId, isCorrect: answer.isCorrect },
          update: { isCorrect: answer.isCorrect }
        })
      )
    );

    return NextResponse.json({ ok: true, saved: parsed.data.answers.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Жауаптарды сақтау мүмкін болмады." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

const updateSchema = z.object({
  prompt: z.string().trim().min(5).optional(),
  options: z.array(z.string().trim().min(1)).length(4).optional(),
  answerIndex: z.number().int().min(0).max(3).optional(),
  explanation: z.string().trim().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional()
});

/** Әкімші сұрақты өңдейді */
export async function PATCH(request: Request, context: { params: Promise<{ questionId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { questionId } = await context.params;
    const parsed = updateSchema.safeParse((await request.json()) as unknown);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Дерек жарамсыз." }, { status: 400 });
    }

    await prisma.topicQuestion.update({ where: { id: questionId }, data: parsed.data });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Сұрақты жаңарту мүмкін болмады." },
      { status: 500 }
    );
  }
}

/** Әкімші сұрақты өшіреді */
export async function DELETE(request: Request, context: { params: Promise<{ questionId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { questionId } = await context.params;
    await prisma.topicQuestion.delete({ where: { id: questionId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Сұрақты өшіру мүмкін болмады." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "next/dist/compiled/zod";
import { revalidateCatalogViews } from "@/lib/catalog-db";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";
import { formatValidationError } from "@/lib/security/validation";

export const runtime = "nodejs";

const paramsSchema = z.object({
  bookId: z.string().trim().min(1, "Кітап ID көрсетілмеген.").max(120, "Кітап ID жарамсыз.")
});

export async function DELETE(request: Request, context: { params: Promise<{ bookId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: formatValidationError(parsedParams.error) }, { status: 400 });
  }

  try {
    const book = await prisma.book.findUnique({
      where: { id: parsedParams.data.bookId },
      select: { id: true, subjectId: true }
    });

    await prisma.book.delete({
      where: { id: parsedParams.data.bookId }
    });

    revalidateCatalogViews({
      subjectId: book?.subjectId,
      bookId: book?.id
    });

    return NextResponse.json({
      message: "Кітап базадан өшірілді."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Кітапты базадан өшіру мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

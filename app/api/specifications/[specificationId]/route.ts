import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ specificationId: string }> }
) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { specificationId } = await context.params;
    await prisma.specification.delete({
      where: { id: specificationId }
    });

    revalidateTag("specifications");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Спецификацияны өшіру мүмкін болмады." },
      { status: 500 }
    );
  }
}

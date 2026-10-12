import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/security/auth";
import { formatValidationError, highlightMutationSchema } from "@/lib/security/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ highlightId: string }> }) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { highlightId } = await context.params;
  const highlight = await prisma.highlight.findUnique({
    where: { id: highlightId },
    select: { id: true, userId: true }
  });

  if (!highlight) {
    return NextResponse.json({ error: "Маркер табылмады." }, { status: 404 });
  }

  if (highlight.userId !== auth.user.id) {
    return NextResponse.json({ error: "Бұл әрекетті орындауға рұқсат жоқ!" }, { status: 401 });
  }

  const parsedBody = highlightMutationSchema.safeParse((await request.json()) as unknown);
  if (!parsedBody.success) {
    return NextResponse.json({ error: formatValidationError(parsedBody.error) }, { status: 400 });
  }

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data: {
      selectedText: parsedBody.data.selectedText,
      color: parsedBody.data.color,
      paragraphId: parsedBody.data.paragraphId || null
    },
    select: {
      id: true,
      selectedText: true,
      color: true,
      paragraphId: true,
      createdAt: true
    }
  });

  return NextResponse.json({ highlight: updated });
}

export async function DELETE(request: Request, context: { params: Promise<{ highlightId: string }> }) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { highlightId } = await context.params;
  const highlight = await prisma.highlight.findUnique({
    where: { id: highlightId },
    select: { id: true, userId: true }
  });

  if (!highlight) {
    return NextResponse.json({ error: "Маркер табылмады." }, { status: 404 });
  }

  if (highlight.userId !== auth.user.id) {
    return NextResponse.json({ error: "Бұл әрекетті орындауға рұқсат жоқ!" }, { status: 401 });
  }

  await prisma.highlight.delete({
    where: { id: highlightId }
  });

  return NextResponse.json({ message: "Маркер өшірілді." });
}

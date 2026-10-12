import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/security/auth";
import { formatValidationError, noteMutationSchema } from "@/lib/security/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ noteId: string }> }) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { noteId } = await context.params;
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, userId: true }
  });

  if (!note) {
    return NextResponse.json({ error: "Конспект табылмады." }, { status: 404 });
  }

  if (note.userId !== auth.user.id) {
    return NextResponse.json({ error: "Бұл әрекетті орындауға рұқсат жоқ!" }, { status: 401 });
  }

  const parsedBody = noteMutationSchema.safeParse((await request.json()) as unknown);
  if (!parsedBody.success) {
    return NextResponse.json({ error: formatValidationError(parsedBody.error) }, { status: 400 });
  }

  const updated = await prisma.note.update({
    where: { id: noteId },
    data: {
      selectedText: parsedBody.data.selectedText || null,
      noteText: parsedBody.data.noteText,
      paragraphId: parsedBody.data.paragraphId || null
    },
    select: {
      id: true,
      selectedText: true,
      noteText: true,
      paragraphId: true,
      createdAt: true
    }
  });

  return NextResponse.json({ note: updated });
}

export async function DELETE(request: Request, context: { params: Promise<{ noteId: string }> }) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { noteId } = await context.params;
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, userId: true }
  });

  if (!note) {
    return NextResponse.json({ error: "Конспект табылмады." }, { status: 404 });
  }

  if (note.userId !== auth.user.id) {
    return NextResponse.json({ error: "Бұл әрекетті орындауға рұқсат жоқ!" }, { status: 401 });
  }

  await prisma.note.delete({
    where: { id: noteId }
  });

  return NextResponse.json({ message: "Конспект өшірілді." });
}

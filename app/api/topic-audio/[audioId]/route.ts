import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/security/auth";
import { getAudioStorageDir } from "@/lib/topic-audio";

export const runtime = "nodejs";

/** Әкімші дайын аудионы өшіреді (файл да жойылады) */
export async function DELETE(request: Request, context: { params: Promise<{ audioId: string }> }) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { audioId } = await context.params;
    const row = await prisma.topicAudio.findUnique({ where: { id: audioId }, select: { fileName: true } });

    if (!row) {
      return NextResponse.json({ error: "Аудио табылмады." }, { status: 404 });
    }

    await prisma.topicAudio.delete({ where: { id: audioId } });
    await fs.unlink(path.join(getAudioStorageDir(), path.basename(row.fileName))).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Аудионы өшіру мүмкін болмады." },
      { status: 500 }
    );
  }
}

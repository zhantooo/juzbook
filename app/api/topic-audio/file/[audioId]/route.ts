import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serveFileWithRange } from "@/lib/http-range";
import { requireAuthenticatedUser } from "@/lib/security/auth";
import { getAudioStorageDir } from "@/lib/topic-audio";

export const runtime = "nodejs";

/**
 * Дайын аудио файлын береді.
 * Файлдар public қалтасында емес, сондықтан оқу құқығы осы жерде тексеріледі.
 *
 * Беру `Range`-ті қолдайды — әйтпесе ойнатқыштың жүгірткісі жұмыс істемейді.
 */
export async function GET(request: Request, context: { params: Promise<{ audioId: string }> }) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { audioId } = await context.params;
    const row = await prisma.topicAudio.findUnique({
      where: { id: audioId },
      select: { fileName: true }
    });

    if (!row) {
      return NextResponse.json({ error: "Аудио табылмады." }, { status: 404 });
    }

    // Файл атауы дерекқордан келеді, бірақ қалтадан шығып кетпеуін бәрібір тексереміз
    const filePath = path.join(getAudioStorageDir(), path.basename(row.fileName));
    const response = await serveFileWithRange({
      filePath,
      contentType: "audio/mpeg",
      rangeHeader: request.headers.get("range")
    });

    if (!response) {
      return NextResponse.json({ error: "Аудио файлы жоқ. Қайта дайындау керек." }, { status: 404 });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Аудионы оқу мүмкін болмады." },
      { status: 500 }
    );
  }
}

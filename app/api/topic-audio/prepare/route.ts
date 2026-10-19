import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/security/auth";
import { AUDIO_VOICES, describeTopicAudio, prepareChapterAudio } from "@/lib/topic-audio";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  chapterId: z.string().trim().min(1),
  voice: z.enum(AUDIO_VOICES).default("kk-KZ-AigulNeural")
});

/**
 * Оқушының өтінішімен бір тақырыптың аудиосын дайындайды.
 *
 * Бұрын оқушы «аудио тыңдау» дегенде мәтін тікелей дыбысқа айналдырылып,
 * MP3 ағын болып қайтатын. Сол жолда сөздердің уақыт белгілері жоғалатын:
 * оқылып жатқан сөз мәтінде ерекшеленбейтін, ал файл сақталмағандықтан
 * келесі оқушы бәрін қайта күтетін.
 *
 * Енді әкімшінің алдын ала дайындауымен бір арна: аудио сақталады, сөз
 * белгілері дерекқорда қалады. Сондықтан бірінші тыңдаған оқушыдан кейін
 * тақырып бәріне бірден дайын болады.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Тақырып көрсетілмеген." }, { status: 400 });
  }

  try {
    const result = await prepareChapterAudio({
      chapterId: parsed.data.chapterId,
      voice: parsed.data.voice
    });

    return NextResponse.json({ ready: true, audio: describeTopicAudio(result.row) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Аудио дайындау мүмкін болмады." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/arena/engine";
import { answerRequestSchema } from "@/lib/arena/schemas";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Бір минутта қанша жауап қабылданады.
 *
 * Адал ойында бұл сан онға жетпейді: матчта он сұрақ бар, әрқайсысы
 * он бес секундтан. Қырық — қолмен тез басқан ойыншыға да, қатар жүрген
 * екі матчқа да жететін, бірақ скриптпен тасқын жіберуге жетпейтін шама.
 */
const ANSWERS_PER_MINUTE = 40;

/** POST — жауап жіберу. Уақытты сервер өлшейді. */
export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const limit = await enforceRateLimit("arena-answer", auth.viewer.id, ANSWERS_PER_MINUTE);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Тым жиі жауап жіберілуде. Сәл кідіріңіз." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const parsed = answerRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Жауап деректері жарамсыз." }, { status: 400 });
  }

  const { matchId } = await context.params;

  try {
    await submitAnswer(auth.viewer, matchId, parsed.data.position, parsed.data.chosenIndex);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return arenaError(error);
  }
}

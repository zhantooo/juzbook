import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/arena/engine";
import { answerRequestSchema } from "@/lib/arena/schemas";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — жауап жіберу. Уақытты сервер өлшейді. */
export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
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

import { NextResponse } from "next/server";
import { z } from "zod";
import { submitAnswer } from "@/lib/arena/engine";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  position: z.number().int().min(0).max(99),
  chosenIndex: z.number().int().min(0).max(9)
});

/** POST — жауап жіберу. Уақытты сервер өлшейді. */
export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
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

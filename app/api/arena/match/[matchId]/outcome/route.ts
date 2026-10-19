import { NextResponse } from "next/server";
import { getOutcome } from "@/lib/arena/engine";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — матч біткендегі қорытынды мен он сұрақтың талдауы */
export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { matchId } = await context.params;

  try {
    const outcome = await getOutcome(auth.viewer, matchId);
    return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return arenaError(error, 409);
  }
}

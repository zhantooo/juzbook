import { NextResponse } from "next/server";
import { getMatchState } from "@/lib/arena/engine";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — матчтың ағымдағы күйі.
 *
 * Клиент осы маршрутты жиі сұрайды (polling). Әр сұраныста матчтың уақыты
 * алға жылжиды, сондықтан фондық процесс керек емес.
 */
export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { matchId } = await context.params;

  try {
    const state = await getMatchState(auth.viewer, matchId);
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return arenaError(error, 404);
  }
}

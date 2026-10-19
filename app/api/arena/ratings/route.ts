import { NextResponse } from "next/server";
import { getHistory, getLeaderboard, getRatings } from "@/lib/arena/engine";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — рейтинг деректері.
 *
 *   ?view=ratings                → ойыншының барлық пәндегі рейтингі
 *   ?view=leaderboard&subjectId= → пән бойынша лидерлер
 *   ?view=history[&subjectId=]   → аяқталған матчтар
 */
export async function GET(request: Request) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const params = new URL(request.url).searchParams;
  const view = params.get("view")?.trim() || "ratings";
  const subjectId = params.get("subjectId")?.trim() || "";
  const limit = Number(params.get("limit") || "0") || undefined;

  try {
    if (view === "leaderboard") {
      if (!subjectId) {
        return NextResponse.json({ error: "Пән көрсетілмеген." }, { status: 400 });
      }
      return NextResponse.json({ rows: await getLeaderboard(auth.viewer, subjectId, limit) });
    }

    if (view === "history") {
      return NextResponse.json({ rows: await getHistory(auth.viewer, subjectId || undefined, limit) });
    }

    return NextResponse.json({ rows: await getRatings(auth.viewer) });
  } catch (error) {
    return arenaError(error);
  }
}

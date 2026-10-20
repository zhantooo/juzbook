import { NextResponse } from "next/server";
import { getHistory, getLeaderboard, getRatings } from "@/lib/arena/engine";
import { ratingsQuerySchema } from "@/lib/arena/schemas";
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
  const parsed = ratingsQuerySchema.safeParse({
    view: params.get("view")?.trim() || undefined,
    subjectId: params.get("subjectId")?.trim() || undefined,
    limit: params.get("limit")?.trim() || undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Сұрау параметрлері жарамсыз." }, { status: 400 });
  }

  const { view, subjectId, limit } = parsed.data;

  try {
    if (view === "leaderboard") {
      if (!subjectId) {
        return NextResponse.json({ error: "Пән көрсетілмеген." }, { status: 400 });
      }
      return NextResponse.json({ rows: await getLeaderboard(auth.viewer, subjectId, limit) });
    }

    if (view === "history") {
      return NextResponse.json({ rows: await getHistory(auth.viewer, subjectId, limit) });
    }

    return NextResponse.json({ rows: await getRatings(auth.viewer) });
  } catch (error) {
    return arenaError(error);
  }
}

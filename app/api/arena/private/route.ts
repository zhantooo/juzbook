import { NextResponse } from "next/server";
import { z } from "zod";
import { createPrivateMatch, joinByCode } from "@/lib/arena/engine";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ subjectId: z.string().trim().min(1) });
const joinSchema = z.object({ code: z.string().trim().min(4).max(8) });

/**
 * POST — жеке матч құру немесе кодпен қосылу.
 *
 * `subjectId` келсе — бөлме құрылып, код қайтады. `code` келсе — сол бөлмеге
 * қосылады. Екеуі бір маршрутта: клиент үшін бір «досыңмен ойна» әрекеті.
 */
export async function POST(request: Request) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json().catch(() => ({}))) as unknown;

  const join = joinSchema.safeParse(body);
  if (join.success) {
    try {
      return NextResponse.json(await joinByCode(auth.viewer, join.data.code));
    } catch (error) {
      return arenaError(error, 404);
    }
  }

  const create = createSchema.safeParse(body);
  if (!create.success) {
    return NextResponse.json({ error: "Пән немесе код көрсетілмеген." }, { status: 400 });
  }

  try {
    return NextResponse.json(await createPrivateMatch(auth.viewer, create.data.subjectId));
  } catch (error) {
    return arenaError(error);
  }
}

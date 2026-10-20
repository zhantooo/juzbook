import { NextResponse } from "next/server";
import { joinQueue, leaveQueue, pollQueue } from "@/lib/arena/engine";
import { subjectRequestSchema } from "@/lib/arena/schemas";
import { arenaError, resolveArenaViewer } from "@/lib/arena/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — кездейсоқ қарсылас кезегіне тұру */
export async function POST(request: Request) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = subjectRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Пән көрсетілмеген." }, { status: 400 });
  }

  try {
    return NextResponse.json(await joinQueue(auth.viewer, parsed.data.subjectId));
  } catch (error) {
    return arenaError(error);
  }
}

/** GET — кезектің күйі. Тірі қарсылас табылмаса, боттың қосылуын да осы шешеді. */
export async function GET(request: Request) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  const subjectId = new URL(request.url).searchParams.get("subjectId")?.trim() || "";
  if (!subjectId) {
    return NextResponse.json({ error: "Пән көрсетілмеген." }, { status: 400 });
  }

  try {
    return NextResponse.json(await pollQueue(auth.viewer, subjectId));
  } catch (error) {
    return arenaError(error);
  }
}

/** DELETE — кезектен шығу */
export async function DELETE(request: Request) {
  const auth = await resolveArenaViewer(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    await leaveQueue(auth.viewer);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return arenaError(error);
  }
}

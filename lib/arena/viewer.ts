import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/auth";
import type { ArenaViewer } from "@/lib/arena/engine";

/**
 * Arena маршруттарының ортақ кіреберісі.
 *
 * Кіру тексерісі оқу бөлігінің сессиясымен бірдей: Arena өз алдына
 * тіркелуді талап етпейді, бірақ қонақты да жібермейді.
 */
export async function resolveArenaViewer(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return { response: auth.response };
  }

  const viewer: ArenaViewer = { id: auth.user.id, name: auth.user.name };
  return { viewer };
}

/** Қозғалтқыштан шыққан қатені клиентке түсінікті жауапқа айналдырады */
export function arenaError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Белгісіз қате.";
  return NextResponse.json({ error: message }, { status });
}

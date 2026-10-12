import { NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/security/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Сессия табылмады." }, { status: 401 });
  }

  return NextResponse.json({
    session: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      totalReadingSeconds: "totalReadingSeconds" in user ? user.totalReadingSeconds : 0
    }
  });
}

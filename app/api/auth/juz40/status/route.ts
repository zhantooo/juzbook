import { NextResponse } from "next/server";
import { isJuz40Configured } from "@/lib/security/juz40";

export const runtime = "nodejs";

export async function GET() {
  const enabled = isJuz40Configured();

  return NextResponse.json({
    enabled,
    message: enabled
      ? "juz40 арқылы кіру дайын."
      : "juz40 арқылы кіруді платформа иесі бір рет баптауы керек (juz40-тан OAuth клиент дерегін алу керек)."
  });
}

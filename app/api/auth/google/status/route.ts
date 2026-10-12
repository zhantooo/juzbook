import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const enabled = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      (process.env.GOOGLE_REDIRECT_URI?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim())
  );

  return NextResponse.json({
    enabled,
    message: enabled
      ? "Google арқылы кіру дайын."
      : "Google арқылы кіруді платформа иесі бір рет баптауы керек. Бұл деректерді әр қолданушы емес, сайт иесі енгізеді."
  });
}

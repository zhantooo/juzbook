import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getJuz40Config, isJuz40Configured, JUZ40_STATE_COOKIE } from "@/lib/security/juz40";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = getJuz40Config();
  const requestUrl = new URL(request.url);
  const fallbackRedirect = requestUrl.searchParams.get("redirect") || "/";

  if (!isJuz40Configured(config)) {
    return NextResponse.redirect(
      new URL(
        `/login?authError=${encodeURIComponent("juz40 арқылы кіруді сайт иесі әлі баптамаған.")}`,
        request.url
      )
    );
  }

  const state = `${randomUUID()}::${fallbackRedirect}`;
  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", config.scope);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set({
    name: JUZ40_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}

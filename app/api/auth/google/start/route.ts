import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GOOGLE_STATE_COOKIE = "juzbook_google_state";

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI?.trim() || `${process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"}/api/auth/google/callback`
  };
}

export async function GET(request: Request) {
  const { clientId, redirectUri } = getGoogleConfig();
  const requestUrl = new URL(request.url);
  const fallbackRedirect = requestUrl.searchParams.get("redirect") || "/";

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL(`/login?authError=${encodeURIComponent("Google арқылы кіруді сайт иесі әлі баптамаған.")}`, request.url)
    );
  }

  const state = `${randomUUID()}::${fallbackRedirect}`;
  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", clientId);
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}

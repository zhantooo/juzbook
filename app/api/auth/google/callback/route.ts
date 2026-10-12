import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/security/session";

export const runtime = "nodejs";

const GOOGLE_STATE_COOKIE = "juzbook_google_state";

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI?.trim() || `${process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"}/api/auth/google/callback`
  };
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const state = requestUrl.searchParams.get("state")?.trim() || "";
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${GOOGLE_STATE_COOKIE}=`))
    ?.split("=")[1];

  const decodedStateCookie = stateCookie ? decodeURIComponent(stateCookie) : "";
  const fallbackRedirect = decodedStateCookie.includes("::") ? decodedStateCookie.split("::").slice(1).join("::") || "/" : "/";
  const safeRedirect = fallbackRedirect.startsWith("/") ? fallbackRedirect : "/";

  if (!code || !state || !decodedStateCookie || decodedStateCookie !== state) {
    const response = NextResponse.redirect(new URL(`/login?authError=${encodeURIComponent("Google арқылы кіру расталмады.")}`, request.url));
    clearStateCookie(response);
    return response;
  }

  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  if (!clientId || !clientSecret || !redirectUri) {
    const response = NextResponse.redirect(new URL(`/login?authError=${encodeURIComponent("Google арқылы кіруді сайт иесі әлі баптамаған.")}`, request.url));
    clearStateCookie(response);
    return response;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      const response = NextResponse.redirect(new URL(`/login?authError=${encodeURIComponent("Google арқылы кіру аяқталмады.")}`, request.url));
      clearStateCookie(response);
      return response;
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`
      }
    });

    const profilePayload = (await profileResponse.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
      verified_email?: boolean;
    };

    const email = profilePayload.email?.trim().toLowerCase() || "";
    const name = profilePayload.name?.trim() || "Оқушы";

    if (!profileResponse.ok || !email || profilePayload.verified_email === false) {
      const response = NextResponse.redirect(new URL(`/login?authError=${encodeURIComponent("Google профилінен email оқу мүмкін болмады.")}`, request.url));
      clearStateCookie(response);
      return response;
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: await bcrypt.hash(randomUUID(), 10),
          role: "USER"
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });
    }

    const token = await createSessionToken({
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    const response = NextResponse.redirect(new URL(safeRedirect, request.url));
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });
    clearStateCookie(response);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL(`/login?authError=${encodeURIComponent("Google арқылы кіру кезінде сервер қатесі пайда болды.")}`, request.url));
    clearStateCookie(response);
    return response;
  }
}

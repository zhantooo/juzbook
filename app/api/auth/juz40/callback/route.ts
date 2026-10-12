import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractJuz40Profile, getJuz40Config, isJuz40Configured, JUZ40_STATE_COOKIE } from "@/lib/security/juz40";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/security/session";

export const runtime = "nodejs";

function clearStateCookie(response: NextResponse) {
  response.cookies.set({
    name: JUZ40_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

function fail(request: Request, message: string) {
  const response = NextResponse.redirect(new URL(`/login?authError=${encodeURIComponent(message)}`, request.url));
  clearStateCookie(response);
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const state = requestUrl.searchParams.get("state")?.trim() || "";
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${JUZ40_STATE_COOKIE}=`))
    ?.split("=")[1];

  const decodedStateCookie = stateCookie ? decodeURIComponent(stateCookie) : "";
  const fallbackRedirect = decodedStateCookie.includes("::")
    ? decodedStateCookie.split("::").slice(1).join("::") || "/"
    : "/";
  const safeRedirect = fallbackRedirect.startsWith("/") ? fallbackRedirect : "/";

  if (!code || !state || !decodedStateCookie || decodedStateCookie !== state) {
    return fail(request, "juz40 арқылы кіру расталмады.");
  }

  const config = getJuz40Config();
  if (!isJuz40Configured(config)) {
    return fail(request, "juz40 арқылы кіруді сайт иесі әлі баптамаған.");
  }

  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return fail(request, "juz40 арқылы кіру аяқталмады.");
    }

    const profileResponse = await fetch(config.userinfoUrl, {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: "application/json" }
    });

    const profilePayload = (await profileResponse.json().catch(() => ({}))) as Record<string, unknown>;
    if (!profileResponse.ok) {
      return fail(request, "juz40 профилін оқу мүмкін болмады.");
    }

    const profile = extractJuz40Profile(profilePayload, config);

    // juz40 email бермеуі мүмкін (логин/ИИН ғана). Сонда тұрақты бірегей кілт
    // құрамыз — сол оқушы келесіде сол профильге қайта кіреді.
    const identityKey = profile.email || (profile.externalId ? `juz40-${profile.externalId}@juz40.import` : "");
    if (!identityKey) {
      return fail(request, "juz40 профилінен оқушыны анықтау мүмкін болмады.");
    }

    let user = await prisma.user.findUnique({
      where: { email: identityKey },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: identityKey,
          name: profile.name || "Оқушы",
          password: await bcrypt.hash(randomUUID(), 10),
          role: "USER",
          schoolName: profile.school || null,
          grade: profile.grade || null
        },
        select: { id: true, email: true, name: true, role: true }
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
    return fail(request, "juz40 арқылы кіру кезінде сервер қатесі пайда болды.");
  }
}

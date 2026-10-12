import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/security/session";

type AuthUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
  totalReadingSeconds?: number;
};

const demoServerUsers: Record<string, AuthUser> = {
  "student@juzbook.kz": {
    id: "demo-student",
    email: "student@juzbook.kz",
    role: "USER",
    name: "Оқушы"
  },
  "admin@juzbook.kz": {
    id: "demo-admin",
    email: "admin@juzbook.kz",
    role: "ADMIN",
    name: "Әкімші"
  },
  "superadmin@juzbook.kz": {
    id: "demo-superadmin",
    email: "superadmin@juzbook.kz",
    role: "SUPERADMIN",
    name: "Бас суперәкімші"
  }
};

function parseCookies(cookieHeader: string | null) {
  const cookies = new Map<string, string>();

  for (const chunk of (cookieHeader || "").split(";")) {
    const [rawKey, ...rest] = chunk.split("=");
    const key = rawKey?.trim();
    if (!key) {
      continue;
    }

    cookies.set(key, decodeURIComponent(rest.join("=").trim()));
  }

  return cookies;
}

function unauthorized(message = "Бұл әрекетті орындауға рұқсат жоқ!") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message = "Бұл бөлімге кіруге құқығыңыз жоқ!") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function getSessionTokenFromRequest(request: Request) {
  return parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE_NAME) || null;
}

export async function getVerifiedSessionPayload(request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

function getDemoUserByPayload(payload: { sub: string; email: string; role: Role; name: string }) {
  const demoUser = demoServerUsers[payload.email.toLowerCase()];
  if (!demoUser) {
    return null;
  }

  if (demoUser.id !== payload.sub || demoUser.role !== payload.role || demoUser.name !== payload.name) {
    return null;
  }

  return demoUser;
}

async function loadDatabaseUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      totalReadingSeconds: true
    }
  });
}

export async function getCurrentUserFromRequest(request: Request): Promise<AuthUser | null> {
  const payload = await getVerifiedSessionPayload(request);
  if (!payload) {
    return null;
  }

  const demoUser = getDemoUserByPayload(payload);
  if (demoUser) {
    return demoUser;
  }

  try {
    const user = await loadDatabaseUser(payload.sub);

    if (!user || user.email !== payload.email || user.role !== payload.role || user.name !== payload.name) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(request: Request) {
  const payload = await getVerifiedSessionPayload(request);
  if (!payload) {
    return { response: unauthorized("Қайтадан жүйеге кіріп көріңіз.") };
  }

  const demoUser = getDemoUserByPayload(payload);
  if (demoUser) {
    return { user: demoUser };
  }

  try {
    const user = await loadDatabaseUser(payload.sub);

    if (!user || user.email !== payload.email || user.role !== payload.role || user.name !== payload.name) {
      return { response: unauthorized("Сессия дерегі жарамсыз. Қайта кіріңіз.") };
    }

    return { user };
  } catch {
    return { response: unauthorized("Сессия дерегі жарамсыз. Қайта кіріңіз.") };
  }
}

export async function requireAdminUser(request: Request) {
  const result = await requireAuthenticatedUser(request);
  if ("response" in result) {
    return result;
  }

  if (!["ADMIN", "SUPERADMIN"].includes(result.user.role)) {
    return { response: forbidden() };
  }

  return result;
}

export async function requireSuperAdminUser(request: Request) {
  const result = await requireAuthenticatedUser(request);
  if ("response" in result) {
    return result;
  }

  if (result.user.role !== "SUPERADMIN") {
    return { response: forbidden() };
  }

  return result;
}

export function createClearedSessionResponse() {
  const response = NextResponse.json({ message: "Сессия аяқталды." });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

export type { AuthUser };

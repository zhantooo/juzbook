import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findDemoAccount } from "@/lib/security/demo-accounts";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/security/session";
import { formatAuthValidationError, loginRequestSchema } from "@/lib/security/auth-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as unknown;
    const parsedBody = loginRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: formatAuthValidationError(parsedBody.error) }, { status: 400 });
    }

    const { email, password } = parsedBody.data;
    const demoAccount = findDemoAccount(email, password);

    if (demoAccount) {
      const demoUser = {
        id:
          demoAccount.role === "SUPERADMIN"
            ? "demo-superadmin"
            : demoAccount.role === "ADMIN"
              ? "demo-admin"
              : "demo-student",
        email: demoAccount.email,
        role: demoAccount.role,
        name: demoAccount.name
      };

      const token = await createSessionToken({
        sub: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role
      });

      const response = NextResponse.json({
        message: "Жүйеге кіру сәтті орындалды.",
        session: demoUser
      });

      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_TTL_SECONDS
      });

      return response;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        password: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Электронды пошта немесе құпия сөз қате!" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Электронды пошта немесе құпия сөз қате!" }, { status: 401 });
    }

    const token = await createSessionToken({
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    const response = NextResponse.json({
      message: "Жүйеге кіру сәтті орындалды.",
      session: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Жүйеге кіру кезінде қате пайда болды."
      },
      { status: 500 }
    );
  }
}

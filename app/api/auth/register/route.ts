import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatAuthValidationError, registerRequestSchema } from "@/lib/security/auth-validation";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/security/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as unknown;
    const parsedBody = registerRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: formatAuthValidationError(parsedBody.error) }, { status: 400 });
    }

    const { name, email, password, isAgreedToTerms } = parsedBody.data;

    if (!isAgreedToTerms) {
      return NextResponse.json(
        { error: "Жүйеге тіркелу үшін ережелермен келісуіңіз қажет!" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      return NextResponse.json({ error: "Бұл email поштасы жүйеде тіркелген!" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: "USER",
        isAgreedToTerms: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    const token = await createSessionToken({
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });

    const response = NextResponse.json({
      message: "Тіркелу сәтті аяқталды.",
      session: user
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
        error: error instanceof Error ? error.message : "Тіркелу кезінде қате пайда болды."
      },
      { status: 500 }
    );
  }
}

import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordRequestSchema, formatAuthValidationError } from "@/lib/security/auth-validation";

export const runtime = "nodejs";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as unknown;
    const parsedBody = resetPasswordRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: formatAuthValidationError(parsedBody.error) }, { status: 400 });
    }

    const { token, password } = parsedBody.data;
    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true
      }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Қалпына келтіру сілтемесінің мерзімі өтіп кеткен немесе жарамсыз." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: passwordHash
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          usedAt: new Date()
        }
      })
    ]);

    return NextResponse.json({
      message: "Құпия сөз сәтті жаңартылды."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Құпия сөзді жаңарту мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

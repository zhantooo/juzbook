import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetMail } from "@/lib/security/mailer";
import { forgotPasswordRequestSchema, formatAuthValidationError } from "@/lib/security/auth-validation";

export const runtime = "nodejs";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as unknown;
    const parsedBody = forgotPasswordRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: formatAuthValidationError(parsedBody.error) }, { status: 400 });
    }

    const { email } = parsedBody.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true }
    });

    /// Қауіпсіздік үшін пайдаланушы бар-жоғын ашық көрсетпейміз.
    if (!user) {
      return NextResponse.json({
        message: "Егер бұл email тіркелген болса, қалпына келтіру хаты жіберілді."
      });
    }

    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").trim();
    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await sendPasswordResetMail(user.email, resetLink);

    return NextResponse.json({
      message: "Егер бұл email тіркелген болса, қалпына келтіру хаты жіберілді."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Қалпына келтіру хатын жіберу мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

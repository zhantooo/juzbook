import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/security/auth";
import { formatAuthValidationError, roleUpdateRequestSchema } from "@/lib/security/auth-validation";
import { sendRoleUpdatedMail } from "@/lib/security/mailer";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const authResult = await requireSuperAdminUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const rawBody = (await request.json()) as unknown;
    const parsedBody = roleUpdateRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: formatAuthValidationError(parsedBody.error) }, { status: 400 });
    }

    const { userId, newRole } = parsedBody.data;

    if (userId.startsWith("demo:")) {
      return NextResponse.json(
        { error: "Демо аккаунттардың рөлін өзгертуге болмайды." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Пайдаланушы табылмады." }, { status: 404 });
    }

    if (String(existingUser.role) === "SUPERADMIN") {
      return NextResponse.json({ error: "SUPERADMIN рөлін өзгертуге болмайды." }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    let mailNotice = "";

    try {
      await sendRoleUpdatedMail(updatedUser.email, newRole);
      mailNotice = " Рөл өзгерісі туралы хат жіберілді.";
    } catch {
      mailNotice = " Пошта жіберілмеді, бірақ рөл сәтті жаңартылды.";
    }

    return NextResponse.json({
      message: `Пайдаланушы рөлі жаңартылды.${mailNotice}`,
      user: updatedUser
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Рөлді өзгерту кезінде қате пайда болды."
      },
      { status: 500 }
    );
  }
}

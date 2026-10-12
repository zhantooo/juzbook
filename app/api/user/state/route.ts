import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/security/auth";

export const runtime = "nodejs";

const saveSchema = z.object({
  /** Клиенттегі күйдің толық көшірмесі */
  data: z.record(z.string(), z.unknown()),
  /** Соңғы өзгеріс уақыты (Date.now) */
  version: z.number().int().nonnegative()
});

/**
 * GET — қолданушының сақталған күйін қайтарады.
 * Демо аккаунттар дерекқорда болмағандықтан, оларға бос жауап беріледі.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const record = await prisma.userState.findUnique({
      where: { userId: auth.user.id },
      select: { data: true, version: true, updatedAt: true }
    });

    if (!record) {
      return NextResponse.json({ found: false, version: 0, data: null });
    }

    return NextResponse.json({
      found: true,
      version: Number(record.version),
      updatedAt: record.updatedAt,
      data: record.data
    });
  } catch {
    // Демо аккаунт немесе дерекқор қолжетімсіз — жергілікті күй қолданылады
    return NextResponse.json({ found: false, version: 0, data: null });
  }
}

/** PUT — күйді сақтайды. Ескі нұсқа жаңасын басып кетпейді. */
export async function PUT(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const parsed = saveSchema.safeParse((await request.json()) as unknown);
    if (!parsed.success) {
      return NextResponse.json({ error: "Дерек жарамсыз." }, { status: 400 });
    }

    // Демо аккаунт дерекқорда жоқ — қатесіз өткізіп жібереміз
    const dbUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true }
    });

    if (!dbUser) {
      return NextResponse.json({ ok: true, saved: false, reason: "demo" });
    }

    const existing = await prisma.userState.findUnique({
      where: { userId: dbUser.id },
      select: { version: true }
    });

    // Нұсқа сервердің өз сағатымен қойылады. Бұрын клиенттің `Date.now()`
    // мәні салыстырылатын — құрылғылардың сағаты сәл ауытқыса (бір телефон
    // артта қалса), сол құрылғының жазуы «ескі» деп үнсіз тасталып, деректер
    // сақталмай қалатын. Енді жалғыз дереккөз — сервер сағаты, әрі нұсқа
    // әрқашан өседі, сондықтан кірген құрылғының жазуы ешқашан жоғалмайды.
    const previousVersion = existing ? Number(existing.version) : 0;
    const serverVersion = BigInt(Math.max(Date.now(), previousVersion + 1));

    await prisma.userState.upsert({
      where: { userId: dbUser.id },
      create: {
        userId: dbUser.id,
        data: parsed.data.data as object,
        version: serverVersion
      },
      update: {
        data: parsed.data.data as object,
        version: serverVersion
      }
    });

    return NextResponse.json({ ok: true, saved: true, version: Number(serverVersion) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Күйді сақтау мүмкін болмады." },
      { status: 500 }
    );
  }
}

/** POST — sendBeacon арқылы бет жабылғанда келетін сақтау (PUT-пен бірдей) */
export const POST = PUT;

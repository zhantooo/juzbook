import { NextResponse } from "next/server";
import { z } from "zod";
import { getIndexStatus, runIndexing } from "@/lib/search/indexer";
import { hasVectorSearch } from "@/lib/search/vector-db";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Бір шақыруда қанша тақырып өңделеді */
  limit: z.number().int().min(1).max(200).default(25)
});

/**
 * GET — индекстің жай-күйі.
 *
 * Жаңа кітап қосылғанда немесе әкімші мәтінді өңдегенде `pending` саны
 * өседі: сол тақырыптардың мазмұны өзгерген, яғни қайта эмбеддеу керек.
 */
export async function GET(request: Request) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  if (!hasVectorSearch()) {
    return NextResponse.json({ enabled: false, error: "Векторлық қойма бапталмаған." });
  }

  try {
    return NextResponse.json({ enabled: true, ...(await getIndexStatus()) });
  } catch (error) {
    return NextResponse.json(
      { enabled: true, error: error instanceof Error ? error.message : "Индексті оқу мүмкін болмады." },
      { status: 500 }
    );
  }
}

/**
 * POST — индексті жаңартады.
 *
 * Бір шақыру шектеулі санды тақырыпты өңдейді де, қалғанын `pending` деп
 * қайтарады. Әкімші панелі оны аяқталғанша қайталап шақыра алады —
 * сұраныс тым ұзаққа созылмауы керек.
 */
export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  if (!hasVectorSearch()) {
    return NextResponse.json({ error: "Векторлық қойма бапталмаған." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Сұраныс деректері жарамсыз." }, { status: 400 });
  }

  try {
    const result = await runIndexing({ limit: parsed.data.limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Индекстеу сәтсіз аяқталды." },
      { status: 500 }
    );
  }
}

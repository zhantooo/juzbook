import { NextResponse } from "next/server";
import { runIndexing } from "@/lib/search/indexer";
import { hasVectorSearch } from "@/lib/search/vector-db";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Мағыналық іздеу индексін автоматты жаңартады.
 *
 * Жаңа кітап қосылғанда немесе әкімші мәтінді өңдегенде сол тақырыптардың
 * мазмұны өзгереді де, индекстеуші оларды келесі жүгірісте өзі алады —
 * ешкім қолмен іске қоспауы керек.
 *
 * Бір жүгіріс шектеулі санды тақырыпты өңдейді: serverless функцияның
 * уақыты шектеулі. Қалғаны келесі күнге қалады, ал жаңа кітап әдетте
 * елу шақты тақырыптан тұрады, сондықтан бір жүгіріске сыяды.
 *
 * Кіру: Vercel cron `Authorization: Bearer <CRON_SECRET>` жібереді.
 * Құпия қойылмаса, маршрут жабық тұрады — ашық қалдырудан гөрі жақсы.
 */
const CHAPTERS_PER_RUN = 120;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Рұқсат жоқ." }, { status: 401 });
  }

  if (!hasVectorSearch()) {
    return NextResponse.json({ skipped: "векторлық қойма бапталмаған" });
  }

  const startedAt = Date.now();

  try {
    const result = await runIndexing({ limit: CHAPTERS_PER_RUN });
    return NextResponse.json({
      ok: true,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Индекстеу сәтсіз аяқталды." },
      { status: 500 }
    );
  }
}

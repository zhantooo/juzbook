import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Таңдалған тақырыптардың мәтінін береді.
 *
 * Навигация жауабында тақырыптың мәтіні жоқ: 2 282 тақырыптың мазмұны
 * бірге тасымалданса, әр бет ашылғанда мегабайттап трафик кетеді. Ал
 * ашық тұрған тақырыптың мәтінін оқу беті өзі алады.
 *
 * Сондықтан мәтін екінші тақырыпқа да керек болғанда (тест құрастырғыш
 * бірден бес тақырып таңдауға мүмкіндік береді) осы маршрут шақырылады.
 *
 * Бір сұранымға бес тақырып: тест құрастырғыштың шегі сол, ал шектеусіз
 * қалдырсақ, маршрут бүкіл каталогты бір сұранымда беріп жіберер еді.
 */
const MAX_TOPICS = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const ids = Array.from(
    new Set(
      (searchParams.get("ids") || "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value.length <= 120)
    )
  );

  if (!ids.length) {
    return NextResponse.json({ error: "Тақырып идентификаторы берілмеген." }, { status: 400 });
  }

  if (ids.length > MAX_TOPICS) {
    return NextResponse.json(
      { error: `Бірден ең көбі ${MAX_TOPICS} тақырып сұрауға болады.` },
      { status: 400 }
    );
  }

  try {
    // Жасырылған тақырып та, жасырылған кітаптың тақырыбы да берілмейді —
    // оқу бетінің сүзгісімен бірдей.
    const topics = await prisma.chapter.findMany({
      where: {
        id: { in: ids },
        isHidden: false,
        book: { isHidden: false, subject: { isHidden: false } }
      },
      select: { id: true, title: true, content: true }
    });

    return NextResponse.json(
      { topics },
      { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Тақырып мәтінін оқу мүмкін болмады." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateQuestions } from "@/lib/question-generator";
import { getCurrentUserFromRequest, requireAdminUser, requireAuthenticatedUser } from "@/lib/security/auth";

export const runtime = "nodejs";

const MAX_GENERATE = 200;

/** Оқушыға сұрақтарды араластырып беру */
const listSchema = z.object({
  chapterIds: z.array(z.string().trim().min(1)).min(1).max(30),
  count: z.number().int().min(1).max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).optional()
});

/** Әкімші не оқушы жаңа сұрақ құрастырады */
const generateSchema = z.object({
  chapterId: z.string().trim().min(1),
  count: z.number().int().min(1).max(MAX_GENERATE),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.enum(["kk", "en"]).default("kk")
});

/** Әкімші қолмен сұрақ қосады */
const createSchema = z.object({
  chapterId: z.string().trim().min(1),
  prompt: z.string().trim().min(5),
  options: z.array(z.string().trim().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium")
});

function shuffle<T>(items: T[]) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * GET — тақырып(тар) бойынша дайын сұрақтарды береді.
 * Оқушы бұрын жауап бермеген сұрақтар алдымен беріледі; олар таусылса,
 * `exhausted: true` қайтарылады да, интерфейс "өзің құра аласың" деп ұсынады.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listSchema.safeParse({
      chapterIds: (searchParams.get("chapterIds") || "").split(",").filter(Boolean),
      count: Number(searchParams.get("count") || 10),
      difficulty: searchParams.get("difficulty") || undefined
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Сұраныс деректері жарамсыз." }, { status: 400 });
    }

    const { chapterIds, count, difficulty } = parsed.data;

    const questions = await prisma.topicQuestion.findMany({
      where: { chapterId: { in: chapterIds }, ...(difficulty ? { difficulty } : {}) },
      select: {
        id: true,
        chapterId: true,
        prompt: true,
        options: true,
        answerIndex: true,
        explanation: true,
        difficulty: true,
        attempts: { where: { userId: auth.user.id }, select: { id: true } }
      }
    });

    const fresh = questions.filter((item) => item.attempts.length === 0);
    const seen = questions.filter((item) => item.attempts.length > 0);
    // Алдымен көрмегендері, жетпесе — бұрын өткендері араластырылып қосылады
    const picked = [...shuffle(fresh), ...shuffle(seen)].slice(0, count);

    return NextResponse.json({
      total: questions.length,
      freshCount: fresh.length,
      exhausted: fresh.length < count,
      questions: picked.map((item) => ({
        id: item.id,
        chapterId: item.chapterId,
        question: item.prompt,
        options: item.options,
        correct_answer: item.options[item.answerIndex] ?? item.options[0],
        explanation: item.explanation,
        difficulty: item.difficulty
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Сұрақтарды оқу мүмкін болмады." },
      { status: 500 }
    );
  }
}

/**
 * POST — жаңа сұрақтар қосу.
 *   { chapterId, count } → ИИ құрастырады (әкімші де, оқушы да шақыра алады)
 *   { chapterId, prompt, options, answerIndex } → әкімші қолмен қосады
 */
export async function POST(request: Request) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Алдымен жүйеге кіріңіз." }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";

  // Демо аккаунттар дерекқорда болмауы мүмкін — сондықтан авторды тек нақты
  // қолданушы табылғанда жазамыз, әйтпесе сыртқы кілт қатесі шығады.
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  const authorId = dbUser?.id ?? null;

  // ── Қолмен қосу (тек әкімші) ──
  if (typeof body.prompt === "string") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Бұл әрекет тек әкімшіге рұқсат етілген." }, { status: 403 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Дерек жарамсыз." }, { status: 400 });
    }

    const created = await prisma.topicQuestion.create({
      data: { ...parsed.data, source: "admin", createdById: authorId },
      select: { id: true }
    });

    return NextResponse.json({ ok: true, questionId: created.id });
  }

  // ── ИИ арқылы құрастыру ──
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Дерек жарамсыз." }, { status: 400 });
  }

  const { chapterId, count, difficulty, language } = parsed.data;

  // Оқушы бір реттік шағын топтама ғана құра алады, әкімші — үлкен банк
  const allowed = isAdmin ? count : Math.min(count, 15);

  // Әр тақырыпқа 50 сұрақ алдын ала дайындалған. Оқушы соны түгел шешіп
  // болмайынша ИИ-ді мазаламайды — API-ға бекер жүктеме түспеуі үшін.
  if (!isAdmin) {
    const unseen = await prisma.topicQuestion.count({
      where: { chapterId, attempts: { none: { userId: user.id } } }
    });

    if (unseen > 0) {
      return NextResponse.json(
        {
          error: `Бұл тақырыпта әлі шешілмеген ${unseen} дайын сұрақ бар. Алдымен соларды бітіріңіз.`,
          remaining: unseen
        },
        { status: 409 }
      );
    }
  }

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { title: true, content: true }
  });

  if (!chapter) {
    return NextResponse.json({ error: "Тақырып табылмады." }, { status: 404 });
  }

  const text = chapter.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 80) {
    return NextResponse.json({ error: "Бұл тақырыпта сұрақ құрастыруға мәтін жеткіліксіз." }, { status: 400 });
  }

  try {
    const generated = await generateQuestions({
      topicTitle: chapter.title,
      text: text.slice(0, 30000),
      count: allowed,
      difficulty,
      language
    });

    if (!generated.length) {
      return NextResponse.json({ error: "Модель сұрақ қайтармады." }, { status: 502 });
    }

    // Бұрыннан бар сұрақтарды қайталамау үшін мәтіні бойынша тексереміз
    const existing = await prisma.topicQuestion.findMany({
      where: { chapterId },
      select: { prompt: true }
    });
    const known = new Set(existing.map((item) => item.prompt.trim().toLowerCase()));

    const rows = generated
      .filter((item) => !known.has(item.question.trim().toLowerCase()))
      .map((item) => {
        const answerIndex = Math.max(0, item.options.indexOf(item.correct_answer));
        return {
          chapterId,
          prompt: item.question.trim(),
          options: item.options,
          answerIndex,
          explanation: (item.explanation || "").trim(),
          difficulty,
          source: isAdmin ? "ai" : "student",
          createdById: authorId
        };
      });

    if (rows.length) {
      await prisma.topicQuestion.createMany({ data: rows });
    }

    const total = await prisma.topicQuestion.count({ where: { chapterId } });

    return NextResponse.json({ ok: true, added: rows.length, total });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Сұрақтарды құрастыру мүмкін болмады." },
      { status: 500 }
    );
  }
}

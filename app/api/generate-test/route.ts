import { NextResponse } from "next/server";
import { hasGeminiApiKey, runWithGeminiKey } from "@/lib/gemini-keys";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/security/auth";
import { enforceAiRateLimit, getRequestIpAddress } from "@/lib/security/rate-limit";
import { formatValidationError, generateTestRequestSchema } from "@/lib/security/validation";
import {
  generateContentWithRetry,
  isTemporaryGeminiError,
  normalizeQuestions
} from "@/lib/question-generator";
import type { DifficultyLevel, TestLanguage } from "@/lib/question-generator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!hasGeminiApiKey()) {
      return NextResponse.json({ error: "GEMINI_API_KEY бапталмаған." }, { status: 500 });
    }

    const parsedBody = generateTestRequestSchema.safeParse((await request.json()) as unknown);
    if (!parsedBody.success) {
      return NextResponse.json({ error: formatValidationError(parsedBody.error) }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    const identity = user?.id || getRequestIpAddress(request);
    const limit = await enforceAiRateLimit(identity, 3);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Сұраныс шегінен астыңыз. Жүйе шамалыдан кейін қайта іске қосылады (минутына 3 рет рұқсат етілген)"
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds)
          }
        }
      );
    }

    const { text, topicTitle, count, language, chapterIds } = parsedBody.data;

    // Әр тақырыпқа 50 сұрақ алдын ала дайындалған. Оқушы соларды түгел
    // шешпейінше ИИ шақырылмайды — API-ға бекер жүктеме түспеуі үшін.
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
    if (user && !isAdmin && chapterIds?.length) {
      const unseen = await prisma.topicQuestion.count({
        where: { chapterId: { in: chapterIds }, attempts: { none: { userId: user.id } } }
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
    const difficulty = parsedBody.data.difficulty as DifficultyLevel;
    // Кілттің шектеуі бітсе, сұраныс келесі кілтпен қайталанады
    const response = await runWithGeminiKey((ai) =>
      generateContentWithRetry({
        ai,
        topicTitle,
        text,
        count,
        difficulty,
        language
      })
    );
    const content = response.text;

    if (!content) {
      return NextResponse.json({ error: "ИИ бос жауап қайтарды." }, { status: 502 });
    }

    const parsed = JSON.parse(content) as unknown;
    const questions = normalizeQuestions(parsed).slice(0, count);

    return NextResponse.json({ questions });
  } catch (error) {
    if (isTemporaryGeminiError(error)) {
      return NextResponse.json(
        { error: "Gemini сервері қазір бос емес. Бірнеше секундтан кейін қайта байқап көріңіз." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Тест құрастыру кезінде қате пайда болды." },
      { status: 500 }
    );
  }
}

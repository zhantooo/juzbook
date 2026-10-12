import { Type } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasGeminiApiKey, runWithGeminiKey } from "@/lib/gemini-keys";
import { getCurrentUserFromRequest } from "@/lib/security/auth";
import { enforceAiRateLimit, getRequestIpAddress } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(3, "Маркер мәтіні тым қысқа."),
  subjectName: z.string().trim().min(1).optional().default(""),
  chapterTitle: z.string().trim().min(1).optional().default("")
});

export async function POST(request: Request) {
  try {
    if (!hasGeminiApiKey()) {
      return NextResponse.json({ error: "GEMINI_API_KEY бапталмаған." }, { status: 500 });
    }

    const parsed = requestSchema.safeParse((await request.json()) as unknown);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Сұраныс деректері жарамсыз." }, { status: 400 });
    }

    const user = await getCurrentUserFromRequest(request);
    const identity = user?.id || getRequestIpAddress(request);
    const limit = await enforceAiRateLimit(`${identity}:flashcard`, 5);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Сұраныс шегінен астыңыз. Flashcard жасау үшін сәл кейінірек қайталап көріңіз." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    const { text, subjectName, chapterTitle } = parsed.data;
    // Кілттің шектеуі бітсе, сұраныс келесі кілтпен қайталанады
    const response = await runWithGeminiKey((ai) =>
      ai.models.generateContent({
      model: process.env.QUESTION_MODEL?.trim() || "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Пән: ${subjectName}\nТақырып: ${chapterTitle}\nМаркерленген мәтін: ${text}\n\nОсы белгіленген мәтіннен 1 қысқа жаттау картасын жаса. Question бетінде тек сұрақ болсын. Answer бетінде нақты, қысқа жауап болсын.`
            }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING }
          },
          required: ["question", "answer"]
        },
        systemInstruction:
          "Тек берілген маркер мәтініне сүйен. Жауапты тек таза JSON форматында қайтар. Артық түсіндірме қоспа. question және answer өрістері қазақ тілінде болсын."
      }
    }));

    const content = response.text;
    if (!content) {
      return NextResponse.json({ error: "ИИ бос жауап қайтарды." }, { status: 502 });
    }

    const payload = JSON.parse(content) as { question?: string; answer?: string };
    if (!payload.question || !payload.answer) {
      return NextResponse.json({ error: "Flashcard құрылымы толық қайтпады." }, { status: 502 });
    }

    return NextResponse.json({
      flashcard: {
        question: payload.question.trim(),
        answer: payload.answer.trim()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Flashcard жасау кезінде қате пайда болды." },
      { status: 500 }
    );
  }
}

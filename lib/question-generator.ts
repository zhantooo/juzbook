/**
 * Gemini арқылы тест сұрақтарын құрастыру логикасы.
 * Екі жерде қолданылады: жедел тест (generate-test) және
 * тақырыптың дайын сұрақтар банкі (topic-questions).
 */
import { GoogleGenAI, Type } from "@google/genai";
import { runWithGeminiKey } from "@/lib/gemini-keys";

type DifficultyLevel = "easy" | "medium" | "hard";
type TestLanguage = "kk" | "en";

type GeneratedQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

/// `gemini-2.5-flash` жаңа аккаунттарға жабылды (404 қайтарады), сондықтан
/// модель атауы бір жерде тұрады да, қажет болса `.env` арқылы ауыстырылады.
const QUESTION_MODEL = process.env.QUESTION_MODEL?.trim() || "gemini-3.5-flash";

const maxAttempts = 3;
const retryDelayMs = 2000;

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTemporaryGeminiError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof maybeError.status === "number" ? maybeError.status : Number(maybeError.code);
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("503") ||
    message.includes("service unavailable") ||
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("overloaded")
  );
}

function normalizeQuestions(value: unknown): GeneratedQuestion[] {
  if (!value || typeof value !== "object" || !("questions" in value)) {
    throw new Error("Жауап құрылымы дұрыс емес.");
  }

  const questions = (value as { questions: unknown }).questions;
  if (!Array.isArray(questions)) {
    throw new Error("Сұрақтар тізімі табылмады.");
  }

  return questions.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("Сұрақ құрылымы дұрыс емес.");
    }

    const record = item as Partial<GeneratedQuestion>;
    const options = Array.isArray(record.options) ? record.options.filter((option) => typeof option === "string") : [];

    if (
      typeof record.question !== "string" ||
      options.length !== 4 ||
      typeof record.correct_answer !== "string" ||
      typeof record.explanation !== "string"
    ) {
      throw new Error("Әр сұрақта 4 жауап нұсқасы және түсіндірме болуы керек.");
    }

    return {
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `q-${index + 1}`,
      question: record.question.trim(),
      options: options.map((option) => option.trim()),
      correct_answer: record.correct_answer.trim(),
      explanation: record.explanation.trim()
    };
  });
}

function getDifficultyPrompt(difficulty: DifficultyLevel, language: TestLanguage) {
  if (language === "en") {
    if (difficulty === "easy") {
      return "Make the questions easy and direct. Focus on definitions and simple facts from the text.";
    }

    if (difficulty === "hard") {
      return "Make the questions challenging. Focus on relationships, comparisons and conclusions based only on the text.";
    }

    return "Make the questions medium level. Focus on understanding the main ideas and concepts from the text.";
  }

  if (difficulty === "easy") {
    return "Сұрақтар жеңіл болсын: негізгі анықтамалар мен тура фактілерді тексерсін.";
  }

  if (difficulty === "hard") {
    return "Сұрақтар күрделі болсын: мәтіндегі байланыстарды, салыстыруды және қорытынды жасауды тексерсін.";
  }

  return "Сұрақтар орташа болсын: ұғымдарды түсінуді және негізгі ойды ажыратуды тексерсін.";
}

function getSystemInstruction(language: TestLanguage) {
  if (language === "en") {
    return "Work only within the provided text. Do not add facts from outside. Return only pure JSON. The root must be a questions array. Each item must contain id, question, options, correct_answer and explanation. Each question must have exactly 4 answer options. The correct_answer must match one option exactly. The explanation must briefly justify the correct answer using only the given text. All questions, options and explanations must be in English.";
  }

  return "Тек берілген мәтін аясында жұмыс істе. Өз ойыңнан факт қоспа. Жауапты тек таза JSON форматында қайтар. JSON түбірі questions массиві болсын. Әр элементте id, question, options, correct_answer, explanation кілттері болсын. options дәл 4 жауап нұсқасынан тұрсын. correct_answer options ішіндегі бір нақты жауаппен бірдей болсын. explanation тек берілген мәтіндегі ақпаратқа сүйеніп, дұрыс жауаптың қысқа дәлелін көрсетсін. Барлық сұрақ, жауап және түсіндірме қазақ тілінде болсын.";
}

async function generateContentWithRetry({
  ai,
  topicTitle,
  text,
  count,
  difficulty,
  language
}: {
  ai: GoogleGenAI;
  topicTitle: string;
  text: string;
  count: number;
  difficulty: DifficultyLevel;
  language: TestLanguage;
}) {
  let lastError: unknown = null;
  const difficultyPrompt = getDifficultyPrompt(difficulty, language);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: QUESTION_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  language === "en"
                    ? `Topic: ${topicTitle}\n\nDifficulty: ${difficulty}\n\nFull textbook content, including text, tables, terms and image descriptions:\n${text}\n\nCreate ${count} multiple-choice questions based only on this provided content. ${difficultyPrompt} In the explanation field, show a brief textual justification taken from the provided content.`
                    : `Тақырыптар: ${topicTitle}\n\nДеңгей: ${difficulty}\n\nКітаптың толық контенті, оның ішінде мәтін, кесте, термин және сурет сипаттамалары:\n${text}\n\nОсы берілген контент бойынша ${count} тест сұрағын құрастыр. ${difficultyPrompt} Әр сұрақтың explanation өрісінде дұрыс жауаптың кітап контентіндегі қысқа дәлелін көрсет.`
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
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    correct_answer: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["id", "question", "options", "correct_answer", "explanation"]
                }
              }
            },
            required: ["questions"]
          },
          systemInstruction: getSystemInstruction(language)
        }
      });
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isTemporaryGeminiError(error)) {
        throw error;
      }

      await wait(retryDelayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini уақытша жауап бермеді.");
}

export type { DifficultyLevel, TestLanguage, GeneratedQuestion };
export { normalizeQuestions, generateContentWithRetry, isTemporaryGeminiError };

/** Мәтін бойынша сұрақтарды құрастырып, тазаланған тізім қайтарады */
export async function generateQuestions(input: {
  topicTitle: string;
  text: string;
  count: number;
  difficulty: DifficultyLevel;
  language: TestLanguage;
}): Promise<GeneratedQuestion[]> {
  // Кілттің шектеуі бітсе, сұраныс келесі кілтпен қайталанады
  const response = await runWithGeminiKey((ai) => generateContentWithRetry({ ai, ...input }));
  const raw = response.text;

  if (!raw) {
    throw new Error("Модель бос жауап қайтарды.");
  }

  return normalizeQuestions(JSON.parse(raw));
}

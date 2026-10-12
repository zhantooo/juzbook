"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Minus, Wand2, X } from "lucide-react";
import { SelectMenu } from "@/components/ui/select-menu";
import { RichQuestionText } from "@/components/reader/rich-question-text";

type TestTopic = {
  id: string;
  title: string;
  content: string;
};

type GeneratedQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

type DifficultyLevel = "easy" | "medium" | "hard";
type TestLanguage = "kk" | "en";
const MAX_TEST_TEXT_LENGTH = 180000;
const MAX_SELECTED_TOPICS = 5;

const testThemes = {
  basic: { accent: "#475569", hover: "#334155", soft: "rgba(100, 116, 139, 0.10)", border: "rgba(100, 116, 139, 0.26)" },
  sky: { accent: "#0284c7", hover: "#0369a1", soft: "rgba(14, 165, 233, 0.12)", border: "rgba(14, 165, 233, 0.3)" },
  emerald: { accent: "#059669", hover: "#047857", soft: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" },
  amber: { accent: "#b45309", hover: "#92400e", soft: "rgba(245, 158, 11, 0.16)", border: "rgba(245, 158, 11, 0.32)" },
  rose: { accent: "#be123c", hover: "#9f1239", soft: "rgba(244, 63, 94, 0.12)", border: "rgba(244, 63, 94, 0.3)" },
  violet: { accent: "#7c3aed", hover: "#6d28d9", soft: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.3)" },
  slate: { accent: "#475569", hover: "#334155", soft: "rgba(100, 116, 139, 0.12)", border: "rgba(100, 116, 139, 0.3)" }
} as const;

function getTestTheme(theme?: string | null) {
  return testThemes[(theme || "sky") as keyof typeof testThemes] ?? testThemes.sky;
}

function decodeEntities(value: string) {
  const parser = new DOMParser();
  return parser.parseFromString(value, "text/html").documentElement.textContent || value;
}

function getAttribute(source: string, name: string) {
  const match = source.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] ? decodeEntities(match[1]) : "";
}

function parseTermGroupItems(value: string) {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Array<{ title?: string; body?: string; image?: string; imageAlign?: string }>;
    return parsed
      .map((item, index) => {
        const title = item.title || `Термин ${index + 1}`;
        const body = item.body || "";
        const imageText = item.image ? `\nСурет: ${title} терминіне қатысты көрнекі сурет.` : "";
        return `Термин: ${title}\nТүсіндірме: ${stripHtml(body)}${imageText}`;
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

function stripHtml(value: string) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function prepareContentForTest(value: string) {
  const shortcodeExpanded = value
    .replace(/\[(danger-right|rightdanger|danger|colorbox)([^\]]*)\]([\s\S]*?)\[\/\1\]/gi, (_, _type: string, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title");
      return `\n${title ? `${title}\n` : ""}${stripHtml(body)}\n`;
    })
    .replace(/\[term([^\]]*)\]([\s\S]*?)\[\/term\]/gi, (_, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") || "Термин";
      const image = getAttribute(attrs, "image");
      return `\nТермин: ${title}\nТүсіндірме: ${stripHtml(body)}${image ? `\nСурет: ${title} терминіне қатысты көрнекі сурет.` : ""}\n`;
    })
    .replace(/\[termgroup([^\]]*)\]([\s\S]*?)\[\/termgroup\]/gi, (_, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") || "Терминдер";
      const items = parseTermGroupItems(getAttribute(attrs, "items"));
      return `\n${title}\n${items || stripHtml(body)}\n`;
    });

  const document = new DOMParser().parseFromString(shortcodeExpanded, "text/html");
  const chunks: string[] = [];

  document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,blockquote,li").forEach((element) => {
    const text = element.textContent?.replace(/\s+/g, " ").trim();
    if (text) {
      chunks.push(text);
    }
  });

  document.querySelectorAll("[data-juz-block]").forEach((element) => {
    const type = element.getAttribute("data-juz-block") || "";
    const title = element.getAttribute("data-title") || "";
    const body = element.getAttribute("data-body") || element.textContent || "";
    const items = element.getAttribute("data-items") || "";

    if (type === "termgroup") {
      chunks.push(`${title || "Терминдер"}\n${parseTermGroupItems(items) || stripHtml(body)}`);
      return;
    }

    if (type === "term") {
      const image = element.getAttribute("data-image") || "";
      chunks.push(`Термин: ${title || "Термин"}\nТүсіндірме: ${stripHtml(body)}${image ? `\nСурет: ${title || "термин"} тақырыбына қатысты көрнекі сурет.` : ""}`);
      return;
    }

    chunks.push(`${title ? `${title}\n` : ""}${stripHtml(body)}`);
  });

  document.querySelectorAll("table").forEach((table, tableIndex) => {
    const rows = Array.from(table.querySelectorAll("tr"))
      .map((row) =>
        Array.from(row.querySelectorAll("th,td"))
          .map((cell) => cell.textContent?.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" | ")
      )
      .filter(Boolean);

    if (rows.length) {
      chunks.push(`Кесте ${tableIndex + 1}:\n${rows.join("\n")}`);
    }
  });

  document.querySelectorAll("figure,img").forEach((element, imageIndex) => {
    const caption = element.tagName.toLowerCase() === "figure" ? element.querySelector("figcaption")?.textContent?.trim() : "";
    const alt = element.tagName.toLowerCase() === "img" ? element.getAttribute("alt") || "" : element.querySelector("img")?.getAttribute("alt") || "";
    chunks.push(`Сурет ${imageIndex + 1}: ${caption || alt || "тақырыпқа қатысты көрнекі сурет"}`);
  });

  const fallback = stripHtml(shortcodeExpanded);
  return Array.from(new Set([...chunks, fallback]))
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function TestGenerator({
  topics,
  initialTopicId,
  language = "kk",
  theme = "sky",
  onJumpToText,
  onTestFinished
}: {
  topics: TestTopic[];
  initialTopicId: string;
  language?: TestLanguage;
  theme?: string | null;
  onJumpToText?: (text: string) => void;
  onTestFinished?: (correctAnswers: number, totalQuestions: number) => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([initialTopicId]);
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  // Дайын банктегі жаңа сұрақтар таусылғанда оқушыға өзі құрастыруды ұсынамыз
  const [bankExhausted, setBankExhausted] = useState(false);
  /// Банкте оқушы әлі көрмеген сұрақ саны — ИИ қашан қосылатынын көрсетеді
  const [bankRemaining, setBankRemaining] = useState<number | null>(null);
  const [isCreatingMore, setIsCreatingMore] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const completedSignatureRef = useRef("");

  const selectedTopics = useMemo(
    () => {
      const selected = topics.filter((topic) => selectedTopicIds.includes(topic.id));
      return selected.length ? selected : topics[0] ? [topics[0]] : [];
    },
    [selectedTopicIds, topics]
  );

  const answeredCount = Object.keys(answers).length;
  const activeTheme = getTestTheme(theme);
  const themeStyle = {
    "--test-accent": activeTheme.accent,
    "--test-hover": activeTheme.hover,
    "--test-soft": activeTheme.soft,
    "--test-border": activeTheme.border
  } as CSSProperties;

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    setSelectedTopicIds([initialTopicId]);
    setQuestions([]);
    setAnswers({});
    setError("");
    completedSignatureRef.current = "";
  }, [initialTopicId]);

  useEffect(() => {
    if (!isMounted || !isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted, isOpen]);

  useEffect(() => {
    if (!questions.length || answeredCount !== questions.length) {
      return;
    }

    const signature = questions.map((item) => `${item.id}:${answers[item.id] || ""}`).join("|");
    if (completedSignatureRef.current === signature) {
      return;
    }

    completedSignatureRef.current = signature;
    const correctAnswers = questions.reduce((total, question) => {
      return total + (answers[question.id] === question.correct_answer ? 1 : 0);
    }, 0);

    onTestFinished?.(correctAnswers, questions.length);

    // Банктен келген сұрақтардың нәтижесін сақтаймыз — келесі тесте олар қайталанбайды.
    // Банк идентификаторлары cuid болады, ИИ жедел құрғандары — қысқа реттік нөмір.
    const bankAnswers = questions
      .filter((question) => question.id.length > 12)
      .map((question) => ({
        questionId: question.id,
        isCorrect: answers[question.id] === question.correct_answer
      }));

    if (bankAnswers.length) {
      void fetch("/api/topic-questions/attempts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: bankAnswers })
      }).catch(() => undefined);
    }
  }, [answers, answeredCount, onTestFinished, questions]);

  /** Банк таусылғанда оқушының өзі жаңа сұрақтар құрастыруы */
  async function createMoreQuestions() {
    if (!selectedTopics.length || isCreatingMore) {
      return;
    }

    setIsCreatingMore(true);
    setError("");

    try {
      for (const topic of selectedTopics) {
        await fetch("/api/topic-questions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId: topic.id, count: 10, difficulty, language })
        });
      }

      setBankExhausted(false);
      await generateTest();
    } catch {
      setError(
        language === "en" ? "Failed to create new questions." : "Жаңа сұрақтар құрастыру мүмкін болмады."
      );
    } finally {
      setIsCreatingMore(false);
    }
  }

  function openWindow() {
    setIsOpen(true);
    setIsMinimized(false);
  }

  function closeWindow() {
    setIsOpen(false);
    setIsMinimized(false);
  }

  function minimizeWindow() {
    setIsOpen(false);
    setIsMinimized(true);
  }

  async function generateTest() {
    if (!selectedTopics.length) {
      setError(language === "en" ? "Please choose a topic first." : "Алдымен тақырыпты таңдаңыз.");
      return;
    }

    if (selectedTopics.length > MAX_SELECTED_TOPICS) {
      setError(language === "en" ? "Choose no more than 5 topics." : "Бірден ең көбі 5 тақырып таңдауға болады.");
      return;
    }

    const preparedText = selectedTopics
      .map((topic, index) => `Тақырып ${index + 1}: ${topic.title}\n\n${prepareContentForTest(topic.content)}`)
      .join("\n\n---\n\n");
    const text =
      preparedText.length > MAX_TEST_TEXT_LENGTH
        ? `${preparedText.slice(0, MAX_TEST_TEXT_LENGTH)}\n\nМәтін көлемі тест дайындауға ыңғайлы болу үшін осы жерден ықшамдалды.`
        : preparedText;

    if (text.length < 80) {
      setError(
        language === "en"
          ? "The topic text is too short for test generation."
          : "Тест құрастыру үшін тақырып мәтіні жеткілікті болуы керек."
      );
      return;
    }

    setIsLoading(true);
    setError("");
    setQuestions([]);
    setAnswers({});
    setBankExhausted(false);
    setBankRemaining(null);

    // 1) Алдымен дайын банктен аламыз — ИИ-ге сұраныс кетпейді.
    try {
      const wanted = Number(questionCount);
      const bankResponse = await fetch(
        `/api/topic-questions?chapterIds=${selectedTopics.map((topic) => topic.id).join(",")}&count=${wanted}`,
        { credentials: "same-origin" }
      );

      if (bankResponse.ok) {
        const bank = (await bankResponse.json()) as {
          questions?: GeneratedQuestion[];
          exhausted?: boolean;
          freshCount?: number;
        };

        if (bank.questions && bank.questions.length >= wanted) {
          setQuestions(bank.questions);
          setBankExhausted(Boolean(bank.exhausted));
          setBankRemaining(typeof bank.freshCount === "number" ? Math.max(0, bank.freshCount - wanted) : null);
          setIsLoading(false);
          return;
        }

        // Банкте жеткіліксіз — оқушыға өзі құрастыруды ұсынамыз
        if (bank.questions && bank.questions.length > 0) {
          setQuestions(bank.questions);
          setBankExhausted(true);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Банк қолжетімсіз болса, төмендегі ИИ жолы жалғасады
    }

    // 2) Банк бос болса ғана ИИ-ден сұраймыз.
    try {
      const response = await fetch("/api/generate-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topicTitle: selectedTopics.map((topic) => topic.title).join(", "),
          // Дайын банк таусылғанын сервер тексереді
          chapterIds: selectedTopics.map((topic) => topic.id),
          text,
          count: Number(questionCount),
          difficulty,
          language
        })
      });

      const payload = (await response.json()) as {
        questions?: GeneratedQuestion[];
        error?: string;
      };

      if (!response.ok || !payload.questions) {
        throw new Error(
          payload.error || (language === "en" ? "Failed to generate the test." : "Тест құрастыру кезінде қате пайда болды.")
        );
      }

      setQuestions(payload.questions);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : language === "en"
            ? "Failed to generate the test."
            : "Тест құрастыру кезінде қате пайда болды."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function chooseAnswer(questionId: string, option: string) {
    setAnswers((current) => {
      if (current[questionId]) {
        return current;
      }

      return {
        ...current,
        [questionId]: option
      };
    });
  }

  const fieldClassName =
    "h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition hover:border-sky-300 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-cyan-500/50 dark:focus:border-cyan-500/50 dark:focus:ring-cyan-500/10";

  const minimizedButton =
    isMounted && isMinimized
      ? createPortal(
          <button
            type="button"
            onClick={openWindow}
            className="fixed bottom-6 left-1/2 z-[100] inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-800 shadow-2xl transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
          >
            <Wand2 className="h-4 w-4" />
            {language === "en" ? "Open test window" : "Тест терезесін ашу"}
          </button>,
          document.body
        )
      : null;

  const modal =
    isMounted && isOpen
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 px-3 py-3 backdrop-blur-md sm:items-center sm:px-4 sm:py-6">
            <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em]" style={{ color: activeTheme.accent }}>
                    {language === "en" ? "AI test" : "ИИ тест"}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-zinc-50">
                    {language === "en" ? "Test generator" : "Тест құрастыру"}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={minimizeWindow}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
                    aria-label={language === "en" ? "Minimize" : "Жинақтау"}
                    title={language === "en" ? "Minimize" : "Жинақтау"}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={closeWindow}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-rose-500/40 dark:hover:text-rose-300"
                    aria-label={language === "en" ? "Close" : "Жабу"}
                    title={language === "en" ? "Close" : "Жабу"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className={`grid shrink-0 gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:grid-cols-[minmax(0,1fr)_180px_180px_190px] ${questions.length ? "max-h-[34dvh] overflow-y-auto" : ""}`}>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                    {language === "en" ? "Topics" : "Тақырыптар"}
                  </p>
                  <div className={`${questions.length ? "max-h-24" : "max-h-36"} space-y-2 overflow-y-auto pr-1`}>
                    {topics.map((topic) => {
                      const checked = selectedTopicIds.includes(topic.id);

                      return (
                        <label
                          key={topic.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm leading-5 transition ${
                            checked
                              ? "text-slate-900 dark:text-zinc-50"
                              : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/30"
                          }`}
                          style={checked ? { borderColor: activeTheme.border, background: activeTheme.soft } : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedTopicIds((current) => {
                                if (current.includes(topic.id)) {
                                  return current.filter((id) => id !== topic.id);
                                }

                                if (current.length >= MAX_SELECTED_TOPICS) {
                                  setError(language === "en" ? "Choose no more than 5 topics." : "Бірден ең көбі 5 тақырып таңдауға болады.");
                                  return current;
                                }

                                const next = [...current, topic.id];
                                return next.length ? next : [topic.id];
                              });
                              setQuestions([]);
                              setAnswers({});
                              setError((currentError) =>
                                currentError === "Бірден ең көбі 5 тақырып таңдауға болады." ||
                                currentError === "Choose no more than 5 topics."
                                  ? currentError
                                  : ""
                              );
                            }}
                            className="mt-1 h-4 w-4 shrink-0"
                            style={{ accentColor: activeTheme.accent }}
                          />
                          <span>{topic.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <SelectMenu
                  ariaLabel={language === "en" ? "Question count" : "Сұрақ саны"}
                  value={questionCount}
                  onChange={(next) => setQuestionCount(next)}
                  options={["10", "15", "20"].map((count) => ({
                    value: count,
                    label: language === "en" ? `${count} questions` : `${count} сұрақ`
                  }))}
                />

                <SelectMenu
                  ariaLabel={language === "en" ? "Difficulty" : "Күрделілік"}
                  value={difficulty}
                  onChange={(next) => setDifficulty(next as DifficultyLevel)}
                  options={[
                    { value: "easy", label: language === "en" ? "Easy" : "Жеңіл" },
                    { value: "medium", label: language === "en" ? "Medium" : "Орташа" },
                    { value: "hard", label: language === "en" ? "Hard" : "Күрделі" }
                  ]}
                />

                <button
                  type="button"
                  onClick={generateTest}
                  disabled={isLoading || selectedTopics.length === 0}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-950"
                  style={{ background: activeTheme.accent }}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {language === "en" ? "Generate test" : "Тест дайындау"}
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {error}
                  </div>
                ) : null}

                {questions.length === 0 && !error ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    {language === "en"
                      ? "Choose a topic, difficulty level and question count."
                      : "Тақырыпты, деңгейін және сұрақ санын таңдаңыз."}
                  </div>
                ) : null}

                {questions.length > 0 ? (
                  <div className="space-y-4">
                    {questions.map((item, questionIndex) => {
                      const chosenAnswer = answers[item.id];
                      const isAnswered = Boolean(chosenAnswer);

                      return (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <p className="text-sm font-semibold leading-6 text-slate-900 dark:text-zinc-50">
                            {questionIndex + 1}. <RichQuestionText value={item.question} />
                          </p>

                          <div className="mt-3 space-y-2">
                            {item.options.map((option) => {
                              const selected = chosenAnswer === option;
                              const isCorrect = isAnswered && option === item.correct_answer;
                              const isWrong = selected && option !== item.correct_answer;

                              return (
                                <label
                                  key={`${item.id}-${option}`}
                                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm leading-6 transition ${
                                    isAnswered
                                      ? "cursor-default"
                                      : "cursor-pointer hover:border-sky-300 dark:hover:border-cyan-500/50"
                                  } ${
                                    isCorrect
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                                      : isWrong
                                        ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
                                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={item.id}
                                    checked={selected}
                                    onChange={() => chooseAnswer(item.id, option)}
                                    disabled={isAnswered}
                                    className="mt-1 h-4 w-4 shrink-0 accent-sky-600 dark:accent-cyan-400"
                                  />
                                  <RichQuestionText value={option} />
                                </label>
                              );
                            })}
                          </div>

                          {isAnswered ? (
                            <button
                              type="button"
                              onClick={() => onJumpToText?.(item.explanation || item.correct_answer)}
                              className="mt-4 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm leading-6 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
                            >
                              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-zinc-50">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                {language === "en" ? "Explanation" : "Түсіндірме"}
                              </div>
                              <p className="mb-2 font-semibold text-emerald-700 dark:text-emerald-300">
                                {language === "en" ? "Correct answer: " : "Дұрыс жауап: "}
                                {item.correct_answer}
                              </p>
                              <p>
                                <RichQuestionText value={item.explanation} />
                              </p>
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {bankExhausted ? (
                <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-sm text-amber-900 dark:text-amber-200">
                    {language === "en"
                      ? "You have completed all ready-made questions for these topics. You can create new ones."
                      : "Осы тақырыптардың дайын сұрақтарын толық өттіңіз. Енді жаңа сұрақтарды өзіңіз құрастыра аласыз."}
                  </p>
                  <button
                    type="button"
                    onClick={createMoreQuestions}
                    disabled={isCreatingMore}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                  >
                    {isCreatingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {isCreatingMore
                      ? language === "en"
                        ? "Creating..."
                        : "Құрастырылуда..."
                      : language === "en"
                        ? "Create new questions"
                        : "Жаңа сұрақтар құрастыру"}
                  </button>
                </div>
              ) : null}

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                {language === "en"
                  ? `${answeredCount}/${questions.length} answered`
                  : `${answeredCount}/${questions.length} сұраққа жауап берілді`}
                {!bankExhausted && bankRemaining !== null && bankRemaining > 0 ? (
                  <span className="ml-2 text-slate-500 dark:text-zinc-400">
                    {language === "en"
                      ? `· ${bankRemaining} ready-made questions left`
                      : `· банкте тағы ${bankRemaining} дайын сұрақ бар`}
                  </span>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openWindow}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white transition hover:brightness-95 dark:text-zinc-950"
        style={{ ...themeStyle, background: activeTheme.accent }}
      >
        <Wand2 className="h-4 w-4" />
        {language === "en" ? "Generate a test" : "Тест құрастыру"}
      </button>
      {minimizedButton}
      {modal}
    </>
  );
}

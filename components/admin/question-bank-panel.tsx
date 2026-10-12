"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { SelectMenu } from "@/components/ui/select-menu";
import { ChapterEditor } from "@/components/admin/chapter-editor";
import { RichQuestionText } from "@/components/reader/rich-question-text";
import type { SubjectRecord } from "@/lib/types";

type BankQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
};

/** HTML-ден қысқаша алдын ала көрініс жасайды */
function previewText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Жиналмалы жазу алаңы.
 * Жабық күйде бір жолдық болып тұрады, басқанда ғана толық редактор ашылады —
 * сол себепті форма шамадан тыс ұзарып кетпейді.
 */
function CollapsibleEditor({
  label,
  value,
  placeholder,
  isOpen,
  onOpen,
  onClose,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const preview = previewText(value);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-500/40"
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-300">{label}</span>
          <span
            className={`mt-0.5 block truncate text-sm ${
              preview ? "text-slate-800 dark:text-zinc-100" : "text-slate-400 dark:text-zinc-500"
            }`}
          >
            {preview || placeholder}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-200 p-2 dark:border-cyan-500/30">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{label}</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-sky-700 dark:text-zinc-400"
        >
          Жинау
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
      <ChapterEditor value={value} onChange={onChange} heightClass="min-h-[180px] max-h-[42vh]" />
    </div>
  );
}

const emptyDraft = {
  prompt: "",
  options: ["", "", "", ""],
  answerIndex: 0,
  explanation: "",
  difficulty: "medium" as "easy" | "medium" | "hard"
};

/**
 * Тақырыптардың дайын сұрақтар банкін басқару панелі.
 * Әкімші ИИ арқылы топтама құрастырады, сұрақтарды қосады, өңдейді, өшіреді.
 */
export function QuestionBankPanel({ subjects }: { subjects: SubjectRecord[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [bookId, setBookId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState("30");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [isAdding, setIsAdding] = useState(false);
  // Бір уақытта бір ғана өріс ашық тұрады — форма қысқа болып қалады
  const [openField, setOpenField] = useState("prompt");

  const subject = subjects.find((item) => item.id === subjectId) ?? null;
  const book = subject?.books.find((item) => item.id === bookId) ?? null;
  const topics = book?.chapters ?? [];

  const loadQuestions = useCallback(async (chapterId: string) => {
    if (!chapterId) {
      setQuestions([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/topic-questions?chapterIds=${chapterId}&count=50`, {
        credentials: "same-origin",
        cache: "no-store"
      });
      const payload = (await response.json()) as { questions?: BankQuestion[]; total?: number; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Сұрақтарды оқу мүмкін болмады.");
      }

      setQuestions(payload.questions ?? []);
      setTotal(payload.total ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сұрақтарды оқу мүмкін болмады.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuestions(topicId);
  }, [topicId, loadQuestions]);

  async function generate() {
    if (!topicId) {
      setError("Алдымен тақырыпты таңдаңыз.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/topic-questions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: topicId, count: Number(generateCount), difficulty, language: "kk" })
      });
      const payload = (await response.json()) as { added?: number; total?: number; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Құрастыру мүмкін болмады.");
      }

      setMessage(`${payload.added ?? 0} жаңа сұрақ қосылды. Банкте барлығы: ${payload.total ?? 0}`);
      await loadQuestions(topicId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Құрастыру мүмкін болмады.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function removeQuestion(questionId: string) {
    setError("");

    try {
      const response = await fetch(`/api/topic-questions/${questionId}`, {
        method: "DELETE",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Өшіру мүмкін болмады.");
      }

      await loadQuestions(topicId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Өшіру мүмкін болмады.");
    }
  }

  async function saveDraft() {
    setError("");

    if (draft.prompt.trim().length < 5 || draft.options.some((option) => !option.trim())) {
      setError("Сұрақ мәтіні мен төрт жауап нұсқасын толық толтырыңыз.");
      return;
    }

    try {
      const isEdit = Boolean(editingId);
      const response = await fetch(isEdit ? `/api/topic-questions/${editingId}` : "/api/topic-questions", {
        method: isEdit ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? {
                prompt: draft.prompt,
                options: draft.options,
                answerIndex: draft.answerIndex,
                explanation: draft.explanation,
                difficulty: draft.difficulty
              }
            : { chapterId: topicId, ...draft }
        )
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Сақтау мүмкін болмады.");
      }

      setEditingId("");
      setIsAdding(false);
      setDraft(emptyDraft);
      await loadQuestions(topicId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Сақтау мүмкін болмады.");
    }
  }

  function startEdit(question: BankQuestion) {
    setEditingId(question.id);
    setIsAdding(false);
    setOpenField("prompt");
    setDraft({
      prompt: question.question,
      options: [...question.options, "", "", "", ""].slice(0, 4),
      answerIndex: Math.max(0, question.options.indexOf(question.correct_answer)),
      explanation: question.explanation,
      difficulty: (question.difficulty as "easy" | "medium" | "hard") || "medium"
    });
  }

  return (
    <section className="glass-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">Сұрақтар банкі</p>
          <h2 className="mt-2 text-3xl font-semibold">Тақырыптың дайын сұрақтары</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-zinc-400">
            Алдын ала құрастырылған сұрақтар дерекқорда сақталады. Оқушы тест бастағанда солар араластырылып
            беріледі — сондықтан ИИ-ге әр жолы сұраныс кетпейді.
          </p>
        </div>
        <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
          Банкте: {total} сұрақ
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Пән</span>
          <SelectMenu
            value={subjectId}
            placeholder="Пәнді таңдаңыз"
            onChange={(next) => {
              setSubjectId(next);
              setBookId("");
              setTopicId("");
            }}
            options={subjects.map((item) => ({ value: item.id, label: item.name, badge: item.books.length }))}
          />
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Кітап</span>
          <SelectMenu
            value={bookId}
            placeholder="Кітапты таңдаңыз"
            disabled={!subject}
            onChange={(next) => {
              setBookId(next);
              setTopicId("");
            }}
            options={(subject?.books ?? []).map((item) => ({
              value: item.id,
              label: item.title,
              badge: item.chapters.length
            }))}
          />
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Тақырып</span>
          <SelectMenu
            value={topicId}
            placeholder="Тақырыпты таңдаңыз"
            disabled={!book}
            onChange={(next) => setTopicId(next)}
            options={topics.map((item) => ({ value: item.id, label: item.title }))}
          />
        </div>
      </div>

      {topicId ? (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Қанша сұрақ құрастыру</span>
              <input
                type="number"
                min={1}
                max={200}
                value={generateCount}
                onChange={(event) => setGenerateCount(event.target.value)}
                className="h-11 w-32 rounded-2xl border border-slate-200 bg-white px-4 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>

            <div className="grid gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-zinc-300">Деңгей</span>
              <SelectMenu
                size="sm"
                className="w-44"
                value={difficulty}
                onChange={(next) => setDifficulty(next as "easy" | "medium" | "hard")}
                options={[
                  { value: "easy", label: "Жеңіл" },
                  { value: "medium", label: "Орташа" },
                  { value: "hard", label: "Күрделі" }
                ]}
              />
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={isGenerating}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-sky-700 px-5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {isGenerating ? "Құрастырылуда..." : "ИИ арқылы құрастыру"}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAdding(true);
                setEditingId("");
                setDraft(emptyDraft);
                setOpenField("prompt");
              }}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <Plus className="h-4 w-4" />
              Қолмен қосу
            </button>
          </div>

          {message ? (
            <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          {isAdding || editingId ? (
            <div className="mt-5 grid gap-3 rounded-3xl border border-sky-200 bg-sky-50/60 p-4 dark:border-cyan-500/30 dark:bg-cyan-500/10">
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                {editingId ? "Сұрақты өңдеу" : "Жаңа сұрақ"}
              </p>
              {/* Әр өріс жиналмалы: басқанда ғана толық редактор ашылады.
                  Редакторда кітап мәтініндегідей барлық мүмкіндік бар. */}
              <CollapsibleEditor
                label="Сұрақ мәтіні"
                value={draft.prompt}
                placeholder="Сұрақты жазу үшін басыңыз"
                isOpen={openField === "prompt"}
                onOpen={() => setOpenField("prompt")}
                onClose={() => setOpenField("")}
                onChange={(value) => setDraft((current) => ({ ...current, prompt: value }))}
              />

              {draft.options.map((option, index) => (
                <div
                  key={index}
                  className={`rounded-2xl border p-2 ${
                    draft.answerIndex === index
                      ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/5"
                      : "border-transparent"
                  }`}
                >
                  <label className="mb-1 flex items-center gap-2 px-1 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    <input
                      type="radio"
                      name="bank-answer"
                      checked={draft.answerIndex === index}
                      onChange={() => setDraft((current) => ({ ...current, answerIndex: index }))}
                      className="h-4 w-4"
                    />
                    {index + 1}-нұсқа
                    {draft.answerIndex === index ? (
                      <span className="text-emerald-700 dark:text-emerald-300">· дұрыс жауап</span>
                    ) : null}
                  </label>
                  <CollapsibleEditor
                    label={`${index + 1}-нұсқа`}
                    value={option}
                    placeholder="Жауап нұсқасын жазу үшін басыңыз"
                    isOpen={openField === `option-${index}`}
                    onOpen={() => setOpenField(`option-${index}`)}
                    onClose={() => setOpenField("")}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        options: current.options.map((item, position) => (position === index ? value : item))
                      }))
                    }
                  />
                </div>
              ))}

              <CollapsibleEditor
                label="Түсіндірме (міндетті емес)"
                value={draft.explanation}
                placeholder="Қажет болса, түсіндірме жазу үшін басыңыз"
                isOpen={openField === "explanation"}
                onOpen={() => setOpenField("explanation")}
                onClose={() => setOpenField("")}
                onChange={(value) => setDraft((current) => ({ ...current, explanation: value }))}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  className="rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
                >
                  Сақтау
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId("");
                    setDraft(emptyDraft);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  Бас тарту
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {isLoading ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">Жүктелуде...</p>
            ) : questions.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                Бұл тақырыпта әлі сұрақ жоқ. Жоғарыдағы батырмамен құрастырыңыз.
              </p>
            ) : (
              questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">
                      {index + 1}. <RichQuestionText value={question.question} />
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(question)}
                        aria-label="Өңдеу"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:text-zinc-300"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(question.id)}
                        aria-label="Өшіру"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <ul className="mt-2 grid gap-1 text-sm text-slate-600 dark:text-zinc-400">
                    {question.options.map((option) => (
                      <li
                        key={option}
                        className={option === question.correct_answer ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""}
                      >
                        • <RichQuestionText value={option} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
          Сұрақтарды басқару үшін пән, кітап және тақырыпты таңдаңыз.
        </p>
      )}
    </section>
  );
}

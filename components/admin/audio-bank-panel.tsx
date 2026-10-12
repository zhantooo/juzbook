"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Headphones, Loader2, RefreshCcw, Trash2, Wand2 } from "lucide-react";
import { SelectMenu } from "@/components/ui/select-menu";
import type { SubjectRecord } from "@/lib/types";

type PreparedAudio = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  voice: string;
  durationMs: number;
  wordCount: number;
  byteSize: number;
  updatedAt: string;
};

type GenerateResult = {
  chapterId: string;
  title: string;
  status: string;
  detail?: string;
};

const voices = [
  { value: "kk-KZ-AigulNeural", label: "Қазақша әйел дауысы (Айгүл)" },
  { value: "kk-KZ-DauletNeural", label: "Қазақша ер дауысы (Дәулет)" },
  { value: "ru-RU-SvetlanaNeural", label: "Орысша әйел дауысы" },
  { value: "en-US-JennyNeural", label: "Ағылшынша әйел дауысы" }
];

const statusLabels: Record<string, string> = {
  created: "жасалды",
  updated: "жаңартылды",
  skipped: "бұрыннан бар",
  empty: "мәтін жеткіліксіз",
  failed: "қате"
};

function formatDuration(ms: number) {
  if (!ms) {
    return "—";
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (!bytes) {
    return "—";
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/**
 * Тақырып аудиоларын алдын ала дайындау панелі.
 * Аудио бір рет жасалып сақталады — оқушы бетті ашқанда күтпейді,
 * әрі әр сөздің уақыты қоса сақталғандықтан мәтінде сөз ерекшеленеді.
 */
export function AudioBankPanel({ subjects }: { subjects: SubjectRecord[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [bookId, setBookId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [voice, setVoice] = useState(voices[0].value);
  const [bulkLimit, setBulkLimit] = useState("5");
  const [audios, setAudios] = useState<PreparedAudio[]>([]);
  const [results, setResults] = useState<GenerateResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const subject = subjects.find((item) => item.id === subjectId) ?? null;
  const book = subject?.books.find((item) => item.id === bookId) ?? null;
  const topics = book?.chapters ?? [];

  const loadAudios = useCallback(async (targetBookId: string) => {
    if (!targetBookId) {
      setAudios([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/topic-audio?bookId=${encodeURIComponent(targetBookId)}`, {
        credentials: "same-origin",
        cache: "no-store"
      });
      const payload = (await response.json()) as { audios?: PreparedAudio[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Аудио тізімін оқу мүмкін болмады.");
      }

      setAudios(payload.audios ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Аудио тізімін оқу мүмкін болмады.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudios(bookId);
  }, [bookId, loadAudios]);

  async function generate(scope: "topic" | "book", force: boolean) {
    if (scope === "topic" && !topicId) {
      setError("Алдымен тақырыпты таңдаңыз.");
      return;
    }
    if (scope === "book" && !bookId) {
      setError("Алдымен кітапты таңдаңыз.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setMessage("");
    setResults([]);

    try {
      const response = await fetch("/api/topic-audio", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "topic"
            ? { chapterId: topicId, voice, force }
            : { bookId, voice, force, limit: Math.max(1, Math.min(40, Number(bulkLimit) || 5)) }
        )
      });
      const payload = (await response.json()) as { created?: number; results?: GenerateResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Аудио дайындау мүмкін болмады.");
      }

      setResults(payload.results ?? []);
      setMessage(`${payload.created ?? 0} аудио дайын болды.`);
      await loadAudios(bookId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Аудио дайындау мүмкін болмады.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function removeAudio(audioId: string) {
    setError("");

    try {
      const response = await fetch(`/api/topic-audio/${audioId}`, {
        method: "DELETE",
        credentials: "same-origin"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Аудионы өшіру мүмкін болмады.");
      }

      setAudios((current) => current.filter((item) => item.id !== audioId));
      setMessage("Аудио өшірілді.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Аудионы өшіру мүмкін болмады.");
    }
  }

  const topicAudio = audios.find((item) => item.chapterId === topicId && item.voice === voice) ?? null;

  return (
    <section className="rounded-panel border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Headphones className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
          <div>
            <h2 className="text-lg font-semibold">Аудио банкі</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Тақырып аудиосын алдын ала дайындаңыз — оқушы бетті ашқанда күтпейді.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
          Кітапта дайын: {audios.length}
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
          Пән
          <div className="mt-1">
            <SelectMenu
              size="sm"
              ariaLabel="Пән"
              value={subjectId}
              onChange={(next) => {
                setSubjectId(next);
                setBookId("");
                setTopicId("");
              }}
              options={[
                { value: "", label: "Таңдаңыз" },
                ...subjects.map((item) => ({ value: item.id, label: item.name }))
              ]}
            />
          </div>
        </label>

        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
          Кітап
          <div className="mt-1">
            <SelectMenu
              size="sm"
              ariaLabel="Кітап"
              value={bookId}
              onChange={(next) => {
                setBookId(next);
                setTopicId("");
              }}
              options={[
                { value: "", label: "Таңдаңыз" },
                ...(subject?.books ?? []).map((item) => ({ value: item.id, label: item.title }))
              ]}
            />
          </div>
        </label>

        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
          Тақырып
          <div className="mt-1">
            <SelectMenu
              size="sm"
              ariaLabel="Тақырып"
              value={topicId}
              onChange={setTopicId}
              options={[
                { value: "", label: "Таңдаңыз" },
                ...topics.map((item) => ({ value: item.id, label: item.title }))
              ]}
            />
          </div>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
          Дауыс
          <div className="mt-1">
            <SelectMenu size="sm" ariaLabel="Дауыс" value={voice} onChange={setVoice} options={voices} />
          </div>
        </label>

        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
          Кітап бойынша бір жолғы саны
          <input
            type="number"
            min={1}
            max={40}
            value={bulkLimit}
            onChange={(event) => setBulkLimit(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="flex items-end">
          <p className="text-[11px] leading-4 text-slate-500 dark:text-zinc-400">
            Аудио едәуір уақыт алады (тақырыпқа шамамен 20–60 секунд). Бетті жаппаңыз.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void generate("topic", false)}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Тақырып аудиосын дайындау
        </button>

        <button
          type="button"
          onClick={() => void generate("topic", true)}
          disabled={isGenerating || !topicAudio}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
        >
          <RefreshCcw className="h-4 w-4" />
          Қайта жасау
        </button>

        <button
          type="button"
          onClick={() => void generate("book", false)}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
        >
          <Headphones className="h-4 w-4" />
          Кітаптағы қалғандарын дайындау
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {results.length ? (
        <ul className="mt-3 space-y-1 rounded-xl border border-slate-200 p-3 text-xs dark:border-zinc-800">
          {results.map((item) => (
            <li key={`${item.chapterId}-${item.status}`} className="flex items-start justify-between gap-3">
              <span className="text-slate-600 dark:text-zinc-300">{item.title}</span>
              <span
                className={
                  item.status === "failed"
                    ? "shrink-0 font-semibold text-rose-600 dark:text-rose-300"
                    : "shrink-0 font-semibold text-slate-500 dark:text-zinc-400"
                }
              >
                {statusLabels[item.status] ?? item.status}
                {item.detail ? ` — ${item.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Дайын аудиолар</h3>

        {isLoading ? (
          <p className="text-xs text-slate-500 dark:text-zinc-400">Жүктелуде...</p>
        ) : !bookId ? (
          <p className="text-xs text-slate-500 dark:text-zinc-400">Кітапты таңдаңыз.</p>
        ) : !audios.length ? (
          <p className="text-xs text-slate-500 dark:text-zinc-400">Бұл кітапта әзірге дайын аудио жоқ.</p>
        ) : (
          <ul className="space-y-2">
            {audios.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-zinc-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {item.chapterTitle}
                  </p>
                  <p className="mt-0.5 text-slate-500 dark:text-zinc-400">
                    {item.voice} · {formatDuration(item.durationMs)} · {item.wordCount} сөз белгісі ·{" "}
                    {formatSize(item.byteSize)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeAudio(item.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2 py-1 font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Өшіру
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { SelectMenu } from "@/components/ui/select-menu";

type ImportResponse = {
  message?: string;
  output?: string;
  error?: string;
};

export function PdfImportPanel({
  subjects,
  onImported
}: {
  subjects: Array<{ id: string; name: string }>;
  onImported: () => Promise<void>;
}) {
  const [subject, setSubject] = useState(subjects[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [grade, setGrade] = useState("");
  const [skipFirst, setSkipFirst] = useState("2");
  const [skipLast, setSkipLast] = useState("1");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const selectedFileNames = useMemo(() => files.map((file) => file.name).join(", "), [files]);
  const hasSubjects = subjects.length > 0;

  useEffect(() => {
    if (!subject && subjects[0]?.name) {
      setSubject(subjects[0].name);
    }
  }, [subject, subjects]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!files.length) {
      setResult({ error: "Кемінде бір PDF файл таңдаңыз." });
      return;
    }

    if (!subject.trim()) {
      setResult({ error: "Пәнді таңдаңыз." });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      formData.append("subject", subject.trim());
      formData.append("title", title.trim());
      formData.append("author", author.trim());
      formData.append("grade", grade.trim());
      formData.append("skipFirst", skipFirst || "2");
      formData.append("skipLast", skipLast || "1");
      formData.append("replaceExisting", replaceExisting ? "true" : "false");

      const response = await fetch("/api/admin/import-books", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as ImportResponse;
      if (!response.ok) {
        throw new Error(payload.error || "PDF импорттау кезінде қате пайда болды.");
      }

      setResult(payload);
      await onImported();
      setFiles([]);
      setTitle("");
      setAuthor("");
      setGrade("");
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "PDF импорттау кезінде қате пайда болды."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="glass-card mt-8 p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">PDF импорт</p>
          <h2 className="mt-3 text-3xl font-semibold">Оқулықтарды платформаға жүктеу</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
            PDF файлды осы жерге жүктеңіз. Жүйе кітапты автоматты түрде бөліп, бөлім, тарау және тақырыптарға ажыратып базаға құяды.
          </p>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Пән</span>
            <SelectMenu
              ariaLabel="Пән"
              placeholder="Алдымен пән қосыңыз"
              disabled={!hasSubjects}
              value={subject}
              onChange={(next) => setSubject(next)}
              options={hasSubjects ? subjects.map((item) => ({ value: item.name, label: item.name })) : []}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Кітап атауы</span>
            <input
              value={title}
              spellCheck={false}
              onChange={(event) => setTitle(event.target.value || "")}
              placeholder="Бос қалса, файл атынан оқылады"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Автор</span>
            <input
              value={author}
              spellCheck={false}
              onChange={(event) => setAuthor(event.target.value || "")}
              placeholder="Бос қалса, файл атынан не қолмен енгізіледі"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Сынып</span>
            <input
              value={grade}
              spellCheck={false}
              onChange={(event) => setGrade(event.target.value || "")}
              placeholder="Мысалы: 8-сынып"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Алғашқы өткізілетін бет саны</span>
            <input
              type="number"
              min="0"
              value={skipFirst}
              onChange={(event) => setSkipFirst(event.target.value || "0")}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">Соңғы өткізілетін бет саны</span>
            <input
              type="number"
              min="0"
              value={skipLast}
              onChange={(event) => setSkipLast(event.target.value || "0")}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
          </label>

          <label className="flex items-end gap-3 pb-2">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-slate-700 dark:text-zinc-200">Бар кітапты қайта жазу</span>
          </label>
        </div>

        <label className="block rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-sky-300 hover:bg-sky-50/70 dark:border-zinc-700 dark:bg-zinc-950/60 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-white p-3 shadow-sm dark:bg-zinc-900">
              <UploadCloud className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">PDF файлдарын жүктеу</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Бір немесе бірнеше файл таңдай аласыз</p>
            </div>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-sky-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-sky-700 dark:text-zinc-300 dark:file:bg-cyan-400 dark:file:text-zinc-950 dark:hover:file:bg-cyan-300"
            />
            {selectedFileNames ? (
              <p className="w-full rounded-2xl bg-white px-4 py-3 text-left text-xs text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                {selectedFileNames}
              </p>
            ) : null}
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !files.length || !hasSubjects}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Платформаға импорттау
          </button>
          <p className="text-xs leading-6 text-slate-500 dark:text-zinc-400">
            Бір файл болса, атау мен авторды қолмен беруге болады. Көп файл болса, жүйе файл атынан тануға тырысады.
          </p>
        </div>

        {result?.message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <p className="font-semibold">{result.message}</p>
            {result.output ? <pre className="mt-3 whitespace-pre-wrap font-mono text-xs">{result.output}</pre> : null}
          </div>
        ) : null}

        {result?.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            <p className="font-semibold">Импорттау орындалмады</p>
            <p className="mt-1">{result.error}</p>
            {result.output ? <pre className="mt-3 whitespace-pre-wrap font-mono text-xs">{result.output}</pre> : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}

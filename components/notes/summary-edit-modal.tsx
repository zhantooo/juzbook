"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { NoteEditor } from "@/components/notes/note-editor";
import type { SummaryRecord } from "@/lib/types";

type SummaryEditModalProps = {
  summary: SummaryRecord | null;
  onClose: () => void;
  onSave: (payload: { title: string; content: string }) => void;
};

export function SummaryEditModal({ summary, onClose, onSave }: SummaryEditModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!summary) {
      return;
    }

    setTitle(summary.title || "");
    setContent(summary.content || "");
  }, [summary]);

  useEffect(() => {
    if (!summary) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [summary]);

  if (!summary) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-panel border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">Конспектті өңдеу</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-zinc-50">{summary.chapterTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
            aria-label="Терезені жабу"
            title="Терезені жабу"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <input
            value={title}
            spellCheck={false}
            onChange={(event) => setTitle(event.target.value || "")}
            placeholder="Конспект атауы"
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-cyan-400"
          />
          <NoteEditor
            value={content}
            onChange={(nextValue) => setContent(nextValue || "")}
            placeholder="Конспект мәтінін осы жерде толық өңдеңіз..."
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
          >
            Бас тарту
          </button>
          <button
            type="button"
            onClick={() => {
              if (!title.trim() || !content.trim()) {
                return;
              }

              onSave({
                title: title.trim(),
                content: content.trim()
              });
            }}
            className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
          >
            Өзгерісті сақтау
          </button>
        </div>
      </div>
    </div>
  );
}

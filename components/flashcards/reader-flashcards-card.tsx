"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Layers, Plus } from "lucide-react";
import { FlipCard } from "@/components/flashcards/flip-card";
import { useAuth } from "@/components/state/auth-context";

type ReaderFlashcardsCardProps = {
  subjectId: string;
  subjectName: string;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  accentColor?: string;
};

/** Оқу бетіндегі шағын флешкарта блогы: осы тақырыптың карточкалары және жылдам қосу */
export function ReaderFlashcardsCard({
  subjectId,
  subjectName,
  bookId,
  bookTitle,
  chapterId,
  chapterTitle,
  accentColor
}: ReaderFlashcardsCardProps) {
  const { flashcards, addFlashcard } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState("");

  const topicCards = flashcards.filter((card) => card.chapterId === chapterId);
  const total = topicCards.length;
  const safeIndex = total ? Math.min(index, total - 1) : 0;
  const card = total ? topicCards[safeIndex] : null;

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [chapterId]);

  function step(delta: number) {
    if (total < 2) {
      return;
    }

    setFlipped(false);
    setIndex((current) => (Math.min(current, total - 1) + delta + total) % total);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim() || !answer.trim()) {
      setError("Сұрақ пен жауапты жазыңыз.");
      return;
    }

    addFlashcard({ question, answer, subjectId, subjectName, bookId, bookTitle, chapterId, chapterTitle });
    setQuestion("");
    setAnswer("");
    setError("");
    // Жаңа карточка тізімнің басына қосылады
    setIndex(0);
    setFlipped(false);
  }

  const inputClass =
    "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50";

  return (
    <div className="mt-5 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-700 dark:text-cyan-300" style={accentColor ? { color: accentColor } : undefined} />
          <p className="text-sm font-semibold">Флешкарталар</p>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
            {total}
          </span>
        </div>
        <Link
          href="/flashcards"
          className="text-xs font-semibold text-sky-700 underline-offset-4 hover:underline dark:text-cyan-300"
        >
          Барлығы →
        </Link>
      </div>

      {card ? (
        <div className="mt-3">
          <FlipCard
            size="sm"
            question={card.question}
            answer={card.answer}
            flipped={flipped}
            onFlip={() => setFlipped((current) => !current)}
          />
          {total > 1 ? (
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Алдыңғы карточка"
                className="rounded-full p-1.5 transition hover:bg-white dark:hover:bg-zinc-900"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span>
                {safeIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Келесі карточка"
                className="rounded-full p-1.5 transition hover:bg-white dark:hover:bg-zinc-900"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
          Осы тақырып бойынша әзірге карточка жоқ. Төменнен сұрақ пен жауап жазып қосыңыз.
        </p>
      )}

      <form onSubmit={submit} className="mt-3 grid gap-2">
        <input
          value={question}
          maxLength={600}
          spellCheck={false}
          onChange={(event) => {
            setQuestion(event.target.value || "");
            setError("");
          }}
          placeholder="Сұрақ"
          aria-label="Флешкарта сұрағы"
          className={inputClass}
        />
        <input
          value={answer}
          maxLength={1200}
          spellCheck={false}
          onChange={(event) => {
            setAnswer(event.target.value || "");
            setError("");
          }}
          placeholder="Жауап"
          aria-label="Флешкарта жауабы"
          className={inputClass}
        />
        {error ? <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 dark:bg-cyan-400 dark:text-zinc-950"
          style={accentColor ? { background: accentColor, color: "#ffffff" } : undefined}
        >
          <Plus className="h-4 w-4" />
          Карточка қосу
        </button>
      </form>
    </div>
  );
}

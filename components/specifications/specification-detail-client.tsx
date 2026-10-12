"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CheckSquare2 } from "lucide-react";

type TopicItem = {
  id: string;
  topic: {
    id: string;
    title: string;
    excerpt: string;
    bookId: string;
    book: {
      title: string;
    };
  };
};

type Props = {
  specificationId: string;
  subjectId: string;
  items: TopicItem[];
};

const checkedKey = (specificationId: string) => `juzbook-spec-checked-${specificationId}`;
const lastKey = (specificationId: string) => `juzbook-spec-last-${specificationId}`;

export function SpecificationDetailClient({ specificationId, subjectId, items }: Props) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedChecked = JSON.parse(window.localStorage.getItem(checkedKey(specificationId)) || "[]");
      setCheckedIds(Array.isArray(storedChecked) ? storedChecked : []);
    } catch {
      setCheckedIds([]);
    }
  }, [specificationId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(checkedKey(specificationId), JSON.stringify(checkedIds));
  }, [checkedIds, specificationId]);

  const checkedCount = useMemo(() => checkedIds.length, [checkedIds.length]);

  function toggleChecked(topicId: string) {
    setCheckedIds((current) => {
      const next = current.includes(topicId) ? current.filter((item) => item !== topicId) : [...current, topicId];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(lastKey(specificationId), topicId);
      }
      return next;
    });
  }

  function scrollToLastTopic() {
    if (typeof window === "undefined") {
      return;
    }

    const topicId = window.localStorage.getItem(lastKey(specificationId));
    if (!topicId) {
      return;
    }

    cardRefs.current[topicId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      <section className="mt-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckSquare2 className="h-4 w-4" />
          Белгіленді: {checkedCount}
        </div>

        <button
          type="button"
          onClick={scrollToLastTopic}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
        >
          <ArrowRight className="h-4 w-4" />
          Соңғы белгіленгенге өту
        </button>
      </section>

      <section className="mt-6 grid gap-4">
        {items.map((item, index) => {
          const checked = checkedIds.includes(item.topic.id);

          return (
            <div
              key={item.id}
              ref={(node) => {
                cardRefs.current[item.topic.id] = node;
              }}
              className={`rounded-3xl border bg-white p-6 transition dark:border-zinc-800 dark:bg-zinc-900 ${
                checked
                  ? "border-emerald-300 shadow-sm shadow-emerald-100 dark:border-emerald-500/40"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Қадам {index + 1}</p>
                  <h2 className="mt-3 text-2xl font-semibold">{item.topic.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">{item.topic.excerpt}</p>
                  <p className="mt-4 text-xs text-slate-500 dark:text-zinc-400">{item.topic.book.title}</p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleChecked(item.topic.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      checked
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {checked ? "Белгіленді" : "Белгілеу"}
                  </button>

                  <Link
                    href={`/books/${item.topic.bookId}/chapters/${item.topic.id}?subject=${subjectId}`}
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(lastKey(specificationId), item.topic.id);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-medium text-white dark:bg-cyan-400 dark:text-zinc-950"
                  >
                    Тақырыпты оқу
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

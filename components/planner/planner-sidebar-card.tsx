"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, ListTodo } from "lucide-react";
import { useAuth } from "@/components/state/auth-context";

type PlannerSidebarCardProps = {
  subjectId?: string | null;
  bookId?: string | null;
  topicId?: string | null;
  accentColor?: string;
};

export function PlannerSidebarCard({
  subjectId,
  bookId,
  topicId,
  accentColor = "#0284c7"
}: PlannerSidebarCardProps) {
  const { todoTasks, toggleTodoTask } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const relevantTasks = todoTasks
    .filter((task) => {
      if (topicId && task.topicId === topicId) {
        return true;
      }

      if (bookId && task.bookId === bookId) {
        return true;
      }

      if (subjectId && task.subjectId === subjectId) {
        return true;
      }

      return false;
    })
    .sort((left, right) => Number(left.completed) - Number(right.completed))
    .slice(0, 4);

  const fallbackTasks =
    relevantTasks.length > 0
      ? relevantTasks
      : todoTasks
          .slice()
          .sort((left, right) => Number(left.completed) - Number(right.completed))
          .slice(0, 4);

  return (
    <div className="mt-5 rounded-3xl border border-slate-200/80 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-sky-700 dark:text-cyan-300" />
          <p className="text-sm font-semibold">Жоспар</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
        >
          {isOpen ? "Жабу" : "Ашу"}
          <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {!isOpen ? (
        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-zinc-400">
          Жоспар әдепкіде жинақы тұрады. Қажет кезде ашып, осы тақырыпқа қатысты міндеттерді көре аласыз.
        </p>
      ) : fallbackTasks.length > 0 ? (
        <div className="mt-3 space-y-2">
          {fallbackTasks.map((task) => {
            const linkedHref =
              task.bookId && task.topicId && task.subjectId
                ? `/books/${task.bookId}/chapters/${task.topicId}?subject=${task.subjectId}`
                : "/planner";

            return (
              <div
                key={task.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleTodoTask(task.id)}
                    className="mt-0.5 rounded-full text-slate-400 transition hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-300"
                    aria-label={task.completed ? "Орындалмаған деп белгілеу" : "Орындалды деп белгілеу"}
                    title={task.completed ? "Орындалмаған деп белгілеу" : "Орындалды деп белгілеу"}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        task.completed ? "text-slate-400 line-through dark:text-zinc-500" : "text-slate-800 dark:text-zinc-100"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                        {task.description}
                      </p>
                    ) : null}
                    {task.topicTitle ? (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-slate-400 dark:text-zinc-500">
                        {task.topicTitle}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400 dark:text-zinc-500">
                    {task.subtasks.length > 0
                      ? `${task.subtasks.filter((item) => item.completed).length}/${task.subtasks.length} қосымша міндет`
                      : "Міндет"}
                  </span>
                  <Link
                    href={linkedHref}
                    className="inline-flex items-center gap-1 text-xs font-semibold transition hover:opacity-80"
                    style={{ color: accentColor }}
                  >
                    Ашу
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Жоспар әлі бос. Міндеттерді жоспар бетінде қоса аласыз.
        </div>
      )}

      {isOpen ? (
        <Link
          href="/planner"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
        >
          Барлық жоспарды ашу
        </Link>
      ) : null}
    </div>
  );
}

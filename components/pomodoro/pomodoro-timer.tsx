"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useAuth } from "@/components/state/auth-context";
import { usePomodoro } from "@/components/state/pomodoro-context";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function PomodoroTimer() {
  const {
    mode,
    isRunning,
    secondsLeft,
    cycleCount,
    notification,
    isMinimized,
    canMove,
    position,
    hasCustomPosition,
    start,
    pause,
    reset,
    clearNotification,
    toggleMinimized,
    setCanMove,
    setPosition
  } = usePomodoro();
  const pathname = usePathname();
  const { session } = useAuth();
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const isReaderArea =
    pathname.startsWith("/books/") ||
    pathname.startsWith("/subjects/") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/notes");

  useEffect(() => {
    if (!canMove) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      if (!dragRef.current) {
        return;
      }

      setPosition({
        x: Math.max(10, event.clientX - dragRef.current.offsetX),
        y: Math.max(10, event.clientY - dragRef.current.offsetY)
      });
    };

    const handleUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [canMove, setPosition]);

  if (!session || session.role !== "USER" || pathname.startsWith("/admin") || pathname === "/login" || !isReaderArea) {
    return null;
  }

  const fixedCornerClass = "fixed bottom-6 right-6 z-50";
  const customClass = "fixed z-50";
  const wrapperClass = canMove && hasCustomPosition ? customClass : fixedCornerClass;
  const wrapperStyle = canMove && hasCustomPosition ? { left: position.x, top: position.y } : undefined;

  if (isMinimized) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <button
          type="button"
          onClick={toggleMinimized}
          className="glass-card accent-ring inline-flex items-center gap-3 rounded-full px-4 py-3"
        >
          <Timer className="h-4 w-4 text-sky-700 dark:text-cyan-300" />
          <span className="text-sm font-semibold">{formatTime(secondsLeft)}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`${wrapperClass} w-[min(92vw,22rem)]`} style={wrapperStyle}>
      <div
        className="glass-card accent-ring overflow-hidden p-4"
        onMouseDown={(event) => {
          if (!canMove) {
            return;
          }

          const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
          dragRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top
          };

          if (!hasCustomPosition) {
            setPosition({
              x: rect.left,
              y: rect.top
            });
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Помодоро</p>
            <h3 className="mt-2 text-2xl font-semibold">{mode === "focus" ? "25 минут оқу" : "5 минут демалыс"}</h3>
          </div>
          <button
            type="button"
            onClick={toggleMinimized}
            className="rounded-full bg-slate-100 p-3 text-sky-700 transition hover:bg-slate-200 dark:bg-zinc-800 dark:text-cyan-300 dark:hover:bg-zinc-700"
          >
            <Timer className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-5xl font-semibold tracking-tight">{formatTime(secondsLeft)}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Аяқталған циклдер: {cycleCount}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isRunning
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {isRunning ? "Жүріп тұр" : "Тоқтап тұр"}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
          >
            <Play className="h-4 w-4" />
            Бастау
          </button>
          <button
            type="button"
            onClick={pause}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:text-zinc-50"
          >
            <Pause className="h-4 w-4" />
            Үзіліс
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-rose-300 hover:text-rose-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-rose-500/50 dark:hover:text-rose-300"
          >
            <RotateCcw className="h-4 w-4" />
            Қалпына келтіру
          </button>
        </div>

        <button
          type="button"
          onClick={toggleMinimized}
          className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700"
        >
          Жинақтау
        </button>

        <label className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={canMove}
            onChange={(event) => setCanMove(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Орынды өзгерту
        </label>

        {notification ? (
          <button
            type="button"
            onClick={clearNotification}
            className="mt-4 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {notification}
          </button>
        ) : null}
      </div>
    </div>
  );
}

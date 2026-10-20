"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, Medal, RefreshCw, TrendingUp } from "lucide-react";
import { formatCount } from "@/lib/arena/format";
import { httpArenaService as service } from "@/lib/arena/service.http";
import type { HistoryRow, LeaderboardRow, SubjectRating } from "@/lib/arena/service";

/**
 * Рейтинг экрандары: лидерлер тізімі, матч тарихы, өз рейтингің.
 *
 * Үшеуі де бір үлгіде: жүктелу → қате → бос → дерек. Бос күй маңызды —
 * жаңа оқушы бірінші күні осыны көреді, сондықтан ол «ештеңе жоқ» емес,
 * «не істеу керек» дегенді айтуы тиіс.
 */

type LoadState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; rows: T[] };

function useRows<T>(load: () => Promise<T[]>, deps: unknown[]) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  const run = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", rows: await load() });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Деректі алу мүмкін болмады."
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
  }, [run]);

  return { state, reload: run };
}

function Panel({
  icon: Icon,
  title,
  children,
  onReload
}: {
  icon: typeof Medal;
  title: string;
  children: React.ReactNode;
  onReload?: () => void;
}) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
          {title}
        </h2>
        {onReload ? (
          <button
            type="button"
            onClick={onReload}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Жаңарту
          </button>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-zinc-400" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Қайталау
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm leading-6 text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
      {children}
    </p>
  );
}

/** Бір пәннің лидерлер тізімі */
export function SubjectLeaderboard({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  const { state, reload } = useRows<LeaderboardRow>(
    () => service.getLeaderboard(subjectId, 10),
    [subjectId]
  );

  return (
    <Panel icon={Medal} title="Лидерлер" onReload={state.status === "ready" ? reload : undefined}>
      {state.status === "loading" ? <Loading label="Тізім жүктелуде…" /> : null}
      {state.status === "error" ? <Failed message={state.message} onRetry={reload} /> : null}
      {state.status === "ready" && state.rows.length === 0 ? (
        <Empty>
          {subjectName} бойынша әлі ешкім ойнамаған. Бірінші матчты бастасаң, тізімнің басында
          тұрасың.
        </Empty>
      ) : null}
      {state.status === "ready" && state.rows.length > 0 ? (
        <ol className="space-y-1.5">
          {state.rows.map((row) => (
            <li
              key={row.playerId}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${
                row.isYou
                  ? "bg-sky-50 ring-1 ring-sky-200 dark:bg-cyan-500/10 dark:ring-cyan-500/30"
                  : "bg-slate-50 dark:bg-zinc-900/60"
              }`}
            >
              <span className="w-6 shrink-0 text-center font-semibold tabular-nums text-slate-500 dark:text-zinc-400">
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {row.displayName}
                {row.isYou ? <span className="ml-2 text-xs text-sky-700 dark:text-cyan-300">сен</span> : null}
              </span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-zinc-500">
                {row.won}/{row.played}
              </span>
              <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                {formatCount(row.rating)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}

/** Ойыншының барлық пәндегі рейтингі */
export function MyRatings() {
  const { state, reload } = useRows<SubjectRating>(() => service.getRatings(), []);

  return (
    <Panel icon={TrendingUp} title="Менің рейтингім" onReload={state.status === "ready" ? reload : undefined}>
      {state.status === "loading" ? <Loading label="Рейтинг жүктелуде…" /> : null}
      {state.status === "error" ? <Failed message={state.message} onRetry={reload} /> : null}
      {state.status === "ready" && state.rows.length === 0 ? (
        <Empty>Әлі бірде-бір матч ойналмаған. Пәнді таңдап, бірінші жекпе-жекті баста.</Empty>
      ) : null}
      {state.status === "ready" && state.rows.length > 0 ? (
        <ul className="space-y-1.5">
          {state.rows.map((row) => (
            <li
              key={row.subjectId}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-zinc-900/60"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{row.subjectName}</span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-zinc-500">
                {row.won} жеңіс · {row.played} матч
                {row.rank ? ` · ${row.rank}-орын` : ""}
              </span>
              <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                {formatCount(row.rating)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

const RESULT_LABEL: Record<HistoryRow["result"], string> = {
  won: "жеңіс",
  lost: "жеңіліс",
  drawn: "тең"
};

const RESULT_TONE: Record<HistoryRow["result"], string> = {
  won: "text-emerald-700 dark:text-emerald-400",
  lost: "text-rose-600 dark:text-rose-400",
  drawn: "text-slate-500 dark:text-zinc-400"
};

/** Аяқталған матчтар */
export function MatchHistory({ subjectId }: { subjectId?: string }) {
  const { state, reload } = useRows<HistoryRow>(() => service.getHistory(subjectId, 15), [subjectId]);

  return (
    <Panel icon={History} title="Соңғы матчтар" onReload={state.status === "ready" ? reload : undefined}>
      {state.status === "loading" ? <Loading label="Тарих жүктелуде…" /> : null}
      {state.status === "error" ? <Failed message={state.message} onRetry={reload} /> : null}
      {state.status === "ready" && state.rows.length === 0 ? (
        <Empty>Аяқталған матч жоқ. Бірінші жекпе-жектен кейін осында тарих жиналады.</Empty>
      ) : null}
      {state.status === "ready" && state.rows.length > 0 ? (
        <ul className="space-y-1.5">
          {state.rows.map((row) => (
            <li
              key={row.matchId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-zinc-900/60"
            >
              <span className={`w-16 shrink-0 font-semibold ${RESULT_TONE[row.result]}`}>
                {RESULT_LABEL[row.result]}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {row.opponentName}
                <span className="ml-2 text-xs text-slate-500 dark:text-zinc-500">{row.subjectName}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {row.yourScore} : {row.opponentScore}
              </span>
              <span
                className={`w-12 shrink-0 text-right text-xs font-semibold tabular-nums ${
                  row.ratingDelta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {row.ratingDelta >= 0 ? "+" : ""}
                {row.ratingDelta}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock3, Loader2, RotateCcw, Swords, Trophy, X } from "lucide-react";
import { QUESTION_MS } from "@/lib/arena/scoring";
import { mockArenaService } from "@/lib/arena/service.mock";
import type { MatchOutcome, MatchState, QuestionResult } from "@/lib/arena/service";

/**
 * Жекпе-жек экраны.
 *
 * Әзірге мок қызметпен жұмыс істейді: интерфейс backend дайын болмай тұрып
 * толық құрастырылады. Нағыз қызметке ауысу бір жолмен болады, өйткені екеуі
 * бірдей интерфейсті іске асырады.
 */

const service = mockArenaService;
const OPTION_KEYS = ["1", "2", "3", "4"];
const LETTERS = ["A", "B", "C", "D"];

type Phase = "connecting" | "playing" | "answered" | "revealing" | "finished";

export function ArenaMatch({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  const [state, setState] = useState<MatchState | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [selected, setSelected] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(QUESTION_MS);
  const [error, setError] = useState("");
  const matchRef = useRef<string | null>(null);

  // Матчқа қосылу: мокта қарсылас бірден табылады
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    service
      .joinQueue(subjectId)
      .then((queue) => {
        if (cancelled || queue.status !== "matched") {
          return;
        }
        matchRef.current = queue.matchId;
        unsubscribe = service.subscribe(queue.matchId, (event) => {
          if (event.type === "state") {
            setState(event.state);
          } else if (event.type === "question") {
            setState(event.state);
            setResult(null);
            setSelected(null);
            setPhase("playing");
          } else if (event.type === "answer-result") {
            setState(event.state);
            setResult(event.result);
            setPhase("revealing");
          } else if (event.type === "match-end") {
            setOutcome(event.outcome);
            setPhase("finished");
          }
        });
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Матчқа қосылу мүмкін болмады.");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [subjectId]);

  // Қалған уақыт — тек көрсету үшін, шешімді сервер қабылдайды
  useEffect(() => {
    if (phase !== "playing" && phase !== "answered") {
      return;
    }
    const closesAt = state?.question ? new Date(state.question.closesAt).getTime() : 0;
    if (!closesAt) {
      return;
    }
    const tick = () => setRemaining(Math.max(0, closesAt - Date.now()));
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [phase, state?.question]);

  const answer = useCallback(
    (index: number) => {
      const matchId = matchRef.current;
      if (!matchId || !state?.question || phase !== "playing") {
        return;
      }
      setSelected(index);
      setPhase("answered");
      void service.submitAnswer(matchId, state.question.position, index);
    },
    [phase, state?.question]
  );

  // Пернетақтамен ойнау: 1–4 нұсқаны таңдайды
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const index = OPTION_KEYS.indexOf(event.key);
      if (index >= 0) {
        event.preventDefault();
        answer(index);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  if (error) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-base">{error}</p>
        <Link href="/arena" className="mt-5 inline-block rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white dark:bg-cyan-400 dark:text-zinc-950">
          Аренаға оралу
        </Link>
      </div>
    );
  }

  if (outcome) {
    return <ArenaOutcome outcome={outcome} subjectId={subjectId} />;
  }

  if (!state || phase === "connecting") {
    return (
      <div className="glass-card flex flex-col items-center gap-4 p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-700 dark:text-cyan-300" />
        <p className="text-base">Қарсылас іздеп жатырмыз…</p>
        <p className="text-sm text-slate-500 dark:text-zinc-500">{subjectName}</p>
      </div>
    );
  }

  const question = state.question;
  const seconds = Math.ceil(remaining / 1000);
  const progress = Math.max(0, Math.min(100, (remaining / QUESTION_MS) * 100));

  return (
    <div className="space-y-5">
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <Swords className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
          <div>
            <p className="text-sm font-semibold">{state.subjectName}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-500">
              {state.currentIndex + 1} / {state.totalQuestions} сұрақ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <ScoreBadge label="Сен" score={state.you.score} answered={state.you.answered} highlight />
          <ScoreBadge
            label={state.opponent?.displayName ?? "Қарсылас"}
            score={state.opponent?.score ?? 0}
            answered={Boolean(state.opponent?.answered)}
          />
        </div>
      </div>

      {question ? (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3">
            <Clock3 className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              {/* Сұрақ жабылған соң таймердің мәні ескіреді: жолақ толық
                  босатылып, орнына «сұрақ жабылды» деп жазылады */}
              <div
                className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                  seconds <= 5 ? "bg-rose-500" : "bg-sky-600 dark:bg-cyan-400"
                }`}
                style={{ width: `${phase === "revealing" ? 0 : progress}%` }}
              />
            </div>
            <span className="w-24 text-right text-sm tabular-nums text-slate-600 dark:text-zinc-300" aria-live="polite">
              {phase === "revealing" ? "сұрақ жабылды" : `${seconds} сек`}
            </span>
          </div>

          <h2 className="mt-5 text-xl font-semibold leading-8">{question.prompt}</h2>

          <div className="mt-5 grid gap-3">
            {question.options.map((option, index) => {
              const isChosen = selected === index;
              const isCorrect = result?.correctIndex === index;
              const showResult = phase === "revealing" && result;

              let tone =
                "border-slate-200 bg-white hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-500/50";
              if (showResult && isCorrect) {
                tone = "border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10";
              } else if (showResult && isChosen) {
                tone = "border-rose-400 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10";
              } else if (isChosen) {
                tone = "border-sky-500 bg-sky-50 dark:border-cyan-400 dark:bg-cyan-500/10";
              }

              return (
                <button
                  key={option}
                  type="button"
                  disabled={phase !== "playing"}
                  onClick={() => answer(index)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-base leading-7 transition disabled:cursor-default ${tone}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold dark:border-zinc-700">
                    {LETTERS[index]}
                  </span>
                  <span className="min-w-0 flex-1">{option}</span>
                  {showResult && isCorrect ? <Check className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : null}
                  {showResult && isChosen && !isCorrect ? <X className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" /> : null}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500">
            Пернетақтамен де жауап беруге болады: 1, 2, 3, 4
          </p>

          {phase === "answered" ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Жауабың қабылданды — қарсыласты күтудеміз
            </p>
          ) : null}

          {phase === "revealing" && result ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-sm font-semibold">
                {result.you.isCorrect ? `Дұрыс! +${result.you.points} ұпай` : "Қате жауап"}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-zinc-400">{result.explanation}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScoreBadge({
  label,
  score,
  answered,
  highlight = false
}: {
  label: string;
  score: number;
  answered: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="text-right">
      <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${highlight ? "text-sky-700 dark:text-cyan-300" : ""}`}>{score}</p>
      <p className="text-[11px] text-slate-400 dark:text-zinc-600">{answered ? "жауап берді" : "ойланып жатыр"}</p>
    </div>
  );
}

function ArenaOutcome({ outcome, subjectId }: { outcome: MatchOutcome; subjectId: string }) {
  const won = outcome.winnerId === outcome.you.playerId;
  const drawn = outcome.winnerId === null;
  const delta = outcome.you.ratingAfter - outcome.you.ratingBefore;

  return (
    <div className="space-y-5">
      <div className="glass-card p-8 text-center">
        <Trophy
          className={`mx-auto h-10 w-10 ${won ? "text-amber-500" : drawn ? "text-slate-400" : "text-slate-300 dark:text-zinc-700"}`}
        />
        <h2 className="mt-4 text-3xl font-semibold">{won ? "Жеңіс!" : drawn ? "Тең ойын" : "Жеңіліс"}</h2>

        <div className="mt-6 flex items-center justify-center gap-8">
          <div>
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-500">Сен</p>
            <p className="text-3xl font-semibold tabular-nums text-sky-700 dark:text-cyan-300">{outcome.you.score}</p>
          </div>
          <span className="text-lg text-slate-400 dark:text-zinc-600">—</span>
          <div>
            <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-500">
              {outcome.opponent?.displayName ?? "Қарсылас"}
            </p>
            <p className="text-3xl font-semibold tabular-nums">{outcome.opponent?.score ?? 0}</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-slate-600 dark:text-zinc-400">
          {outcome.subjectName} рейтингі: {outcome.you.ratingBefore} →{" "}
          <span className={delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            {outcome.you.ratingAfter} ({delta >= 0 ? "+" : ""}
            {delta})
          </span>
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/arena/${subjectId}`}
            className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white dark:bg-cyan-400 dark:text-zinc-950"
          >
            <RotateCcw className="h-4 w-4" />
            Тағы ойнау
          </Link>
          <Link
            href="/arena"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Пән таңдау
          </Link>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold">Сұрақтарды қарап шық</h3>
        <ul className="mt-4 space-y-4">
          {outcome.review.map((item) => (
            <li key={item.position} className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium leading-7">
                {item.position + 1}. {item.prompt}
              </p>
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                Дұрыс жауап: {item.options[item.correctIndex]}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Сенің жауабың:{" "}
                {item.you.chosenIndex === null ? (
                  <span className="text-slate-500 dark:text-zinc-500">үлгермедің</span>
                ) : (
                  <span className={item.you.isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    {item.options[item.you.chosenIndex]}
                  </span>
                )}{" "}
                · +{item.you.points} ұпай
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-zinc-400">{item.explanation}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Check, Copy, Hash, Loader2, Shuffle, UserPlus, Users } from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { SiteHeader } from "@/components/site/site-header";
import { SubjectLeaderboard } from "@/components/arena/arena-stats";
import { httpArenaService as service } from "@/lib/arena/service.http";

/**
 * Пәнді таңдағаннан кейінгі бөлме.
 *
 * Үш жол ұсынылады: кездейсоқ қарсылас, досты кодпен шақыру, кодпен қосылу.
 * Матч осы жерде басталмайды — қарсылас табылған соң ғана матч бетіне өтеді,
 * сондықтан екі ойыншы да бірдей сәтте басталады.
 */

/** Кездейсоқ қарсыласты осы уақыттан соң бот ауыстырады (серверде де сол шек) */
const BOT_HINT_SECONDS = 15;

export function ArenaLobby({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  return (
    <RouteGuard>
      <ArenaLobbyContent subjectId={subjectId} subjectName={subjectName} />
    </RouteGuard>
  );
}

type Mode = "idle" | "queue" | "room";

export function ArenaLobbyContent({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [code, setCode] = useState("");
  const [roomMatchId, setRoomMatchId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const goToMatch = useCallback(
    (matchId: string) => {
      router.push(`/arena/match/${encodeURIComponent(matchId)}`);
    },
    [router]
  );

  // Кезекте тұрғанда күйді сұрап отырамыз
  useEffect(() => {
    if (mode !== "queue") {
      return;
    }

    let timer: number | null = null;
    const started = Date.now();

    const poll = async () => {
      if (cancelledRef.current) {
        return;
      }
      setWaitedSeconds(Math.floor((Date.now() - started) / 1000));

      try {
        const result = await service.pollQueue(subjectId);
        if (result.status === "matched") {
          goToMatch(result.matchId);
          return;
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Кезекке тұру мүмкін болмады.");
        setMode("idle");
        return;
      }

      timer = window.setTimeout(() => void poll(), 1200);
    };

    void poll();

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [goToMatch, mode, subjectId]);

  // Бөлме ашылғанда қарсыластың қосылуын күтеміз
  useEffect(() => {
    if (mode !== "room" || !roomMatchId) {
      return;
    }

    let timer: number | null = null;

    const poll = async () => {
      if (cancelledRef.current) {
        return;
      }

      try {
        const state = await service.getMatch(roomMatchId);
        if (state.status === "active") {
          goToMatch(roomMatchId);
          return;
        }
      } catch {
        // Желі үзілсе келесі сұраныс қалпына келтіреді
      }

      timer = window.setTimeout(() => void poll(), 1500);
    };

    void poll();

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [goToMatch, mode, roomMatchId]);

  async function startRandom() {
    setError("");
    setBusy(true);
    try {
      const result = await service.joinQueue(subjectId);
      if (result.status === "matched") {
        goToMatch(result.matchId);
        return;
      }
      setMode("queue");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Кезекке тұру мүмкін болмады.");
    } finally {
      setBusy(false);
    }
  }

  async function createRoom() {
    setError("");
    setBusy(true);
    try {
      const room = await service.createPrivateMatch(subjectId);
      setCode(room.code);
      setRoomMatchId(room.matchId);
      setMode("room");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Бөлме құру мүмкін болмады.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (clean.length < 4) {
      setError("Код кемінде 4 таңбадан тұрады.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const joined = await service.joinByCode(clean);
      goToMatch(joined.matchId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Бұл код бойынша матч табылмады.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelQueue() {
    setMode("idle");
    setWaitedSeconds(0);
    await service.leaveQueue().catch(() => undefined);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Көшіру мүмкін болмады — кодты қолмен жазып жіберіңіз.");
    }
  }

  return (
    <div className="page-shell min-h-screen">
      <SiteHeader />
      <main id="juz-main" className="mx-auto w-full max-w-2xl px-5 pb-24 pt-8 sm:px-8">
        <Link
          href="/arena"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-sky-700 dark:text-zinc-500 dark:hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Пәндер
        </Link>

        <h1 className="mt-4 text-[clamp(1.6rem,5vw,2.25rem)] font-semibold leading-tight">{subjectName}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-zinc-400">
          Қарсылас қалай табылатынын таңда. Екеуіңе бірдей 10 сұрақ беріледі.
        </p>

        {error ? (
          <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        {mode === "queue" ? (
          <section className="glass-card mt-6 flex flex-col items-center gap-4 p-10 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-sky-700 dark:text-cyan-300" />
            <p className="text-lg font-semibold">Қарсылас іздеп жатырмыз…</p>
            <p className="max-w-sm text-sm leading-6 text-slate-500 dark:text-zinc-400">
              Осы пәнді таңдаған басқа оқушы кезекте болса, матч бірден басталады.
              {waitedSeconds < BOT_HINT_SECONDS
                ? ` Егер ${BOT_HINT_SECONDS} секунд ішінде ешкім табылмаса, жаттығу боты қосылады.`
                : " Жаттығу боты дайындалып жатыр…"}
            </p>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500">
              {waitedSeconds} с
            </p>
            <button
              type="button"
              onClick={() => void cancelQueue()}
              className="mt-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 dark:border-zinc-800 dark:text-zinc-300"
            >
              Болдырмау
            </button>
          </section>
        ) : null}

        {mode === "room" ? (
          <section className="glass-card mt-6 p-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-500">
              Бөлме коды
            </p>
            <p className="mt-3 font-mono text-[clamp(2.2rem,12vw,3.4rem)] font-bold tracking-[0.28em] text-sky-800 dark:text-cyan-300">
              {code}
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-zinc-400">
              Осы кодты досыңа жібер. Ол Аренадан «Кодпен қосылу» арқылы енгізсе, матч екеуіңе бірден басталады.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void copyCode()}
                className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Көшірілді" : "Кодты көшіру"}
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 dark:border-zinc-800 dark:text-zinc-300"
              >
                Болдырмау
              </button>
            </div>

            <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Қарсыласты күтіп тұрмыз
            </p>
          </section>
        ) : null}

        {mode === "idle" ? (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => void startRandom()}
              disabled={busy}
              className="glass-card flex w-full items-center gap-4 p-5 text-left transition hover:border-sky-300 disabled:opacity-60 dark:hover:border-cyan-500/50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                <Shuffle className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold">Кездейсоқ қарсылас</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  Кезекке тұрасың — осы пәнді таңдаған бірінші оқушымен ойнайсың.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => void createRoom()}
              disabled={busy}
              className="glass-card flex w-full items-center gap-4 p-5 text-left transition hover:border-sky-300 disabled:opacity-60 dark:hover:border-cyan-500/50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <UserPlus className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold">Досты шақыру</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  Бөлме ашылады да, код беріледі. Кодты досыңа жібересің.
                </span>
              </span>
            </button>

            <form onSubmit={submitCode} className="glass-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <Hash className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold">Кодпен қосылу</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                    Досың жіберген кодты енгіз.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <label htmlFor="arena-lobby-code" className="sr-only">
                  Бөлме коды
                </label>
                <input
                  id="arena-lobby-code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="КОД"
                  maxLength={8}
                  autoComplete="off"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-mono text-base tracking-[0.2em] text-slate-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-12 shrink-0 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
                >
                  Қосылу
                </button>
              </div>
            </form>

            <div className="pt-2">
              <SubjectLeaderboard subjectId={subjectId} subjectName={subjectName} />
            </div>

            <ul className="space-y-2 pt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0" />
                Екі ойыншыға бірдей сұрақтар, уақытты сервер өлшейді.
              </li>
              <li className="flex items-start gap-2">
                <Bot className="mt-0.5 h-4 w-4 shrink-0" />
                Кезекте ешкім болмаса, жаттығу ботымен ойнап тұра аласың — рейтинг бәрібір есептеледі.
              </li>
            </ul>
          </div>
        ) : null}
      </main>
    </div>
  );
}

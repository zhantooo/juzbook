"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock3, Hash, Swords, Trophy, Users } from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { SiteHeader } from "@/components/site/site-header";
import { formatCount } from "@/lib/arena/format";
import { MatchHistory, MyRatings } from "@/components/arena/arena-stats";
import { httpArenaService as service } from "@/lib/arena/service.http";
import type { ArenaSubject } from "@/lib/arena/subjects";

/** Жекпе-жек ережесі — бетте бір рет түсіндіріледі */
const RULES = [
  { icon: Users, text: "Екі ойыншыға бірдей 10 сұрақ беріледі" },
  { icon: Clock3, text: "Әр сұраққа 15 секунд: жылдам жауап көбірек ұпай әкеледі" },
  { icon: Trophy, text: "Рейтинг әр пәнде бөлек есептеледі" }
];

export function ArenaHome({ subjects }: { subjects: ArenaSubject[] }) {
  return (
    <RouteGuard>
      <ArenaHomeContent subjects={subjects} />
    </RouteGuard>
  );
}

/// Мазмұны кіру тексерісінен бөлек тұрады: сол арқылы бетті кірмей-ақ
/// (dev режимінде) көзбен тексеруге болады.
export function ArenaHomeContent({ subjects }: { subjects: ArenaSubject[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [joining, setJoining] = useState(false);

  const playable = subjects.filter((subject) => subject.playable);
  const pending = subjects.filter((subject) => !subject.playable);

  async function joinByCode(event: React.FormEvent) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setCodeError("Код кемінде 4 таңбадан тұрады.");
      return;
    }

    setCodeError("");
    setJoining(true);
    try {
      // Код матчтың нақты мекенжайын береді: пәнді таңдаудың қажеті жоқ,
      // өйткені пәнді бөлмені ашқан ойыншы таңдап қойған.
      const joined = await service.joinByCode(clean);
      router.push(`/arena/match/${encodeURIComponent(joined.matchId)}`);
    } catch (caught) {
      setCodeError(caught instanceof Error ? caught.message : "Бұл код бойынша матч табылмады.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="page-shell min-h-screen">
        <SiteHeader />

        <main id="juz-main" className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8">
          <header className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs uppercase tracking-[0.12em] text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
              <Swords className="h-4 w-4" />
              Арена
            </div>
            <h1 className="mt-4 text-[clamp(1.9rem,6vw,2.75rem)] font-semibold leading-tight">
              Қарсыласпен жекпе-жек
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600 dark:text-zinc-400">
              Пәнді таңдап, қарсылас тап. Екеуіңе бірдей сұрақтар беріледі — кім дәл әрі жылдам
              жауап берсе, сол жеңеді.
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {RULES.map((rule) => (
                <li
                  key={rule.text}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <rule.icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-cyan-300" />
                  {rule.text}
                </li>
              ))}
            </ul>
          </header>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">Пәнді таңда</h2>
            {playable.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {playable.map((subject) => (
                  <Link
                    key={subject.id}
                    href={`/arena/${subject.id}`}
                    className="group glass-card flex flex-col justify-between p-5 transition hover:border-sky-300 dark:hover:border-cyan-500/50"
                  >
                    <div>
                      <h3 className="text-lg font-semibold">{subject.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                        {subject.description}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-500">
                        {formatCount(subject.total)} сұрақ
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950">
                        <Swords className="h-4 w-4" />
                        Ойнау
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm leading-7 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Әзірге бірде-бір пән дайын емес — сұрақтар банкі толтырылып жатыр.
              </p>
            )}
          </section>

          {pending.length ? (
            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-500">
                Әзірге дайын емес
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {pending.map((subject) => (
                  <li
                    key={subject.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <p className="font-medium text-slate-700 dark:text-zinc-300">{subject.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-zinc-500">{subject.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <MyRatings />
            <MatchHistory />
          </section>

          <section className="mt-10 max-w-xl">
            <h2 className="text-xl font-semibold">Досыңмен ойна</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-zinc-400">
              Код пәнді таңдағанда беріледі: жоғарыдан пәнді ашып, «Досты шақыру» дегенді бассаң,
              бес таңбалы код шығады. Соны досыңа жібересің, ол осы жерге енгізеді — екеуіңе матч
              бірдей сәтте басталады.
            </p>
            <form onSubmit={joinByCode} className="mt-4 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <label htmlFor="arena-code" className="sr-only">
                  Матч коды
                </label>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  <input
                    id="arena-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="МАТЧ КОДЫ"
                    maxLength={8}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-base tracking-[0.2em] text-slate-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </div>
                {codeError ? (
                  <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{codeError}</p>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={joining}
                className="h-12 shrink-0 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
              >
                {joining ? "Қосылуда…" : "Қосылу"}
              </button>
            </form>
          </section>
      </main>
    </div>
  );
}

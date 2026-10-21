"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bot, Clock3, Hash, Medal, Shuffle, Swords, Trophy, UserPlus, Users, Zap } from "lucide-react";
import { RouteGuard } from "@/components/auth/route-guard";
import { SiteHeader } from "@/components/site/site-header";
import { MatchHistory, MyRatings } from "@/components/arena/arena-stats";
import { formatCount } from "@/lib/arena/format";
import { httpArenaService as service } from "@/lib/arena/service.http";
import type { SubjectRating } from "@/lib/arena/service";
import type { ArenaSubject } from "@/lib/arena/subjects";

/** Соңғы ойналған пән есте сақталады — келесі жолы бір басуда ойнау үшін */
const LAST_SUBJECT_KEY = "juzbook-arena-last-subject";

const RULES = [
  { icon: Users, text: "Екеуіңе бірдей 10 сұрақ" },
  { icon: Clock3, text: "Әр сұраққа 15 секунд" },
  { icon: Zap, text: "Жылдам жауап — көп ұпай" },
  { icon: Trophy, text: "Рейтинг әр пәнде бөлек" }
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
  const [ratings, setRatings] = useState<SubjectRating[]>([]);
  const [lastSubjectId, setLastSubjectId] = useState("");

  const playable = useMemo(() => subjects.filter((subject) => subject.playable), [subjects]);
  const pending = useMemo(() => subjects.filter((subject) => !subject.playable), [subjects]);

  useEffect(() => {
    try {
      setLastSubjectId(window.localStorage.getItem(LAST_SUBJECT_KEY) || "");
    } catch {
      // Жеке режимде жад жабық болуы мүмкін — маңызды емес
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void service
      .getRatings()
      .then((rows) => {
        if (!cancelled) {
          setRatings(rows);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const ratingBySubject = useMemo(
    () => new Map(ratings.map((row) => [row.subjectId, row])),
    [ratings]
  );

  /** Жылдам ойын қай пәнде басталады: соңғы ойналғаны, болмаса ең толығы */
  const quickSubject = useMemo(() => {
    if (!playable.length) {
      return null;
    }
    return (
      playable.find((subject) => subject.id === lastSubjectId) ??
      [...playable].sort((first, second) => second.total - first.total)[0]
    );
  }, [playable, lastSubjectId]);

  function rememberSubject(subjectId: string) {
    try {
      window.localStorage.setItem(LAST_SUBJECT_KEY, subjectId);
    } catch {
      // маңызды емес
    }
  }

  /** Бір басумен кезекке: пән бетіне `auto` белгісімен өтеміз */
  function startQuickMatch() {
    if (!quickSubject) {
      return;
    }
    rememberSubject(quickSubject.id);
    router.push(`/arena/${quickSubject.id}?auto=1`);
  }

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

      <main id="juz-main" className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8">
        {/* ── Жекпе-жек тақтасы ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-900 p-6 text-white shadow-[0_30px_80px_-40px_rgba(2,132,199,0.6)] dark:border-zinc-800 sm:p-9">
          {/* Екі жақтан соғылған жарық — арена сезімі осыдан */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(70% 120% at 0% 50%, rgba(56,189,248,0.38) 0%, transparent 60%), radial-gradient(70% 120% at 100% 50%, rgba(244,114,182,0.32) 0%, transparent 60%)"
            }}
          />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
              <Swords className="h-3.5 w-3.5" />
              Арена
            </span>

            <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h1 className="text-[clamp(2rem,6vw,3rem)] font-semibold leading-[1.05]">
                  Қарсыласыңмен бетпе-бет
                </h1>
                <p className="mt-4 text-base leading-7 text-slate-200">
                  Он сұрақ, он бес секунд. Кім дәл әрі жылдам жауап берсе — сол жеңеді.
                  Рейтинг әр пәнде бөлек жиналады.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={startQuickMatch}
                    disabled={!quickSubject}
                    className="inline-flex items-center gap-2.5 rounded-full bg-cyan-400 px-7 py-3.5 text-base font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60"
                  >
                    <Swords className="h-5 w-5" />
                    {quickSubject ? `Ойнау — ${quickSubject.name}` : "Пән әзірге дайын емес"}
                  </button>

                  {quickSubject ? (
                    <span className="text-sm text-slate-300">
                      немесе төменнен басқа пәнді таңда
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Екі жақтың қарсы тұрғаны */}
              <div aria-hidden className="flex items-center gap-4 self-start lg:self-auto">
                <DuelSide label="Сен" tone="sky" />
                <span className="text-2xl font-black italic tracking-tight text-white/70">VS</span>
                <DuelSide label="Қарсылас" tone="rose" />
              </div>
            </div>

            <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {RULES.map((rule) => (
                <li
                  key={rule.text}
                  className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-3.5 py-2.5 text-sm text-slate-100 backdrop-blur"
                >
                  <rule.icon className="h-4 w-4 shrink-0 text-cyan-200" />
                  {rule.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Пәндер ────────────────────────────────────────────────────── */}
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold">Пәнді таңда</h2>
            {playable.length ? (
              <p className="text-sm text-slate-500 dark:text-zinc-500">
                {playable.length} пән дайын
              </p>
            ) : null}
          </div>

          {playable.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playable.map((subject) => {
                const rating = ratingBySubject.get(subject.id);
                return (
                  <Link
                    key={subject.id}
                    href={`/arena/${subject.id}`}
                    onClick={() => rememberSubject(subject.id)}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-[0_18px_50px_-30px_rgba(14,165,233,0.65)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-500/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold leading-tight">{subject.name}</h3>
                      {rating ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:bg-cyan-500/10 dark:text-cyan-300">
                          <Medal className="h-3.5 w-3.5" />
                          {formatCount(rating.rating)}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                      {subject.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-zinc-500">
                        {formatCount(subject.total)} сұрақ
                        {rating ? ` · ${rating.played} матч` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700 transition group-hover:gap-2.5 dark:text-cyan-300">
                        Ойнау
                        <Swords className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm leading-7 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Әзірге бірде-бір пән дайын емес — сұрақтар банкі толтырылып жатыр.
            </p>
          )}

          {pending.length ? (
            <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <summary className="cursor-pointer font-medium text-slate-600 dark:text-zinc-300">
                Әзірге дайын емес пәндер ({pending.length})
              </summary>
              <ul className="mt-3 space-y-1.5">
                {pending.map((subject) => (
                  <li key={subject.id} className="text-slate-500 dark:text-zinc-400">
                    <span className="font-medium text-slate-700 dark:text-zinc-300">{subject.name}</span>
                    {subject.reason ? ` — ${subject.reason}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        {/* ── Досыңмен ойна ─────────────────────────────────────────────── */}
        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="glass-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <UserPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Досыңа код жібер
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
              Пәнді ашып, «Досты шақыру» дегенді бассаң, бес таңбалы код шығады. Досың сол кодты
              осы жерге енгізеді — матч екеуіңе бірдей сәтте басталады.
            </p>

            <form onSubmit={joinByCode} className="mt-4 flex flex-wrap gap-3">
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
                    autoComplete="off"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 font-mono text-base tracking-[0.2em] text-slate-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
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
          </div>

          <div className="glass-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Shuffle className="h-5 w-5 text-sky-700 dark:text-cyan-300" />
              Қарсылас қалай табылады
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-600 dark:text-zinc-400">
              <li className="flex items-start gap-2.5">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-cyan-300" />
                Сол пәнді таңдаған оқушы кезекте болса, матч бірден басталады.
              </li>
              <li className="flex items-start gap-2.5">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                Он бес секунд ішінде ешкім табылмаса, жаттығу боты қосылады — рейтинг бәрібір
                есептеледі.
              </li>
              <li className="flex items-start gap-2.5">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                Уақытты сервер өлшейді, сондықтан баяу интернет ұтылуға себеп болмайды.
              </li>
            </ul>
          </div>
        </section>

        {/* ── Статистика ────────────────────────────────────────────────── */}
        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <MyRatings />
          <MatchHistory />
        </section>
      </main>
    </div>
  );
}

/** Тақтадағы қарсы тұрған екі жақтың бірі */
function DuelSide({ label, tone }: { label: string; tone: "sky" | "rose" }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-2xl font-black ${
          tone === "sky"
            ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-200"
            : "border-rose-300/40 bg-rose-400/15 text-rose-200"
        }`}
      >
        {tone === "sky" ? "С" : "Қ"}
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">{label}</span>
    </div>
  );
}

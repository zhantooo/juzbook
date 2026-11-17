/**
 * Әкімші бетінің басындағы орта белгісі.
 *
 * Серверлік компонент: `process.env` тікелей оқылады, сондықтан
 * дерекқордың мекенжайы клиентке жіберілмейді — тек қысқа белгісі.
 *
 * Неге керек: `.env` ішіндегі дерекқор мен өндірістікі екеуінде де
 * дерек бірдей көрінеді (екеуі де 2300-дей тақырып). Сондықтан қай
 * базамен жұмыс істеп отырғаныңды байқамай қалу оңай, ал бір рет
 * бүтін бір топтама түзету дәл сол себептен жергілікті базада қалып
 * қойған.
 */
import { resolveEnvironment } from "@/lib/runtime-env";

export function EnvironmentBanner() {
  const { environment, databaseHost, label, isProduction } = resolveEnvironment();

  // Өндіріс — қалыпты жағдай, сондықтан оны ақырын, ал әзірлеу мен
  // алдын ала қарауды анық түспен көрсетеміз: әкімші өндіріс деп
  // ойлап, басқа базада отырмауы үшін.
  const tone = isProduction
    ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    : environment === "preview"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200";

  return (
    <div
      data-juz-environment={environment}
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2 text-xs ${tone}`}
    >
      <span className="font-semibold uppercase tracking-[0.12em]">{label}</span>
      <span className="opacity-80">дерекқор: {databaseHost}</span>
      {!isProduction ? (
        <span className="opacity-80">— мұндағы өзгерістер оқушыларға көрінбейді</span>
      ) : null}
    </div>
  );
}

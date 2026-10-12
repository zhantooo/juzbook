import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white/90 px-4 py-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="page-width flex flex-col gap-3 text-xs text-slate-500 dark:text-zinc-400 md:flex-row md:items-center md:justify-between">
        <p>
          Ескерту: JUZBOOK — тәуелсіз білім беру платформасы. Платформа ҚР Білім министрлігімен немесе ресми
          баспалармен тікелей байланысты емес. Барлық материалдар тек танысу және білім сапасын арттыру мақсатында
          ұсынылады.
        </p>
        <div className="flex items-center gap-4 whitespace-nowrap">
          <Link href="/terms" className="transition hover:text-sky-700 dark:hover:text-cyan-300">
            Пайдаланушылық келісім
          </Link>
          <Link href="/privacy" className="transition hover:text-sky-700 dark:hover:text-cyan-300">
            Құпиялылық саясаты
          </Link>
        </div>
      </div>
    </footer>
  );
}

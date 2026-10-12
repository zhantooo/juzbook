"use client";

import Link from "next/link";
import { useEffect } from "react";

// Бетте күтпеген қате шықса, Next.js бұл компонентті көрсетеді. Бұрын ол
// болмағандықтан, оқырман ақ экран мен браузердің өз қатесін көретін.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell flex items-center justify-center px-5 py-20">
      <div className="glass-card max-w-xl p-10 text-center">
        <h1 className="text-4xl font-semibold">Бір нәрсе дұрыс жүрмеді</h1>
        <p className="mt-4 text-base leading-8 text-slate-600 dark:text-zinc-400">
          Бетті жүктеу кезінде қате шықты. Қайта жүктеп көріңіз; қайталана берсе,
          қай бетте болғаныңызды жазып жіберсеңіз, тезірек түзетеміз.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center justify-center rounded-full bg-sky-700 px-6 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
          >
            Қайта жүктеу
          </button>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
          >
            Басты бетке оралу
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 text-xs text-slate-500 dark:text-zinc-400">Қате коды: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}

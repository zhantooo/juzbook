import Link from "next/link";
import { BookOpenText, LibraryBig } from "lucide-react";

/**
 * Оқу бетінің өз «табылмады» экраны.
 * Кітап немесе тақырып өшірілсе, оқушы жалаң 404 орнына нақты нұсқау көреді.
 */
export default function ChapterNotFound() {
  return (
    <div className="page-shell flex items-center justify-center px-5 py-20">
      <div className="glass-card max-w-xl p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
          <BookOpenText className="h-7 w-7" />
        </div>

        <h1 className="mt-6 text-4xl font-semibold">Бұл тақырып қолжетімсіз</h1>

        <p className="mt-4 text-base leading-8 text-slate-600 dark:text-zinc-400">
          Тақырып өшірілген немесе сілтеме ескірген болуы мүмкін. Кітаптар бөлімінен
          қажетті тақырыпты қайта таңдаңыз — оқу тарихыңыз бен маркерлеріңіз сақталған.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-6 py-3 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
          >
            <LibraryBig className="h-4 w-4" />
            Кітаптарға өту
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Басты бет
          </Link>
        </div>
      </div>
    </div>
  );
}

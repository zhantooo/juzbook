export function SubjectPageSkeleton() {
  return (
    <div className="page-shell">
      <main id="juz-main" className="page-width py-10">
        <div className="glass-card animate-pulse p-8">
          <div className="h-4 w-28 rounded-full bg-slate-200 dark:bg-zinc-800" />
          <div className="mt-5 h-12 w-72 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          <div className="mt-4 h-24 w-full rounded-3xl bg-slate-100 dark:bg-zinc-900" />
        </div>
        <div className="mt-8 grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="glass-card animate-pulse p-6">
              <div className="h-32 rounded-3xl bg-slate-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export function ReaderPageSkeleton() {
  return (
    <div className="page-shell">
      <main id="juz-main" className="page-width py-10">
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <div className="glass-card h-[70vh] animate-pulse rounded-panel bg-slate-100 p-6 dark:bg-zinc-900" />
          <div className="glass-card h-[70vh] animate-pulse rounded-panel bg-slate-100 p-6 dark:bg-zinc-900" />
          <div className="glass-card h-[70vh] animate-pulse rounded-panel bg-slate-100 p-6 dark:bg-zinc-900" />
        </div>
      </main>
    </div>
  );
}

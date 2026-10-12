import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-slate-300 bg-white/85 px-6 py-16 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-slate-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}

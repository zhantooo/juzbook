"use client";

function isOfficialOkulykLink(link?: string | null) {
  if (!link) {
    return false;
  }

  try {
    const parsed = new URL(link);
    return parsed.hostname === "okulyk.kz" || parsed.hostname.endsWith(".okulyk.kz");
  } catch {
    return false;
  }
}

export function SourceAttributionBadge({
  sourceInfo,
  sourceLink,
  className = ""
}: {
  sourceInfo?: string | null;
  sourceLink?: string | null;
  className?: string;
}) {
  if (!sourceInfo && !sourceLink) {
    return null;
  }

  const isOfficial = isOfficialOkulykLink(sourceLink);

  if (isOfficial && sourceLink) {
    return (
      <div
        className={`rounded-3xl border border-sky-200 bg-sky-50/95 px-5 py-4 text-sm leading-7 text-slate-700 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-zinc-200 ${className}`.trim()}
      >
        <p>
          <span className="font-semibold text-sky-800 dark:text-cyan-300">ℹ️ Дереккөз:</span>{" "}
          Материалдар білім беру мақсатында{" "}
          <a
            href={sourceLink}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-sky-700 underline underline-offset-4 transition hover:text-sky-900 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            okulyk.kz ресми порталынан
          </a>{" "}
          алынды.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl border border-slate-200/80 bg-white/90 px-5 py-4 text-sm leading-7 text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/85 dark:text-zinc-300 ${className}`.trim()}
    >
      <p className="font-semibold text-slate-900 dark:text-zinc-100">Дереккөз</p>
      {sourceInfo ? <p className="mt-1">{sourceInfo}</p> : null}
      {sourceLink ? (
        <a
          href={sourceLink}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-sky-700 underline underline-offset-4 transition hover:text-sky-900 dark:text-cyan-300 dark:hover:text-cyan-200"
        >
          Ресми электронды нұсқа
        </a>
      ) : null}
    </div>
  );
}

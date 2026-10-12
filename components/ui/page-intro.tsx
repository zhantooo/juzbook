"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type IntroStat = {
  label: string;
  value: string;
};

/**
 * Ішкі беттердің шағын hero-сы: маскадан көтерілетін тақырып,
 * қысқа сипаттама, прогресс көрсеткіштері және қажет болса әрекет батырмасы.
 * Толық экранды алмайды — мазмұн бірден қол астында қалады.
 */
export function PageIntro({
  eyebrow,
  title,
  accent,
  description,
  stats = [],
  action,
  children
}: {
  eyebrow: string;
  title: string;
  /** Тақырыптың екінші жолы — көк курсивпен беріледі */
  accent?: string;
  description?: string;
  stats?: IntroStat[];
  action?: { label: string; href: string };
  children?: ReactNode;
}) {
  return (
    <section className="pb-4 pt-2">
      <div className="intro-mask">
        <p className="hero-line flex items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.06s" }}>
          <span className="hero-rule inline-block h-[2px] w-8 bg-sky-600 dark:bg-cyan-400" style={{ animationDelay: "0.2s" }} />
          {eyebrow}
        </p>
      </div>

      <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-slate-900 dark:text-zinc-50 md:text-6xl" style={{ textWrap: "pretty" }}>
        <span className="intro-mask block pb-[2px]">
          <span className="hero-rise block" style={{ animationDelay: "0.14s" }}>{title}</span>
        </span>
        {accent ? (
          <span className="intro-mask block pb-[2px]">
            <span className="hero-rise block italic text-sky-700 dark:text-cyan-300" style={{ animationDelay: "0.26s" }}>{accent}</span>
          </span>
        ) : null}
      </h1>

      {description ? (
        <p className="hero-line mt-6 max-w-3xl text-base leading-8 text-slate-600 dark:text-zinc-400" style={{ animationDelay: "0.44s" }}>
          {description}
        </p>
      ) : null}

      {stats.length > 0 ? (
        <div className="hero-line mt-8 flex flex-wrap gap-x-10 gap-y-5" style={{ animationDelay: "0.56s" }}>
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-zinc-50">{stat.value}</div>
              <div className="mt-1 text-[13px] text-slate-500 dark:text-zinc-400">{stat.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {action ? (
        <div className="hero-line mt-8" style={{ animationDelay: "0.66s" }}>
          <Link
            href={action.href}
            className="inline-flex items-center justify-center rounded-full bg-sky-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
          >
            {action.label}
          </Link>
        </div>
      ) : null}

      {children}
    </section>
  );
}

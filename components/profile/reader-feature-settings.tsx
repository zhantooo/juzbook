"use client";

import Link from "next/link";
import { BookOpen, BookOpenText, CheckCircle2, Layers, SquareCheckBig } from "lucide-react";
import { useAuth } from "@/components/state/auth-context";
import type { ContinueReadingSettings, ReaderFeature } from "@/lib/types";

type FeatureItem = {
  id: ReaderFeature;
  settingKey: keyof Pick<ContinueReadingSettings, "notesEnabled" | "plannerEnabled" | "flashcardsEnabled">;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  icon: typeof Layers;
};

const features: FeatureItem[] = [
  {
    id: "notes",
    settingKey: "notesEnabled",
    title: "Конспект",
    description: "Кітап оқығанда шетте тұратын конспект жазу терезесі.",
    href: "/notes",
    hrefLabel: "Конспектілер",
    icon: BookOpenText
  },
  {
    id: "planner",
    settingKey: "plannerEnabled",
    title: "Жоспар",
    description: "Оқу бетіндегі жоспар карточкасы және оқып отырғанда шығатын еске салулар.",
    href: "/planner",
    hrefLabel: "Жоспар",
    icon: SquareCheckBig
  },
  {
    id: "flashcards",
    settingKey: "flashcardsEnabled",
    title: "Флешкарта",
    description: "Оқу бетінде карточка жасау және маркерден флешкарта құрастыру.",
    href: "/flashcards",
    hrefLabel: "Флешкарталар",
    icon: Layers
  }
];

/**
 * Профильдегі айқын баптау: кітап оқитын бетте қай құралдар көрінетінін
 * таңдайды. Мән аккаунт күйімен бірге дерекқорға сақталады.
 */
export function ReaderFeatureSettings() {
  const { session, continueReadingSettings, setReaderFeatureEnabled } = useAuth();
  const isDemo = Boolean(session?.id?.startsWith("demo-"));
  const enabledCount = features.filter((feature) => continueReadingSettings[feature.settingKey]).length;

  return (
    <section className="glass-card p-6 md:p-8" aria-labelledby="reader-features-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">
            <BookOpen className="h-4 w-4" />
            Оқу беті
          </p>
          <h2 id="reader-features-title" className="mt-2 text-3xl font-semibold text-slate-950 dark:text-zinc-50">
            Кітап оқығанда көрінетін функциялар
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-zinc-400">
            Қосулы құралдар кітап оқитын бетте көрінеді, өшірілгендері жасырылады. Бөлімдердің өз беттері мәзірде
            әрқашан ашық қалады.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-semibold md:self-auto ${
            isDemo
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isDemo ? "Демо аккаунт: тек осы құрылғыда сақталады" : `Аккаунтта сақталады · қосулы ${enabledCount}/3`}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {features.map((feature) => {
          const enabled = continueReadingSettings[feature.settingKey];
          const Icon = feature.icon;

          return (
            <div
              key={feature.id}
              className={`flex flex-col rounded-3xl border p-5 transition-all duration-300 ${
                enabled
                  ? "border-emerald-200 bg-white shadow-sm shadow-emerald-100/60 dark:border-emerald-500/30 dark:bg-zinc-900 dark:shadow-none"
                  : "border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-zinc-950/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-300 ${
                      enabled
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-zinc-50">{feature.title}</p>
                    <p
                      className={`text-xs font-semibold ${
                        enabled ? "text-emerald-600 dark:text-emerald-300" : "text-slate-400 dark:text-zinc-500"
                      }`}
                    >
                      {enabled ? "Қосулы" : "Өшірулі"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${feature.title}: ${enabled ? "қосулы, өшіру" : "өшірулі, қосу"}`}
                  onClick={() => setReaderFeatureEnabled(feature.id, !enabled)}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${
                    enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                      enabled ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <p className="mt-4 flex-1 text-sm leading-6 text-slate-600 dark:text-zinc-400">{feature.description}</p>

              <Link
                href={feature.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 underline-offset-4 hover:underline dark:text-cyan-300"
              >
                {feature.hrefLabel} бетіне өту →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

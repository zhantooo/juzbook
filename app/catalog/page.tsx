"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { PageIntro } from "@/components/ui/page-intro";
import { Reveal } from "@/components/ui/reveal";
import { comboOptions } from "@/lib/demo-catalog";

export default function CatalogPage() {
  const { subjects } = useCatalog();
  const { selectedCombo, session } = useAuth();

  const pinnedIds = selectedCombo
    ? Array.from(new Set([...(comboOptions.find((item) => item.code === selectedCombo)?.subjectIds ?? []), "kazakh-history"]))
    : [];
  const orderedSubjects = [...subjects].sort((left, right) => {
    const leftPinned = pinnedIds.includes(left.id) ? 0 : 1;
    const rightPinned = pinnedIds.includes(right.id) ? 0 : 1;
    if (leftPinned !== rightPinned) {
      return leftPinned - rightPinned;
    }
    return left.name.localeCompare(right.name, "kk");
  });

  return (
    <div className="page-shell">
      <SiteHeader />
      <main id="juz-main" className="page-width py-10">
        <PageIntro
          eyebrow="Оқу бөлімі"
          title="Пәндер"
          accent="каталогы"
          description="Профильде таңдалған комбоға байланысты маңызды пәндер тізімнің жоғарғы жағына автоматты түрде бекітіледі."
          stats={[
            { label: "пән каталогта", value: String(orderedSubjects.length) },
            { label: "бекітілген пән", value: String(pinnedIds.length) }
          ]}
        />

        <Reveal distance={44} blur={7} scale>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {orderedSubjects.map((subject) => (
            <Link
              key={subject.id}
              href={session ? `/subjects/${subject.id}` : `/login?redirect=/subjects/${subject.id}`}
              className={`glass-card group block p-6 transition hover:-translate-y-1 ${
                pinnedIds.includes(subject.id) ? "ring-2 ring-sky-300/60 dark:ring-cyan-500/40" : ""
              }`}
            >
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                {pinnedIds.includes(subject.id) ? "Бекітілген пән" : "Пән"}
              </p>
              <h2 className="mt-4 text-3xl font-semibold">{subject.name}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">{subject.description}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-cyan-300">
                Ашу
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
          </section>
        </Reveal>
      </main>
    </div>
  );
}

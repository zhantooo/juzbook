"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Layers3 } from "lucide-react";
import type { SpecificationRecord, SubjectRecord } from "@/lib/types";
import { SelectMenu } from "@/components/ui/select-menu";

export function SpecificationBrowser({
  subjects,
  initialSubjectId = "",
  collapsible = false,
  defaultCollapsed = false,
  hideSubjectPicker = false
}: {
  subjects: SubjectRecord[];
  initialSubjectId?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  hideSubjectPicker?: boolean;
}) {
  const [subjectId, setSubjectId] = useState(initialSubjectId || "");
  const [items, setItems] = useState<SpecificationRecord[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isLoading, setIsLoading] = useState(false);

  const activeSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId) ?? null,
    [subjectId, subjects]
  );

  useEffect(() => {
    if (!subjectId) {
      setItems([]);
      return;
    }

    let active = true;
    setIsLoading(true);
    void fetch(`/api/specifications?subjectId=${encodeURIComponent(subjectId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { specifications?: SpecificationRecord[] }) => {
        if (!active) {
          return;
        }

        setItems(payload.specifications ?? []);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setItems([]);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [subjectId]);

  return (
    <section className="mt-10 glass-card p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-sm text-sky-700 dark:text-cyan-300">Спецификация</p>
            {collapsible ? (
              <button
                type="button"
                onClick={() => setIsCollapsed((current) => !current)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
                aria-label={isCollapsed ? "Ашу" : "Жинақтау"}
                title={isCollapsed ? "Ашу" : "Жинақтау"}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-500 ${isCollapsed ? "-rotate-90" : ""}`} />
              </button>
            ) : null}
          </div>
          <h2 className="mt-3 text-4xl font-semibold">Спецификация бойынша дайындалу</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-zinc-400">
            Белгілі бір пәнді таңдап, дәл спецификацияға кіретін тақырыптармен ғана жұмыс істей аласыз.
          </p>
        </div>

        {!hideSubjectPicker ? (
          <label className="block w-full max-w-sm">
            <span className="mb-2 block text-sm text-slate-600 dark:text-zinc-400">Пән</span>
            <SelectMenu
              ariaLabel="Пән"
              placeholder="Пәнді таңдаңыз"
              value={subjectId}
              onChange={(next) => setSubjectId(next)}
              options={[
                { value: "", label: "Пәнді таңдаңыз" },
                ...subjects.map((subject) => ({
                  value: subject.id,
                  label: subject.name,
                  badge: subject.books.length
                }))
              ]}
            />
          </label>
        ) : null}
      </div>

      <div className={`spec-reveal ${isCollapsed ? "is-collapsed" : ""}`} aria-hidden={isCollapsed}>
        <div className="spec-reveal__inner">
        <div className="mt-6">
          {!subjectId && !hideSubjectPicker ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Спецификацияларды көру үшін алдымен пәнді таңдаңыз.
            </div>
          ) : (
            <div key={subjectId} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/specifications/${item.id}`}
                  className="spec-card rounded-3xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-500/50"
                  style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                    <Layers3 className="h-4 w-4" />
                    Дайын бағыт
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-400">
                    {item.description || "Бұл бағытта белгіленген тақырыптарды ретімен оқи аласыз."}
                  </p>
                  <p className="mt-4 text-xs text-slate-500 dark:text-zinc-400">{item.topics.length} тақырып</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-cyan-300">
                    Ашу
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))}

              {isLoading && !items.length
                ? [0, 1, 2].map((item) => (
                    <div
                      key={`skeleton-${item}`}
                      className="spec-skeleton h-44 rounded-3xl border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
                      style={{ animationDelay: `${item * 120}ms` }}
                    />
                  ))
                : null}

              {!items.length && !isLoading ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  {activeSubject ? `${activeSubject.name} пәніне спецификация әлі қосылмаған.` : "Спецификация табылмады."}
                </div>
              ) : null}
            </div>
          )}
        </div>
        </div>
      </div>
    </section>
  );
}

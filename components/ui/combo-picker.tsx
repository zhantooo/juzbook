"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ComboCode } from "@/lib/types";

type ComboOption = {
  code: ComboCode;
  label: string;
  caption: string;
};

export function ComboPicker({
  value,
  options,
  onChange,
  placeholder = "ҰБТ комбинациясын таңдаңыз",
  error
}: {
  value: ComboCode | undefined | null;
  options: ComboOption[];
  onChange: (nextValue: ComboCode) => void;
  placeholder?: string;
  error?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.code === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex min-h-14 w-full items-center justify-between rounded-3xl border bg-white px-4 py-3 text-left shadow-sm transition-all dark:bg-zinc-950 ${
          error
            ? "border-rose-300 shadow-rose-100 dark:border-rose-500/40"
            : "border-slate-200 hover:border-sky-300 hover:shadow-sky-100 dark:border-zinc-800 dark:hover:border-cyan-500/50"
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-slate-900 dark:text-zinc-50">
            {selectedOption?.label ?? placeholder}
          </span>
          <span className="mt-1 block truncate text-sm text-slate-500 dark:text-zinc-400">
            {selectedOption?.caption ?? "Тізімді ашып, бір комбинацияны таңдаңыз"}
          </span>
        </span>
        <span className="ml-4 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-zinc-300">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%_+_0.65rem)] z-50 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/40">
          <div className="max-h-80 overflow-y-auto p-2.5">
            <div className="space-y-2">
              {options.map((option) => {
                const active = option.code === value;

                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      onChange(option.code);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-sky-300 bg-sky-50 text-sky-900 shadow-sm shadow-sky-100 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200"
                        : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-zinc-200 dark:hover:border-zinc-800 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-semibold">{option.label}</span>
                      <span className="mt-1 block text-sm text-slate-500 dark:text-zinc-400">{option.caption}</span>
                    </span>
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-sky-700 text-white dark:bg-cyan-400 dark:text-zinc-950"
                          : "bg-slate-100 text-transparent dark:bg-zinc-800"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, checked, ...props },
  ref
) {
  return (
    <label className={cn("relative inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        {...props}
      />
      <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-transparent transition peer-checked:border-sky-600 peer-checked:bg-sky-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-sky-200 dark:border-zinc-700 dark:bg-zinc-950 dark:peer-checked:border-cyan-400 dark:peer-checked:bg-cyan-400 dark:peer-checked:text-zinc-950 dark:peer-focus-visible:ring-cyan-500/20" />
      <Check className="pointer-events-none absolute h-3.5 w-3.5 text-inherit opacity-0 transition peer-checked:opacity-100" />
    </label>
  );
});

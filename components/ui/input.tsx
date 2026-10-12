"use client";

import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      spellCheck={false}
      className={cn(
        // Толтырғыш түсі globals.css ішінде (AA контрастымен) берілген,
        // фокус сақинасы да сонда — мұнда қайталанбайды
        "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 transition focus:border-sky-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-cyan-500/50",
        className
      )}
      {...props}
    />
  );
});

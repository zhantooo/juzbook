"use client";

import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Домалақ (таблетка) пішін — сайттағы әдепкі батырма осылай */
  pill?: boolean;
};

// Түс жүйесі: интерфейстің акценті — sky/cyan. Қызыл тек қауіпті әрекетке
// (өшіру, қайтарымсыз қадам) қолданылады, пән мен кітаптың өз түсі емес.
// sky-700 таңдалған себебі: ақ мәтінмен 5,9:1 контраст береді (AA талабы 4,5:1).
const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-sky-700 text-white hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
};

// Үш өлшем: тар панельге sm, әдеттегі әрекетке md, басты шақыруға lg
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-xs",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-6 text-base"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", pill = true, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition",
        "active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
        pill ? "rounded-full" : "rounded-2xl",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
});

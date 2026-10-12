"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SelectMenuOption = {
  value: string;
  label: string;
  /** Оң жақта тұратын кішкене сан (мысалы, кітап саны) */
  badge?: string | number;
  caption?: string;
  disabled?: boolean;
};

type SelectMenuProps = {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
};

const PANEL_MAX_HEIGHT = 320;
const GAP = 10;

/**
 * Сайттағы барлық ашылмалы тізімнің ортақ дизайны.
 *
 * Тізім body-ге портал арқылы шығарылады: солай болмаса, ата-элементтің
 * overflow-ы оны қиып тастайды не келесі карточка үстінен басып кетеді.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = "Таңдаңыз",
  disabled = false,
  size = "md",
  className = "",
  ariaLabel
}: SelectMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, dropUp: false });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const spaceBelow = viewportHeight - rect.bottom;
    // Төменде орын жетпесе ғана жоғары ашамыз — әрі жоғарыда орын бар болса.
    const dropUp = viewportHeight > 0 && spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow;

    setBox({
      left: rect.left,
      top: dropUp ? rect.top - GAP : rect.bottom + GAP,
      width: rect.width,
      dropUp
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    measure();

    const onScrollOrResize = () => measure();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen, measure]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const heightClass = size === "sm" ? "h-11 text-sm" : "h-14 text-sm";

  const panel =
    isOpen && mounted
      ? createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: "fixed",
              left: box.left,
              width: box.width,
              maxHeight: PANEL_MAX_HEIGHT,
              ...(box.dropUp ? { bottom: Math.max(0, window.innerHeight - box.top) } : { top: box.top })
            }}
            className="z-[110] overflow-y-auto rounded-3xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_24px_80px_-28px_rgba(14,165,233,0.35)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-[0_24px_80px_-28px_rgba(34,211,238,0.18)]"
          >
            {options.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-slate-500 dark:text-zinc-400">Тізім бос</p>
            ) : (
              options.map((option) => {
                const active = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-sky-50 text-sky-800 shadow-sm dark:bg-cyan-500/10 dark:text-cyan-200"
                        : "text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.caption ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-zinc-400">
                          {option.caption}
                        </span>
                      ) : null}
                    </span>

                    {option.badge !== undefined ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {option.badge}
                      </span>
                    ) : active ? (
                      <Check className="h-4 w-4 shrink-0 text-sky-600 dark:text-cyan-300" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) {
            return;
          }
          measure();
          setIsOpen((current) => !current);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 text-left font-semibold text-slate-900 shadow-sm transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-cyan-400/60 ${heightClass}`}
      >
        <span className="min-w-0 truncate">
          {selected ? selected.label : <span className="text-slate-400 dark:text-zinc-500">{placeholder}</span>}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-sky-600 transition dark:text-cyan-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {panel}
    </div>
  );
}

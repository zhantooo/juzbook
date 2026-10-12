"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlignJustify, BookOpenText, Focus, Minus, Plus, Type, X } from "lucide-react";

export const READING_MODE_KEY = "juzbook-reading-mode";

export type PaperId = "auto" | "light" | "sepia" | "soft" | "night";
export type ReadingFontId = "sans" | "serif";

export type ReadingSettings = {
  paper: PaperId;
  size: number;
  lead: number;
  measure: number;
  font: ReadingFontId;
  focus: boolean;
};

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  paper: "auto",
  size: 19,
  lead: 2,
  // Әдепкіде мәтін бағанның бүкіл енін алады — оң жағында бос орын қалмайды.
  // Тар оқу қалауы бар оқушы «Тар»/«Орташа» нұсқасын өзі таңдай алады.
  measure: 96,
  font: "sans",
  focus: false
};

const SIZE_MIN = 16;
const SIZE_MAX = 26;

const PAPERS: { id: PaperId; label: string; swatch: string; border: string }[] = [
  { id: "auto", label: "Авто", swatch: "linear-gradient(135deg,#ffffff 50%,#15181d 50%)", border: "#cbd5e1" },
  { id: "light", label: "Ақ", swatch: "#ffffff", border: "#dbe2ea" },
  { id: "sepia", label: "Сепия", swatch: "#e6d5aa", border: "#c9ae72" },
  { id: "soft", label: "Жұмсақ", swatch: "#e4ece6", border: "#bccfc3" },
  { id: "night", label: "Түн", swatch: "#14171c", border: "#343a43" }
];

const LEADS: { value: number; label: string }[] = [
  { value: 1.7, label: "Тығыз" },
  { value: 2, label: "Қалыпты" },
  { value: 2.35, label: "Кең" }
];

const MEASURES: { value: number; label: string }[] = [
  { value: 62, label: "Тар" },
  { value: 74, label: "Орташа" },
  { value: 96, label: "Толық" }
];

const FONTS: { value: ReadingFontId; label: string }[] = [
  { value: "sans", label: "Негізгі қаріп" },
  { value: "serif", label: "Кітап қарпі" }
];

/** Оқу енінің әдепкі мәні 74ch-тен толық енге ауысқанын белгілейтін кілт */
const MEASURE_MIGRATION_KEY = "juzbook-reading-measure-v2";

const SERIF_STACK = "var(--font-reading-serif), 'PT Serif', 'Noto Serif', Georgia, serif";
const SANS_STACK = "var(--font-juz-sans), system-ui, sans-serif";

/**
 * Оқу баптауларын бет боялғанға дейін қолданатын скрипт.
 * layout.tsx ішінде <head>-ке қойылады — сондықтан жыпылықтау (flash) болмайды.
 */
export const READING_MODE_SCRIPT = `(function(){try{var d=document.documentElement;var s={};try{s=JSON.parse(localStorage.getItem("${READING_MODE_KEY}")||"{}")||{}}catch(e){s={}}
var size=Number(s.size);if(!isFinite(size))size=${DEFAULT_READING_SETTINGS.size};size=Math.min(${SIZE_MAX},Math.max(${SIZE_MIN},size));
var lead=Number(s.lead);if(!isFinite(lead))lead=${DEFAULT_READING_SETTINGS.lead};
var measure=Number(s.measure);if(!isFinite(measure))measure=${DEFAULT_READING_SETTINGS.measure};
var mig=null;try{mig=localStorage.getItem("${MEASURE_MIGRATION_KEY}")}catch(e){}
if(!mig){try{localStorage.setItem("${MEASURE_MIGRATION_KEY}","1")}catch(e){}
if(measure===74){measure=${DEFAULT_READING_SETTINGS.measure};try{s.measure=measure;localStorage.setItem("${READING_MODE_KEY}",JSON.stringify(s))}catch(e){}}}
var paper=s.paper||"auto";
d.setAttribute("data-paper",paper);
d.setAttribute("data-paper-active",(paper==="sepia"||paper==="soft"||paper==="night")?"true":"false");
d.setAttribute("data-reading-focus",s.focus?"true":"false");
d.style.setProperty("--reading-size",size+"px");
d.style.setProperty("--reading-lead",String(lead));
d.style.setProperty("--reading-measure",measure>=92?"100%":measure+"ch");
d.style.setProperty("--reading-font",s.font==="serif"?"${SERIF_STACK}":"${SANS_STACK}");}catch(e){}})();`;

function clampSettings(raw: Partial<ReadingSettings> | null): ReadingSettings {
  const source = raw ?? {};
  const size = Number(source.size);
  const lead = Number(source.lead);
  const measure = Number(source.measure);

  return {
    paper: PAPERS.some((item) => item.id === source.paper) ? (source.paper as PaperId) : DEFAULT_READING_SETTINGS.paper,
    size: Number.isFinite(size) ? Math.min(SIZE_MAX, Math.max(SIZE_MIN, size)) : DEFAULT_READING_SETTINGS.size,
    lead: Number.isFinite(lead) ? Math.min(2.6, Math.max(1.5, lead)) : DEFAULT_READING_SETTINGS.lead,
    measure: Number.isFinite(measure) ? Math.min(96, Math.max(56, measure)) : DEFAULT_READING_SETTINGS.measure,
    font: source.font === "serif" ? "serif" : "sans",
    focus: Boolean(source.focus)
  };
}

export function applyReadingSettings(settings: ReadingSettings) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-paper", settings.paper);
  root.setAttribute(
    "data-paper-active",
    settings.paper === "sepia" || settings.paper === "soft" || settings.paper === "night" ? "true" : "false"
  );
  root.setAttribute("data-reading-focus", settings.focus ? "true" : "false");
  root.style.setProperty("--reading-size", `${settings.size}px`);
  root.style.setProperty("--reading-lead", String(settings.lead));
  root.style.setProperty("--reading-measure", settings.measure >= 92 ? "100%" : `${settings.measure}ch`);
  root.style.setProperty("--reading-font", settings.font === "serif" ? SERIF_STACK : SANS_STACK);
}

export function readStoredReadingSettings(): ReadingSettings {
  if (typeof window === "undefined") {
    return DEFAULT_READING_SETTINGS;
  }

  try {
    const raw = JSON.parse(window.localStorage.getItem(READING_MODE_KEY) || "{}") as Partial<ReadingSettings>;

    // Бұрын мәтін ені әдепкіде 74ch болатын да, бағанның оң жағы бос қалатын.
    // Ескі әдепкіні бір рет қана толық енге ауыстырамыз; оқушы қаласа,
    // оқу режимі панелінен «Тар»/«Орташа» нұсқасын қайта таңдай алады.
    if (!window.localStorage.getItem(MEASURE_MIGRATION_KEY)) {
      window.localStorage.setItem(MEASURE_MIGRATION_KEY, "1");
      if (Number(raw.measure) === 74) {
        raw.measure = DEFAULT_READING_SETTINGS.measure;
        window.localStorage.setItem(READING_MODE_KEY, JSON.stringify(raw));
      }
    }

    return clampSettings(raw);
  } catch {
    return DEFAULT_READING_SETTINGS;
  }
}

type ReadingSettingsPatch = Partial<ReadingSettings> | ((current: ReadingSettings) => Partial<ReadingSettings>);

export function useReadingSettings() {
  const [settings, setSettings] = useState<ReadingSettings>(DEFAULT_READING_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredReadingSettings();
    setSettings(stored);
    applyReadingSettings(stored);
    setMounted(true);
  }, []);

  const update = useCallback((patch: ReadingSettingsPatch) => {
    setSettings((current) => {
      const next = clampSettings({ ...current, ...(typeof patch === "function" ? patch(current) : patch) });
      applyReadingSettings(next);

      try {
        window.localStorage.setItem(READING_MODE_KEY, JSON.stringify(next));
      } catch {
        // localStorage қолжетімсіз болса, баптау тек ағымдағы сессияда жұмыс істейді
      }

      window.dispatchEvent(new CustomEvent("juzbook-reading-mode", { detail: next }));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    update(DEFAULT_READING_SETTINGS);
  }, [update]);

  return { settings, update, reset, mounted };
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">{children}</p>;
}

function SegmentedRow<T extends string | number>({
  items,
  active,
  onSelect
}: {
  items: { value: T; label: string }[];
  active: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-zinc-800/70">
      {items.map((item) => (
        <button
          key={String(item.value)}
          type="button"
          onClick={() => onSelect(item.value)}
          className={`rounded-xl px-2 py-2 text-[13px] font-semibold transition ${
            active === item.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
              : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ReadingModeControl() {
  const { settings, update, reset, mounted } = useReadingSettings();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activePaper = PAPERS.find((item) => item.id === settings.paper) ?? PAPERS[0];

  return (
    <div ref={wrapRef} className="relative" data-reading-mode-control="true">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Оқу режимін баптау"
        title="Оқу режимі"
        className={`inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition sm:px-4 ${
          open
            ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200"
            : "border-slate-200/80 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-300"
        }`}
      >
        <BookOpenText className="h-4 w-4" />
        {/* Мәзірде 6 сілтеме тұрғанда орташа экранда жазу сыймайды — тек белгіше қалады */}
        <span className="hidden xl:inline">Оқу режимі</span>
        <span
          className="h-4 w-4 rounded-full border"
          style={{ background: activePaper.swatch, borderColor: activePaper.border }}
        />
      </button>

      {open ? (
        <div data-header-popup="true" className="absolute right-0 top-[calc(100%+0.7rem)] z-[60] w-[min(94vw,22rem)] rounded-panel border border-slate-200/80 bg-white/95 p-5 shadow-[0_28px_80px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-zinc-50">Оқу режимі</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">Фон, қаріп өлшемі және жол аралығы бірден қолданылады.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Жабу"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-slate-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5">
            <SectionLabel>Оқу фоны</SectionLabel>
            <div className="grid grid-cols-5 gap-2">
              {PAPERS.map((paper) => {
                const active = settings.paper === paper.id;

                return (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => update({ paper: paper.id })}
                    title={paper.label}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition ${
                      active
                        ? "border-sky-400 bg-sky-50/70 dark:border-cyan-400/60 dark:bg-cyan-500/10"
                        : "border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    }`}
                  >
                    <span
                      className="h-7 w-7 rounded-full border shadow-inner"
                      style={{ background: paper.swatch, borderColor: paper.border }}
                    />
                    <span
                      className={`text-[10.5px] font-semibold ${
                        active ? "text-sky-800 dark:text-cyan-200" : "text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      {paper.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 px-1 text-[11.5px] leading-5 text-slate-500 dark:text-zinc-400">
              Сепия, Жұмсақ және Түн таңдалса, түс бүкіл блокқа — карталарға, панельдерге, іздеу өрістеріне — қолданылады.
            </p>
          </div>
          <div className="mt-5">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" />
                Қаріп өлшемі
              </span>
            </SectionLabel>
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-zinc-800/70">
              <button
                type="button"
                onClick={() => update((current) => ({ size: current.size - 1 }))}
                disabled={settings.size <= SIZE_MIN}
                aria-label="Кішірейту"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm transition disabled:opacity-40 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={SIZE_MIN}
                max={SIZE_MAX}
                step={1}
                value={settings.size}
                onChange={(event) => update({ size: Number(event.target.value) })}
                aria-label="Қаріп өлшемі"
                className="reading-range h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-300 dark:bg-zinc-700"
              />
              <button
                type="button"
                onClick={() => update((current) => ({ size: current.size + 1 }))}
                disabled={settings.size >= SIZE_MAX}
                aria-label="Үлкейту"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm transition disabled:opacity-40 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="w-10 text-right text-xs font-bold tabular-nums text-slate-600 dark:text-zinc-300">{settings.size}px</span>
            </div>
          </div>

          <div className="mt-5">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <AlignJustify className="h-3.5 w-3.5" />
                Жол аралығы
              </span>
            </SectionLabel>
            <SegmentedRow items={LEADS} active={settings.lead} onSelect={(value) => update({ lead: value })} />
          </div>

          <div className="mt-5">
            <SectionLabel>Мәтін ені</SectionLabel>
            <SegmentedRow items={MEASURES} active={settings.measure} onSelect={(value) => update({ measure: value })} />
          </div>

          <div className="mt-5">
            <SectionLabel>Қаріп түрі</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-zinc-800/70">
              {FONTS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => update({ font: item.value })}
                  style={{ fontFamily: item.value === "serif" ? SERIF_STACK : undefined }}
                  className={`rounded-xl px-2 py-2 text-[13px] font-semibold transition ${
                    settings.font === item.value
                      ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                      : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => update((current) => ({ focus: !current.focus }))}
            className={`mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
              settings.focus
                ? "border-sky-300 bg-sky-50 dark:border-cyan-500/40 dark:bg-cyan-500/10"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Focus className={`h-4 w-4 ${settings.focus ? "text-sky-700 dark:text-cyan-300" : "text-slate-400"}`} />
              <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Тыныш режим</span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                settings.focus ? "bg-sky-600 dark:bg-cyan-400" : "bg-slate-300 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${settings.focus ? "left-[1.4rem]" : "left-0.5"}`}
              />
            </span>
          </button>
          <p className="mt-2 px-1 text-[11.5px] leading-5 text-slate-500 dark:text-zinc-400">
            Қосылса, оқу бетінде тек мәтін қалады — бүйірдегі панельдер жасырылады.
          </p>

          <div
            className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-zinc-800"
            data-reading-preview="true"
          >
            <p
              className="m-0"
              style={{
                fontFamily: settings.font === "serif" ? SERIF_STACK : SANS_STACK,
                fontSize: `${settings.size}px`,
                lineHeight: settings.lead
              }}
            >
              Оқу мәтіні осылай көрінеді. Қаріп пен фон көзге жайлы болғанда, ұзақ оқу да жеңіл өтеді.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-slate-400 dark:text-zinc-500">{mounted ? "Баптау сақталады" : "Жүктелуде…"}</span>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Бастапқы қалпы
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

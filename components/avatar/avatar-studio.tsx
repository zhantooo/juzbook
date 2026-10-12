"use client";

import { useMemo, useState } from "react";
import { Check, Crown, Drama, Footprints, Gift, Lock, Shirt, Sparkles, UserRound, WandSparkles } from "lucide-react";
import { AvatarCanvas } from "@/components/avatar/avatar-canvas";
import { useAuth } from "@/components/state/auth-context";
import {
  AVATAR_PART_LABELS,
  AVATAR_PARTS,
  countUnlockedAvatarItems,
  describeUnlock,
  getAvatarItems,
  isAvatarItemUnlocked,
  nextAvatarUnlocks,
  resolveAvatar,
  type AvatarItem,
  type AvatarPart
} from "@/lib/avatar";
import { getStageBySeconds } from "@/lib/tree";
import type { AvatarLook } from "@/lib/types";
import { GARDEN_TREE_COUNT } from "@/lib/types";

const partIcons: Record<AvatarPart, typeof Shirt> = {
  base: UserRound,
  hat: Crown,
  mask: Drama,
  top: Shirt,
  bottom: Shirt,
  shoes: Footprints
};

type GenderFilter = "all" | "boy" | "girl";

/**
 * Профильдегі мини-персонаж. Басында тек персонаж бен прогресс көрінеді;
 * киім шкафы «Өзгерту» басылғанда ғана ашылады. Жабық заттар оқу сағаты мен
 * ағаш деңгейі жеткенде ашылады. Таңдау аккаунт күйімен бірге сақталады.
 */
export function AvatarStudio() {
  const { avatar, setAvatarLook, totalReadingSeconds, treeStats, session } = useAuth();
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [part, setPart] = useState<AvatarPart>("base");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [preview, setPreview] = useState<AvatarLook | null>(null);
  const [lockedNotice, setLockedNotice] = useState("");

  const readingHours = totalReadingSeconds / 3600;
  const treeLevel = useMemo(
    () =>
      Math.max(
        1,
        ...Array.from({ length: GARDEN_TREE_COUNT }, (_, index) => getStageBySeconds(treeStats.trees?.[index] ?? 0).level)
      ),
    [treeStats]
  );
  const progress = useMemo(() => ({ readingHours, treeLevel }), [readingHours, treeLevel]);
  const counts = countUnlockedAvatarItems(progress);
  const upcoming = nextAvatarUnlocks(progress);
  const worn = resolveAvatar(preview ?? avatar);
  const isDemo = Boolean(session?.id?.startsWith("demo-"));

  const wornLabel = [
    worn.hat.id !== "none" ? worn.hat.name : null,
    worn.mask.id !== "none" ? worn.mask.name : null,
    worn.top.name,
    worn.bottom.name,
    worn.shoes.name
  ]
    .filter(Boolean)
    .join(" · ");

  const items = getAvatarItems(part).filter(
    (item) => part !== "base" || genderFilter === "all" || (item.part === "base" && item.gender === genderFilter)
  );

  function toggleWardrobe() {
    setIsWardrobeOpen((current) => !current);
    setPreview(null);
    setLockedNotice("");
  }

  function selectItem(item: AvatarItem) {
    if (!isAvatarItemUnlocked(item.unlock, progress)) {
      setLockedNotice(`Бұл зат ${describeUnlock(item.unlock).toLowerCase()} болғанда ашылады.`);
      return;
    }

    setLockedNotice("");
    setAvatarLook({ [part]: item.id } as Partial<AvatarLook>);
  }

  return (
    <section className="glass-card overflow-hidden p-6 md:p-8" aria-labelledby="avatar-studio-title">
      <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)] md:items-center">
        <div className="avatar-stage relative flex items-end justify-center overflow-hidden rounded-panel border border-slate-200/80 px-4 pt-5 dark:border-zinc-800">
          <AvatarCanvas look={preview ?? avatar} scale={5} animate className="avatar-idle relative z-10" label="Менің персонажым" />
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-cyan-300">
            <Sparkles className="h-4 w-4" />
            Мини-персонаж
          </p>
          <h2 id="avatar-studio-title" className="mt-2 text-3xl font-semibold text-slate-950 dark:text-zinc-50">
            Менің персонажым
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-zinc-400">
            Көп оқыған сайын және ағашыңыз өскен сайын жаңа киімдер мен маскалар ашылады. Персонаж ағаш бағында үйдің
            қасында тұрады.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
              Ашылған: {counts.unlocked}/{counts.total}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Оқу: {readingHours.toFixed(1)} сағ
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              Ағаш: {treeLevel}-деңгей
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 ${
                isDemo
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-slate-200 bg-white text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {isDemo ? "Демо: тек осы құрылғыда сақталады" : "Аккаунтта сақталады"}
            </span>
          </div>

          <p className="mt-3 truncate text-xs text-slate-500 dark:text-zinc-400">{wornLabel}</p>

          {upcoming.byHours || upcoming.byLevel ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-zinc-200">
                <Gift className="h-3.5 w-3.5" />
                Келесі сыйлық:
              </span>
              {upcoming.byHours ? (
                <span>
                  тағы {Math.max(0, upcoming.byHours.unlock.hours - readingHours).toFixed(1)} сағат оқу
                </span>
              ) : null}
              {upcoming.byLevel ? <span>ағаш {upcoming.byLevel.unlock.level}-деңгейге жеткенде</span> : null}
            </p>
          ) : null}

          <button
            type="button"
            onClick={toggleWardrobe}
            aria-expanded={isWardrobeOpen}
            aria-controls="avatar-wardrobe"
            className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              isWardrobeOpen
                ? "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                : "bg-sky-700 text-white hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
            }`}
          >
            {isWardrobeOpen ? <Check className="h-4 w-4" /> : <WandSparkles className="h-4 w-4" />}
            {isWardrobeOpen ? "Дайын" : "Өзгерту"}
          </button>
        </div>
      </div>

      {isWardrobeOpen ? (
        <div id="avatar-wardrobe" className="wardrobe-reveal mt-6 border-t border-slate-200/80 pt-6 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Персонаж бөлімдері">
            {AVATAR_PARTS.map((item) => {
              const Icon = partIcons[item];
              const active = item === part;
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setPart(item);
                    setLockedNotice("");
                    setPreview(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-cyan-500/40 dark:hover:text-cyan-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {AVATAR_PART_LABELS[item]}
                </button>
              );
            })}
          </div>

          {part === "base" ? (
            <div className="mt-3 flex gap-2 text-xs font-semibold">
              {(
                [
                  ["all", "Барлығы"],
                  ["boy", "Ұл"],
                  ["girl", "Қыз"]
                ] as Array<[GenderFilter, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGenderFilter(value)}
                  className={`rounded-full px-3 py-1 transition ${
                    genderFilter === value
                      ? "bg-sky-700 text-white dark:bg-cyan-400 dark:text-zinc-950"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {lockedNotice ? (
            <p className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Lock className="h-4 w-4 shrink-0" />
              {lockedNotice}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => {
              const unlocked = isAvatarItemUnlocked(item.unlock, progress);
              const selected = avatar[part] === item.id;
              const tileLook = { ...avatar, [part]: item.id } as AvatarLook;
              const isBase = item.part === "base";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setPreview(tileLook)}
                  onMouseLeave={() => setPreview(null)}
                  onFocus={() => setPreview(tileLook)}
                  onBlur={() => setPreview(null)}
                  aria-pressed={selected}
                  aria-label={`${item.name}${unlocked ? "" : `, жабық: ${describeUnlock(item.unlock)}`}`}
                  className={`group relative flex flex-col items-center rounded-2xl border px-2 pb-2.5 pt-3 text-center transition ${
                    selected
                      ? "border-sky-400 bg-sky-50 shadow-sm shadow-sky-100 dark:border-cyan-400/60 dark:bg-cyan-500/10 dark:shadow-none"
                      : unlocked
                        ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-cyan-500/40"
                        : "border-dashed border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950/60"
                  }`}
                >
                  <AvatarCanvas look={tileLook} scale={2} locked={!unlocked} className="h-[126px] w-auto" label={item.name} />
                  {isBase ? (
                    <span className="mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                      {item.gender === "girl" ? "Қыз" : "Ұл"}
                    </span>
                  ) : (
                    <span className="mt-1.5 line-clamp-2 min-h-[2rem] text-xs font-semibold leading-4 text-slate-800 dark:text-zinc-100">
                      {item.name}
                    </span>
                  )}
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      selected
                        ? "bg-sky-700 text-white dark:bg-cyan-400 dark:text-zinc-950"
                        : unlocked
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "bg-slate-200/70 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {selected ? (
                      "Таңдалған"
                    ) : unlocked ? (
                      "Ашық"
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        {describeUnlock(item.unlock)}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={toggleWardrobe}
              className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
            >
              <Check className="h-4 w-4" />
              Дайын
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

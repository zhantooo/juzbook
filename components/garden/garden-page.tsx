"use client";

import { useEffect, useRef, useState } from "react";
import { RouteGuard } from "@/components/auth/route-guard";
import { GardenIntro } from "@/components/garden/garden-intro";
import { PixelScene } from "@/components/garden/pixel-scene";
import { SiteHeader } from "@/components/site/site-header";
import { useAuth } from "@/components/state/auth-context";
import { formatHours, getStageBySeconds } from "@/lib/tree";

/** Пиксель дизайнның палитрасы (дадада.html файлынан) */
const P = {
  bg: "#060d16",
  panel: "#0c1a26",
  panelFoot: "#0f1f0b",
  line: "#2c4f2a",
  chip: "#14260e",
  chipText: "#b7e06a",
  text: "#eaf7d2",
  textBright: "#f4fce4",
  eyebrow: "#7fae4d",
  muted: "#8fbf63"
};

/**
 * Қазақстан 2024 жылдан бері бір уақыт белдеуінде (UTC+5).
 * Күн/түн соған қарай есептеледі — оқушы өзі таңдамайды.
 */
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;

function readKazakhstanClock() {
  const kz = new Date(Date.now() + KZ_OFFSET_MS);
  const hour = kz.getUTCHours();
  return {
    night: hour >= 20 || hour < 6,
    label: `${String(hour).padStart(2, "0")}:${String(kz.getUTCMinutes()).padStart(2, "0")}`
  };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 16px",
        background: P.chip,
        border: `3px solid ${P.line}`,
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: ".04em",
        color: P.chipText
      }}
    >
      {children}
    </div>
  );
}

/** Аралдағы үш ағаштың орны мен аты */
const TREE_SLOTS = [
  { x: 138, label: "Бірінші ағаш" },
  { x: 248, label: "Ортаңғы ағаш" },
  { x: 328, label: "Үшінші ағаш" }
];

export function GardenPage({ fontClassName }: { fontClassName?: string }) {
  const { treeStats, waterTree, session, readingLeaderboard, avatar } = useAuth();
  const [clock, setClock] = useState({ night: false, label: "--:--" });
  const [activeTree, setActiveTree] = useState(0);
  const [pouring, setPouring] = useState(false);
  // Нұсқаулықты қайта ашу үшін
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  // Соңғы құюдың нәтижесі: қанша су құйылды және деңгей өзгерді ме
  const [lastPour, setLastPour] = useState<{
    amount: number;
    treeLabel: string;
    fromLevel: number;
    toLevel: number;
    title: string;
  } | null>(null);
  const pourTimer = useRef<number | null>(null);
  const pourNoticeTimer = useRef<number | null>(null);

  const treeSeconds = TREE_SLOTS.map((_, index) => treeStats.trees?.[index] ?? 0);
  const stages = treeSeconds.map((seconds) => getStageBySeconds(seconds));
  const stage = stages[activeTree];

  // Уақытты клиентте ғана оқимыз (SSR-мен сәйкессіздік болмауы үшін)
  // әрі минут сайын жаңартып отырамыз — түн түскенде бақ өзі қараяды.
  useEffect(() => {
    const sync = () => setClock(readKazakhstanClock());
    sync();
    const id = window.setInterval(sync, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (pourTimer.current) {
        window.clearTimeout(pourTimer.current);
      }
      if (pourNoticeTimer.current) {
        window.clearTimeout(pourNoticeTimer.current);
      }
    };
  }, []);

  const night = clock.night;
  const streakDays = session?.currentStreak ?? 1;
  const readSeconds = treeStats.totalWateredSeconds + treeStats.availableWaterSeconds;
  const canWater = treeStats.availableWaterSeconds > 0 && !pouring;

  // Су толық сағат бойынша жиналады: 1 сағат оқу = 1 сағат су.
  // Ағымдағы толық емес сағаттың қанша пайызы жиналғанын көрсетеміз.
  const availableSeconds = treeStats.availableWaterSeconds;
  const fullHours = Math.floor(availableSeconds / 3600);
  const partialSeconds = availableSeconds % 3600;
  const hourPercent = Math.round((partialSeconds / 3600) * 100);
  const minutesLeft = Math.max(0, Math.ceil((3600 - partialSeconds) / 60));

  function pourWater() {
    if (!canWater) {
      return;
    }

    const amount = treeStats.availableWaterSeconds;
    const fromLevel = stages[activeTree].level;
    const nextStage = getStageBySeconds(treeSeconds[activeTree] + amount);

    // Су бірден құйылады — бет жаңаланса да, ауыссаң да жоғалып кетпейді.
    // Анимация мен хабарлама содан кейін көрсетіледі.
    waterTree(undefined, activeTree);
    setPouring(true);
    setLastPour({
      amount,
      treeLabel: TREE_SLOTS[activeTree].label,
      fromLevel,
      toLevel: nextStage.level,
      title: nextStage.title
    });

    if (pourTimer.current) {
      window.clearTimeout(pourTimer.current);
    }
    pourTimer.current = window.setTimeout(() => setPouring(false), 1100);

    if (pourNoticeTimer.current) {
      window.clearTimeout(pourNoticeTimer.current);
    }
    pourNoticeTimer.current = window.setTimeout(() => setLastPour(null), 9000);
  }

  return (
    <RouteGuard role="USER">
      <div className={fontClassName}>
        <div
          className="page-shell"
          data-pixel-garden="true"
          style={{ fontFamily: "var(--font-garden-pixel), ui-monospace, monospace", color: P.text }}
        >
          <SiteHeader />

          <GardenIntro forceOpen={isIntroOpen} onClose={() => setIsIntroOpen(false)} />

          <main id="juz-main"
            style={{
              maxWidth: 1520,
              margin: "0 auto",
              padding: "26px 20px 56px",
              display: "flex",
              flexDirection: "column",
              gap: 22
            }}
          >
            {/* ── Тақырып жолы ── */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 16,
                borderBottom: `4px solid ${P.line}`,
                paddingBottom: 16
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: ".34em",
                    color: P.eyebrow,
                    textTransform: "uppercase"
                  }}
                >
                  <span style={{ display: "inline-block", width: 26, height: 4, background: P.eyebrow }} />
                  JUZBOOKS
                </div>
                <div
                  style={{
                    fontSize: "clamp(3rem, 5.6vw, 4.8rem)",
                    fontWeight: 800,
                    lineHeight: ".9",
                    color: P.textBright,
                    textShadow: "4px 4px 0 #15290f",
                    letterSpacing: ".02em"
                  }}
                >
                  АҒАШ БАҒЫ
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setIsIntroOpen(true)}
                  title="Нұсқаулықты қайта көру"
                  style={{
                    padding: "8px 16px",
                    background: P.chip,
                    border: `3px solid ${P.line}`,
                    fontSize: 24,
                    fontWeight: 600,
                    letterSpacing: ".04em",
                    color: P.chipText,
                    fontFamily: "inherit",
                    cursor: "pointer"
                  }}
                >
                  ? НҰСҚАУЛЫҚ
                </button>
                <Chip>СЕРИЯ · {streakDays} КҮН</Chip>
                <Chip>ОҚЫЛҒАН · {formatHours(readSeconds)} САҒ</Chip>
                <Chip>
                  {night ? "☾" : "☀"} {clock.label} · АСТАНА
                </Chip>
              </div>
            </div>

            {/* Үш баған: сол жақта рейтинг, ортада бақ, оң жақта су құю.
               Телефонда бәрі бір бағанға түседі де, рейтинг ең астына кетеді. */}
            <div className="garden-grid">
              <section className="garden-col garden-col--stage">
            {/* ── Негізгі сахна: пайдаланушының өз ағашы ── */}
            <div
              style={{
                border: `4px solid ${P.line}`,
                background: P.panel,
                boxShadow: `0 0 0 3px ${P.bg}, 0 14px 0 -6px rgba(0,0,0,.4)`
              }}
            >
              <div style={{ position: "relative" }}>
                <PixelScene
                  width={512}
                  height={288}
                  config={{
                    night,
                    wide: true,
                    island: { cx: 256, top: 172, half: 214, depth: 86 },
                    satellite: { cx: 254, top: 80, half: 30, depth: 20 },
                    house: 388,
                    well: 58,
                    // Персонаж үшінші ағаш пен үйдің арасында тұрады
                    avatar: { x: 366, look: avatar },
                    trees: TREE_SLOTS.map((slot, index) => ({ x: slot.x, idx: stages[index].treeIndex }))
                  }}
                />

                {/* Таңдалған ағашты көрсететін нұсқағыш */}
                <span
                  aria-hidden="true"
                  className="garden-pointer"
                  style={{ left: `${(TREE_SLOTS[activeTree].x / 512) * 100}%` }}
                >
                  ▼
                </span>

                {/* Су құю анимациясы: тамшылар таңдалған ағашқа құйылады */}
                {pouring ? (
                  <span
                    aria-hidden="true"
                    className="garden-pour"
                    style={{ left: `${(TREE_SLOTS[activeTree].x / 512) * 100}%` }}
                  >
                    {[0, 1, 2, 3, 4, 5].map((drop) => (
                      <i key={drop} style={{ animationDelay: `${drop * 0.11}s`, left: `${(drop % 3) * 9 - 9}px` }} />
                    ))}
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "11px 15px",
                  borderTop: `4px solid ${P.line}`,
                  background: P.panelFoot
                }}
              >
                <span style={{ fontSize: 25, fontWeight: 600, color: P.textBright, letterSpacing: ".03em" }}>
                  {TREE_SLOTS[activeTree].label.toUpperCase()} · {String(stage.level).padStart(2, "0")}{" "}
                  {stage.title.toUpperCase()} · {night ? "ТҮН" : "КҮНДІЗ"}
                </span>
                <span style={{ fontSize: 21, color: P.muted }}>
                  {pouring ? "Су құйылып жатыр..." : canWater ? "Су құюға дайын" : "Су жиналуда"}
                </span>
              </div>
            </div>

            {/* ── Қай ағашқа құятынын таңдау ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              {TREE_SLOTS.map((slot, index) => {
                const active = index === activeTree;
                const treeStage = stages[index];

                return (
                  <button
                    key={slot.label}
                    type="button"
                    onClick={() => setActiveTree(index)}
                    style={{
                      textAlign: "left",
                      padding: "11px 14px",
                      background: active ? "#1d3a12" : P.chip,
                      border: `3px solid ${active ? "#8ad84c" : P.line}`,
                      color: P.text,
                      fontFamily: "inherit",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ fontSize: 19, letterSpacing: ".14em", color: active ? "#b7e06a" : P.eyebrow }}>
                      {slot.label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: P.textBright, lineHeight: 1.15 }}>
                      {String(treeStage.level).padStart(2, "0")} {treeStage.title}
                    </div>
                    <div style={{ fontSize: 18, color: P.muted }}>{formatHours(treeSeconds[index])} сағ құйылған</div>
                  </button>
                );
              })}
            </div>

              </section>

              <aside className="garden-col garden-col--water">
            {/* ── Су құю панелі ── */}
            <div
              style={{
                border: `3px solid ${P.line}`,
                background: P.panel,
                boxShadow: `0 0 0 2px ${P.bg}`,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 210px", border: `3px solid ${P.line}`, background: P.chip, padding: "11px 14px" }}>
                  <div style={{ fontSize: 20, letterSpacing: ".18em", color: P.eyebrow }}>ҚҰЮҒА ДАЙЫН СУ</div>
                  <div style={{ fontSize: 42, fontWeight: 800, color: P.chipText, lineHeight: 1.05 }}>
                    {formatHours(treeStats.availableWaterSeconds)} САҒ
                  </div>

                  {/* Су қалай жиналатыны: кітап оқыған уақыт тікелей суға айналады */}
                  <div style={{ marginTop: 10, fontSize: 17, color: P.muted, lineHeight: 1.5 }}>
                    Кітап оқыған 1 сағат = 1 сағат су. Қазір {fullHours} толық сағат жиналды.
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 17,
                      color: P.eyebrow
                    }}
                  >
                    <span>Келесі сағатқа дейін {minutesLeft} мин</span>
                    <span style={{ color: P.chipText, fontWeight: 700 }}>{hourPercent}%</span>
                  </div>
                  <div style={{ marginTop: 5, height: 16, border: `3px solid ${P.line}`, background: "#0a1a08", padding: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${hourPercent}%`,
                        background: "repeating-linear-gradient(90deg,#6ec7f5 0 6px,#3d93c9 6px 12px)",
                        transition: "width .45s ease-out"
                      }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={pourWater}
                disabled={!canWater}
                style={{
                  alignSelf: "flex-start",
                  padding: "12px 26px",
                  background: canWater ? "#1d3a12" : "#101c14",
                  border: `3px solid ${canWater ? P.line : "#22331f"}`,
                  color: canWater ? P.chipText : "#4d6642",
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  fontFamily: "inherit",
                  cursor: canWater ? "pointer" : "not-allowed",
                  boxShadow: canWater ? `0 5px 0 0 ${P.bg}` : "none"
                }}
              >
                💧 {pouring ? "ҚҰЙЫЛУДА..." : `СУ ҚҰЮ — ${TREE_SLOTS[activeTree].label}`}
              </button>

              {/* Құйылған соң нақты не өзгергенін көрсетеміз */}
              {lastPour ? (
                <div
                  style={{
                    border: `3px solid ${lastPour.toLevel > lastPour.fromLevel ? "#8ad84c" : P.line}`,
                    background: lastPour.toLevel > lastPour.fromLevel ? "#1d3a12" : P.chip,
                    padding: "10px 14px"
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, color: P.chipText, lineHeight: 1.25 }}>
                    💧 {formatHours(lastPour.amount)} сағ су құйылды — {lastPour.treeLabel}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 19, color: P.muted, lineHeight: 1.4 }}>
                    {lastPour.toLevel > lastPour.fromLevel
                      ? `🎉 Деңгей ${lastPour.fromLevel} → ${lastPour.toLevel}: ${lastPour.title}`
                      : `Деңгей ${lastPour.toLevel} (${lastPour.title}) · келесі деңгейге ${Math.max(
                          0,
                          100 - Math.round(stage.progressPercent)
                        )}% қалды`}
                  </div>
                </div>
              ) : null}

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    fontSize: 21,
                    color: P.muted,
                    marginBottom: 8
                  }}
                >
                  <span>{stage.progressLabel}</span>
                  <span style={{ color: P.chipText, fontWeight: 700 }}>{Math.round(stage.progressPercent)}%</span>
                </div>
                <div style={{ height: 26, border: `3px solid ${P.line}`, background: "#0a1a08", padding: 3 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(stage.progressPercent, stage.progressPercent > 0 ? 3 : 0)}%`,
                      background: "repeating-linear-gradient(90deg,#8ad84c 0 8px,#5da42b 8px 16px)",
                      // steps() өтпелісі кадр жіберіліп қалса жарты жолда тұрып қалады
                      transition: "width .45s ease-out"
                    }}
                  />
                </div>
              </div>


              <div
                style={{
                  border: `3px solid ${P.line}`,
                  background: P.chip,
                  padding: "9px 14px",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10
                }}
              >
                <span style={{ fontSize: 20, letterSpacing: ".18em", color: P.eyebrow }}>БАРЛЫҒЫ ҚҰЙЫЛҒАН</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: P.chipText }}>
                  {formatHours(treeStats.totalWateredSeconds)} САҒ
                </span>
              </div>
            </div>

              </aside>

              <aside className="garden-col garden-col--rank">
            {/* ── Оқу рейтингі (басты беттен осында көшірілді) ── */}
            <div
              style={{
                border: `3px solid ${P.line}`,
                background: P.panel,
                boxShadow: `0 0 0 2px ${P.bg}`,
                padding: 16
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 12
                }}
              >
                <span style={{ fontSize: 25, fontWeight: 700, color: P.textBright, letterSpacing: ".03em" }}>
                  ОҚУ РЕЙТИНГІ
                </span>
                <span style={{ fontSize: 19, color: P.eyebrow }}>Барлығы: {readingLeaderboard.length} аккаунт</span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {readingLeaderboard.map((item, index) => (
                  <div
                    key={item.email}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0,1fr) auto",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 12px",
                      border: `3px solid ${item.isCurrent ? "#8ad84c" : P.line}`,
                      background: item.isCurrent ? "#1d3a12" : P.chip
                    }}
                  >
                    <span
                      style={{
                        minWidth: 34,
                        textAlign: "center",
                        fontSize: 22,
                        fontWeight: 800,
                        color: index === 0 ? "#d9b64a" : P.eyebrow
                      }}
                    >
                      {index === 0 ? "★" : index + 1}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 22, fontWeight: 600, color: P.textBright }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize: 17, color: P.muted }}>
                        {item.role === "ADMIN" ? "Әкімші" : item.isCurrent ? "Сіздің аккаунтыңыз" : "Оқушы"}
                      </span>
                    </span>
                    <span style={{ fontSize: 19, color: P.chipText, whiteSpace: "nowrap" }}>
                      {formatHours(item.totalSeconds)} сағ · бүгін {formatHours(item.todaySeconds)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
              </aside>
            </div>

          </main>
        </div>
      </div>
    </RouteGuard>
  );
}

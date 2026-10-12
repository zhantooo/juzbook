"use client";

import { useEffect, useState } from "react";

/** Пиксель дизайнның палитрасы — бақ бетімен бірдей */
const P = {
  overlay: "rgba(4, 9, 15, 0.82)",
  panel: "#0c1a26",
  line: "#2c4f2a",
  chip: "#14260e",
  chipText: "#b7e06a",
  text: "#eaf7d2",
  textBright: "#f4fce4",
  eyebrow: "#7fae4d",
  muted: "#8fbf63"
};

const STORAGE_KEY = "juzbook-garden-intro-v1";

type Step = {
  badge: string;
  title: string;
  lines: string[];
};

const STEPS: Step[] = [
  {
    badge: "1 / 4",
    title: "АҒАШ БАҒЫ ДЕГЕНІМІЗ НЕ?",
    lines: [
      "Бұл — оқыған уақытыңның көрінетін жері. Кітап оқыған әр сағатың суға айналады, ал сол сумен ағаш өсіресің.",
      "Мақсаты қарапайым: күн сайын оқысаң, бағың өседі. Оқымай қалсаң, ағаш сол қалпында тұрып қалады."
    ]
  },
  {
    badge: "2 / 4",
    title: "СУ ҚАЛАЙ ЖИНАЛАДЫ?",
    lines: [
      "Кітап оқыған 1 сағат = 1 сағат су. Уақыт оқу бетінде автоматты түрде саналады, ештеңе басудың қажеті жоқ.",
      "Тест тапсырғанда әр дұрыс жауабың үстіне 1 минут су қосады. 10 сұраққа дұрыс жауап берсең — 10 минут су.",
      "«ҚҰЮҒА ДАЙЫН СУ» тақтасындағы көк жолақ ағымдағы сағаттың қанша пайызы жиналғанын және келесі сағатқа қанша минут қалғанын көрсетеді."
    ]
  },
  {
    badge: "3 / 4",
    title: "СУДЫ ҚАЛАЙ ҚҰЯМЫН?",
    lines: [
      "Алдымен бақтағы үш ағаштың бірін таңда — сахнаның астындағы карточкадан.",
      "Содан кейін оң жақтағы «СУ ҚҰЮ» түймесін бас. Су сол сәтте құйылады, содан соң тамшы анимациясы ойналады.",
      "Түйменің астында қанша сағат су құйылғаны және деңгей өзгергені жазылып тұрады."
    ]
  },
  {
    badge: "4 / 4",
    title: "ДЕҢГЕЙЛЕР",
    lines: [
      "Әр ағаштың 10 деңгейі бар: тұқымнан бастап алтын ағашқа дейін.",
      "Келесі деңгейге өту үшін қажет сағат саны артып отырады: 2 сағат — өскін, 5 — көшет, 10 — жас ағаш, 120 сағат — алтын ағаш.",
      "Суды үш ағашқа бөліп құюға да, біреуін тез өсіруге де болады — өзің шешесің."
    ]
  }
];

function PixelButton({
  children,
  onClick,
  variant = "primary"
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
}) {
  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 22px",
        background: isPrimary ? "#1d3a12" : "transparent",
        border: `3px solid ${isPrimary ? P.line : "#22331f"}`,
        color: isPrimary ? P.chipText : P.muted,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: ".06em",
        fontFamily: "inherit",
        cursor: "pointer",
        boxShadow: isPrimary ? "0 5px 0 0 #060d16" : "none"
      }}
    >
      {children}
    </button>
  );
}

/**
 * Бақпен алғаш танысқанда шығатын қадамдық нұсқаулық.
 * Бет дизайнымен бірдей пиксель стилінде, ортасында тұрады.
 */
export function GardenIntro({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setIsOpen(true);
      return;
    }

    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setIsOpen(true);
      }
    } catch {
      // localStorage қолжетімсіз болса, нұсқаулық көрсетілмейді
    }
  }, [forceOpen]);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // сақтау мүмкін болмаса да, терезе жабылады
    }
    setIsOpen(false);
    onClose?.();
  }

  if (!isOpen) {
    return null;
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ағаш бағының нұсқаулығы"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: P.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          background: P.panel,
          border: `4px solid ${P.line}`,
          boxShadow: "0 0 0 3px #060d16, 0 18px 0 -8px rgba(0,0,0,.45)",
          color: P.text
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderBottom: `4px solid ${P.line}`,
            background: "#0f1f0b"
          }}
        >
          <span style={{ fontSize: 20, letterSpacing: ".18em", color: P.eyebrow }}>НҰСҚАУЛЫҚ</span>
          <span style={{ fontSize: 20, color: P.chipText, fontWeight: 700 }}>{current.badge}</span>
        </div>

        <div style={{ padding: "18px 20px 8px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.15,
              color: P.textBright,
              textShadow: "3px 3px 0 #15290f"
            }}
          >
            {current.title}
          </p>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {current.lines.map((line) => (
              <p key={line} style={{ margin: 0, fontSize: 21, lineHeight: 1.5, color: P.muted }}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Қадам көрсеткіші */}
        <div style={{ display: "flex", gap: 6, padding: "14px 20px 0" }}>
          {STEPS.map((item, index) => (
            <span
              key={item.badge}
              style={{
                height: 8,
                flex: 1,
                background: index <= step ? P.chipText : P.chip,
                border: `2px solid ${P.line}`
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px 20px"
          }}
        >
          <PixelButton variant="ghost" onClick={finish}>
            ӨТКІЗІП ЖІБЕРУ
          </PixelButton>

          <div style={{ display: "flex", gap: 10 }}>
            {step > 0 ? (
              <PixelButton variant="ghost" onClick={() => setStep((value) => value - 1)}>
                АРТҚА
              </PixelButton>
            ) : null}
            <PixelButton onClick={() => (isLast ? finish() : setStep((value) => value + 1))}>
              {isLast ? "ТҮСІНІКТІ" : "КЕЛЕСІ"}
            </PixelButton>
          </div>
        </div>
      </div>
    </div>
  );
}

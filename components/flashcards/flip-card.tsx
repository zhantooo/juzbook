"use client";

type FlipCardProps = {
  question: string;
  answer: string;
  flipped: boolean;
  onFlip: () => void;
  size?: "lg" | "sm";
  /** Карточка астындағы шағын жазу (пән, тақырып) */
  meta?: string;
};

/**
 * Сұрақ/жауап карточкасы: басқанда 3D кеңістікте жұмсақ айналады.
 * Анимация стильдері `app/globals.css` ішіндегі `.flip-card*` класстарында.
 */
export function FlipCard({ question, answer, flipped, onFlip, size = "lg", meta }: FlipCardProps) {
  return (
    <button
      type="button"
      onClick={onFlip}
      aria-pressed={flipped}
      aria-label={
        flipped ? `Жауап: ${answer}. Сұраққа оралу үшін басыңыз` : `Сұрақ: ${question}. Жауабын көру үшін басыңыз`
      }
      className={`flip-card ${size === "sm" ? "flip-card-sm" : "flip-card-lg"}`}
    >
      <span className={`flip-card-inner${flipped ? " is-flipped" : ""}`}>
        <span className="flip-card-face flip-card-front" aria-hidden="true">
          <span className="flip-card-label">Сұрақ</span>
          <span className="flip-card-text">{question}</span>
          <span className="flip-card-foot">
            <span className="flip-card-meta">{meta}</span>
            <span className="flip-card-hint">Айналдыру ↻</span>
          </span>
        </span>
        <span className="flip-card-face flip-card-back" aria-hidden="true">
          <span className="flip-card-label">Жауап</span>
          <span className="flip-card-text">{answer}</span>
          <span className="flip-card-foot">
            <span className="flip-card-meta">{meta}</span>
            <span className="flip-card-hint">Сұраққа оралу ↺</span>
          </span>
        </span>
      </span>
    </button>
  );
}

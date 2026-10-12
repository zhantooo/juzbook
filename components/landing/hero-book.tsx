"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/state/auth-context";
import { useCatalog } from "@/components/state/catalog-context";
import { comboOptions } from "@/lib/demo-catalog";
import type { SubjectRecord } from "@/lib/types";

const TURN_MS = 900;
const ENTER_MS = 760;
// Жабылу анимациясының ұзақтығы (0.24s кідіріс + 0.85s) — globals.css
const CLOSE_MS = 1150;
const PLACEHOLDER_LINES = [82, 58, 90, 44, 70];

/**
 * Ашылатын кітап (таза CSS 3D). Ашылған соң екі беті нағыз каталог мазмұнын
 * көрсетеді, беттерді 3D-мен аударуға және кітапқа "кіріп" пәнге өтуге болады.
 */
export function HeroBook() {
  const { subjects } = useCatalog();
  const { session, selectedCombo } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [closing, setClosing] = useState(false);
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<{
    dir: "next" | "prev";
    front: SubjectRecord;
    back: SubjectRecord;
    frontNumber: number;
    backNumber: number;
    id: number;
  } | null>(null);
  const timers = useRef<number[]>([]);
  const turnId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), 900);
    timers.current.push(timer);

    return () => {
      timers.current.forEach((item) => window.clearTimeout(item));
      timers.current = [];
    };
  }, []);

  // Профильде таңдалған комбо пәндері мен Қазақстан тарихы алдымен тұрады —
  // оқушы кітапты ашқанда ең керек пәндерін бірден көреді.
  const orderedSubjects = useMemo(() => {
    const priority = selectedCombo
      ? [...(comboOptions.find((item) => item.code === selectedCombo)?.subjectIds ?? []), "kazakh-history"]
      : [];

    if (priority.length === 0) {
      return subjects;
    }

    const rank = (id: string) => {
      const position = priority.indexOf(id);
      return position === -1 ? priority.length : position;
    };

    return [...subjects].sort((left, right) => rank(left.id) - rank(right.id));
  }, [selectedCombo, subjects]);

  const total = orderedSubjects.length;
  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0;
  const active = total > 0 ? orderedSubjects[safeIndex] : null;

  function flip(dir: "next" | "prev") {
    if (total < 2 || turn || entering || closing || !open) {
      return;
    }

    const current = orderedSubjects[safeIndex];
    const nextIndex = dir === "next" ? (safeIndex + 1) % total : (safeIndex - 1 + total) % total;
    const upcoming = orderedSubjects[nextIndex];

    // Соңғы пәннен біріншіге (не біріншіден соңғыға) өткенде кітап жабылып,
    // басынан қайта ашылады — парақ аударылмайды.
    const wraps = dir === "next" ? nextIndex === 0 : nextIndex === total - 1;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (wraps && !reduceMotion) {
      setClosing(true);
      timers.current.push(
        window.setTimeout(() => {
          setIndex(nextIndex);
          setClosing(false);
        }, CLOSE_MS)
      );
      return;
    }

    turnId.current += 1;
    // Нағыз парақ сияқты: аударылатын беттің бет жағы — кетіп бара жатқан пән,
    // сырт жағы — келе жатқан пәннің мұқаба беті.
    setTurn({
      dir,
      front: dir === "next" ? current : upcoming,
      back: dir === "next" ? upcoming : current,
      frontNumber: dir === "next" ? safeIndex + 1 : nextIndex + 1,
      backNumber: dir === "next" ? nextIndex + 1 : safeIndex + 1,
      id: turnId.current
    });
    setIndex(nextIndex);

    timers.current.push(window.setTimeout(() => setTurn(null), TURN_MS));
  }

  function enterSubject(event: MouseEvent<HTMLAnchorElement>) {
    if (!active || entering) {
      return;
    }

    event.preventDefault();
    setEntering(true);
    timers.current.push(window.setTimeout(() => router.push(href), ENTER_MS));
  }

  const href = active
    ? session
      ? `/subjects/${active.id}`
      : `/login?redirect=/subjects/${active.id}`
    : "#subjects";

  return (
    <div
      className="hero-book-stage relative flex w-full flex-col items-center justify-center gap-7"
      data-open={open && !closing ? "true" : "false"}
      data-closing={closing ? "true" : "false"}
      data-entering={entering ? "true" : "false"}
    >
      <div className="hero-book-glow" />

      <div className="hero-book-holder">
        <a
          href={href}
          onClick={enterSubject}
          className="hero-book"
          aria-label={active ? `${active.name} пәнін ашу` : "Пәндер каталогына өту"}
        >
          {/* Оң жақ бет */}
          <div className="hero-book-back">
            <div className="hero-book-page hero-book-page-right">
              <SubjectPage subject={active} number={safeIndex + 1} total={total} />
            </div>
          </div>

          {turn ? (
            <div key={turn.id} className="hero-book-turner" data-dir={turn.dir}>
              <div className="hero-book-turner-face hero-book-turner-front">
                <SubjectPage subject={turn.front} number={turn.frontNumber} total={total} />
              </div>
              <div className="hero-book-turner-face hero-book-turner-back">
                <CoverPage subject={turn.back} number={turn.backNumber} total={total} />
              </div>
            </div>
          ) : null}

          {/* Ашылғанда фанның ЕҢ ҮСТІНДЕ тұратын парақ — сол жақ бет осы.
              Пәннің визуалды жағы (әрпі мен нөмірі) сонда орналасады. */}
          <div className="hero-book-leaf hero-book-leaf-3">
            <div className="hero-book-leaf-face hero-book-leaf-front">
              {PLACEHOLDER_LINES.slice(0, 4).map((width, position) => (
                <span key={position} className="hero-book-line" style={{ width: `${width}%` }} />
              ))}
            </div>
            <div className="hero-book-leaf-face hero-book-leaf-back">
              <CoverPage subject={active} number={safeIndex + 1} total={total} />
            </div>
          </div>

          <div className="hero-book-leaf hero-book-leaf-2">
            <div className="hero-book-leaf-face hero-book-leaf-front">
              {PLACEHOLDER_LINES.map((width, position) => (
                <span key={position} className="hero-book-line" style={{ width: `${width}%` }} />
              ))}
            </div>
            <div className="hero-book-leaf-face hero-book-leaf-back" />
          </div>

          {/* Мұқаба: сырты — бренд, іші — сол жақ бет */}
          <div className="hero-book-leaf hero-book-cover">
            <div className="hero-book-leaf-face hero-book-cover-front">
              <span className="hero-book-brand">JUZBOOK</span>
              <span className="hero-book-cover-rule" />
              <span className="hero-book-cover-note">ҰБТ-ға дайындалу</span>
            </div>
            <div className="hero-book-leaf-face hero-book-cover-inner" />
          </div>

          <div className="hero-book-spine" />
        </a>
      </div>

      <div className="hero-book-nav">
        <button type="button" onClick={() => flip("prev")} disabled={total < 2} aria-label="Алдыңғы пән">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="hero-book-nav-count">
          {total > 0 ? `${String(safeIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : "—"}
        </span>
        <button type="button" onClick={() => flip("next")} disabled={total < 2} aria-label="Келесі пән">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CoverPage({ subject, number, total }: { subject: SubjectRecord | null; number: number; total: number }) {
  if (!subject) {
    return (
      <>
        {PLACEHOLDER_LINES.slice(0, 3).map((width, position) => (
          <span key={position} className="hero-book-line" style={{ width: `${width}%` }} />
        ))}
      </>
    );
  }

  return (
    <div className="hero-page hero-page-cover">
      <span className="hero-page-initial">{subject.name.trim().charAt(0)}</span>
      <span className="hero-page-index">
        {String(number).padStart(2, "0")}
        <i>/{String(total).padStart(2, "0")}</i>
      </span>
    </div>
  );
}

function SubjectPage({ subject, number, total }: { subject: SubjectRecord | null; number: number; total: number }) {
  if (!subject) {
    return (
      <>
        {PLACEHOLDER_LINES.concat([84, 70]).map((width, position) => (
          <span key={position} className="hero-book-line" style={{ width: `${width}%` }} />
        ))}
      </>
    );
  }

  const bookCount = subject.books.length;
  const topicCount = subject.books.reduce((sum, book) => sum + book.chapters.length, 0);

  return (
    <div className="hero-page">
      <p className="hero-page-eyebrow">
        Пән {String(number).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <h3 className="hero-page-title">{subject.name}</h3>
      <p className="hero-page-desc">{subject.description}</p>
      <p className="hero-page-meta">
        {bookCount} кітап · {topicCount} тақырып
      </p>
      <span className="hero-page-cta">Пәнді ашу →</span>
    </div>
  );
}

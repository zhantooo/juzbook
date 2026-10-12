"use client";

import { useCallback, useEffect, useRef } from "react";

/** Аудиодағы бір сөздің уақыт белгісі (серверде edge-tts береді) */
export type AudioMark = {
  t: number;
  d: number;
  w: string;
};

type DomWord = {
  node: Text;
  start: number;
  end: number;
  normalized: string;
};

const HIGHLIGHT_NAME = "juz-audio-word";
const HIGHLIGHT_STYLE_ID = "juz-audio-word-style";

/**
 * ::highlight() ережесін бетке JS арқылы қосамыз.
 * Кейбір CSS талдағыштары (Turbopack/lightningcss) бұл синтаксисті танымай,
 * бүкіл стиль файлын құлатады — сондықтан ол CSS файлында сақталмайды.
 */
function ensureHighlightStyle() {
  if (typeof document === "undefined" || document.getElementById(HIGHLIGHT_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = [
    "::highlight(" + HIGHLIGHT_NAME + "){",
    "background-color:rgba(56,189,248,.42);",
    "color:inherit;",
    "text-decoration:underline;",
    "text-decoration-color:rgba(2,132,199,.75);",
    "text-decoration-thickness:2px;",
    "text-underline-offset:3px;",
    "}",
    ".dark ::highlight(" + HIGHLIGHT_NAME + "){",
    "background-color:rgba(34,211,238,.32);",
    "text-decoration-color:rgba(103,232,249,.8);",
    "}"
  ].join("");

  document.head.appendChild(style);
}

/** Сөзді салыстыруға дайындау: тек әріп пен сан қалады */
function normalizeWord(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function supportsHighlightApi() {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

/** Мәтіндегі барлық сөзді ретімен жинау */
function collectDomWords(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }
      // Қалқымалы мәзірлер мен басқару элементтері оқылмайды
      if (parent.closest("[data-selection-box], button, [data-audio-skip='true']")) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const words: DomWord[] = [];
  const pattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

  let current = walker.nextNode() as Text | null;
  while (current) {
    const value = current.nodeValue ?? "";
    pattern.lastIndex = 0;
    let match = pattern.exec(value);
    while (match) {
      const normalized = normalizeWord(match[0]);
      if (normalized) {
        words.push({
          node: current,
          start: match.index,
          end: match.index + match[0].length,
          normalized
        });
      }
      match = pattern.exec(value);
    }
    current = walker.nextNode() as Text | null;
  }

  return words;
}

/**
 * Аудио белгілерін беттегі нақты сөздермен байланыстырады.
 * Кейбір сөздер (мысалы, тақырып атауы) мәтінде кездеспеуі мүмкін —
 * ондай белгілер -1 болып қалады да, өткізіліп жіберіледі.
 */
function alignMarks(marks: AudioMark[], domWords: DomWord[]) {
  const map = new Array<number>(marks.length).fill(-1);
  const lookahead = 40;
  let cursor = 0;

  for (let index = 0; index < marks.length; index += 1) {
    const target = normalizeWord(marks[index]?.w ?? "");
    if (!target) {
      continue;
    }

    const limit = Math.min(cursor + lookahead, domWords.length);
    // Аудио тақырып атауынан басталады, ал ол мәтін ішінде жоқ. Сондықтан
    // бірінші сәйкестікті екі сөзбен бекітеміз — әйтпесе кездейсоқ қайталанған
    // сөзге ілігіп, бүкіл тізбек жылжып кетеді.
    const needsAnchor = cursor === 0;
    const nextTarget = needsAnchor ? normalizeWord(marks[index + 1]?.w ?? "") : "";

    for (let position = cursor; position < limit; position += 1) {
      if (domWords[position].normalized !== target) {
        continue;
      }

      if (needsAnchor && nextTarget && domWords[position + 1]?.normalized !== nextTarget) {
        continue;
      }

      map[index] = position;
      cursor = position + 1;
      break;
    }
  }

  return map;
}

/**
 * Түйін әлі де сол сөзді ұстап тұр ма? Мәтін қайта көрсетілгенде
 * ескі түйін бос қалуы мүмкін, сондықтан мазмұнын да тексереміз.
 */
function isWordStillValid(word: DomWord | null | undefined) {
  if (!word || !word.node.isConnected) {
    return false;
  }

  const value = word.node.nodeValue ?? "";
  if (value.length < word.end) {
    return false;
  }

  return normalizeWord(value.slice(word.start, word.end)) === word.normalized;
}

/** Уақыт бойынша ағымдағы сөзді табу (екілік іздеу) */
function findMarkIndex(marks: AudioMark[], timeMs: number) {
  let low = 0;
  let high = marks.length - 1;
  let result = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    if (marks[middle].t <= timeMs) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

/**
 * Аудио ойнап тұрғанда оқылып жатқан сөзді мәтінде ерекшелейді.
 * DOM өзгертілмейді — CSS Custom Highlight API қолданылады, сондықтан
 * маркерлер мен мәтін таңдау жұмысына кедергі жасамайды.
 */
export function useAudioWordHighlight(options: {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Аудио элементі панель ашылғанда ғана пайда болады, сондықтан ref емес — нақты элемент */
  audioElement: HTMLAudioElement | null;
  marks: AudioMark[];
  enabled: boolean;
  /** Оқылып жатқан сөз көрінбей қалса, бетті жайлап жылжыту */
  autoScroll?: boolean;
}) {
  const { containerRef, audioElement, marks, enabled, autoScroll = true } = options;

  const domWordsRef = useRef<DomWord[]>([]);
  const mapRef = useRef<number[]>([]);
  const activeDomIndexRef = useRef(-1);
  const activeWordRef = useRef<DomWord | null>(null);
  const frameRef = useRef<number | null>(null);

  const clearHighlight = useCallback(() => {
    if (supportsHighlightApi()) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    }
    activeDomIndexRef.current = -1;
    activeWordRef.current = null;
  }, []);

  /** Беттегі сөздерді қайта жинап, аудио белгілерімен қайта байланыстырады */
  const rebuildIndex = useCallback(() => {
    if (!enabled || !marks.length || !containerRef.current) {
      domWordsRef.current = [];
      mapRef.current = [];
      return;
    }

    const words = collectDomWords(containerRef.current);
    domWordsRef.current = words;
    mapRef.current = alignMarks(marks, words);
    activeDomIndexRef.current = -1;
  }, [containerRef, enabled, marks]);

  // Белгілер немесе мәтін өзгергенде сөз индексін қайта құрамыз
  useEffect(() => {
    rebuildIndex();
  }, [rebuildIndex, audioElement]);

  useEffect(() => {
    const audio = audioElement;
    if (!enabled || !audio || !marks.length || !supportsHighlightApi()) {
      return;
    }

    ensureHighlightStyle();

    let stopped = false;

    /** Ағымдағы уақытқа сәйкес сөзді бояйды */
    const apply = () => {
      if (stopped) {
        return;
      }

      const timeMs = audio.currentTime * 1000;
      const markIndex = findMarkIndex(marks, timeMs);

      if (markIndex < 0) {
        if (activeDomIndexRef.current !== -1) {
          clearHighlight();
        }
        return;
      }

      let domIndex = mapRef.current[markIndex] ?? -1;

      // Мәтін блоктары қайта көрсетілгенде ескі түйіндер жарамсыз болып қалады
      // (тіпті бос мәтінге айналуы мүмкін) — ондайда индексті қайта құрамыз.
      if (domIndex >= 0 && !isWordStillValid(domWordsRef.current[domIndex])) {
        rebuildIndex();
        domIndex = mapRef.current[markIndex] ?? -1;
        if (domIndex >= 0 && !isWordStillValid(domWordsRef.current[domIndex])) {
          domIndex = -1;
        }
      }

      if (domIndex < 0) {
        // Бұл сөз мәтінде жоқ (мысалы, тақырып атауы) — ерекшелеуді өшіреміз
        if (activeDomIndexRef.current !== -1) {
          clearHighlight();
        }
        return;
      }

      // Сөз ауысқанда немесе бұрынғы белгі жарамсыз болып қалғанда қайта саламыз
      const isSameWord = domIndex === activeDomIndexRef.current;
      if (isSameWord && isWordStillValid(activeWordRef.current)) {
        return;
      }

      const word = domWordsRef.current[domIndex];
      if (!word) {
        return;
      }

      const range = document.createRange();
      range.setStart(word.node, word.start);
      range.setEnd(word.node, Math.min(word.end, word.node.length));
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
      activeDomIndexRef.current = domIndex;
      activeWordRef.current = word;

      if (autoScroll && !isSameWord) {
        const rect = range.getBoundingClientRect();
        const margin = 120;
        if (rect.height > 0 && (rect.top < margin || rect.bottom > window.innerHeight - margin)) {
          window.scrollBy({ top: rect.top - window.innerHeight / 2, behavior: "smooth" });
        }
      }
    };

    // requestAnimationFrame бет көрініп тұрғанда тегіс жаңартады,
    // ал timeupdate фондық режимде де жұмысты жалғастырады.
    const loop = () => {
      apply();
      frameRef.current = stopped || audio.paused ? null : window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(loop);
      }
    };

    const stop = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const handleEnded = () => {
      stop();
      clearHighlight();
    };

    audio.addEventListener("play", start);
    audio.addEventListener("playing", start);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("seeked", apply);
    audio.addEventListener("timeupdate", apply);

    if (!audio.paused) {
      start();
    } else {
      apply();
    }

    return () => {
      stopped = true;
      stop();
      audio.removeEventListener("play", start);
      audio.removeEventListener("playing", start);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("seeked", apply);
      audio.removeEventListener("timeupdate", apply);
      clearHighlight();
    };
  }, [audioElement, autoScroll, clearHighlight, enabled, marks, rebuildIndex]);

  return { isSupported: supportsHighlightApi() };
}

"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Palette,
  Quote,
  SmilePlus,
  Underline
} from "lucide-react";

const colorOptions = ["#0f172a", "#1d4ed8", "#0f766e", "#be123c", "#d97706", "#7c3aed", "#ea580c", "#16a34a"];
const emojiOptions = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤓", "🤔", "🤯", "🥳", "😭", "😤", "😡",
  "👋", "👌", "✌️", "🤞", "🤟", "🤙", "👍", "👎", "👏", "🙌", "🙏", "💪",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕", "💡", "🔥",
  "📘", "📗", "📕", "📙", "📚", "📖", "🧠", "✏️", "📝", "📌", "📎", "📐", "📏", "🧮", "🔬", "🔭", "🧬", "🧪", "⚗️", "💻", "⌨️", "🖥️",
  "✅", "☑️", "✔️", "❌", "❗", "❓", "⭐", "🌟", "💬", "💭", "🔎", "🔐", "🔒", "🔓", "⚠️", "🎯", "🚀", "🏆"
];

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isEmptyEditorHtml(value: string) {
  return !value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/<div>\s*<\/div>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

export function NoteEditor({
  value,
  onChange,
  placeholder = "Осы тақырып бойынша конспектіңізді осы жерге жазыңыз...",
  minHeightClass = "min-h-[220px]",
  /** Жазу алаңының ең үлкен биіктігі — одан асқанда астыға қарай скролл болады */
  maxHeightClass = "max-h-[18rem]"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  maxHeightClass?: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const colorButtonRef = useRef<HTMLButtonElement | null>(null);
  const isFocusedRef = useRef(false);
  const lastSyncedValueRef = useRef("");
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiMenuPosition, setEmojiMenuPosition] = useState({ left: 12, top: 120 });
  // Түс мәзірі де эмодзи мәзірі сияқты экранға бекітіледі: конспект панелі
  // скроллды болғандықтан, absolute мәзір қиылып қалатын еді.
  const [colorMenuPosition, setColorMenuPosition] = useState({ left: 12, top: 120 });
  const [isEmpty, setIsEmpty] = useState(isEmptyEditorHtml(value));

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const nextHtml = isEmptyEditorHtml(value) ? "" : value;

    if (isFocusedRef.current && lastSyncedValueRef.current === nextHtml) {
      setIsEmpty(isEmptyEditorHtml(nextHtml));
      return;
    }

    if (editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }

    lastSyncedValueRef.current = nextHtml;
    setIsEmpty(isEmptyEditorHtml(nextHtml));
  }, [value]);

  useEffect(() => {
    if (!isEmojiMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note-emoji-menu='true']") || target?.closest("[data-note-emoji-button='true']")) {
        return;
      }

      setIsEmojiMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isEmojiMenuOpen]);

  function syncContent() {
    if (!editorRef.current) {
      return;
    }

    const nextHtml = editorRef.current.innerHTML;
    const normalized = isEmptyEditorHtml(nextHtml) ? "" : nextHtml;
    lastSyncedValueRef.current = normalized;
    setIsEmpty(!normalized);
    onChange(normalized);
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    selectionRef.current = range.cloneRange();
  }

  function restoreSelection() {
    editorRef.current?.focus();

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    if (selectionRef.current && editorRef.current?.contains(selectionRef.current.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
      return;
    }

    if (editorRef.current) {
      placeCaretAtEnd(editorRef.current);
      rememberSelection();
    }
  }

  function handleToolbarMouseDown(event: ReactMouseEvent<HTMLElement>) {
    event.preventDefault();
  }

  function runCommand(command: string, valueArg?: string) {
    restoreSelection();
    document.execCommand(command, false, valueArg);
    syncContent();
    rememberSelection();
  }

  function insertHtml(html: string) {
    restoreSelection();
    document.execCommand("insertHTML", false, html);
    syncContent();
    rememberSelection();
  }

  function insertEmoji(emoji: string) {
    restoreSelection();
    document.execCommand("insertText", false, emoji);
    syncContent();
    rememberSelection();
    setIsEmojiMenuOpen(false);
  }

  function toggleEmojiMenu() {
    rememberSelection();
    const rect = emojiButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = Math.min(360, window.innerWidth - 24);
      setEmojiMenuPosition({
        left: Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)),
        top: Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 430))
      });
    }
    setIsEmojiMenuOpen((current) => !current);
    setIsColorMenuOpen(false);
  }

  const tools = [
    { label: "Қалың", icon: Bold, action: () => runCommand("bold") },
    { label: "Курсив", icon: Italic, action: () => runCommand("italic") },
    { label: "Асты сызу", icon: Underline, action: () => runCommand("underline") },
    { label: "Солға туралау", icon: AlignLeft, action: () => runCommand("justifyLeft") },
    { label: "Ортаға туралау", icon: AlignCenter, action: () => runCommand("justifyCenter") },
    { label: "Оңға туралау", icon: AlignRight, action: () => runCommand("justifyRight") },
    { label: "Маркерлі тізім", icon: List, action: () => runCommand("insertUnorderedList") },
    { label: "Нөмірленген тізім", icon: ListOrdered, action: () => runCommand("insertOrderedList") },
    {
      label: "Дәйексөз",
      icon: Quote,
      action: () => {
        const selected = selectionRef.current?.toString().trim() || "Дәйексөз мәтіні";
        insertHtml(`<blockquote><p>${escapeHtml(selected)}</p></blockquote>`);
      }
    }
  ];

  return (
    <div className="relative w-full max-w-none overflow-visible rounded-3xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative z-20 flex flex-wrap items-center gap-2 overflow-visible border-b border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              onMouseDown={handleToolbarMouseDown}
              onClick={tool.action}
              className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}

        <div className="relative z-30">
          <button
            ref={colorButtonRef}
            type="button"
            title="Мәтін түсі"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => {
              rememberSelection();
              const rect = colorButtonRef.current?.getBoundingClientRect();
              if (rect) {
                const menuWidth = 224;
                setColorMenuPosition({
                  left: Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)),
                  top: Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 210))
                });
              }
              setIsColorMenuOpen((current) => !current);
              setIsEmojiMenuOpen(false);
            }}
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <Palette className="h-4 w-4" />
          </button>

          {isColorMenuOpen ? (
            <div
              className="fixed z-[100] grid w-56 grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
              style={{ left: colorMenuPosition.left, top: colorMenuPosition.top }}
            >
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={handleToolbarMouseDown}
                  onClick={() => {
                    restoreSelection();
                    document.execCommand("styleWithCSS", false, "true");
                    document.execCommand("foreColor", false, color);
                    syncContent();
                    rememberSelection();
                    setIsColorMenuOpen(false);
                  }}
                  className="h-8 w-8 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative z-30">
          <button
            ref={emojiButtonRef}
            type="button"
            data-note-emoji-button="true"
            title="Эмодзи"
            onMouseDown={handleToolbarMouseDown}
            onClick={toggleEmojiMenu}
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <SmilePlus className="h-4 w-4" />
          </button>

          {isEmojiMenuOpen ? (
            <div
              data-note-emoji-menu="true"
              className="fixed z-[100] max-h-[420px] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-panel border border-zinc-700 bg-zinc-900 p-3 text-white shadow-2xl"
              style={{ left: emojiMenuPosition.left, top: emojiMenuPosition.top }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Эмодзи және басқа элементтер</p>
                <div className="rounded-full bg-zinc-800 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  Жинақ
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-zinc-800 p-3">
                <input
                  value={emojiSearch}
                  spellCheck={false}
                  onChange={(event) => setEmojiSearch(event.target.value || "")}
                  placeholder="Іздеу"
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </div>
              <div className="mt-3 grid grid-cols-6 gap-2">
                {emojiOptions
                  .filter((emoji) => !emojiSearch.trim() || emoji.includes(emojiSearch.trim()))
                  .map((emoji, index) => (
                    <button
                      key={`${emoji}-${index}`}
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => insertEmoji(emoji)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-2xl transition hover:border-sky-400 hover:bg-zinc-700"
                    >
                      {emoji}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`relative min-w-0 ${minHeightClass}`}>
        {isEmpty ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 text-base leading-8 text-slate-400 dark:text-zinc-500">
            {placeholder}
          </div>
        ) : null}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={syncContent}
          onMouseUp={rememberSelection}
          onKeyUp={rememberSelection}
          onFocus={() => {
            isFocusedRef.current = true;
            rememberSelection();
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            setIsColorMenuOpen(false);
            syncContent();
          }}
          className={`${minHeightClass} ${maxHeightClass} w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] px-4 py-4 text-base leading-8 text-slate-800 outline-none dark:text-zinc-100 [&_*]:max-w-full [&_*]:[overflow-wrap:anywhere] [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_img]:h-auto [&_img]:max-w-full [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p]:whitespace-pre-wrap [&_pre]:whitespace-pre-wrap [&_strong]:font-semibold [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_u]:underline [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6`}
        />
      </div>
    </div>
  );
}

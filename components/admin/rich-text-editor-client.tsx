"use client";

import type { ChangeEvent, DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookType,
  Crop,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  PaintBucket,
  Quote,
  ShieldAlert,
  SmilePlus,
  Subscript,
  Superscript,
  Table2,
  Trash2,
  Undo2
} from "lucide-react";
import { sanitizeRichText } from "@/lib/sanitize";

type CommandName = "bold" | "italic" | "subscript" | "superscript";
type DangerColor = "red" | "yellow" | "blue" | "green" | "violet";
type DangerPlacement = "danger" | "rightdanger";
type TermImageAlign = "top" | "left" | "right";
type TermSurface = "default" | "white" | "transparent";
type BlockType = "danger" | "rightdanger" | "term" | "termgroup" | "colorbox";
type ContentImageAlign = "left" | "center" | "right";
type TableMode = "table" | "tree";
type TermGroupItem = {
  id: string;
  title: string;
  body: string;
  image: string;
  imageWidth: string;
  imageHeight: string;
  imageAlign: TermImageAlign;
};

export type RichTextEditorHandle = {
  flush: () => string;
};

const textColors = ["#0f172a", "#1d4ed8", "#0f766e", "#be123c", "#d97706", "#7c3aed", "#ea580c", "#16a34a"];
const backgroundColors = ["transparent", "#ede5c3", "#eff6ff", "#ecfeff", "#f0fdf4", "#fffbeb", "#fff1f2", "#f5f3ff", "#f8fafc", "#ffffff"];
const emojiOptions = [
  ...["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🫢", "🫣", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😶‍🌫️", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "😵‍💫", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬"].map((symbol) => ({ symbol, label: "бет-әлпет" })),
  ...["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💪"].map((symbol) => ({ symbol, label: "қол" })),
  ...["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "❤️‍🔥", "❤️‍🩹", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((symbol) => ({ symbol, label: "таңба жүрек" })),
  ...["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🪲", "🪳", "🦟", "🦗", "🕷️", "🦂", "🐢", "🐍", "🦎", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🦣", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🦬", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐈", "🪶"].map((symbol) => ({ symbol, label: "жануар табиғат" })),
  ...["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "🌯", "🥗", "🥘", "🫕", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪"].map((symbol) => ({ symbol, label: "тағам" })),
  ...["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸", "⛹️", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🚣", "🧗", "🚴", "🚵"].map((symbol) => ({ symbol, label: "спорт" })),
  ...["📘", "📗", "📕", "📙", "📚", "📖", "🧠", "💡", "✏️", "📝", "📌", "📎", "🖊️", "🖋️", "📐", "📏", "🧮", "🔬", "🔭", "🧬", "🧪", "⚗️", "🧫", "🧲", "💻", "🖥️", "⌨️", "🖱️", "🖨️", "📱", "📲", "☎️", "📞", "📟", "📠", "🔋", "🪫", "🔌", "💾", "💿", "📀", "🧭", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔎", "🔍", "🔐", "🔒", "🔓", "🗝️", "🔨", "🪛", "🔧", "🪜", "⚙️", "🧰", "🧱", "🪨"].map((symbol) => ({ symbol, label: "оқу құрал" })),
  ...["✅", "☑️", "✔️", "❌", "❎", "➕", "➖", "➗", "✖️", "♾️", "‼️", "⁉️", "❓", "❔", "❕", "❗", "〰️", "💱", "💲", "⚕️", "♻️", "⚜️", "🔱", "📛", "🔰", "⭕", "🟢", "🔵", "🔴", "🟡", "🟠", "🟣", "⚫", "⚪", "🟤", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛", "⬜", "◼️", "◻️", "◾", "◽", "▪️", "▫️", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💬", "💭", "🗯️", "♨️", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣", "💤"].map((symbol) => ({ symbol, label: "белгі" }))
];
const gifOptions = [
  {
    id: "success",
    label: "жетістік",
    src: "https://media.giphy.com/media/l3q2XhfQ8oCkm1Ts4/giphy.gif"
  },
  {
    id: "study",
    label: "оқу",
    src: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif"
  },
  {
    id: "idea",
    label: "идея",
    src: "https://media.giphy.com/media/lXu72d4iKwqek/giphy.gif"
  },
  {
    id: "brain",
    label: "ми",
    src: "https://media.giphy.com/media/QNFhOolVeCzPQ2Mx85/giphy.gif"
  }
];

const dangerColors: Array<{ value: DangerColor; label: string; preview: string }> = [
  { value: "red", label: "Қызыл", preview: "linear-gradient(135deg, #fb7185, #fecdd3)" },
  { value: "yellow", label: "Сары", preview: "linear-gradient(135deg, #f59e0b, #fde68a)" },
  { value: "blue", label: "Көк", preview: "linear-gradient(135deg, #3b82f6, #bfdbfe)" },
  { value: "green", label: "Жасыл", preview: "linear-gradient(135deg, #10b981, #bbf7d0)" },
  { value: "violet", label: "Күлгін", preview: "linear-gradient(135deg, #8b5cf6, #ddd6fe)" }
];

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeRichBlockBody(value: string) {
  return sanitizeRichText(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/\n\n/g, "<br /><br />")
    .trim();
}

function prepareBlockBodyForEditor(value: string) {
  return decodeEntities(value || "").replace(/<br\s*\/?>/gi, "\n").trim();
}

function stripHtmlForTree(value: string) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function createBlockActionButtons() {
  return `
    <div data-juz-actions="true" class="absolute right-3 top-3 z-10 flex items-center gap-2">
      <button type="button" data-juz-drag="true" contenteditable="false" draggable="true" class="cursor-grab rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 shadow-sm active:cursor-grabbing">Жылжыту</button>
      <button type="button" data-juz-edit="true" contenteditable="false" class="rounded-full border border-white/70 bg-white/90 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm">Өңдеу</button>
      <button type="button" data-juz-delete="true" contenteditable="false" class="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 shadow-sm">Өшіру</button>
    </div>
  `;
}

function createMoveDeleteButtons() {
  return `
    <div data-juz-actions="true" class="absolute right-3 top-3 z-10 flex items-center gap-2">
      <button type="button" data-juz-drag="true" contenteditable="false" draggable="true" class="cursor-grab rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 shadow-sm active:cursor-grabbing">Жылжыту</button>
      <button type="button" data-juz-delete="true" contenteditable="false" class="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 shadow-sm">Өшіру</button>
    </div>
  `;
}

function createEditorImageId() {
  return `juz-image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function tooltip(label: string) {
  return (
    <span className="pointer-events-none absolute -top-11 left-1/2 z-40 hidden -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs text-white shadow-lg group-hover:block dark:bg-zinc-100 dark:text-zinc-950">
      {label}
    </span>
  );
}

function BlockTextTools({
  onBold,
  onItalic,
  onUnderline
}: {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
}) {
  const buttonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onBold} className={buttonClass} aria-label="Қалың мәтін">
        <Bold className="h-4 w-4" />
      </button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onItalic} className={buttonClass} aria-label="Курсив">
        <Italic className="h-4 w-4" />
      </button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onUnderline} className={buttonClass} aria-label="Асты сызылған мәтін">
        <span className="text-sm font-semibold underline">U</span>
      </button>
    </div>
  );
}

function CollapseSection({
  title,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-zinc-700 dark:bg-zinc-950/60">
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-900 dark:text-zinc-100"
      >
        <span>{title}</span>
        <span className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
          {isOpen ? "Жинақтау" : "Ашу"}
        </span>
      </button>
      {isOpen ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function createDangerPreviewHtml({
  title,
  body,
  color,
  placement
}: {
  title: string;
  body: string;
  color: DangerColor;
  placement: DangerPlacement;
}) {
  const palette =
    color === "yellow"
      ? {
          container: "border-amber-200 bg-amber-50 text-amber-900",
          icon: "bg-amber-100 text-amber-700"
        }
      : color === "blue"
        ? {
            container: "border-sky-200 bg-sky-50 text-sky-900",
            icon: "bg-sky-100 text-sky-700"
          }
        : color === "green"
          ? {
              container: "border-emerald-200 bg-emerald-50 text-emerald-900",
              icon: "bg-emerald-100 text-emerald-700"
            }
          : color === "violet"
            ? {
                container: "border-violet-200 bg-violet-50 text-violet-900",
                icon: "bg-violet-100 text-violet-700"
              }
            : {
                container: "border-rose-200 bg-rose-50 text-rose-900",
                icon: "bg-rose-100 text-rose-700"
              };

  const blockType = placement === "rightdanger" ? "rightdanger" : "danger";
  const wrapperClass = placement === "rightdanger" ? "my-4 lg:float-right lg:clear-right lg:ml-6 lg:w-80" : "my-6";
  const richBody = normalizeRichBlockBody(body);

  return `
    <div
      data-juz-block="${blockType}"
      data-title="${escapeAttribute(title)}"
      data-body="${escapeAttribute(richBody)}"
      data-color="${color}"
      contenteditable="false"
      class="${wrapperClass} relative"
    >
      ${createBlockActionButtons()}
      <div class="rounded-3xl border p-5 ${palette.container} ${placement === "rightdanger" ? "w-full shadow-lg" : ""}">
        <div class="flex items-start gap-3">
          <div class="mt-1 rounded-full p-2 ${palette.icon}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-7.57 13.12A2 2 0 004.45 20h15.1a2 2 0 001.73-3.02L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.12em]">${escapeHtml(title)}</p>
            <div class="mt-2 text-base leading-8 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_strong]:font-semibold [&_u]:underline">${richBody}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createTermPreviewHtml({
  title,
  body,
  color,
  image,
  imageAlign,
  imageWidth,
  imageHeight,
  surface,
  backgroundColor
}: {
  title: string;
  body: string;
  color: DangerColor;
  image: string;
  imageAlign: TermImageAlign;
  imageWidth: string;
  imageHeight: string;
  surface: TermSurface;
  backgroundColor: string;
}) {
  const palette =
    color === "yellow"
      ? "bg-amber-100 text-amber-700"
      : color === "blue"
        ? "bg-sky-100 text-sky-700"
        : color === "green"
          ? "bg-emerald-100 text-emerald-700"
          : color === "violet"
            ? "bg-violet-100 text-violet-700"
            : "bg-rose-100 text-rose-700";

  const width = Math.max(20, Number(imageWidth) || 220);
  const height = Math.max(0, Number(imageHeight) || 0);
  const rowLayout =
    image && imageAlign !== "top"
      ? imageAlign === "right"
        ? "flex-col md:flex-row-reverse"
        : "flex-col md:flex-row"
      : "flex-col";
  const surfaceClass =
    surface === "transparent"
      ? "border-slate-200 bg-white/40 text-slate-900 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/45 dark:text-zinc-50"
      : surface === "white"
        ? "border-slate-200 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        : "backdrop-blur-sm border-slate-200 bg-slate-50/80 text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-50";
  const safeBackgroundColor = backgroundColor.trim();
  const shouldUseInlineBackground = Boolean(safeBackgroundColor && safeBackgroundColor !== "transparent" && !["#ffffff", "#f8fafc"].includes(safeBackgroundColor.toLowerCase()));
  const richBody = normalizeRichBlockBody(body);
  const imageStyle = [
    `width:min(100%, ${width}px)`,
    height ? `height:${height}px` : "height:auto",
    height ? "object-fit:contain" : ""
  ]
    .filter(Boolean)
    .join(";");

  return `
    <div
      data-juz-block="term"
      data-title="${escapeAttribute(title)}"
      data-body="${escapeAttribute(richBody)}"
      data-color="${color}"
      data-image="${escapeAttribute(image)}"
      data-image-align="${imageAlign}"
      data-image-width="${width}"
      data-image-height="${height || ""}"
      data-surface="${surface}"
      data-background-color="${escapeAttribute(safeBackgroundColor)}"
      contenteditable="false"
      class="my-4 relative"
    >
      ${createBlockActionButtons()}
      <div class="border rounded-xl p-4 shadow-sm ${surfaceClass}" ${shouldUseInlineBackground ? `style="background:${escapeAttribute(safeBackgroundColor)};"` : ""}>
        <div class="flex gap-4 ${rowLayout}">
          ${
            image
              ? `<div class="${imageAlign !== "top" ? "md:shrink-0" : "w-full"}" style="${imageAlign !== "top" ? `width:${width}px;max-width:100%;` : ""}">
                  <img src="${escapeAttribute(image)}" alt="" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md" style="${imageStyle}" />
                </div>`
              : ""
          }
          <div class="flex min-w-0 items-start gap-3">
            <div class="mt-1 rounded-full p-2 ${surface === "white" || surface === "transparent" ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200" : palette}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 7H20v12H6.5A2.5 2.5 0 014 21.5v-17z" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-base font-semibold leading-7">${escapeHtml(title)}</p>
              <div class="mt-1 text-base font-normal leading-8 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_strong]:font-semibold [&_u]:underline">${richBody}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createTermGroupItem(title = "Термин", body = "Түсіндірме", image = "", imageWidth = "180", imageHeight = "", imageAlign: TermImageAlign = "top"): TermGroupItem {
  return {
    id: `term-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    body,
    image,
    imageWidth,
    imageHeight,
    imageAlign
  };
}

function parseTermGroupItems(source: string): TermGroupItem[] {
  return source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+(?:—|-|:)\s+/);
      const title = (parts.shift() || "Термин").trim();
      const body = parts.join(" — ").trim() || "Түсіндірме";
      return createTermGroupItem(title, body);
    });
}

function encodeTermGroupItems(items: Array<{ title: string; body: string }>) {
  return items.map((item) => `${item.title} — ${item.body}`).join("\n");
}

function encodeTermGroupItemsAttribute(items: TermGroupItem[]) {
  return encodeURIComponent(
    JSON.stringify(
      items.map((item) => ({
        title: item.title,
        body: item.body,
        image: item.image,
        imageWidth: item.imageWidth,
        imageHeight: item.imageHeight,
        imageAlign: item.imageAlign
      }))
    )
  );
}

function decodeTermGroupItemsAttribute(value: string, fallback = ""): TermGroupItem[] {
  const candidates = [value, fallback].map((item) => item.trim()).filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(decodeURIComponent(candidate)) as Array<Partial<TermGroupItem>>;
      const items = parsed
        .map((item) =>
          createTermGroupItem(
            item.title || "Термин",
            item.body || "Түсіндірме",
            item.image || "",
            item.imageWidth || "180",
            item.imageHeight || "",
            (item.imageAlign as TermImageAlign) || "top"
          )
        )
        .filter((item) => item.title.trim() || item.body.trim() || item.image.trim());

      if (items.length) {
        return items;
      }
    } catch {
      continue;
    }
  }

  return parseTermGroupItems(fallback);
}

function createTermGroupPreviewHtml({
  title,
  items,
  color,
  backgroundColor
}: {
  title: string;
  items: TermGroupItem[];
  color: DangerColor;
  backgroundColor: string;
}) {
  const palette =
    color === "yellow"
      ? "bg-amber-100 text-amber-700"
      : color === "blue"
        ? "bg-sky-100 text-sky-700"
        : color === "green"
          ? "bg-emerald-100 text-emerald-700"
          : color === "violet"
            ? "bg-violet-100 text-violet-700"
            : "bg-rose-100 text-rose-700";
  const safeTitle = title.trim() || "Терминдер";
  const safeBackgroundColor = backgroundColor.trim();
  const shouldUseInlineBackground = Boolean(safeBackgroundColor && safeBackgroundColor !== "transparent" && !["#ffffff", "#f8fafc"].includes(safeBackgroundColor.toLowerCase()));
  const parsedItems = items.length ? items : [createTermGroupItem()];
  const bodyText = encodeTermGroupItems(parsedItems);
  const encodedItems = encodeTermGroupItemsAttribute(parsedItems);

  return `
    <div
      data-juz-block="termgroup"
      data-title="${escapeAttribute(safeTitle)}"
      data-body="${escapeAttribute(bodyText)}"
      data-items="${escapeAttribute(encodedItems)}"
      data-color="${color}"
      data-background-color="${escapeAttribute(safeBackgroundColor || "transparent")}"
      contenteditable="false"
      class="my-5 relative"
    >
      ${createBlockActionButtons()}
      <div class="rounded-3xl border border-slate-200 p-5 shadow-sm text-slate-900 dark:border-zinc-700 dark:text-zinc-50 ${shouldUseInlineBackground ? "" : "bg-slate-50/80 dark:bg-zinc-900/80"}" ${shouldUseInlineBackground ? `style="background:${escapeAttribute(safeBackgroundColor)};"` : ""}>
        <div class="mb-4 flex items-center gap-3">
          <div class="rounded-full p-2 ${palette}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 7H20v12H6.5A2.5 2.5 0 014 21.5v-17z" />
            </svg>
          </div>
          <p class="text-base font-semibold leading-7">${escapeHtml(safeTitle)}</p>
        </div>
        <div class="grid gap-3">
          ${
            parsedItems.length
              ? parsedItems
                  .map(
                    (item) => {
                      const imageAlign = item.imageAlign || "top";
                      const width = Math.max(30, Number(item.imageWidth) || 180);
                      const height = Math.max(0, Number(item.imageHeight) || 0);
                      const rowClass = item.image && imageAlign !== "top" ? (imageAlign === "right" ? "flex-col md:flex-row-reverse" : "flex-col md:flex-row") : "flex-col";
                      const imageHtml = item.image
                        ? `<div class="${imageAlign !== "top" ? "md:shrink-0" : "w-full"}" style="${imageAlign !== "top" ? `width:${width}px;max-width:100%;` : ""}">
                            <img src="${escapeAttribute(item.image)}" alt="" class="max-w-full h-auto rounded-xl mx-auto mb-3 shadow-md" style="width:min(100%, ${width}px); height:${height ? `${height}px` : "auto"}; ${height ? "object-fit:contain;" : ""}" />
                          </div>`
                        : "";

                      return `
                      <div class="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                        <div class="flex gap-4 ${rowClass}">
                          ${imageHtml}
                          <div class="min-w-0">
                            <p class="text-sm font-semibold text-slate-950">${escapeHtml(item.title)}</p>
                            <div class="mt-1 text-base font-normal leading-8 text-slate-700 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_strong]:font-semibold [&_u]:underline">${normalizeRichBlockBody(item.body)}</div>
                          </div>
                        </div>
                      </div>
                    `;
                    }
                  )
                  .join("")
              : `<div class="rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-slate-600">Терминдерді осы жерге қосыңыз</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function createColorBoxPreviewHtml({
  body,
  color,
  textColor
}: {
  body: string;
  color: string;
  textColor: string;
}) {
  const safeColor = color.trim() || "#ede5c3";
  const safeTextColor = textColor.trim() || "#0f172a";
  const richBody = normalizeRichBlockBody(body);

  return `
    <div
      data-juz-block="colorbox"
      data-body="${escapeAttribute(richBody)}"
      data-color="${escapeAttribute(safeColor)}"
      data-text-color="${escapeAttribute(safeTextColor)}"
      contenteditable="false"
      class="my-5 relative"
    >
      ${createBlockActionButtons()}
      <div class="px-5 py-4" style="background:linear-gradient(180deg, ${escapeAttribute(safeColor)} 0%, ${escapeAttribute(safeColor)} 58%, transparent 100%); color:${escapeAttribute(safeTextColor)};">
        <div class="text-base leading-8 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_strong]:font-semibold [&_u]:underline">${richBody}</div>
      </div>
    </div>
  `;
}

type TreeNode = {
  title: string;
  children: TreeNode[];
};

function createTreeNode(title: string): TreeNode {
  return { title, children: [] };
}

function buildTreeFromLines(rootTitle: string, source: string) {
  const root = createTreeNode(rootTitle.trim() || "Негізгі блок");
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.length ? lines : ["Бірінші тармақ", "Екінші тармақ"]) {
    const parts = line
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean);

    let current = root;
    for (const part of parts) {
      let child = current.children.find((item) => item.title === part);
      if (!child) {
        child = createTreeNode(part);
        current.children.push(child);
      }
      current = child;
    }
  }

  return root;
}

function renderTreeNode(node: TreeNode, options: { boxColor: string; lineColor: string; textColor: string; scale: number; isRoot?: boolean }): string {
  const childCount = node.children.length;
  const scale = Math.max(0.45, Math.min(1.2, options.scale));
  const width = Math.round((options.isRoot ? 240 : Math.max(170, Math.min(250, Math.floor(780 / Math.max(childCount || 1, 1))))) * scale);
  const minBoxWidth = Math.round((options.isRoot ? 210 : 160) * scale);
  const maxBoxWidth = Math.round(260 * scale);
  const radius = Math.round(14 * scale);
  const verticalLine = Math.round(26 * scale);
  const paddingY = Math.round(10 * scale);
  const paddingX = Math.round(16 * scale);
  const fontSize = Math.max(12, Math.round(15 * scale));

  return `
    <div style="display:flex; flex-direction:column; align-items:center; min-width:${width}px;">
      <div contenteditable="true" style="min-width:${minBoxWidth}px; max-width:${maxBoxWidth}px; border:1px solid ${options.lineColor}; background:${options.boxColor}; color:${options.textColor}; border-radius:${radius}px; padding:${paddingY}px ${paddingX}px; font-size:${fontSize}px; font-weight:${options.isRoot ? 800 : 600}; line-height:1.55; box-shadow:0 8px 18px rgba(15,23,42,0.08);">${escapeHtml(node.title)}</div>
      ${
        childCount
          ? `<div style="height:${verticalLine}px; width:2px; background:${options.lineColor};"></div>
             <div style="width:100%; height:2px; background:${options.lineColor};"></div>
             <div style="display:flex; justify-content:center; gap:${Math.round(18 * scale)}px; align-items:flex-start; padding-top:0;">
               ${node.children
                 .map(
                   (child) => `
                    <div style="display:flex; flex-direction:column; align-items:center;">
                      <div style="height:${verticalLine}px; width:2px; background:${options.lineColor};"></div>
                      ${renderTreeNode(child, { ...options, isRoot: false })}
                    </div>
                  `
                 )
                 .join("")}
             </div>`
          : ""
      }
    </div>
  `;
}

function wrapSvgText(value: string, maxChars: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 4);
}

function renderTreeSvg(root: TreeNode, options: { boxColor: string; lineColor: string; textColor: string; scale: number }) {
  const scale = Math.max(0.45, Math.min(1.2, options.scale));
  const boxWidth = Math.round(220 * scale);
  const boxHeight = Math.round(74 * scale);
  const gapX = Math.round(42 * scale);
  const gapY = Math.round(86 * scale);
  const padding = Math.round(36 * scale);
  const fontSize = Math.max(11, Math.round(14 * scale));
  const radius = Math.round(12 * scale);

  type PositionedNode = TreeNode & { x: number; y: number; width: number; depth: number };
  const positioned: PositionedNode[] = [];
  const lines: Array<{ fromX: number; fromY: number; toX: number; toY: number }> = [];
  let maxDepth = 0;

  function measure(node: TreeNode): number {
    if (!node.children.length) {
      return boxWidth;
    }

    return Math.max(
      boxWidth,
      node.children.reduce((total, child, index) => total + measure(child) + (index > 0 ? gapX : 0), 0)
    );
  }

  function layout(node: TreeNode, left: number, depth: number): number {
    const totalWidth = measure(node);
    const y = padding + depth * (boxHeight + gapY);
    const x = left + totalWidth / 2 - boxWidth / 2;
    positioned.push({ ...node, x, y, width: totalWidth, depth });
    maxDepth = Math.max(maxDepth, depth);

    if (node.children.length) {
      const childrenWidth = node.children.reduce((total, child, index) => total + measure(child) + (index > 0 ? gapX : 0), 0);
      let childLeft = left + (totalWidth - childrenWidth) / 2;
      const parentBottomX = x + boxWidth / 2;
      const parentBottomY = y + boxHeight;

      for (const child of node.children) {
        const childWidth = measure(child);
        const childCenterX = childLeft + childWidth / 2;
        const childTopY = padding + (depth + 1) * (boxHeight + gapY);
        lines.push({ fromX: parentBottomX, fromY: parentBottomY, toX: childCenterX, toY: childTopY });
        layout(child, childLeft, depth + 1);
        childLeft += childWidth + gapX;
      }
    }

    return totalWidth;
  }

  const width = Math.ceil(measure(root) + padding * 2);
  const height = Math.ceil(padding * 2 + (maxDepth + 1) * boxHeight + maxDepth * gapY);
  layout(root, padding, 0);
  const finalHeight = Math.ceil(padding * 2 + (maxDepth + 1) * boxHeight + maxDepth * gapY);

  const lineSvg = lines
    .map((line) => {
      const midY = line.fromY + (line.toY - line.fromY) / 2;
      return `<path d="M ${line.fromX} ${line.fromY} V ${midY} H ${line.toX} V ${line.toY}" fill="none" stroke="${escapeAttribute(options.lineColor)}" stroke-width="${Math.max(1.5, 2 * scale)}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("");

  const nodeSvg = positioned
    .map((node) => {
      const textLines = wrapSvgText(node.title, Math.max(12, Math.floor(22 / scale)));
      const lineHeight = Math.round(fontSize * 1.25);
      const startY = node.y + boxHeight / 2 - ((textLines.length - 1) * lineHeight) / 2 + fontSize / 3;

      return `
        <rect x="${node.x}" y="${node.y}" width="${boxWidth}" height="${boxHeight}" rx="${radius}" fill="${escapeAttribute(options.boxColor)}" stroke="${escapeAttribute(options.lineColor)}" stroke-width="${Math.max(1, 1.5 * scale)}" filter="url(#treeShadow)" />
        <text x="${node.x + boxWidth / 2}" y="${startY}" text-anchor="middle" fill="${escapeAttribute(options.textColor)}" font-size="${fontSize}" font-weight="${node.depth === 0 ? 800 : 600}" font-family="var(--font-juz-sans), sans-serif">
          ${textLines.map((line, index) => `<tspan x="${node.x + boxWidth / 2}" dy="${index === 0 ? 0 : lineHeight}">${escapeHtml(line)}</tspan>`).join("")}
        </text>
      `;
    })
    .join("");

  return `
    <div data-juz-tree="true" data-juz-block="tree" data-box-color="${escapeAttribute(options.boxColor)}" data-line-color="${escapeAttribute(options.lineColor)}" data-text-color="${escapeAttribute(options.textColor)}" data-scale="${Math.round(scale * 100)}" contenteditable="false" style="position:relative; margin:24px 0; overflow-x:auto; padding:18px; max-width:100%;">
      ${createBlockActionButtons()}
      <div style="display:none;">
        <button type="button" data-juz-delete="true" contenteditable="false" style="border:1px solid rgba(255,255,255,0.7); background:rgba(255,255,255,0.92); color:#475569; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:700; box-shadow:0 4px 12px rgba(15,23,42,0.10);">Өшіру</button>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${finalHeight}" viewBox="0 0 ${width} ${finalHeight}" style="display:block; max-width:100%; height:auto; margin:0 auto;">
        <defs>
          <filter id="treeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.10" />
          </filter>
        </defs>
        ${lineSvg}
        ${nodeSvg}
      </svg>
    </div>
  `;
}

function createImageFigureHtml({
  src,
  width,
  height,
  align,
  caption
}: {
  src: string;
  width: string;
  height: string;
  align: ContentImageAlign;
  caption: string;
}) {
  const safeWidth = Math.max(30, Number(width) || 220);
  const safeHeight = Math.max(0, Number(height) || 0);
  const imageId = createEditorImageId();
  const figureClass =
    align === "left"
      ? "my-4 mr-5 inline-block align-top"
      : align === "right"
        ? "my-4 ml-5 inline-block align-top"
        : "mx-auto my-5 block text-center";

  return `
    <figure data-juz-image="true" data-juz-image-id="${imageId}" contenteditable="false" draggable="true" class="${figureClass}" style="position:relative; box-sizing:border-box; overflow:hidden; cursor:move; ${align === "left" ? "float:left;" : align === "right" ? "float:right;" : "clear:both;"} max-width:100%;">
      ${createMoveDeleteButtons()}
      <img
        src="${escapeAttribute(src)}"
        alt="${escapeAttribute(caption.trim())}"
        data-juz-image-id="${imageId}"
        data-width="${safeWidth}"
        data-height="${safeHeight || ""}"
        data-align="${align}"
        data-caption="${escapeAttribute(caption)}"
        class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md"
        style="width:min(100%, ${safeWidth}px); height:${safeHeight ? `${safeHeight}px` : "auto"}; ${safeHeight ? "object-fit:contain;" : ""}"
      />
      ${caption.trim() ? `<figcaption class="mt-2 text-center text-sm italic text-slate-500 dark:text-zinc-400">${escapeHtml(caption.trim())}</figcaption>` : ""}
    </figure>
  `;
}

function serializeEditorHtml(editor: HTMLDivElement) {
  const clone = editor.cloneNode(true) as HTMLDivElement;

  clone.querySelectorAll("[data-juz-block]").forEach((node) => {
    const element = node as HTMLElement;
    const type = element.dataset.juzBlock;

    if (type === "tree") {
      element.querySelectorAll("[data-juz-delete]").forEach((button) => {
        const parent = button.parentElement;
        button.remove();
        if (parent && !parent.textContent?.trim() && parent.children.length === 0) {
          parent.remove();
        }
      });
      element.removeAttribute("contenteditable");
      element.querySelectorAll("[contenteditable]").forEach((child) => child.removeAttribute("contenteditable"));
      return;
    }

    const title = element.dataset.title || "";
    const body = element.dataset.body || "";
    const color = element.dataset.color || "red";
    const image = element.dataset.image || "";
    const imageAlign = element.dataset.imageAlign || "top";
    const imageWidth = element.dataset.imageWidth || "";
    const imageHeight = element.dataset.imageHeight || "";
    const surface = element.dataset.surface || "default";
    const textColor = element.dataset.textColor || "#0f172a";
    const backgroundColor = element.dataset.backgroundColor || "";
    const items = element.dataset.items || "";

    let shortcode = "";

    if (type === "colorbox") {
      shortcode = `[colorbox color="${escapeAttribute(color)}" textcolor="${escapeAttribute(textColor)}"]${normalizeRichBlockBody(body)}[/colorbox]`;
    } else if (type === "term") {
      const parts = [
        `color="${color}"`,
        `title="${escapeAttribute(title)}"`,
        image ? `image="${escapeAttribute(image)}"` : "",
        `imagealign="${imageAlign}"`,
        imageWidth ? `imagewidth="${imageWidth}"` : "",
        imageHeight ? `imageheight="${imageHeight}"` : "",
        `surface="${surface}"`,
        backgroundColor ? `background="${escapeAttribute(backgroundColor)}"` : ""
      ]
        .filter(Boolean)
        .join(" ");

      shortcode = `[term ${parts}]${normalizeRichBlockBody(body)}[/term]`;
    } else if (type === "termgroup") {
      const groupItems = decodeTermGroupItemsAttribute(items, body);
      const payload = encodeTermGroupItemsAttribute(groupItems);
      const parts = [
        `color="${color}"`,
        `title="${escapeAttribute(title)}"`,
        backgroundColor ? `background="${escapeAttribute(backgroundColor)}"` : ""
      ]
        .filter(Boolean)
        .join(" ");

      shortcode = `[termgroup ${parts}]${payload}[/termgroup]`;
    } else {
      const parts = [`color="${color}"`, `title="${escapeAttribute(title)}"`].join(" ");
      shortcode = `[${type} ${parts}]${normalizeRichBlockBody(body)}[/${type}]`;
    }

    element.replaceWith(document.createTextNode(shortcode));
  });

  // Қаптаманың өзі де өшуі керек: бұрын тек батырмалар алынып, бос
  // `absolute` блок мәтінге жазылып қалатын — әр сақтау сайын көбейіп,
  // суреттің үстінде қалқып тұратын.
  clone
    .querySelectorAll("[data-juz-actions], [data-juz-delete], [data-juz-drag], [data-juz-edit]")
    .forEach((node) => node.remove());
  clone.querySelectorAll("figure[data-juz-image='true']").forEach((node) => {
    const figure = node as HTMLElement;
    figure.classList.remove("ring-2", "ring-sky-300", "ring-offset-2", "ring-offset-white", "dark:ring-cyan-300", "dark:ring-offset-zinc-950");
    // Сүйреу тек редакторда керек — сақталған мәтінде қалмайды
    figure.removeAttribute("draggable");
    figure.style.cursor = "";
  });
  clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));

  return clone.innerHTML;
}

function hydrateShortcodesToPreview(html: string) {
  const shortcodePattern = /\[(danger-right|rightdanger|danger|termgroup|term|colorbox|tree)([^\]]*)\]([\s\S]*?)\[\/\1\]/gi;

  return html.replace(shortcodePattern, (_, rawType: string, rawAttributes: string, body: string) => {
    const attributes: Record<string, string> = {};

    for (const match of rawAttributes.matchAll(/(\w+)="([^"]*)"/g)) {
      const key = match[1]?.trim().toLowerCase();
      const value = decodeEntities(match[2] ?? "").trim();
      if (key) {
        attributes[key] = value;
      }
    }

    const richBody = sanitizeRichText(decodeEntities(body)).trim();
    const normalizedType = rawType.toLowerCase();

    if (normalizedType === "tree") {
      const palette: Record<string, { box: string; line: string; text: string }> = {
        red: { box: "#fee2e2", line: "#fb7185", text: "#7f1d1d" },
        yellow: { box: "#fef3c7", line: "#f59e0b", text: "#78350f" },
        blue: { box: "#dbeafe", line: "#93c5fd", text: "#0f172a" },
        green: { box: "#dcfce7", line: "#34d399", text: "#064e3b" },
        violet: { box: "#ede9fe", line: "#a78bfa", text: "#3b0764" }
      };
      const selectedPalette = palette[(attributes.color || "blue").trim().toLowerCase()] ?? palette.blue;
      const scaleValue = Math.max(45, Math.min(120, Number(attributes.scale) || 80)) / 100;

      return renderTreeSvg(buildTreeFromLines(attributes.title || "Негізгі ұғым", stripHtmlForTree(body)), {
        boxColor: attributes.boxcolor || selectedPalette.box,
        lineColor: attributes.linecolor || selectedPalette.line,
        textColor: attributes.textcolor || selectedPalette.text,
        scale: scaleValue
      });
    }

    if (normalizedType === "colorbox") {
      return createColorBoxPreviewHtml({
        body: richBody || "Боялған мәтінді осы жерге жазыңыз",
        color: attributes.color || "#ede5c3",
        textColor: attributes.textcolor || "#0f172a"
      });
    }

    if (normalizedType === "term") {
      return createTermPreviewHtml({
        title: attributes.title || "Термин",
        body: richBody || "Терминнің түсіндірмесін осы жерге жазыңыз",
        color: (attributes.color as DangerColor) || "blue",
        image: attributes.image || "",
        imageAlign: (attributes.imagealign as TermImageAlign) || "top",
        imageWidth: attributes.imagewidth || "220",
        imageHeight: attributes.imageheight || "",
        surface: (attributes.surface as TermSurface) || "default",
        backgroundColor: attributes.background || attributes.bg || ""
      });
    }

    if (normalizedType === "termgroup") {
      return createTermGroupPreviewHtml({
        title: attributes.title || "Терминдер",
        items: decodeTermGroupItemsAttribute(attributes.items || "", decodeEntities(body).trim()),
        color: (attributes.color as DangerColor) || "blue",
        backgroundColor: attributes.background || attributes.bg || "#f8fafc"
      });
    }

    return createDangerPreviewHtml({
      title: attributes.title || "Маңызды, қарап ал!",
      body: richBody || "Маңызды мәтінді осы жерге жазыңыз",
      color: (attributes.color as DangerColor) || "red",
      placement: rawType.toLowerCase() === "rightdanger" || rawType.toLowerCase() === "danger-right" ? "rightdanger" : "danger"
    });
  });
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function removeDuplicatedBlockText(editor: HTMLDivElement) {
  const blocks = Array.from(editor.querySelectorAll("[data-juz-block]")) as HTMLElement[];

  for (const block of blocks) {
    const title = normalizeComparableText(block.dataset.title || "");
    const body = normalizeComparableText(block.dataset.body || "");
    const combined = normalizeComparableText(`${title} ${body}`);

    let sibling = block.nextSibling;
    let matched = 0;

    while (sibling) {
      if (sibling.nodeType === Node.TEXT_NODE && !(sibling.textContent || "").trim()) {
        sibling = sibling.nextSibling;
        continue;
      }

      if (sibling instanceof HTMLElement && sibling.matches("p") && sibling.innerHTML.trim().toLowerCase() === "<br>") {
        break;
      }

      const current = sibling;
      if (
        current instanceof HTMLElement &&
        (current.matches("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]") || current.querySelector("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]"))
      ) {
        break;
      }

      const currentText = normalizeComparableText(current.textContent || "");
      const nextSibling = current.nextSibling;

      if (!currentText) {
        sibling = nextSibling;
        continue;
      }

      if (!matched && combined && currentText === combined) {
        current.parentNode?.removeChild(current);
        matched = 2;
        sibling = nextSibling;
        continue;
      }

      if (matched === 0 && title && currentText === title) {
        current.parentNode?.removeChild(current);
        matched = 1;
        sibling = nextSibling;
        continue;
      }

      if (matched <= 1 && body && currentText === body) {
        current.parentNode?.removeChild(current);
        matched = 2;
        sibling = nextSibling;
        continue;
      }

      break;
    }
  }
}

export const RichTextEditorClient = forwardRef<RichTextEditorHandle, {
  value: string;
  onChange: (value: string) => void;
  /** Жазу алаңының биіктігі. Шағын формаларда (сұрақ банкі) кішірейтіледі. */
  heightClass?: string;
  /** "side" — құралдар оң жақ бағанға шығады, мәтін кітаптағыдай кең тұрады */
  layout?: "stacked" | "side";
  /** Жазу алаңының қосымша стилі (кітаптың қаріп өлшемі, жол аралығы) */
  editorClassName?: string;
}>(function RichTextEditorClient({ value, onChange, heightClass, layout = "stacked", editorClassName }, ref) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const selectedDangerBlockRef = useRef<HTMLElement | null>(null);
  const selectedTermBlockRef = useRef<HTMLElement | null>(null);
  const selectedTermGroupBlockRef = useRef<HTMLElement | null>(null);
  const selectedColorBoxRef = useRef<HTMLElement | null>(null);
  const selectedTreeBlockRef = useRef<HTMLElement | null>(null);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const selectedImageIdRef = useRef<string | null>(null);
  const draggedBlockRef = useRef<HTMLElement | null>(null);
  const dragPreviewTargetRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<string[]>([]);
  const isRestoringHistoryRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const termImageInputRef = useRef<HTMLInputElement | null>(null);
  const dangerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const termTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const colorBoxTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const dangerMenuRef = useRef<HTMLDivElement | null>(null);
  const termMenuRef = useRef<HTMLDivElement | null>(null);
  const colorBoxMenuRef = useRef<HTMLDivElement | null>(null);
  const tableMenuRef = useRef<HTMLDivElement | null>(null);
  const linkMenuRef = useRef<HTMLDivElement | null>(null);
  const emojiMenuRef = useRef<HTMLDivElement | null>(null);

  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isDangerMenuOpen, setIsDangerMenuOpen] = useState(false);
  const [isTermMenuOpen, setIsTermMenuOpen] = useState(false);
  const [isSingleTermSectionOpen, setIsSingleTermSectionOpen] = useState(true);
  const [isTermGroupSectionOpen, setIsTermGroupSectionOpen] = useState(false);
  const [isTermImageSectionOpen, setIsTermImageSectionOpen] = useState(false);
  const [isColorBoxMenuOpen, setIsColorBoxMenuOpen] = useState(false);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [isEmojiMenuOpen, setIsEmojiMenuOpen] = useState(false);

  const [dangerTitle, setDangerTitle] = useState("Маңызды, қарап ал!");
  const [dangerText, setDangerText] = useState("Маңызды мәтінді осы жерге жазыңыз");
  const [dangerColor, setDangerColor] = useState<DangerColor>("red");
  const [dangerPlacement, setDangerPlacement] = useState<DangerPlacement>("danger");

  const [termTitle, setTermTitle] = useState("Термин");
  const [termText, setTermText] = useState("Терминнің түсіндірмесін осы жерге жазыңыз");
  const [termColor, setTermColor] = useState<DangerColor>("blue");
  const [termImage, setTermImage] = useState("");
  const [termImageAlign, setTermImageAlign] = useState<TermImageAlign>("top");
  const [termImageWidth, setTermImageWidth] = useState("220");
  const [termImageHeight, setTermImageHeight] = useState("");
  const [termSurface, setTermSurface] = useState<TermSurface>("default");
  const [termBackgroundColor, setTermBackgroundColor] = useState("#f8fafc");
  const [termGroupTitle, setTermGroupTitle] = useState("Негізгі терминдер");
  const [termGroupItems, setTermGroupItems] = useState<TermGroupItem[]>([
    createTermGroupItem("Алгоритм", "Берілген есепті шешу жолдарының реті"),
    createTermGroupItem("Команда", "Орындаушыға берілетін нақты нұсқау")
  ]);

  const [colorBoxText, setColorBoxText] = useState("Боялған мәтінді осы жерге жазыңыз");
  const [colorBoxColor, setColorBoxColor] = useState("#ede5c3");
  const [colorBoxTextColor, setColorBoxTextColor] = useState("#0f172a");

  const [tableMode, setTableMode] = useState<TableMode>("table");
  const [tableRows, setTableRows] = useState("3");
  const [tableColumns, setTableColumns] = useState("3");
  const [tableHeaders, setTableHeaders] = useState("Баған 1, Баған 2, Баған 3");
  const [tableHeaderColor, setTableHeaderColor] = useState("#dbeafe");
  const [tableBodyColor, setTableBodyColor] = useState("#ffffff");
  const [tableBorderColor, setTableBorderColor] = useState("#cbd5e1");
  const [tableWidthPercent, setTableWidthPercent] = useState("100");
  const [treeRoot, setTreeRoot] = useState("Негізгі ұғым");
  const [treeChildren, setTreeChildren] = useState("Файлдың аты — Мектеп.\n.doc файл кеңейтімі файлды жасаған программа тағайындайды");
  const [treeBoxColor, setTreeBoxColor] = useState("#dbeafe");
  const [treeLineColor, setTreeLineColor] = useState("#93c5fd");
  const [treeTextColor, setTreeTextColor] = useState("#0f172a");
  const [treeScale, setTreeScale] = useState("80");

  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [emojiSearch, setEmojiSearch] = useState("");

  const [imageWidth, setImageWidth] = useState("220");
  const [imageHeight, setImageHeight] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [hasSelectedImage, setHasSelectedImage] = useState(false);
  // Суретті қию: терезедегі сурет пен қию тіктөртбұрышы (0–1 аралығындағы үлес)
  const [cropState, setCropState] = useState<{ src: string } | null>(null);
  const [cropRect, setCropRect] = useState({ x: 0.08, y: 0.08, width: 0.84, height: 0.84 });
  const [isCropSaving, setIsCropSaving] = useState(false);
  const [cropError, setCropError] = useState("");
  const cropAreaRef = useRef<HTMLDivElement | null>(null);
  const [imageAlign, setImageAlign] = useState<ContentImageAlign>("center");
  const isFocusedRef = useRef(false);
  const lastSyncedValueRef = useRef("");

  function openDangerMenuForBlock(block: HTMLElement) {
    selectedDangerBlockRef.current = block;
    selectedTermBlockRef.current = null;
    selectedColorBoxRef.current = null;
    selectedTreeBlockRef.current = null;
    setDangerTitle(block.dataset.title || "Маңызды, қарап ал!");
    setDangerText(prepareBlockBodyForEditor(block.dataset.body || "Маңызды мәтінді осы жерге жазыңыз"));
    setDangerColor((block.dataset.color as DangerColor) || "red");
    setDangerPlacement(block.dataset.juzBlock === "rightdanger" ? "rightdanger" : "danger");
    setIsDangerMenuOpen(true);
    setIsTermMenuOpen(false);
    setIsColorBoxMenuOpen(false);
    setIsColorMenuOpen(false);
    setIsTableMenuOpen(false);
    setIsLinkMenuOpen(false);
    setIsEmojiMenuOpen(false);
  }

  function openTermMenuForBlock(block: HTMLElement) {
    selectedTermBlockRef.current = block;
    selectedTermGroupBlockRef.current = null;
    selectedDangerBlockRef.current = null;
    selectedColorBoxRef.current = null;
    selectedTreeBlockRef.current = null;
    setTermTitle(block.dataset.title || "Термин");
    setTermText(prepareBlockBodyForEditor(block.dataset.body || "Терминнің түсіндірмесін осы жерге жазыңыз"));
    setTermColor((block.dataset.color as DangerColor) || "blue");
    setTermImage(block.dataset.image || "");
    setTermImageAlign((block.dataset.imageAlign as TermImageAlign) || "top");
    setTermImageWidth(block.dataset.imageWidth || "220");
    setTermImageHeight(block.dataset.imageHeight || "");
    setTermSurface((block.dataset.surface as TermSurface) || "default");
    setTermBackgroundColor(block.dataset.backgroundColor || (block.dataset.surface === "white" ? "#ffffff" : "#f8fafc"));
    setIsTermMenuOpen(true);
    setIsDangerMenuOpen(false);
    setIsColorBoxMenuOpen(false);
    setIsColorMenuOpen(false);
    setIsTableMenuOpen(false);
    setIsLinkMenuOpen(false);
    setIsEmojiMenuOpen(false);
  }

  function openTermGroupMenuForBlock(block: HTMLElement) {
    selectedTermGroupBlockRef.current = block;
    selectedTermBlockRef.current = null;
    selectedDangerBlockRef.current = null;
    selectedColorBoxRef.current = null;
    selectedTreeBlockRef.current = null;
    setTermGroupTitle(block.dataset.title || "Негізгі терминдер");
    setTermGroupItems(decodeTermGroupItemsAttribute(block.dataset.items || "", prepareBlockBodyForEditor(block.dataset.body || "")));
    setTermColor((block.dataset.color as DangerColor) || "blue");
    setTermBackgroundColor(block.dataset.backgroundColor || "#f8fafc");
    setTermSurface("default");
    setIsTermMenuOpen(true);
    setIsDangerMenuOpen(false);
    setIsColorBoxMenuOpen(false);
    setIsColorMenuOpen(false);
    setIsTableMenuOpen(false);
    setIsLinkMenuOpen(false);
    setIsEmojiMenuOpen(false);
  }

  function openColorBoxMenuForBlock(block: HTMLElement) {
    selectedColorBoxRef.current = block;
    selectedTreeBlockRef.current = null;
    selectedDangerBlockRef.current = null;
    selectedTermBlockRef.current = null;
    setColorBoxText(prepareBlockBodyForEditor(block.dataset.body || "Боялған мәтінді осы жерге жазыңыз"));
    setColorBoxColor(block.dataset.color || "#ede5c3");
    setColorBoxTextColor(block.dataset.textColor || "#0f172a");
    setIsColorBoxMenuOpen(true);
    setIsTermMenuOpen(false);
    setIsDangerMenuOpen(false);
    setIsColorMenuOpen(false);
    setIsTableMenuOpen(false);
    setIsLinkMenuOpen(false);
    setIsEmojiMenuOpen(false);
  }

  function openTreeMenuForBlock(block: HTMLElement) {
    selectedTreeBlockRef.current = block;
    selectedDangerBlockRef.current = null;
    selectedTermBlockRef.current = null;
    selectedTermGroupBlockRef.current = null;
    selectedColorBoxRef.current = null;

    const textNodes = Array.from(block.querySelectorAll("text"))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "")
      .filter(Boolean);

    setTableMode("tree");
    setTreeRoot(textNodes[0] || "Негізгі ұғым");
    setTreeChildren(textNodes.slice(1).join("\n") || treeChildren);
    setTreeBoxColor(block.dataset.boxColor || "#dbeafe");
    setTreeLineColor(block.dataset.lineColor || "#93c5fd");
    setTreeTextColor(block.dataset.textColor || "#0f172a");
    setTreeScale(block.dataset.scale || "80");
    setIsTableMenuOpen(true);
    setIsColorMenuOpen(false);
    setIsDangerMenuOpen(false);
    setIsTermMenuOpen(false);
    setIsColorBoxMenuOpen(false);
    setIsLinkMenuOpen(false);
    setIsEmojiMenuOpen(false);
  }

  function wrapTextareaSelection(
    textarea: HTMLTextAreaElement | null,
    value: string,
    setValue: (next: string) => void,
    openTag: string,
    closeTag: string
  ) {
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = value.slice(start, end) || "мәтін";
    const nextValue = `${value.slice(0, start)}${openTag}${selected}${closeTag}${value.slice(end)}`;
    setValue(nextValue);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + openTag.length, start + openTag.length + selected.length);
    });
  }

  function applyDangerTextMarkup(openTag: string, closeTag: string) {
    wrapTextareaSelection(dangerTextareaRef.current, dangerText, setDangerText, openTag, closeTag);
  }

  function applyTermTextMarkup(openTag: string, closeTag: string) {
    wrapTextareaSelection(termTextareaRef.current, termText, setTermText, openTag, closeTag);
  }

  function applyColorBoxTextMarkup(openTag: string, closeTag: string) {
    wrapTextareaSelection(colorBoxTextareaRef.current, colorBoxText, setColorBoxText, openTag, closeTag);
  }

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const hydrated = hydrateShortcodesToPreview(value || "");
    if (isFocusedRef.current && lastSyncedValueRef.current === (value || "")) {
      return;
    }

    if (editorRef.current.innerHTML !== hydrated) {
      editorRef.current.innerHTML = hydrated;
      normalizeEditorMarkup();
      removeDuplicatedBlockText(editorRef.current);
    }

    lastSyncedValueRef.current = value || "";
  }, [value]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (
        colorMenuRef.current?.contains(event.target) ||
        dangerMenuRef.current?.contains(event.target) ||
        termMenuRef.current?.contains(event.target) ||
        colorBoxMenuRef.current?.contains(event.target) ||
        tableMenuRef.current?.contains(event.target) ||
        linkMenuRef.current?.contains(event.target) ||
        emojiMenuRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsColorMenuOpen(false);
      setIsDangerMenuOpen(false);
      setIsTermMenuOpen(false);
      setIsColorBoxMenuOpen(false);
      setIsTableMenuOpen(false);
      setIsLinkMenuOpen(false);
      setIsEmojiMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function normalizeImageElement(image: HTMLImageElement) {
    const width = Math.max(30, Number(image.dataset.width) || 220);
    const height = Math.max(0, Number(image.dataset.height) || 0);
    const align = (image.dataset.align as ContentImageAlign | undefined) || "center";
    const figure = image.closest("figure") as HTMLElement | null;
    // Сырттан келген мазмұнда сипаттама тек <figcaption> ішінде тұруы мүмкін —
    // ондайда оны data-caption-ға көшіреміз, әйтпесе жазу жойылып кетеді.
    const existingCaption = figure?.querySelector("figcaption")?.textContent?.trim() || "";
    const caption = image.dataset.caption || existingCaption;
    if (caption && !image.dataset.caption) {
      image.dataset.caption = caption;
    }
    const stableImageId = image.dataset.juzImageId || figure?.dataset.juzImageId || createEditorImageId();

    image.dataset.juzImageId = stableImageId;

    image.className =
      align === "left"
        ? "max-w-full h-auto rounded-xl my-3 mr-4 shadow-md"
        : align === "right"
          ? "max-w-full h-auto rounded-xl my-3 ml-4 shadow-md"
          : "max-w-full h-auto rounded-xl mx-auto my-4 shadow-md";
    image.setAttribute("alt", caption.trim());
    image.style.width = `min(100%, ${width}px)`;
    image.style.height = height ? `${height}px` : "auto";
    image.style.objectFit = height ? "contain" : "";
    image.style.float = align === "left" ? "left" : align === "right" ? "right" : "none";
    image.style.display = align === "center" ? "block" : "inline-block";
    image.style.clear = align === "center" ? "both" : "none";

    if (figure) {
      figure.setAttribute("data-juz-image", "true");
      figure.dataset.juzImageId = stableImageId;
      figure.setAttribute("contenteditable", "false");
      figure.dataset.width = image.dataset.width || `${width}`;
      figure.dataset.height = image.dataset.height || "";
      figure.dataset.align = align;
      figure.dataset.caption = caption;
      figure.className =
        align === "left"
          ? "my-4 mr-5 inline-block align-top"
          : align === "right"
            ? "my-4 ml-5 inline-block align-top"
            : "mx-auto my-5 block text-center";
      figure.style.float = align === "left" ? "left" : align === "right" ? "right" : "none";
      figure.style.clear = align === "center" ? "both" : "none";
      figure.style.maxWidth = "100%";
      figure.style.position = "relative";
      figure.style.boxSizing = "border-box";
      figure.style.overflow = "hidden";
      // Суретті басып тұрып жылжытуға болады
      figure.draggable = true;
      figure.style.cursor = "move";

      if (!figure.querySelector("[data-juz-drag]")) {
        figure.insertAdjacentHTML("afterbegin", createMoveDeleteButtons());
      }

      if (!figure.querySelector("[data-juz-edit]")) {
        const controls = figure.querySelector(":scope > div.absolute") as HTMLElement | null;
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.dataset.juzEdit = "true";
        editButton.setAttribute("contenteditable", "false");
        editButton.className = "rounded-full border border-white/70 bg-white/90 px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm";
        editButton.textContent = "Өңдеу";
        controls?.insertBefore(editButton, controls.querySelector("[data-juz-delete]") ?? null);
      }

      let figcaption = figure.querySelector("figcaption");
      if (caption.trim()) {
        if (!figcaption) {
          figcaption = document.createElement("figcaption");
          figure.appendChild(figcaption);
        }
        figcaption.textContent = caption.trim();
        figcaption.className = "mt-2 text-center text-sm italic text-slate-500 dark:text-zinc-400";
      } else {
        figcaption?.remove();
      }
    }
  }

  function openImageControls(image: HTMLImageElement) {
    selectedDangerBlockRef.current = null;
    selectedTermBlockRef.current = null;
    selectedTermGroupBlockRef.current = null;
    selectedColorBoxRef.current = null;
    selectedTreeBlockRef.current = null;
    editorRef.current?.querySelectorAll("figure[data-juz-image='true']").forEach((figure) => {
      figure.classList.remove("ring-2", "ring-sky-300", "ring-offset-2", "ring-offset-white", "dark:ring-cyan-300", "dark:ring-offset-zinc-950");
    });
    const figure = image.closest("figure") as HTMLElement | null;
    figure?.classList.add("ring-2", "ring-sky-300", "ring-offset-2", "ring-offset-white", "dark:ring-cyan-300", "dark:ring-offset-zinc-950");
    selectedImageRef.current = image;
    selectedImageIdRef.current = image.dataset.juzImageId || figure?.dataset.juzImageId || null;
    setImageWidth(image.dataset.width || "220");
    setImageHeight(image.dataset.height || "");
    setImageAlign((image.dataset.align as ContentImageAlign) || "center");
    setImageCaption(image.dataset.caption || image.closest("figure")?.querySelector("figcaption")?.textContent || "");
    setHasSelectedImage(true);
  }

  function getActiveSelectedImage() {
    const selectedId = selectedImageIdRef.current;
    if (selectedId) {
      const escapedId = CSS.escape(selectedId);
      const imageById = editorRef.current?.querySelector(`img[data-juz-image-id="${escapedId}"]`) as HTMLImageElement | null;
      if (imageById?.isConnected) {
        selectedImageRef.current = imageById;
        return imageById;
      }
    }

    const current = selectedImageRef.current;
    if (current?.isConnected && editorRef.current?.contains(current)) {
      return current;
    }

    const selectedFigure = editorRef.current?.querySelector("figure[data-juz-image='true'].ring-2") as HTMLElement | null;
    const selectedImage = selectedFigure?.querySelector("img") as HTMLImageElement | null;
    if (selectedImage?.isConnected) {
      selectedImageRef.current = selectedImage;
      selectedImageIdRef.current = selectedImage.dataset.juzImageId || selectedFigure?.dataset.juzImageId || null;
      return selectedImage;
    }

    return null;
  }

  function normalizeEditorMarkup() {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.querySelectorAll("img").forEach((element) => {
      normalizeImageElement(element as HTMLImageElement);
    });

    editorRef.current.querySelectorAll("ul").forEach((list) => {
      list.className = "list-disc list-inside my-2 pl-4 text-gray-700";
    });

    editorRef.current.querySelectorAll("ol").forEach((list) => {
      list.className = "list-decimal list-inside my-2 pl-4 text-gray-700";
    });

    editorRef.current.querySelectorAll("a").forEach((anchor) => {
      anchor.className = "text-blue-600 underline font-medium";
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noreferrer noopener");
    });

    removeDuplicatedBlockText(editorRef.current);
  }

  function pushHistorySnapshot(snapshot: string) {
    if (!snapshot || historyRef.current[historyRef.current.length - 1] === snapshot) {
      return;
    }

    historyRef.current = [...historyRef.current.slice(-49), snapshot];
  }

  function syncContent(options: { skipHistory?: boolean } = {}) {
    if (!editorRef.current) {
      return lastSyncedValueRef.current;
    }

    normalizeEditorMarkup();
    const nextValue = serializeEditorHtml(editorRef.current);
    const previousValue = lastSyncedValueRef.current;

    if (!options.skipHistory && !isRestoringHistoryRef.current && previousValue && previousValue !== nextValue) {
      pushHistorySnapshot(previousValue);
    }

    lastSyncedValueRef.current = nextValue;
    onChange(nextValue);
    return nextValue;
  }

  useImperativeHandle(
    ref,
    () => ({
      flush() {
        return syncContent({ skipHistory: true }) || "";
      }
    }),
    [onChange]
  );

  function restoreEditorFromValue(nextValue: string) {
    if (!editorRef.current) {
      return;
    }

    isRestoringHistoryRef.current = true;
    const hydrated = hydrateShortcodesToPreview(nextValue || "");
    editorRef.current.innerHTML = hydrated;
    normalizeEditorMarkup();
    removeDuplicatedBlockText(editorRef.current);
    lastSyncedValueRef.current = nextValue || "";
    onChange(nextValue || "");
    isRestoringHistoryRef.current = false;
    window.requestAnimationFrame(() => {
      placeCaretAtEditorEnd();
    });
  }

  function undoLastEditorChange() {
    const previousValue = historyRef.current.pop();

    if (!previousValue) {
      return;
    }

    clearSelectedBlocks();
    restoreEditorFromValue(previousValue);
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (!isFocusedRef.current) {
        selectionRef.current = null;
      }
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      if (!isFocusedRef.current) {
        selectionRef.current = null;
      }
      return;
    }

    selectionRef.current = range.cloneRange();
  }

  function placeCaretAtEditorEnd() {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    selectionRef.current = range.cloneRange();
  }

  function restoreSelection() {
    editorRef.current?.focus();

    if (!selectionRef.current || !editorRef.current?.contains(selectionRef.current.commonAncestorContainer)) {
      placeCaretAtEditorEnd();
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }

  function removeEditorBlock(block: HTMLElement | null) {
    if (!block || !editorRef.current?.contains(block)) {
      return;
    }

    const nextTarget = block.nextSibling;
    block.remove();
    clearSelectedBlocks();
    syncContent();

    if (nextTarget && editorRef.current.contains(nextTarget)) {
      const range = document.createRange();
      range.setStartBefore(nextTarget);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      selectionRef.current = range.cloneRange();
      return;
    }

    placeCaretAtEditorEnd();
  }

  function getSelectedEditorBlock() {
    return selectedTreeBlockRef.current || selectedColorBoxRef.current || selectedTermGroupBlockRef.current || selectedTermBlockRef.current || selectedDangerBlockRef.current;
  }

  function clearSelectedBlocks() {
    selectedDangerBlockRef.current = null;
    selectedTermBlockRef.current = null;
    selectedTermGroupBlockRef.current = null;
    selectedColorBoxRef.current = null;
    selectedTreeBlockRef.current = null;
    selectedImageRef.current = null;
    selectedImageIdRef.current = null;
    setHasSelectedImage(false);
  }

  function handleToolbarMouseDown(event: ReactMouseEvent<HTMLElement>) {
    rememberSelection();
    event.preventDefault();
  }

  function prepareInsertionSelection() {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
      return;
    }

    if (selectionRef.current && editorRef.current?.contains(selectionRef.current.commonAncestorContainer)) {
      return;
    }

    placeCaretAtEditorEnd();
  }

  /** Курсор тұрған абзацты (<p>) қайтарады */
  function getCaretParagraph(): HTMLParagraphElement | null {
    const selection = window.getSelection();
    const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;

    if (!node || !editorRef.current?.contains(node)) {
      return null;
    }

    const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    const paragraph = element?.closest("p") as HTMLParagraphElement | null;

    return paragraph && editorRef.current.contains(paragraph) ? paragraph : null;
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();

    if (event.key === "Tab") {
      event.preventDefault();
      restoreSelection();

      // Tab — азат жол: абзацтың бірінші жолын шегініспен бастайды.
      // Shift+Tab шегіністі алып тастайды.
      const paragraph = getCaretParagraph();

      if (paragraph) {
        if (event.shiftKey) {
          delete paragraph.dataset.indent;
        } else {
          paragraph.dataset.indent = "true";
        }

        syncContent();
        rememberSelection();
        return;
      }

      // Абзац табылмаса (тізім, кесте ішінде) — бұрынғыша бос орын қосамыз
      if (!event.shiftKey) {
        document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
      }

      syncContent();
      rememberSelection();
      return;
    }

    if ((event.key === "Backspace" || event.key === "Delete") && getSelectedEditorBlock()) {
      event.preventDefault();
      removeEditorBlock(getSelectedEditorBlock());
    }
  }

  function handleControlKeyDown(event: React.KeyboardEvent<HTMLElement>, action?: () => void) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    action?.();
  }

  function insertHtml(html: string) {
    restoreSelection();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (!range || !editorRef.current?.contains(range.commonAncestorContainer)) {
      placeCaretAtEditorEnd();
    }

    const activeSelection = window.getSelection();
    const activeRange = activeSelection?.rangeCount ? activeSelection.getRangeAt(0) : null;

    if (!activeRange || !editorRef.current?.contains(activeRange.commonAncestorContainer)) {
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content;
    const lastNode = fragment.lastChild;

    activeRange.deleteContents();
    activeRange.insertNode(fragment);

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      activeSelection?.removeAllRanges();
      activeSelection?.addRange(nextRange);
      selectionRef.current = nextRange.cloneRange();
    }

    syncContent();
    rememberSelection();
  }

  function insertImageFigure(html: string) {
    // Суретті енгізер алдында соңғы сақталған курсор орнын қайта қалпына келтіреміз.
    prepareInsertionSelection();
    restoreSelection();

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (!range || !editorRef.current?.contains(range.commonAncestorContainer)) {
      placeCaretAtEditorEnd();
    }

    const activeSelection = window.getSelection();
    const activeRange = activeSelection?.rangeCount ? activeSelection.getRangeAt(0) : null;

    if (!activeRange || !editorRef.current?.contains(activeRange.commonAncestorContainer)) {
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = `${html}<p data-juz-after-image="true"><br /></p>`;
    const fragment = template.content;
    const image = fragment.querySelector("img") as HTMLImageElement | null;
    const caretParagraph = fragment.querySelector("[data-juz-after-image]") as HTMLElement | null;

    activeRange.deleteContents();
    activeRange.insertNode(fragment);

    normalizeEditorMarkup();

    if (image?.isConnected) {
      normalizeImageElement(image);
      openImageControls(image);
    }

    if (caretParagraph?.isConnected) {
      caretParagraph.removeAttribute("data-juz-after-image");
      // Суреттен кейін бірден жазуды жалғастыру үшін курсорды бос абзацтың ішіне қоямыз.
      const nextRange = document.createRange();
      nextRange.selectNodeContents(caretParagraph);
      nextRange.collapse(false);
      activeSelection?.removeAllRanges();
      activeSelection?.addRange(nextRange);
      selectionRef.current = nextRange.cloneRange();
    }

    syncContent();
    rememberSelection();
  }

  function insertImageFigureCore(html: string) {
    // Сурет таңдау терезесінен кейін жоғалған фокусты сақталған орынға мәжбүрлі түрде қайтарамыз.
    prepareInsertionSelection();
    restoreSelection();

    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (!range || !editorRef.current?.contains(range.commonAncestorContainer)) {
      placeCaretAtEditorEnd();
    }

    const activeSelection = window.getSelection();
    const activeRange = activeSelection?.rangeCount ? activeSelection.getRangeAt(0) : null;

    if (!activeRange || !editorRef.current?.contains(activeRange.commonAncestorContainer)) {
      return;
    }

    const template = document.createElement("template");
    template.innerHTML = `${html}<p data-juz-after-image="true"><br /></p>`;
    const fragment = template.content;
    const incomingImage = fragment.querySelector("img") as HTMLImageElement | null;
    const imageId = incomingImage?.dataset.juzImageId || createEditorImageId();
    const figure = fragment.querySelector("figure[data-juz-image='true']") as HTMLElement | null;
    const caretParagraph = fragment.querySelector("[data-juz-after-image]") as HTMLElement | null;

    if (incomingImage) {
      incomingImage.dataset.juzImageId = imageId;
    }
    if (figure) {
      figure.dataset.juzImageId = imageId;
    }

    activeRange.deleteContents();
    activeRange.insertNode(fragment);
    normalizeEditorMarkup();

    const insertedImage = editorRef.current?.querySelector(`img[data-juz-image-id="${CSS.escape(imageId)}"]`) as HTMLImageElement | null;
    if (insertedImage) {
      normalizeImageElement(insertedImage);
      openImageControls(insertedImage);
    }

    if (caretParagraph?.isConnected) {
      caretParagraph.removeAttribute("data-juz-after-image");
      // Суреттен кейін бірден жазу үшін курсорды суреттен кейінгі бос абзацқа қоямыз.
      const nextRange = document.createRange();
      nextRange.selectNodeContents(caretParagraph);
      nextRange.collapse(false);
      activeSelection?.removeAllRanges();
      activeSelection?.addRange(nextRange);
      selectionRef.current = nextRange.cloneRange();
    }

    syncContent();
    rememberSelection();
  }

  function runCommand(command: CommandName) {
    restoreSelection();
    document.execCommand(command);
    syncContent();
    rememberSelection();
  }

  function applyAlignment(direction: "left" | "center" | "right") {
    restoreSelection();
    document.execCommand(direction === "left" ? "justifyLeft" : direction === "center" ? "justifyCenter" : "justifyRight");
    syncContent();
    rememberSelection();
  }

  function applyList(type: "ul" | "ol") {
    restoreSelection();
    document.execCommand(type === "ul" ? "insertUnorderedList" : "insertOrderedList");
    syncContent();
    rememberSelection();
  }

  function applyTextColor(color: string) {
    restoreSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);
    syncContent();
    rememberSelection();
    setIsColorMenuOpen(false);
  }

  function insertQuoteBlock() {
    restoreSelection();
    const selected = selectionRef.current?.toString().trim() || "Дәйексөз мәтіні";
    document.execCommand(
      "insertHTML",
      false,
      `<blockquote class="my-3 border-l-4 border-slate-300 pl-4 italic text-slate-700"><p>${escapeHtml(selected)}</p></blockquote>`
    );
    syncContent();
    rememberSelection();
  }

  function openLinkMenu() {
    rememberSelection();
    const selectedText = selectionRef.current?.toString().trim() ?? "";
    setLinkLabel(selectedText);
    setLinkUrl("");
    setIsLinkMenuOpen((current) => !current);
    setIsColorMenuOpen(false);
    setIsDangerMenuOpen(false);
    setIsTermMenuOpen(false);
    setIsColorBoxMenuOpen(false);
    setIsTableMenuOpen(false);
    setIsEmojiMenuOpen(false);
  }

  function insertLink() {
    const safeUrl = linkUrl.trim();
    const safeLabel = (linkLabel.trim() || selectionRef.current?.toString().trim() || "Сілтеме").trim();

    if (!safeUrl) {
      return;
    }

    insertHtml(
      `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer noopener" class="text-blue-600 underline font-medium">${escapeHtml(safeLabel)}</a>`
    );
    setLinkLabel("");
    setLinkUrl("");
    setIsLinkMenuOpen(false);
  }

  function insertEmoji(emoji: string) {
    restoreSelection();
    document.execCommand("insertText", false, emoji);
    syncContent();
    rememberSelection();
    setIsEmojiMenuOpen(false);
  }

  function insertGif(src: string) {
    insertHtml(
      `<img src="${escapeAttribute(src)}" alt="" data-width="${imageWidth.trim() || "220"}" data-height="${imageHeight.trim() || ""}" data-align="${imageAlign}" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md" />`
    );
    setIsEmojiMenuOpen(false);
  }

  function openEmojiMenu() {
    rememberSelection();
    setIsEmojiMenuOpen((current) => !current);
    setIsColorMenuOpen(false);
    setIsDangerMenuOpen(false);
    setIsTermMenuOpen(false);
    setIsColorBoxMenuOpen(false);
    setIsTableMenuOpen(false);
    setIsLinkMenuOpen(false);
  }

  function insertDangerBlock() {
    const preview = createDangerPreviewHtml({
      title: dangerTitle,
      body: dangerText,
      color: dangerColor,
      placement: dangerPlacement
    });

    if (selectedDangerBlockRef.current && selectedDangerBlockRef.current.isConnected) {
      selectedDangerBlockRef.current.outerHTML = preview;
      selectedDangerBlockRef.current = null;
      syncContent();
      return;
    }

    insertHtml(`${preview}<p><br /></p>`);
  }

  function insertTermBlock() {
    selectedTermGroupBlockRef.current = null;
    const preview = createTermPreviewHtml({
      title: termTitle,
      body: termText,
      color: termColor,
      image: termImage,
      imageAlign: termImageAlign,
      imageWidth: termImageWidth,
      imageHeight: termImageHeight,
      surface: termSurface,
      backgroundColor: termBackgroundColor
    });

    if (selectedTermBlockRef.current && selectedTermBlockRef.current.isConnected) {
      selectedTermBlockRef.current.outerHTML = preview;
      selectedTermBlockRef.current = null;
      syncContent();
      return;
    }

    insertHtml(`${preview}<p><br /></p>`);
  }

  function insertTermGroupBlock() {
    selectedTermBlockRef.current = null;
    const preview = createTermGroupPreviewHtml({
      title: termGroupTitle,
      items: termGroupItems,
      color: termColor,
      backgroundColor: termBackgroundColor
    });

    const targetBlock =
      selectedTermGroupBlockRef.current?.isConnected && editorRef.current?.contains(selectedTermGroupBlockRef.current)
        ? selectedTermGroupBlockRef.current
        : null;

    if (targetBlock) {
      targetBlock.outerHTML = preview;
      selectedTermGroupBlockRef.current = null;
      syncContent();
      return;
    }

    insertHtml(`${preview}<p><br /></p>`);
  }

  function termBlockToGroupItem(block: HTMLElement): TermGroupItem {
    return createTermGroupItem(
      block.dataset.title || "Термин",
      prepareBlockBodyForEditor(block.dataset.body || ""),
      block.dataset.image || "",
      block.dataset.imageWidth || "180",
      block.dataset.imageHeight || "",
      (block.dataset.imageAlign as TermImageAlign) || "top"
    );
  }

  function mergeVisibleTermBlocks() {
    if (!editorRef.current) {
      return;
    }

    const selectedBlock = selectedTermBlockRef.current || selectedTermGroupBlockRef.current;
    const allBlocks = Array.from(editorRef.current.querySelectorAll<HTMLElement>('[data-juz-block="term"]'));
    const targetIndex = selectedBlock ? allBlocks.findIndex((block) => block === selectedBlock) : -1;
    const blocksToMerge =
      targetIndex >= 0
        ? allBlocks.slice(Math.max(0, targetIndex - 1), Math.min(allBlocks.length, targetIndex + 2))
        : allBlocks.slice(0, 2);

    const uniqueBlocks = blocksToMerge.filter((block, index, source) => source.indexOf(block) === index);

    if (uniqueBlocks.length < 2) {
      return;
    }

    const items = uniqueBlocks.map(termBlockToGroupItem);
    const preview = createTermGroupPreviewHtml({
      title: termGroupTitle || "Негізгі терминдер",
      items,
      color: termColor,
      backgroundColor: termBackgroundColor
    });
    const template = document.createElement("template");
    template.innerHTML = preview;
    const groupNode = template.content.firstElementChild;

    if (!groupNode) {
      return;
    }

    uniqueBlocks[0].replaceWith(groupNode);
    uniqueBlocks.slice(1).forEach((block) => block.remove());
    selectedTermBlockRef.current = null;
    selectedTermGroupBlockRef.current = groupNode as HTMLElement;
    setTermGroupItems(items);
    syncContent();
  }

  function insertColorBox() {
    const preview = createColorBoxPreviewHtml({
      body: colorBoxText,
      color: colorBoxColor,
      textColor: colorBoxTextColor
    });

    if (selectedColorBoxRef.current && selectedColorBoxRef.current.isConnected) {
      selectedColorBoxRef.current.outerHTML = preview;
      selectedColorBoxRef.current = null;
      syncContent();
      return;
    }

    insertHtml(`${preview}<p><br /></p>`);
  }

  function insertTable() {
    prepareInsertionSelection();

    if (tableMode === "tree") {
      const tree = buildTreeFromLines(treeRoot, treeChildren);
      const normalizedScale = Math.max(45, Math.min(120, Number(treeScale) || 80)) / 100;
      const treeHtml = renderTreeSvg(tree, { boxColor: treeBoxColor, lineColor: treeLineColor, textColor: treeTextColor, scale: normalizedScale });

      if (selectedTreeBlockRef.current && selectedTreeBlockRef.current.isConnected) {
        selectedTreeBlockRef.current.outerHTML = treeHtml;
        selectedTreeBlockRef.current = null;
        syncContent();
        setIsTableMenuOpen(false);
        return;
      }

      insertHtml(`${treeHtml}<p><br /></p>`);
      setIsTableMenuOpen(false);
      return;
    }

    const rows = Math.max(1, Number(tableRows) || 1);
    const columns = Math.max(1, Number(tableColumns) || 1);
    const widthPercent = Math.max(20, Math.min(100, Number(tableWidthPercent) || 100));
    const customHeaders = tableHeaders
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const headerCells = Array.from({ length: columns }, (_, index) => {
      const label = escapeHtml(customHeaders[index] || `Баған ${index + 1}`);
      return `<th style="border:1px solid ${tableBorderColor}; padding:12px; background:${tableHeaderColor}; text-align:left; font-weight:700;">${label}</th>`;
    }).join("");

    const bodyRows = Array.from({ length: rows }, (_, rowIndex) => {
      const cells = Array.from({ length: columns }, (_, columnIndex) => {
        return `<td style="border:1px solid ${tableBorderColor}; padding:12px; background:${tableBodyColor};">Ұяшық ${rowIndex + 1}.${columnIndex + 1}</td>`;
      }).join("");

      return `<tr>${cells}</tr>`;
    }).join("");

    insertHtml(
      `<div data-juz-table="true" contenteditable="false" style="position:relative; margin:16px auto; width:${widthPercent}%; max-width:100%; overflow-x:auto; border:1px solid ${tableBorderColor}; border-radius:18px;">${createMoveDeleteButtons()}<table style="width:100%; border-collapse:collapse; min-width:${Math.max(columns * 140, 320)}px;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div><p><br /></p>`
    );
    setIsTableMenuOpen(false);
  }

  function insertImageFromUrl() {
    prepareInsertionSelection();
    const src = window.prompt("Сурет сілтемесін енгізіңіз");
    if (!src) {
      return;
    }

    insertImageFigureCore(
      createImageFigureHtml({ src, width: imageWidth || "220", height: imageHeight || "", align: imageAlign, caption: imageCaption })
    );
  }

  function openImagePicker() {
    prepareInsertionSelection();
    imageInputRef.current?.click();
  }

  function openTermImagePicker() {
    prepareInsertionSelection();
    termImageInputRef.current?.click();
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        insertImageFigureCore(
          createImageFigureHtml({ src: reader.result, width: imageWidth || "220", height: imageHeight || "", align: imageAlign, caption: imageCaption })
        );
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleTermImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setTermImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function updateTermGroupItem(itemId: string, patch: Partial<TermGroupItem>) {
    setTermGroupItems((items) => items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  function applyTermGroupItemMarkup(itemId: string, textarea: HTMLTextAreaElement | null, openTag: string, closeTag: string) {
    if (!textarea) {
      return;
    }

    const item = termGroupItems.find((current) => current.id === itemId);
    if (!item) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = item.body.slice(start, end) || "мәтін";
    const nextBody = `${item.body.slice(0, start)}${openTag}${selected}${closeTag}${item.body.slice(end)}`;
    updateTermGroupItem(itemId, { body: nextBody });

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + openTag.length, start + openTag.length + selected.length);
    });
  }

  function removeTermGroupItem(itemId: string) {
    setTermGroupItems((items) => (items.length > 1 ? items.filter((item) => item.id !== itemId) : items));
  }

  function handleTermGroupImageUpload(itemId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateTermGroupItem(itemId, { image: reader.result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function applySelectedImageAttributes(image: HTMLImageElement, next: { width: string; height: string; align: ContentImageAlign; caption: string }) {
    // Редактор ядросындағы нақты image түйініне атрибуттарды бір жерде жазамыз.
    const figure = image.closest("figure") as HTMLElement | null;
    const imageId = image.dataset.juzImageId || figure?.dataset.juzImageId || createEditorImageId();

    image.dataset.juzImageId = imageId;
    image.dataset.width = next.width.trim() || "220";
    image.dataset.height = next.height.trim();
    image.dataset.align = next.align;
    image.dataset.caption = next.caption.trim();
    image.setAttribute("alt", next.caption.trim());

    if (figure) {
      figure.dataset.juzImageId = imageId;
      figure.dataset.width = image.dataset.width;
      figure.dataset.height = image.dataset.height;
      figure.dataset.align = image.dataset.align;
      figure.dataset.caption = image.dataset.caption;
    }

    normalizeImageElement(image);
    selectedImageRef.current = image;
    selectedImageIdRef.current = imageId;
    syncContent();
    openImageControls(image);
  }

  function updateSelectedImage() {
    const image = getActiveSelectedImage();
    if (!image) {
      return;
    }

    // Өңдеу панеліндегі мәндерді дәл таңдалған сурет түйініне жазамыз.
    applySelectedImageAttributes(image, {
      width: imageWidth,
      height: imageHeight,
      align: imageAlign,
      caption: imageCaption
    });
  }

  function patchSelectedImage(patch: { width?: string; height?: string; align?: ContentImageAlign; caption?: string }) {
    const image = getActiveSelectedImage();
    if (!image) {
      return;
    }

    applySelectedImageAttributes(image, {
      width: patch.width !== undefined ? patch.width : imageWidth,
      height: patch.height !== undefined ? patch.height : imageHeight,
      align: patch.align ?? imageAlign,
      caption: patch.caption !== undefined ? patch.caption : imageCaption
    });
  }

  function openCropForSelectedImage() {
    const image = getActiveSelectedImage();
    if (!image) {
      return;
    }

    setCropError("");
    setCropRect({ x: 0.08, y: 0.08, width: 0.84, height: 0.84 });
    setCropState({ src: image.currentSrc || image.src });
  }

  /** Қию тіктөртбұрышын сүйреу (move) не бұрышынан өлшемін өзгерту */
  function startCropDrag(event: ReactMouseEvent<HTMLElement>, mode: "move" | "nw" | "ne" | "sw" | "se") {
    event.preventDefault();
    event.stopPropagation();

    const area = cropAreaRef.current;
    if (!area) {
      return;
    }

    const bounds = area.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...cropRect };
    const minimum = 0.05;

    const handleMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / bounds.width;
      const deltaY = (moveEvent.clientY - startY) / bounds.height;
      let { x, y, width, height } = start;

      if (mode === "move") {
        x = Math.min(Math.max(0, start.x + deltaX), 1 - start.width);
        y = Math.min(Math.max(0, start.y + deltaY), 1 - start.height);
      } else {
        if (mode.includes("w")) {
          const nextX = Math.min(Math.max(0, start.x + deltaX), start.x + start.width - minimum);
          width = start.width + (start.x - nextX);
          x = nextX;
        }
        if (mode.includes("e")) {
          width = Math.min(Math.max(minimum, start.width + deltaX), 1 - start.x);
        }
        if (mode.includes("n")) {
          const nextY = Math.min(Math.max(0, start.y + deltaY), start.y + start.height - minimum);
          height = start.height + (start.y - nextY);
          y = nextY;
        }
        if (mode.includes("s")) {
          height = Math.min(Math.max(minimum, start.height + deltaY), 1 - start.y);
        }
      }

      setCropRect({ x, y, width, height });
    };

    const handleUp = () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }

  function loadImageElement(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = "anonymous";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Суретті жүктеу мүмкін болмады."));
      element.src = src;
    });
  }

  /** Қиылған суретті файл етіп сақтайды; сәтсіз болса, data-URL күйінде қалады */
  async function uploadEditedImage(dataUrl: string) {
    try {
      const response = await fetch("/api/admin/images", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl })
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { url?: string };
      return typeof payload.url === "string" ? payload.url : null;
    } catch {
      return null;
    }
  }

  async function applyCrop() {
    const image = getActiveSelectedImage();
    if (!image || !cropState) {
      return;
    }

    setIsCropSaving(true);
    setCropError("");

    try {
      const source = await loadImageElement(cropState.src);
      const sourceX = Math.round(cropRect.x * source.naturalWidth);
      const sourceY = Math.round(cropRect.y * source.naturalHeight);
      const sourceWidth = Math.max(1, Math.round(cropRect.width * source.naturalWidth));
      const sourceHeight = Math.max(1, Math.round(cropRect.height * source.naturalHeight));

      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Қию мүмкін болмады.");
      }

      context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
      const dataUrl = canvas.toDataURL("image/png");
      const uploaded = await uploadEditedImage(dataUrl);

      image.src = uploaded || dataUrl;
      image.removeAttribute("srcset");
      // Қиылған соң биіктік бұрынғы суреттікі болып қалмауы керек
      setImageHeight("");
      applySelectedImageAttributes(image, {
        width: imageWidth || "220",
        height: "",
        align: imageAlign,
        caption: imageCaption
      });
      setCropState(null);
    } catch (error) {
      setCropError(error instanceof Error ? error.message : "Суретті қию мүмкін болмады.");
    } finally {
      setIsCropSaving(false);
    }
  }

  function removeSelectedImage() {
    const image = getActiveSelectedImage();
    if (!image) {
      return;
    }

    const figure = image.closest("figure");
    if (figure) {
      figure.remove();
    } else {
      image.remove();
    }
    selectedImageRef.current = null;
    selectedImageIdRef.current = null;
    setHasSelectedImage(false);
    syncContent();
  }

  function clearDragVisualState() {
    draggedBlockRef.current?.classList.remove("opacity-60", "ring-2", "ring-sky-300");
    dragPreviewTargetRef.current?.classList.remove("ring-2", "ring-sky-200");
    dragPreviewTargetRef.current = null;
  }

  function getTopLevelEditorNode(node: Node | null) {
    if (!node || !editorRef.current?.contains(node)) {
      return null;
    }

    let current: Node | null = node;
    while (current?.parentNode && current.parentNode !== editorRef.current) {
      current = current.parentNode;
    }

    return current && current !== editorRef.current ? current : null;
  }

  function getDropReferenceNode(clientX: number, clientY: number) {
    if (!editorRef.current) {
      return null;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const targetBlock = element?.closest?.("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]") as HTMLElement | null;

    if (targetBlock && editorRef.current.contains(targetBlock) && targetBlock !== draggedBlockRef.current) {
      const rect = targetBlock.getBoundingClientRect();
      return {
        node: targetBlock,
        after: clientY > rect.top + rect.height / 2
      };
    }

    const caretRange =
      "caretRangeFromPoint" in document
        ? document.caretRangeFromPoint(clientX, clientY)
        : null;
    const topLevelNode = getTopLevelEditorNode(caretRange?.startContainer || element || null);

    if (topLevelNode && topLevelNode !== draggedBlockRef.current) {
      const topLevelElement = topLevelNode instanceof HTMLElement ? topLevelNode : topLevelNode.parentElement;
      const rect = topLevelElement?.getBoundingClientRect();
      return {
        node: topLevelNode,
        after: rect ? clientY > rect.top + rect.height / 2 : false
      };
    }

    return null;
  }

  function moveDraggedBlockToPoint(clientX: number, clientY: number) {
    const draggedBlock = draggedBlockRef.current;
    const editor = editorRef.current;

    if (!draggedBlock || !editor?.contains(draggedBlock)) {
      return;
    }

    const dropReference = getDropReferenceNode(clientX, clientY);

    if (dropReference?.node && editor.contains(dropReference.node)) {
      const referenceNode = dropReference.after ? dropReference.node.nextSibling : dropReference.node;
      editor.insertBefore(draggedBlock, referenceNode);
    } else {
      editor.appendChild(draggedBlock);
    }

    clearSelectedBlocks();
    syncContent();
    placeCaretAtEditorEnd();
  }

  function handleEditorMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const handle = target.closest("[data-juz-drag]") as HTMLElement | null;
    // Батырма басылмаса, суреттің өзін басып тұрып сүйреуге болады
    const imageFigure = handle
      ? null
      : (target.closest("figure[data-juz-image='true']") as HTMLElement | null);
    const block = (handle?.closest("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]") ||
      imageFigure) as HTMLElement | null;

    if (!block || !editorRef.current?.contains(block)) {
      return;
    }

    if (imageFigure && (target.closest("[data-juz-delete]") || target.closest("[data-juz-edit]"))) {
      return;
    }

    // Суретте сүйреу 5 пиксельден артық жылжығанда ғана басталады, әйтпесе
    // жай басу суретті таңдап, өңдеу панелін ашуы керек
    const startX = event.clientX;
    const startY = event.clientY;
    let isDragging = !imageFigure;

    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      draggedBlockRef.current = block;
      block.classList.add("opacity-60", "ring-2", "ring-sky-300");
    }

    const handleMouseMove = (mouseEvent: MouseEvent) => {
      if (!isDragging) {
        if (Math.abs(mouseEvent.clientX - startX) < 5 && Math.abs(mouseEvent.clientY - startY) < 5) {
          return;
        }

        isDragging = true;
        draggedBlockRef.current = block;
        block.classList.add("opacity-60", "ring-2", "ring-sky-300");
      }

      const dropReference = getDropReferenceNode(mouseEvent.clientX, mouseEvent.clientY);
      dragPreviewTargetRef.current?.classList.remove("ring-2", "ring-sky-200");
      const nextTarget = dropReference?.node instanceof HTMLElement ? dropReference.node : dropReference?.node?.parentElement || null;

      if (nextTarget && nextTarget !== draggedBlockRef.current && editorRef.current?.contains(nextTarget)) {
        nextTarget.classList.add("ring-2", "ring-sky-200");
        dragPreviewTargetRef.current = nextTarget;
      } else {
        dragPreviewTargetRef.current = null;
      }
    };

    const handleMouseUp = (mouseEvent: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (!isDragging) {
        return;
      }

      moveDraggedBlockToPoint(mouseEvent.clientX, mouseEvent.clientY);
      clearDragVisualState();
      draggedBlockRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function handleEditorDragStart(event: ReactDragEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const handle = target.closest("[data-juz-drag]") as HTMLElement | null;
    // Суретті бөлек «Жылжыту» батырмасынсыз, тікелей басып сүйреуге болады
    const block = (handle?.closest("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]") ||
      target.closest("figure[data-juz-image='true']")) as HTMLElement | null;

    if (!block || !editorRef.current?.contains(block)) {
      event.preventDefault();
      return;
    }

    draggedBlockRef.current = block;
    block.classList.add("opacity-60", "ring-2", "ring-sky-300");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", block.dataset.juzBlock || "block");
  }

  function handleEditorDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!draggedBlockRef.current) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleEditorDrop(event: ReactDragEvent<HTMLDivElement>) {
    const draggedBlock = draggedBlockRef.current;
    if (!draggedBlock || !editorRef.current?.contains(draggedBlock)) {
      return;
    }

    event.preventDefault();
    const target = event.target as HTMLElement;
    const targetBlock = target.closest("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]") as HTMLElement | null;

    if (targetBlock && targetBlock !== draggedBlock && editorRef.current.contains(targetBlock)) {
      const rect = targetBlock.getBoundingClientRect();
      targetBlock.parentNode?.insertBefore(draggedBlock, event.clientY > rect.top + rect.height / 2 ? targetBlock.nextSibling : targetBlock);
    } else {
      editorRef.current.appendChild(draggedBlock);
    }

    clearDragVisualState();
    draggedBlockRef.current = null;
    clearSelectedBlocks();
    syncContent();
  }

  function handleEditorDragEnd() {
    clearDragVisualState();
    draggedBlockRef.current = null;
  }

  function handleEditorClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const dragButton = target.closest("[data-juz-drag]") as HTMLElement | null;
    const deleteButton = target.closest("[data-juz-delete]") as HTMLElement | null;
    const editButton = target.closest("[data-juz-edit]") as HTMLElement | null;

    if (dragButton) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      removeEditorBlock(deleteButton.closest("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]") as HTMLElement | null);
      return;
    }

    if (editButton) {
      event.preventDefault();
      event.stopPropagation();
      const imageBlock = editButton.closest("[data-juz-image]") as HTMLElement | null;
      if (imageBlock) {
        const image = imageBlock.querySelector("img") as HTMLImageElement | null;
        if (image) {
          openImageControls(image);
        }
        return;
      }

      const editableBlock = editButton.closest("[data-juz-block]") as HTMLElement | null;
      if (!editableBlock) {
        return;
      }

      if (editableBlock.dataset.juzBlock === "tree") {
        openTreeMenuForBlock(editableBlock);
        return;
      }

      if (editableBlock.dataset.juzBlock === "colorbox") {
        openColorBoxMenuForBlock(editableBlock);
        return;
      }

      if (editableBlock.dataset.juzBlock === "term") {
        openTermMenuForBlock(editableBlock);
        return;
      }

      if (editableBlock.dataset.juzBlock === "termgroup") {
        openTermGroupMenuForBlock(editableBlock);
        return;
      }

      if (editableBlock.dataset.juzBlock === "danger" || editableBlock.dataset.juzBlock === "rightdanger") {
        openDangerMenuForBlock(editableBlock);
        return;
      }
    }

    const block = target.closest("[data-juz-block], [data-juz-tree], [data-juz-image], [data-juz-table]") as HTMLElement | null;

    if (block) {
      if (block.dataset.juzImage === "true") {
        const image = block.querySelector("img") as HTMLImageElement | null;
        if (image) {
          openImageControls(image);
        }
        return;
      }

      selectedImageRef.current = null;
      selectedImageIdRef.current = null;
      setHasSelectedImage(false);

      if (block.dataset.juzTree === "true" || block.dataset.juzBlock === "tree") {
        selectedTreeBlockRef.current = block;
        selectedColorBoxRef.current = null;
        selectedTermBlockRef.current = null;
        selectedDangerBlockRef.current = null;
        return;
      }

      if (block.dataset.juzBlock === "colorbox") {
        selectedColorBoxRef.current = block;
        selectedTreeBlockRef.current = null;
        selectedDangerBlockRef.current = null;
        selectedTermBlockRef.current = null;
        setColorBoxText(block.dataset.body || "Боялған мәтінді осы жерге жазыңыз");
        setColorBoxColor(block.dataset.color || "#ede5c3");
        setColorBoxTextColor(block.dataset.textColor || "#0f172a");
        setColorBoxText(prepareBlockBodyForEditor(block.dataset.body || ""));
        return;
      }

      if (block.dataset.juzBlock === "term") {
        selectedTermBlockRef.current = block;
        selectedTermGroupBlockRef.current = null;
        selectedDangerBlockRef.current = null;
        selectedColorBoxRef.current = null;
        selectedTreeBlockRef.current = null;
        setTermTitle(block.dataset.title || "Термин");
        setTermText(block.dataset.body || "Терминнің түсіндірмесін осы жерге жазыңыз");
        setTermColor((block.dataset.color as DangerColor) || "blue");
        setTermImage(block.dataset.image || "");
        setTermImageAlign((block.dataset.imageAlign as TermImageAlign) || "top");
        setTermImageWidth(block.dataset.imageWidth || "220");
        setTermImageHeight(block.dataset.imageHeight || "");
        setTermSurface((block.dataset.surface as TermSurface) || "default");
        setTermBackgroundColor(block.dataset.backgroundColor || (block.dataset.surface === "white" ? "#ffffff" : "#f8fafc"));
        setTermTitle(block.dataset.title || "Термин");
        setTermText(prepareBlockBodyForEditor(block.dataset.body || ""));
        return;
      }

      if (block.dataset.juzBlock === "termgroup") {
        selectedTermGroupBlockRef.current = block;
        selectedTermBlockRef.current = null;
        selectedDangerBlockRef.current = null;
        selectedColorBoxRef.current = null;
        selectedTreeBlockRef.current = null;
        setTermGroupTitle(block.dataset.title || "Негізгі терминдер");
        setTermGroupItems(decodeTermGroupItemsAttribute(block.dataset.items || "", prepareBlockBodyForEditor(block.dataset.body || "")));
        setTermColor((block.dataset.color as DangerColor) || "blue");
        setTermBackgroundColor(block.dataset.backgroundColor || "#f8fafc");
        return;
      }

      if (block.dataset.juzBlock === "danger" || block.dataset.juzBlock === "rightdanger") {
        selectedDangerBlockRef.current = block;
        selectedTermBlockRef.current = null;
        selectedColorBoxRef.current = null;
        selectedTreeBlockRef.current = null;
        setDangerTitle(block.dataset.title || "Маңызды, қарап ал!");
        setDangerText(block.dataset.body || "Маңызды мәтінді осы жерге жазыңыз");
        setDangerColor((block.dataset.color as DangerColor) || "red");
        setDangerPlacement(block.dataset.juzBlock === "rightdanger" ? "rightdanger" : "danger");
        setDangerTitle(block.dataset.title || "Маңызды, қарап ал!");
        setDangerText(prepareBlockBodyForEditor(block.dataset.body || ""));
        return;
      }
    }

    const image = target.closest("img") as HTMLImageElement | null;
    if (image && editorRef.current?.contains(image)) {
      openImageControls(image);
      return;
    }

    clearSelectedBlocks();
  }

  const tools = [
    { label: "Мәтінді қалыңдату", icon: Bold, action: () => runCommand("bold") },
    { label: "Мәтінді көлбеу ету", icon: Italic, action: () => runCommand("italic") },
    { label: "Жоғарғы индекс", icon: Superscript, action: () => runCommand("superscript") },
    { label: "Төменгі индекс", icon: Subscript, action: () => runCommand("subscript") },
    { label: "Солға туралау", icon: AlignLeft, action: () => applyAlignment("left") },
    { label: "Ортаға туралау", icon: AlignCenter, action: () => applyAlignment("center") },
    { label: "Оңға туралау", icon: AlignRight, action: () => applyAlignment("right") },
    { label: "Маркерленген тізім", icon: List, action: () => applyList("ul") },
    { label: "Нөмірленген тізім", icon: ListOrdered, action: () => applyList("ol") },
    { label: "Дәйексөз", icon: Quote, action: insertQuoteBlock },
    { label: "Сілтеме қосу", icon: Link2, action: openLinkMenu },
    { label: "Эмодзи қосу", icon: SmilePlus, action: openEmojiMenu },
    { label: "Суретті сілтемемен қосу", icon: ImagePlus, action: insertImageFromUrl },
    { label: "Компьютерден сурет жүктеу", icon: ImagePlus, action: openImagePicker }
  ];
  const isEditingTermGroup = Boolean(selectedTermGroupBlockRef.current?.isConnected);
  const isEditingSingleTerm = Boolean(selectedTermBlockRef.current?.isConnected);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${
        layout === "side" ? "flex flex-col lg:flex-row-reverse lg:items-stretch" : ""
      }`}
    >
      <div
        className={`relative z-10 flex flex-wrap items-center gap-2 overflow-visible border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 ${
          layout === "side"
            ? "border-b lg:max-h-[80vh] lg:w-[16.5rem] lg:shrink-0 lg:content-start lg:items-start lg:overflow-y-auto lg:border-b-0 lg:border-l"
            : "border-b"
        }`}
      >
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <input ref={termImageInputRef} type="file" accept="image/*" onChange={handleTermImageUpload} className="hidden" />

        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={undoLastEditorChange}
          className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
          aria-label="Соңғы өзгерісті қайтару"
        >
          <Undo2 className="h-4 w-4" />
          {tooltip("Соңғы өзгерісті қайтару")}
        </button>

        <div ref={colorMenuRef} className="relative z-10">
          <button
            type="button"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => {
              rememberSelection();
              setIsColorMenuOpen((current) => !current);
              setIsDangerMenuOpen(false);
              setIsTermMenuOpen(false);
              setIsColorBoxMenuOpen(false);
              setIsTableMenuOpen(false);
              setIsLinkMenuOpen(false);
              setIsEmojiMenuOpen(false);
            }}
            className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
            aria-label="Мәтін түсін өзгерту"
          >
            <Palette className="h-4 w-4" />
            {tooltip("Мәтін түсін өзгерту")}
          </button>

          {isColorMenuOpen ? (
            <div className="absolute left-0 top-12 z-40 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Мәтін түсі</p>
              <div className="grid grid-cols-4 gap-2">
                {textColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onMouseDown={handleToolbarMouseDown}
                    onClick={() => applyTextColor(color)}
                    className="h-9 w-9 rounded-full border border-white shadow-sm transition hover:scale-105 dark:border-zinc-900"
                    style={{ background: `linear-gradient(135deg, ${color}, #ffffff)` }}
                    aria-label={color}
                    title={color}
                  />
                ))}
              </div>
              <label className="mt-3 block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Өз түсіңіз</span>
                <input
                  type="color"
                  defaultValue="#1d4ed8"
                  onChange={(event) => applyTextColor(event.target.value || "#1d4ed8")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div ref={dangerMenuRef} className="relative z-10">
          <button
            type="button"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => {
              rememberSelection();
              setIsDangerMenuOpen((current) => !current);
              setIsColorMenuOpen(false);
              setIsTermMenuOpen(false);
              setIsColorBoxMenuOpen(false);
              setIsTableMenuOpen(false);
              setIsLinkMenuOpen(false);
              setIsEmojiMenuOpen(false);
            }}
            className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
            aria-label="Ескерту блогын қосу"
          >
            <ShieldAlert className="h-4 w-4" />
            {tooltip("Ескерту блогын қосу")}
          </button>

          {isDangerMenuOpen ? (
            <div className="absolute left-0 top-12 z-40 w-[22rem] max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pr-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Ескерту блогын баптау</p>
                <button
                  type="button"
                  onMouseDown={handleToolbarMouseDown}
                  onClick={insertDangerBlock}
                  className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                >
                  Қою
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Орналасуы</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => setDangerPlacement("danger")}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        dangerPlacement === "danger"
                          ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200"
                          : "border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                      }`}
                    >
                      Орталық блок
                    </button>
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => setDangerPlacement("rightdanger")}
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        dangerPlacement === "rightdanger"
                          ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200"
                          : "border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                      }`}
                    >
                      Оң жақ блок
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Тақырыпшасы</label>
                  <input
                    value={dangerTitle}
                    spellCheck={false}
                    onChange={(event) => setDangerTitle(event.target.value || "")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Ішкі мәтін</label>
                  <div className="mb-2">
                    <BlockTextTools
                      onBold={() => applyDangerTextMarkup("<strong>", "</strong>")}
                      onItalic={() => applyDangerTextMarkup("<em>", "</em>")}
                      onUnderline={() => applyDangerTextMarkup("<u>", "</u>")}
                    />
                  </div>
                  <textarea
                    ref={dangerTextareaRef}
                    value={dangerText}
                    spellCheck={false}
                    onChange={(event) => setDangerText(event.target.value || "")}
                    rows={12}
                    className="min-h-[300px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Түсі</p>
                  <div className="flex flex-wrap gap-2">
                    {dangerColors.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onMouseDown={handleToolbarMouseDown}
                        onClick={() => setDangerColor(item.value)}
                        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${
                          dangerColor === item.value
                            ? "border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100"
                            : "border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <span className="h-4 w-4 rounded-full" style={{ background: item.preview }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div ref={termMenuRef} className="relative z-10">
          <button
            type="button"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => {
              rememberSelection();
              selectedTermBlockRef.current = null;
              selectedTermGroupBlockRef.current = null;
              setIsTermMenuOpen((current) => !current);
              setIsDangerMenuOpen(false);
              setIsColorMenuOpen(false);
              setIsColorBoxMenuOpen(false);
              setIsTableMenuOpen(false);
              setIsLinkMenuOpen(false);
              setIsEmojiMenuOpen(false);
            }}
            className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
            aria-label="Термин блогын қосу"
          >
            <BookType className="h-4 w-4" />
            {tooltip("Термин блогын қосу")}
          </button>

          {isTermMenuOpen ? (
            <div className="absolute left-0 top-12 z-40 w-[26rem] max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pr-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Термин блогын баптау</p>
                {isEditingTermGroup || isEditingSingleTerm ? (
                  <button
                    type="button"
                    onMouseDown={handleToolbarMouseDown}
                    onClick={isEditingTermGroup ? insertTermGroupBlock : insertTermBlock}
                    className="rounded-xl bg-sky-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                  >
                    Сақтау
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={insertTermGroupBlock}
                      className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 transition hover:bg-sky-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
                    >
                      Топты қою
                    </button>
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={insertTermBlock}
                      className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                    >
                      Бір термин қою
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <CollapseSection title="Бір термин" isOpen={isSingleTermSectionOpen} onToggle={() => setIsSingleTermSectionOpen((current) => !current)}>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Термин атауы</label>
                  <input
                    value={termTitle}
                    spellCheck={false}
                    onChange={(event) => setTermTitle(event.target.value || "")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Түсіндірмесі</label>
                  <div className="mb-2">
                    <BlockTextTools
                      onBold={() => applyTermTextMarkup("<strong>", "</strong>")}
                      onItalic={() => applyTermTextMarkup("<em>", "</em>")}
                      onUnderline={() => applyTermTextMarkup("<u>", "</u>")}
                    />
                  </div>
                  <textarea
                    ref={termTextareaRef}
                    value={termText}
                    spellCheck={false}
                    onChange={(event) => setTermText(event.target.value || "")}
                    rows={12}
                    className="min-h-[300px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </div>
                </CollapseSection>

                <CollapseSection title="Топталған терминдер" isOpen={isTermGroupSectionOpen} onToggle={() => setIsTermGroupSectionOpen((current) => !current)}>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3 dark:border-cyan-500/20 dark:bg-cyan-500/10">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Топталған терминдер</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                    Бірнеше терминді бір дизайнда көрсету үшін әр жолға: Термин — түсіндірме деп жазыңыз.
                  </p>
                  <label className="mt-3 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Ортақ атауы</label>
                  <input
                    value={termGroupTitle}
                    spellCheck={false}
                    onChange={(event) => setTermGroupTitle(event.target.value || "")}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                  <div className="mt-3 space-y-3">
                    {termGroupItems.map((item, index) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">Термин {index + 1}</p>
                          <button
                            type="button"
                            onMouseDown={handleToolbarMouseDown}
                            onClick={() => removeTermGroupItem(item.id)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                          >
                            Өшіру
                          </button>
                        </div>
                        <input
                          value={item.title}
                          spellCheck={false}
                          onChange={(event) => updateTermGroupItem(item.id, { title: event.target.value || "" })}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          placeholder="Термин атауы"
                        />
                        <div className="mt-2">
                          <BlockTextTools
                            onBold={() => applyTermGroupItemMarkup(item.id, document.getElementById(`term-group-body-${item.id}`) as HTMLTextAreaElement | null, "<strong>", "</strong>")}
                            onItalic={() => applyTermGroupItemMarkup(item.id, document.getElementById(`term-group-body-${item.id}`) as HTMLTextAreaElement | null, "<em>", "</em>")}
                            onUnderline={() => applyTermGroupItemMarkup(item.id, document.getElementById(`term-group-body-${item.id}`) as HTMLTextAreaElement | null, "<u>", "</u>")}
                          />
                        </div>
                        <textarea
                          id={`term-group-body-${item.id}`}
                          value={item.body}
                          spellCheck={false}
                          onChange={(event) => updateTermGroupItem(item.id, { body: event.target.value || "" })}
                          rows={9}
                          className="mt-2 min-h-[220px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          placeholder="Түсіндірмесі"
                        />
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="mt-3 max-w-full rounded-xl shadow-sm"
                            style={{
                              width: `min(100%, ${Math.max(30, Number(item.imageWidth) || 180)}px)`,
                              height: Math.max(0, Number(item.imageHeight) || 0) ? `${Math.max(30, Number(item.imageHeight) || 0)}px` : "auto",
                              objectFit: Math.max(0, Number(item.imageHeight) || 0) ? "contain" : undefined
                            }}
                          />
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900">
                            Фото
                            <input type="file" accept="image/*" className="hidden" onChange={(event) => handleTermGroupImageUpload(item.id, event)} />
                          </label>
                          <button
                            type="button"
                            onMouseDown={handleToolbarMouseDown}
                            onClick={() => updateTermGroupItem(item.id, { image: "" })}
                            className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          >
                            Фотоны өшіру
                          </button>
                          <input
                            value={item.imageWidth}
                            onChange={(event) => updateTermGroupItem(item.id, { imageWidth: event.target.value })}
                            className="h-9 w-20 rounded-xl border border-slate-200 px-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            placeholder="Ені"
                          />
                          <input
                            value={item.imageHeight}
                            onChange={(event) => updateTermGroupItem(item.id, { imageHeight: event.target.value })}
                            className="h-9 w-20 rounded-xl border border-slate-200 px-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            placeholder="Биіктігі"
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {[
                            { value: "top", label: "Жоғары" },
                            { value: "left", label: "Сол" },
                            { value: "right", label: "Оң" }
                          ].map((align) => (
                            <button
                              key={`${item.id}-${align.value}`}
                              type="button"
                              onMouseDown={handleToolbarMouseDown}
                              onClick={() => updateTermGroupItem(item.id, { imageAlign: align.value as TermImageAlign })}
                              className={`rounded-xl border px-2 py-2 text-xs transition ${
                                item.imageAlign === align.value
                                  ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200"
                                  : "border-slate-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                              }`}
                            >
                              {align.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => setTermGroupItems((items) => [...items, createTermGroupItem()])}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-sky-800 shadow-sm transition hover:bg-sky-100 dark:bg-zinc-950 dark:text-cyan-200"
                    >
                      Термин қосу
                    </button>
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={mergeVisibleTermBlocks}
                      className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-medium text-sky-800 shadow-sm transition hover:bg-sky-100 dark:border-cyan-500/30 dark:bg-zinc-950 dark:text-cyan-200"
                    >
                      Көрініп тұрған терминдерді біріктіру
                    </button>
                  </div>
                </div>
                </CollapseSection>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Түсі</p>
                  <div className="flex flex-wrap gap-2">
                    {dangerColors.map((item) => (
                      <button
                        key={`term-${item.value}`}
                        type="button"
                        onMouseDown={handleToolbarMouseDown}
                        onClick={() => setTermColor(item.value)}
                        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${
                          termColor === item.value
                            ? "border-slate-900 text-slate-900 dark:border-zinc-100 dark:text-zinc-100"
                            : "border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        <span className="h-4 w-4 rounded-full" style={{ background: item.preview }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Артқы фоны</p>
                  <div className="flex flex-wrap gap-2">
                    {backgroundColors.map((color) => (
                      <button
                        key={`term-bg-${color}`}
                        type="button"
                        onMouseDown={handleToolbarMouseDown}
                        onClick={() => {
                          setTermBackgroundColor(color);
                          setTermSurface(color === "transparent" ? "transparent" : color === "#ffffff" ? "white" : "default");
                        }}
                        className={`relative h-9 w-9 rounded-full border shadow-sm transition hover:scale-105 ${
                          termBackgroundColor === color ? "border-slate-950 ring-2 ring-sky-200 dark:border-zinc-50" : "border-slate-200 dark:border-zinc-700"
                        }`}
                        style={{
                          background:
                            color === "transparent"
                              ? "linear-gradient(45deg, #f8fafc 25%, #cbd5e1 25%, #cbd5e1 50%, #f8fafc 50%, #f8fafc 75%, #cbd5e1 75%, #cbd5e1 100%)"
                              : color,
                          backgroundSize: color === "transparent" ? "12px 12px" : undefined
                        }}
                        aria-label={color === "transparent" ? "Мөлдір фон" : color}
                      >
                        {color === "transparent" ? <span className="absolute inset-0 grid place-items-center text-sm font-black text-slate-700">&times;</span> : null}
                      </button>
                    ))}
                  </div>
                  <input
                    type="color"
                    value={termBackgroundColor === "transparent" ? "#f8fafc" : termBackgroundColor}
                    onChange={(event) => {
                      setTermBackgroundColor(event.target.value || "#f8fafc");
                      setTermSurface("default");
                    }}
                    className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>

                <CollapseSection title="Бір терминнің суреті" isOpen={isTermImageSectionOpen} onToggle={() => setIsTermImageSectionOpen((current) => !current)}>
                <div className="rounded-2xl border border-slate-200 p-3 dark:border-zinc-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={openTermImagePicker}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900"
                    >
                      Фото жүктеу
                    </button>
                    <button
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => setTermImage("")}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Фотоны өшіру
                    </button>
                  </div>

                  {termImage ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                      <img
                        src={termImage}
                        alt=""
                        className="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md"
                        style={{
                          width: `min(100%, ${Math.max(30, Number(termImageWidth) || 220)}px)`,
                          height: Math.max(0, Number(termImageHeight) || 0) ? `${Math.max(30, Number(termImageHeight) || 0)}px` : "auto",
                          objectFit: Math.max(0, Number(termImageHeight) || 0) ? "contain" : undefined
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Фото орны</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "top", label: "Жоғарыда" },
                        { value: "left", label: "Сол жақта" },
                        { value: "right", label: "Оң жақта" }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onMouseDown={handleToolbarMouseDown}
                          onClick={() => setTermImageAlign(item.value as TermImageAlign)}
                          className={`rounded-xl border px-3 py-2 text-sm transition ${
                            termImageAlign === item.value
                              ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200"
                              : "border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-slate-700 dark:text-zinc-200">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Фото ені</span>
                      <input
                        type="number"
                        min="20"
                        value={termImageWidth}
                        onKeyDown={(event) => handleControlKeyDown(event)}
                        onChange={(event) => setTermImageWidth(event.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                        placeholder="220"
                      />
                    </label>
                    <label className="text-sm text-slate-700 dark:text-zinc-200">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Фото биіктігі</span>
                      <input
                        type="number"
                        min="0"
                        value={termImageHeight}
                        onKeyDown={(event) => handleControlKeyDown(event)}
                        onChange={(event) => setTermImageHeight(event.target.value || "")}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                        placeholder="Авто"
                      />
                    </label>
                  </div>

                  <label className="mt-3 flex items-center gap-3 text-sm text-transparent">
                    <input
                      type="checkbox"
                      checked={termSurface === "transparent"}
                      onChange={(event) => {
                        setTermSurface(event.target.checked ? "transparent" : "default");
                        setTermBackgroundColor(event.target.checked ? "transparent" : "#f8fafc");
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-slate-700 dark:text-zinc-200">Артқы фонды мөлдір ету</span>
                  </label>
                </div>
                </CollapseSection>
              </div>
            </div>
          ) : null}
        </div>

        <div ref={colorBoxMenuRef} className="relative z-10">
          <button
            type="button"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => {
              rememberSelection();
              setIsColorBoxMenuOpen((current) => !current);
              setIsTermMenuOpen(false);
              setIsDangerMenuOpen(false);
              setIsColorMenuOpen(false);
              setIsTableMenuOpen(false);
              setIsLinkMenuOpen(false);
              setIsEmojiMenuOpen(false);
            }}
            className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
            aria-label="Боялған блок қосу"
          >
            <PaintBucket className="h-4 w-4" />
            {tooltip("Боялған блок қосу")}
          </button>

          {isColorBoxMenuOpen ? (
            <div className="absolute left-0 top-12 z-40 w-[24rem] max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pr-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Жай боялған блок</p>
                <button
                  type="button"
                  onMouseDown={handleToolbarMouseDown}
                  onClick={insertColorBox}
                  className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                >
                  Қою
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <BlockTextTools
                    onBold={() => applyColorBoxTextMarkup("<strong>", "</strong>")}
                    onItalic={() => applyColorBoxTextMarkup("<em>", "</em>")}
                    onUnderline={() => applyColorBoxTextMarkup("<u>", "</u>")}
                  />
                </div>
                <textarea
                  ref={colorBoxTextareaRef}
                  value={colorBoxText}
                  spellCheck={false}
                  onChange={(event) => setColorBoxText(event.target.value || "")}
                  rows={12}
                  className="min-h-[300px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  placeholder="Блок мәтінін жазыңыз"
                />

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Артқы түсі</p>
                  <div className="flex flex-wrap gap-2">
                    {backgroundColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onMouseDown={handleToolbarMouseDown}
                        onClick={() => setColorBoxColor(color)}
                        className={`relative h-9 w-9 rounded-full border shadow-sm transition hover:scale-105 ${
                          colorBoxColor === color ? "border-slate-950 ring-2 ring-sky-200 dark:border-zinc-50" : "border-slate-200 dark:border-zinc-700"
                        }`}
                        style={{
                          background:
                            color === "transparent"
                              ? "linear-gradient(45deg, #f8fafc 25%, #cbd5e1 25%, #cbd5e1 50%, #f8fafc 50%, #f8fafc 75%, #cbd5e1 75%, #cbd5e1 100%)"
                              : color,
                          backgroundSize: color === "transparent" ? "12px 12px" : undefined
                        }}
                        aria-label={color}
                      >
                        {color === "transparent" ? <span className="absolute inset-0 grid place-items-center text-sm font-black text-slate-700">&times;</span> : null}
                      </button>
                    ))}
                  </div>
                  <input
                    type="color"
                    value={colorBoxColor}
                    onChange={(event) => setColorBoxColor(event.target.value || "#ede5c3")}
                    className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Мәтін түсі</p>
                  <div className="flex flex-wrap gap-2">
                    {textColors.map((color) => (
                      <button
                        key={`box-text-${color}`}
                        type="button"
                        onMouseDown={handleToolbarMouseDown}
                        onClick={() => setColorBoxTextColor(color)}
                        className={`h-9 w-9 rounded-full border shadow-sm transition hover:scale-105 ${
                          colorBoxTextColor === color ? "border-slate-950 ring-2 ring-sky-200 dark:border-zinc-50" : "border-slate-200 dark:border-zinc-700"
                        }`}
                        style={{ background: color }}
                        aria-label={color}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={colorBoxTextColor}
                    onChange={(event) => setColorBoxTextColor(event.target.value || "#0f172a")}
                    className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div ref={tableMenuRef} className="relative z-10">
          <button
            type="button"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => {
              rememberSelection();
              setIsTableMenuOpen((current) => !current);
              setIsTermMenuOpen(false);
              setIsDangerMenuOpen(false);
              setIsColorMenuOpen(false);
              setIsColorBoxMenuOpen(false);
              setIsLinkMenuOpen(false);
              setIsEmojiMenuOpen(false);
            }}
            className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
            aria-label="Кесте кірістіру"
          >
            <Table2 className="h-4 w-4" />
            {tooltip("Кесте кірістіру")}
          </button>

          {isTableMenuOpen ? (
            <div className="absolute left-0 top-12 z-40 w-[24rem] max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pr-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Кесте құрастыру</p>
                <button
                  type="button"
                  onMouseDown={handleToolbarMouseDown}
                  onClick={insertTable}
                  className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                >
                  Қою
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { value: "table", label: "Кесте" },
                  { value: "tree", label: "Схема" }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onMouseDown={handleToolbarMouseDown}
                    onClick={() => setTableMode(item.value as TableMode)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      tableMode === item.value
                        ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200"
                        : "border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {tableMode === "table" ? (
                <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700 dark:text-zinc-200">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Жол саны</span>
                  <input
                    type="number"
                    min="1"
                    value={tableRows}
                    onChange={(event) => setTableRows(event.target.value || "1")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </label>
                <label className="text-sm text-slate-700 dark:text-zinc-200">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Баған саны</span>
                  <input
                    type="number"
                    min="1"
                    value={tableColumns}
                    onChange={(event) => setTableColumns(event.target.value || "1")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </label>
                <label className="text-sm text-slate-700 dark:text-zinc-200">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Өлшемі (%)</span>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    value={tableWidthPercent}
                    onChange={(event) => setTableWidthPercent(event.target.value || "100")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm text-slate-700 dark:text-zinc-200">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Баған атаулары</span>
                <input
                  value={tableHeaders}
                  spellCheck={false}
                  onChange={(event) => setTableHeaders(event.target.value || "")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                  placeholder="Атауы, Сипаттамасы, Мысалы"
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700 dark:text-zinc-200">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Бас түсі</span>
                  <input
                    type="color"
                    value={tableHeaderColor}
                    onChange={(event) => setTableHeaderColor(event.target.value || "#dbeafe")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="text-sm text-slate-700 dark:text-zinc-200">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Ұяшық түсі</span>
                  <input
                    type="color"
                    value={tableBodyColor}
                    onChange={(event) => setTableBodyColor(event.target.value || "#ffffff")}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm text-slate-700 dark:text-zinc-200">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Шекара түсі</span>
                <input
                  type="color"
                  value={tableBorderColor}
                  onChange={(event) => setTableBorderColor(event.target.value || "#cbd5e1")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
                </>
              ) : (
                <div className="mt-4 space-y-4">
                  <label className="block text-sm text-slate-700 dark:text-zinc-200">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Негізгі блок</span>
                    <input
                      value={treeRoot}
                      spellCheck={false}
                      onChange={(event) => setTreeRoot(event.target.value || "")}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-zinc-200">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Ағаш тармақтары</span>
                    <textarea
                      value={treeChildren}
                      spellCheck={false}
                      onChange={(event) => setTreeChildren(event.target.value || "")}
                      rows={6}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                      placeholder="Әр жол жаңа тармақ. Ішкі деңгей үшін > белгісін қолданыңыз"
                    />
                    <span className="mt-2 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
                      Мысал: Мектеп.doc &gt; Файлдың аты — Мектеп. Бір жол қосқан сайын схема кеңейеді.
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm text-slate-700 dark:text-zinc-200">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Блок түсі</span>
                      <input
                        type="color"
                        value={treeBoxColor}
                        onChange={(event) => setTreeBoxColor(event.target.value || "#dbeafe")}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="text-sm text-slate-700 dark:text-zinc-200">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Сызық түсі</span>
                      <input
                        type="color"
                        value={treeLineColor}
                        onChange={(event) => setTreeLineColor(event.target.value || "#93c5fd")}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="text-sm text-slate-700 dark:text-zinc-200">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Мәтін түсі</span>
                      <input
                        type="color"
                        value={treeTextColor}
                        onChange={(event) => setTreeTextColor(event.target.value || "#0f172a")}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 outline-none dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="text-sm text-slate-700 dark:text-zinc-200">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">Өлшемі (%)</span>
                      <input
                        type="number"
                        min="45"
                        max="120"
                        value={treeScale}
                        onChange={(event) => setTreeScale(event.target.value || "80")}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div ref={emojiMenuRef} className="relative z-10">
          <button
            type="button"
            onMouseDown={handleToolbarMouseDown}
            onClick={openEmojiMenu}
            className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
            aria-label="Эмодзи қосу"
          >
            <SmilePlus className="h-4 w-4" />
            {tooltip("Эмодзи қосу")}
          </button>

          {isEmojiMenuOpen ? (
            <div className="absolute left-0 top-12 z-40 max-h-[78vh] w-[22rem] overflow-y-auto rounded-panel border border-zinc-700 bg-zinc-900 p-3 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Эмодзи және басқа элементтер</p>
                <div className="rounded-full bg-zinc-800 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  Жинақ
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-lg">
                {["😊", "GIF", "❤️", "✨", "📎", "🖼️"].map((icon) => (
                  <div key={icon} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-base">
                    {icon}
                  </div>
                ))}
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
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-100">Эмодзи</p>
                <div className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">Таңдау</div>
              </div>
              <div className="mt-3 grid grid-cols-6 gap-2">
                {emojiOptions
                  .filter((emoji) => {
                    const term = emojiSearch.trim().toLowerCase();
                    return !term || emoji.label.includes(term) || emoji.symbol.includes(term);
                  })
                  .map((emoji, index) => (
                  <button
                    key={`${emoji.symbol}-${index}`}
                    type="button"
                    onMouseDown={handleToolbarMouseDown}
                    onClick={() => insertEmoji(emoji.symbol)}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 text-2xl transition hover:border-sky-400 hover:bg-zinc-700"
                    title={emoji.label}
                  >
                    {emoji.symbol}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-100">GIF</p>
                  <p className="mt-1 text-xs text-zinc-400">Курсор тұрған жерге бірден кірістіріледі</p>
                </div>
                <div className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">GIF</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {gifOptions
                  .filter((gif) => {
                    const term = emojiSearch.trim().toLowerCase();
                    return !term || gif.label.includes(term);
                  })
                  .map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => insertGif(gif.src)}
                      className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-800 text-left transition hover:border-sky-400 hover:bg-zinc-700"
                      title={gif.label}
                    >
                      <img src={gif.src} alt={gif.label} className="h-24 w-full object-cover" />
                      <div className="px-3 py-2 text-xs text-zinc-200">{gif.label}</div>
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </div>

        {tools.map((tool, index) => {
          const Icon = tool.icon;
          if (tool.label === "Эмодзи қосу") {
            return null;
          }

          return (
            <button
              key={`${tool.label}-${index}`}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onMouseDown={handleToolbarMouseDown}
              onClick={tool.action}
              className="group relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500/50 dark:hover:bg-zinc-900 dark:hover:text-cyan-300"
            >
              <Icon className="h-4 w-4" />
              {tooltip(tool.label)}
            </button>
          );
        })}
      </div>

      {isLinkMenuOpen ? (
        <div ref={linkMenuRef} className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
                <input
                  value={linkLabel}
                  spellCheck={false}
                  onKeyDown={(event) => handleControlKeyDown(event, insertLink)}
                  onChange={(event) => setLinkLabel(event.target.value || "")}
              placeholder="Сілтеме атауы"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
                <input
                  value={linkUrl}
                  spellCheck={false}
                  onKeyDown={(event) => handleControlKeyDown(event, insertLink)}
                  onChange={(event) => setLinkUrl(event.target.value || "")}
              placeholder="Сілтеме мекенжайы (URL)"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
            <button
              type="button"
              onClick={insertLink}
              className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
            >
              Қосу
            </button>
          </div>
        </div>
      ) : null}

      {hasSelectedImage ? (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto_auto_auto]">
            <input
              value={imageWidth}
              spellCheck={false}
              onKeyDown={(event) => handleControlKeyDown(event, updateSelectedImage)}
              onChange={(event) => {
                const nextValue = event.target.value;
                setImageWidth(nextValue);
                patchSelectedImage({ width: nextValue });
              }}
              placeholder="Ені"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
            <input
              value={imageHeight}
              spellCheck={false}
              onKeyDown={(event) => handleControlKeyDown(event, updateSelectedImage)}
              onChange={(event) => {
                const nextValue = event.target.value;
                setImageHeight(nextValue);
                patchSelectedImage({ height: nextValue });
              }}
              placeholder="Биіктігі"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
            />
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "left", label: "Сол" },
                { value: "center", label: "Орта" },
                { value: "right", label: "Оң" }
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    const nextAlign = item.value as ContentImageAlign;
                    setImageAlign(nextAlign);
                    patchSelectedImage({ align: nextAlign });
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    imageAlign === item.value
                      ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-200"
                      : "border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={updateSelectedImage}
              className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
            >
              Қолдану
            </button>
            <button
              type="button"
              onClick={openCropForSelectedImage}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50 dark:border-cyan-500/40 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
            >
              <Crop className="h-4 w-4" /> Қию
            </button>
            <button
              type="button"
              onClick={removeSelectedImage}
              className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              Өшіру
            </button>
          </div>
          <input
            value={imageCaption}
            spellCheck={false}
            onKeyDown={(event) => handleControlKeyDown(event, updateSelectedImage)}
            onChange={(event) => {
              const nextValue = event.target.value || "";
              setImageCaption(nextValue);
              patchSelectedImage({ caption: nextValue });
            }}
            placeholder="Сурет астындағы сипаттама: 3-сурет. Анықтамасы"
            className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-cyan-500/50"
          />
        </div>
      ) : null}

      {cropState ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Суретті қию</p>
              <button
                type="button"
                onClick={() => setCropState(null)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Жабу
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-zinc-900">
              <div ref={cropAreaRef} className="relative mx-auto w-fit select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cropState.src}
                  alt=""
                  draggable={false}
                  className="block max-h-[58vh] w-auto max-w-full rounded-xl"
                />
                <div
                  onMouseDown={(event) => startCropDrag(event, "move")}
                  className="absolute cursor-move border-2 border-sky-400"
                  style={{
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                    width: `${cropRect.width * 100}%`,
                    height: `${cropRect.height * 100}%`,
                    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)"
                  }}
                >
                  {([
                    ["nw", "-left-1.5 -top-1.5 cursor-nwse-resize"],
                    ["ne", "-right-1.5 -top-1.5 cursor-nesw-resize"],
                    ["sw", "-bottom-1.5 -left-1.5 cursor-nesw-resize"],
                    ["se", "-bottom-1.5 -right-1.5 cursor-nwse-resize"]
                  ] as Array<["nw" | "ne" | "sw" | "se", string]>).map(([corner, position]) => (
                    <span
                      key={corner}
                      onMouseDown={(event) => startCropDrag(event, corner)}
                      className={`absolute h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow ${position}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
              {cropError ? (
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{cropError}</span>
              ) : (
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Тіктөртбұрышты сүйреңіз, бұрыштарынан өлшемін өзгертіңіз.
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCropState(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Болдырмау
                </button>
                <button
                  type="button"
                  onClick={() => void applyCrop()}
                  disabled={isCropSaving}
                  className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50 dark:bg-cyan-400 dark:text-zinc-950 dark:hover:bg-cyan-300"
                >
                  {isCropSaving ? "Қиылуда..." : "Қию"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        ref={editorRef}
        contentEditable
        data-juz-editor="true"
        spellCheck={false}
        suppressContentEditableWarning
        onInput={() => {
          syncContent();
          rememberSelection();
        }}
        onKeyDown={handleEditorKeyDown}
        onKeyUp={rememberSelection}
        onMouseDown={handleEditorMouseDown}
        onMouseUp={rememberSelection}
        onClick={handleEditorClick}
        onDragStart={handleEditorDragStart}
        onDragOver={handleEditorDragOver}
        onDrop={handleEditorDrop}
        onDragEnd={handleEditorDragEnd}
        onFocus={() => {
          isFocusedRef.current = true;
          const selection = window.getSelection();
          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
          if (!range || !editorRef.current?.contains(range.commonAncestorContainer)) {
            placeCaretAtEditorEnd();
            return;
          }
          rememberSelection();
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          syncContent();
        }}
        className={`${heightClass ?? "min-h-[420px] max-h-[58vh]"} ${
          layout === "side" ? "min-w-0 flex-1" : ""
        } overflow-y-auto px-4 py-4 text-base leading-8 text-slate-800 outline-none [&_p[data-indent='true']]:indent-8 dark:text-zinc-100 ${editorClassName ?? ""}`}
      />
    </div>
  );
});

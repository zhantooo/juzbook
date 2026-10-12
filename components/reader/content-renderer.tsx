import { Fragment } from "react";
import type { CSSProperties } from "react";
import { AlertTriangle, BookType } from "lucide-react";
import type { HighlightRecord } from "@/lib/types";
import { sanitizeRichText } from "@/lib/sanitize";

type TermImageAlign = "top" | "left" | "right";
type TermSurface = "default" | "white" | "transparent";
type TermGroupItem = {
  title: string;
  body: string;
  image: string;
  imageWidth: string;
  imageHeight: string;
  imageAlign: TermImageAlign;
};

type TreeNode = {
  title: string;
  children: TreeNode[];
};

type ParsedBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "html"; html: string }
  | { type: "danger"; text: string; bodyHtml?: string; title?: string; color?: string }
  | { type: "danger-right"; text: string; bodyHtml?: string; title?: string; color?: string }
  | { type: "colorbox"; text: string; bodyHtml?: string; color?: string; textColor?: string }
  | { type: "tree"; html: string }
  | {
      type: "term";
      text: string;
      bodyHtml?: string;
      title?: string;
      color?: string;
      image?: string;
      imageAlign?: TermImageAlign;
      imageWidth?: string;
      imageHeight?: string;
      surface?: TermSurface;
      backgroundColor?: string;
    }
  | {
      type: "termgroup";
      text: string;
      bodyHtml?: string;
      title?: string;
      color?: string;
      backgroundColor?: string;
      items?: TermGroupItem[];
    };

const defaultDangerTitle = "Маңызды, қарап ал!";

const treeColorPresets: Record<string, { box: string; line: string; text: string }> = {
  red: { box: "#fee2e2", line: "#f87171", text: "#7f1d1d" },
  yellow: { box: "#fef3c7", line: "#f59e0b", text: "#78350f" },
  blue: { box: "#dbeafe", line: "#93c5fd", text: "#0f172a" },
  green: { box: "#dcfce7", line: "#34d399", text: "#064e3b" },
  violet: { box: "#ede9fe", line: "#a78bfa", text: "#2e1065" }
};

const colorPresets: Record<
  string,
  {
    container: string;
    icon: string;
  }
> = {
  red: {
    container: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
  },
  yellow: {
    container: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
  },
  blue: {
    container: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
  },
  green: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
  },
  violet: {
    container: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
  }
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtml(value: string) {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim()
  );
}

function createTreeNode(title: string): TreeNode {
  return { title, children: [] };
}

function buildTreeFromLines(rootTitle: string, source: string) {
  const root = createTreeNode(rootTitle.trim() || "Негізгі ұғым");
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.length ? lines : ["Файлдың аты — Мектеп.", ".doc файл кеңейтімі файлды жасаған программа тағайындайды"]) {
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
  const boxWidth = Math.round(260 * scale);
  const boxHeight = Math.round(108 * scale);
  const gapX = Math.round(42 * scale);
  const gapY = Math.round(104 * scale);
  const padding = Math.round(36 * scale);
  const fontSize = Math.max(10, Math.round(13 * scale));
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

  function layout(node: TreeNode, left: number, depth: number) {
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
  }

  const width = Math.ceil(measure(root) + padding * 2);
  layout(root, padding, 0);
  const height = Math.ceil(padding * 2 + (maxDepth + 1) * boxHeight + maxDepth * gapY);
  const lineSvg = lines
    .map((line) => {
      const midY = line.fromY + (line.toY - line.fromY) / 2;
      return `<path d="M ${line.fromX} ${line.fromY} V ${midY} H ${line.toX} V ${line.toY}" fill="none" stroke="${escapeAttribute(options.lineColor)}" stroke-width="${Math.max(1.5, 2 * scale)}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join("");
  const nodeSvg = positioned
    .map((node) => {
      const textLines = wrapSvgText(node.title, Math.max(10, Math.floor(16 / scale)));
      const lineHeight = Math.round(fontSize * 1.25);
      const startY = node.y + boxHeight / 2 - ((textLines.length - 1) * lineHeight) / 2 + fontSize / 3;

      return `
        <rect x="${node.x}" y="${node.y}" width="${boxWidth}" height="${boxHeight}" rx="${radius}" fill="${escapeAttribute(options.boxColor)}" stroke="${escapeAttribute(options.lineColor)}" stroke-width="${Math.max(1, 1.5 * scale)}" filter="url(#readerTreeShadow)" />
        <text x="${node.x + boxWidth / 2}" y="${startY}" text-anchor="middle" fill="${escapeAttribute(options.textColor)}" font-size="${fontSize}" font-weight="${node.depth === 0 ? 800 : 600}" font-family="var(--font-juz-sans), sans-serif">
          ${textLines.map((line, index) => `<tspan x="${node.x + boxWidth / 2}" dy="${index === 0 ? 0 : lineHeight}">${escapeAttribute(line)}</tspan>`).join("")}
        </text>
      `;
    })
    .join("");

  return `
    <div data-juz-tree="true" class="my-8 w-full overflow-x-auto rounded-3xl border border-slate-700 bg-white p-5 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block; max-width:100%; height:auto; margin:0 auto;">
        <defs>
          <filter id="readerTreeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.10" />
          </filter>
        </defs>
        ${lineSvg}
        ${nodeSvg}
      </svg>
    </div>
  `;
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function removeLeakedAttributeDuplicate(value: string) {
  const decoded = decodeEntities(value || "").trim();
  const leakMarkers = ['">', "&quot;>", "&quot;&gt;", '"&gt;'];

  for (const marker of leakMarkers) {
    const markerIndex = decoded.indexOf(marker);
    if (markerIndex < 0) {
      continue;
    }

    const before = decoded.slice(0, markerIndex).trim();
    const after = decoded.slice(markerIndex + marker.length).trim();
    const beforeText = normalizeComparableText(stripHtml(before));
    const afterText = normalizeComparableText(stripHtml(after));
    const comparablePrefix = beforeText.slice(0, 36);

    if (beforeText && afterText && comparablePrefix && afterText.startsWith(comparablePrefix)) {
      return before;
    }

    if (!beforeText && afterText) {
      return after;
    }
  }

  return decoded;
}

function normalizeCalloutBodyHtml(value: string, fallback: string) {
  const cleaned = removeLeakedAttributeDuplicate(value || fallback);
  return sanitizeRichText(cleaned);
}

function parseShortcodeAttributes(source: string) {
  const attributes: Record<string, string> = {};

  for (const match of source.matchAll(/(\w+)="([^"]*)"/g)) {
    const key = match[1]?.trim().toLowerCase();
    const value = decodeEntities(match[2] ?? "").trim();

    if (key) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function createTermGroupItem(title = "Термин", body = "Түсіндірме", image = "", imageWidth = "180", imageHeight = "", imageAlign: TermImageAlign = "top"): TermGroupItem {
  return { title, body, image, imageWidth, imageHeight, imageAlign };
}

function parseTermGroupItemsFromText(source: string): TermGroupItem[] {
  return stripHtml(source)
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

  return parseTermGroupItemsFromText(fallback);
}

function normalizeShortcodes(content: string) {
  return content.replace(/\[(danger-right|rightdanger|danger|termgroup|term|colorbox|tree)([^\]]*)\]([\s\S]*?)\[\/\1\]/gi, (_, rawType: string, rawAttributes: string, body: string) => {
    const type = rawType.toLowerCase();
    const attributes = parseShortcodeAttributes(rawAttributes || "");

    const attrPairs = [
      `data-juz-block="${type}"`,
      attributes.title ? `data-title="${escapeAttribute(attributes.title)}"` : "",
      attributes.color ? `data-color="${escapeAttribute(attributes.color)}"` : "",
      attributes.image ? `data-image="${escapeAttribute(attributes.image)}"` : "",
      attributes.imagealign ? `data-image-align="${escapeAttribute(attributes.imagealign)}"` : "",
      attributes.imagewidth ? `data-image-width="${escapeAttribute(attributes.imagewidth)}"` : "",
      attributes.imageheight ? `data-image-height="${escapeAttribute(attributes.imageheight)}"` : "",
      attributes.surface ? `data-surface="${escapeAttribute(attributes.surface)}"` : "",
      attributes.background ? `data-background-color="${escapeAttribute(attributes.background)}"` : "",
      attributes.bg ? `data-background-color="${escapeAttribute(attributes.bg)}"` : "",
      attributes.textcolor ? `data-text-color="${escapeAttribute(attributes.textcolor)}"` : "",
      attributes.boxcolor ? `data-box-color="${escapeAttribute(attributes.boxcolor)}"` : "",
      attributes.linecolor ? `data-line-color="${escapeAttribute(attributes.linecolor)}"` : "",
      attributes.scale ? `data-scale="${escapeAttribute(attributes.scale)}"` : "",
      attributes.items ? `data-items="${escapeAttribute(attributes.items)}"` : "",
      `data-body="${escapeAttribute(decodeEntities(body))}"`
    ]
      .filter(Boolean)
      .join(" ");

    return `<div ${attrPairs}>${body}</div>`;
  });
}

function createCalloutBlock(type: string, attributes: Record<string, string>, text: string): ParsedBlock {
  if (type === "tree") {
    const palette = treeColorPresets[(attributes.color || "blue").trim().toLowerCase()] ?? treeColorPresets.blue;
    const scale = Math.max(45, Math.min(120, Number(attributes.scale) || 80)) / 100;

    return {
      type: "tree",
      html: renderTreeSvg(buildTreeFromLines(attributes.title?.trim() || "Негізгі ұғым", text), {
        boxColor: attributes.boxcolor?.trim() || palette.box,
        lineColor: attributes.linecolor?.trim() || palette.line,
        textColor: attributes.textcolor?.trim() || palette.text,
        scale
      })
    };
  }

  if (type === "colorbox") {
    return {
      type: "colorbox",
      text,
      bodyHtml: normalizeCalloutBodyHtml(attributes.body?.trim() || "", text),
      color: attributes.color?.trim() || COLORBOX_DEFAULT,
      textColor: attributes.textcolor?.trim() || "#0f172a"
    };
  }

  if (type === "term") {
    return {
      type: "term",
      text,
      bodyHtml: normalizeCalloutBodyHtml(attributes.body?.trim() || "", text),
      title: attributes.title?.trim() || undefined,
      color: attributes.color?.trim() || undefined,
      image: attributes.image?.trim() || undefined,
      imageAlign: (attributes.imagealign?.trim().toLowerCase() as TermImageAlign | undefined) || "top",
      imageWidth: attributes.imagewidth?.trim() || undefined,
      imageHeight: attributes.imageheight?.trim() || undefined,
      surface: (attributes.surface?.trim().toLowerCase() as TermSurface | undefined) || "default",
      backgroundColor: attributes.background?.trim() || attributes.bg?.trim() || undefined
    };
  }

  if (type === "termgroup") {
    return {
      type: "termgroup",
      text,
      bodyHtml: normalizeCalloutBodyHtml(attributes.body?.trim() || "", text),
      title: attributes.title?.trim() || "Терминдер",
      color: attributes.color?.trim() || "blue",
      backgroundColor: attributes.background?.trim() || attributes.bg?.trim() || undefined,
      items: decodeTermGroupItemsAttribute(attributes.items?.trim() || "", text)
    };
  }

  return {
    type: type === "rightdanger" || type === "danger-right" ? "danger-right" : "danger",
    text,
    bodyHtml: normalizeCalloutBodyHtml(attributes.body?.trim() || "", text),
    title: attributes.title?.trim() || undefined,
    color: attributes.color?.trim() || undefined
  };
}

function pushShortcodeAwareText(blocks: ParsedBlock[], source: string) {
  const text = source.trim();
  if (!text) {
    return;
  }

  blocks.push({ type: "paragraph", text });
}

function parseDataBlock(htmlSource: string): ParsedBlock | null {
  const blockMatch = htmlSource.match(/^<div\b([^>]*)>([\s\S]*)<\/div>$/i);
  if (!blockMatch) {
    return null;
  }

  const attrsSource = blockMatch[1] ?? "";
  const typeMatch = attrsSource.match(/data-juz-block="([^"]+)"/i);
  if (!typeMatch?.[1]) {
    return null;
  }

  const type = typeMatch[1].trim().toLowerCase();
  if (type === "tree" && /<svg\b/i.test(blockMatch[2] ?? "")) {
    return {
      type: "tree",
      html: htmlSource
        .replace(/<button\b[^>]*data-juz-delete="true"[\s\S]*?<\/button>/gi, "")
        .replace(/contenteditable="[^"]*"/gi, "")
    };
  }

  const attributes: Record<string, string> = {};

  const mappings = [
    ["title", /data-title="([^"]*)"/i],
    ["color", /data-color="([^"]*)"/i],
    ["image", /data-image="([^"]*)"/i],
    ["imagealign", /data-image-align="([^"]*)"/i],
    ["imagewidth", /data-image-width="([^"]*)"/i],
    ["imageheight", /data-image-height="([^"]*)"/i],
    ["surface", /data-surface="([^"]*)"/i],
    ["background", /data-background-color="([^"]*)"/i],
    ["textcolor", /data-text-color="([^"]*)"/i],
    ["boxcolor", /data-box-color="([^"]*)"/i],
    ["linecolor", /data-line-color="([^"]*)"/i],
    ["scale", /data-scale="([^"]*)"/i],
    ["items", /data-items="([^"]*)"/i],
    ["body", /data-body="([^"]*)"/i]
  ] as const;

  for (const [key, pattern] of mappings) {
    const match = attrsSource.match(pattern);
    if (match?.[1]) {
      attributes[key] = decodeEntities(match[1]);
    }
  }

  return createCalloutBlock(type, attributes, attributes.body?.trim() || stripHtml(blockMatch[2] ?? ""));
}

function findMatchingDivEnd(source: string, startIndex: number) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;

  for (const match of source.matchAll(tagPattern)) {
    const tag = match[0] ?? "";
    const index = match.index ?? 0;

    if (index < startIndex) {
      continue;
    }

    if (tag.startsWith("</")) {
      depth -= 1;
    } else {
      depth += 1;
    }

    if (depth === 0) {
      return index + tag.length;
    }
  }

  return source.length;
}

function parseGenericHtmlBlocks(content: string): ParsedBlock[] {
  if (/<(h3|table|thead|tbody|tr|td|th|div|figure|figcaption|p|strong|b|em|i|u|blockquote|ul|ol|img)\b/i.test(content)) {
    return [{ type: "html", html: content }];
  }

  const htmlBlockPattern = /<(h3|p|div|figure|table|blockquote|ul|ol)\b[\s\S]*?<\/\1>|<img\b[^>]*>/gi;
  const blocks: ParsedBlock[] = [];
  let cursor = 0;
  let htmlBuffer = "";

  function flushHtmlBuffer() {
    if (!htmlBuffer.trim()) {
      htmlBuffer = "";
      return;
    }

    blocks.push({ type: "html", html: htmlBuffer });
    htmlBuffer = "";
  }

  for (const match of content.matchAll(htmlBlockPattern)) {
    const index = match.index ?? 0;
    const htmlSource = match[0] ?? "";
    const tagName = htmlSource.match(/^<(\w+)/i)?.[1]?.toLowerCase() ?? "";
    const textBefore = stripHtml(content.slice(cursor, index));

    if (textBefore.trim()) {
      flushHtmlBuffer();
      pushShortcodeAwareText(blocks, textBefore);
    }

    if (tagName === "div") {
      const calloutBlock = parseDataBlock(htmlSource);
      if (calloutBlock) {
        flushHtmlBuffer();
        blocks.push(calloutBlock);
      } else {
        htmlBuffer += htmlSource;
      }
    } else {
      htmlBuffer += htmlSource;
    }

    cursor = index + htmlSource.length;
  }

  flushHtmlBuffer();
  pushShortcodeAwareText(blocks, stripHtml(content.slice(cursor)));

  return blocks.length ? blocks : [{ type: "paragraph", text: stripHtml(content) }];
}

function parseHtmlBlocks(content: string): ParsedBlock[] {
  const dataBlockPattern = /<div\b[^>]*data-juz-block="[^"]+"[^>]*>/gi;
  const blocks: ParsedBlock[] = [];
  let cursor = 0;

  for (const match of content.matchAll(dataBlockPattern)) {
    const index = match.index ?? 0;
    if (index < cursor) {
      continue;
    }

    blocks.push(...parseGenericHtmlBlocks(content.slice(cursor, index)));

    const end = findMatchingDivEnd(content, index);
    const htmlSource = content.slice(index, end);
    const calloutBlock = parseDataBlock(htmlSource);

    if (calloutBlock) {
      blocks.push(calloutBlock);
    } else {
      blocks.push({ type: "html", html: htmlSource });
    }

    cursor = end;
  }

  blocks.push(...parseGenericHtmlBlocks(content.slice(cursor)));
  return blocks.length ? blocks : [{ type: "paragraph", text: stripHtml(content) }];
}

function dedupeCalloutText(blocks: ParsedBlock[]) {
  const filtered: ParsedBlock[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const current = blocks[index];

    if (
      current.type === "term" ||
      current.type === "termgroup" ||
      current.type === "danger" ||
      current.type === "danger-right"
    ) {
      filtered.push(current);

      const title = normalizeComparableText(current.title || (current.type === "term" || current.type === "termgroup" ? "Термин" : defaultDangerTitle));
      const body = normalizeComparableText(current.text || "");
      const combined = normalizeComparableText(`${title} ${body}`);

      let cursor = index + 1;

      while (cursor < blocks.length) {
        const next = blocks[cursor];
        if (next.type !== "paragraph") {
          break;
        }

        const nextText = normalizeComparableText(next.text);
        if (!nextText) {
          cursor += 1;
          continue;
        }

        if (nextText === title || nextText === body || nextText === combined) {
          cursor += 1;
          index = cursor - 1;
          continue;
        }

        break;
      }

      continue;
    }

    filtered.push(current);
  }

  return filtered;
}

function parseBlocks(content: string): ParsedBlock[] {
  const normalizedContent = normalizeShortcodes(content).replace(/<p\b[^>]*>\s*(<div\b[^>]*data-juz-block="[^"]+"[\s\S]*?<\/div>)\s*<\/p>/gi, "$1");

  if (/<(h3|table|thead|tbody|tr|td|th|div|figure|figcaption|p|strong|b|em|i|u|blockquote|ul|ol|img)\b/i.test(normalizedContent)) {
    return dedupeCalloutText(parseHtmlBlocks(normalizedContent));
  }

  const normalized = decodeEntities(
    normalizedContent
      .replace(/<\/p>\s*<p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?p>/gi, "")
      .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
      .replace(/<[^>]+>/g, "")
  );

  return dedupeCalloutText(
    normalized
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((text) => ({ type: "paragraph", text }) as ParsedBlock)
  );
}

function getHighlightStyle(color: HighlightRecord["color"]) {
  return {
    backgroundColor: color
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createFlexibleTextRegExp(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return new RegExp(escapeRegExp(normalized).replace(/\s+/g, "\\s+"), "i");
}

function getHighlightStyleText(color: HighlightRecord["color"]) {
  return `background-color:${color};border-radius:0.25rem;padding-left:0.25rem;padding-right:0.25rem;cursor:pointer;box-decoration-break:clone;-webkit-box-decoration-break:clone;`;
}

function upsertHtmlAttribute(attributes: string, name: string, value: string) {
  const pattern = new RegExp(`\\s${name}="[^"]*"`, "i");
  if (pattern.test(attributes)) {
    return attributes.replace(pattern, ` ${name}="${escapeAttribute(value)}"`);
  }

  return `${attributes} ${name}="${escapeAttribute(value)}"`;
}

function getImageAlignmentFromHtml(html: string) {
  const dataAlignMatch = html.match(/data-align="(left|right|center)"/i);
  if (dataAlignMatch?.[1]) {
    return dataAlignMatch[1].toLowerCase();
  }

  if (/float\s*:\s*right/i.test(html)) {
    return "right";
  }

  if (/float\s*:\s*left/i.test(html)) {
    return "left";
  }

  return "center";
}

/** Стильден аталған қасиеттерді алып тастайды (қайта жазу үшін). */
function dropStyleProperties(style: string, names: string[]) {
  return style
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !names.includes(part.split(":")[0]?.trim().toLowerCase() ?? ""))
    .join(";");
}

function readPixelWidth(value: string | undefined) {
  const number = Number.parseFloat((value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

/** Суреттің өз енін табады: data-width → width атрибуты → стильдегі width */
function findImageWidth(figureAttributes: string, innerHtml: string) {
  const fromData = readPixelWidth(figureAttributes.match(/data-width="([^"]*)"/i)?.[1]);
  if (fromData) {
    return fromData;
  }

  const image = innerHtml.match(/<img\b[^>]*>/i)?.[0] ?? "";
  const fromAttribute = readPixelWidth(image.match(/\bwidth="([^"]*)"/i)?.[1]);
  if (fromAttribute) {
    return fromAttribute;
  }

  return readPixelWidth(image.match(/style="[^"]*\bwidth\s*:\s*([^;"]+)/i)?.[1]);
}

function normalizeReaderHtml(html: string) {
  return sanitizeRichText(html)
    .replace(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi, (_match, rawAttributes: string, rawInnerHtml: string) => {
      const alignment = getImageAlignmentFromHtml(rawInnerHtml || rawAttributes || "");
      let attributes = rawAttributes || "";
      // Редактордың бос «әрекет» қабаттары мазмұнға жазылып қалған: олар
      // `position:absolute` болғандықтан суреттің үстінде қалқып тұрады.
      let innerHtml = (rawInnerHtml || "").replace(
        /<div\b[^>]*class="[^"]*\babsolute\b[^"]*"[^>]*>\s*<\/div>/gi,
        ""
      );

      // Қалқыманы (float) тек `<figure>` көтереді. Суреттің өзінде қалса,
      // figcaption суреттің астына емес, қасына шығып, мәтінмен қабаттасады.
      innerHtml = innerHtml.replace(/<img\b([^>]*)>/gi, (imageMatch: string, imageAttributes: string) => {
        if (!/style="/i.test(imageAttributes)) {
          return imageMatch;
        }

        return `<img${imageAttributes.replace(/style="([^"]*)"/i, (_styleMatch: string, styleValue: string) =>
          `style="${escapeAttribute(dropStyleProperties(styleValue, ["float", "clear", "margin", "margin-left", "margin-right"]))}"`
        )}>`;
      });

      attributes = upsertHtmlAttribute(attributes, "data-juz-image", "true");
      attributes = upsertHtmlAttribute(attributes, "data-align", alignment);

      const width = findImageWidth(attributes, innerHtml);
      const floated = alignment === "left" || alignment === "right";
      // Қалқыған сурет мәтінге тым жақын тұрмауы және бағанның жартысынан
      // аспауы керек — әйтпесе мәтін жіңішке жолаққа қысылады.
      // Ен белгісіз болса жазбаймыз: сонда CSS-тегі `fit-content` күшінде қалады.
      const widthRule = width ? `width:${width}px;` : "";
      // `max-width` жазылмайды: оны CSS шешеді (үлкен экранда бағанның 46%-ы,
      // телефонда толық ені). Inline мән қойсақ, медиа-сұраныс жұмыс істемейді.
      const layout = floated
        ? `float:${alignment};${widthRule}margin-${alignment === "left" ? "right" : "left"}:1.5rem;margin-bottom:0.75rem;`
        : `float:none;clear:both;${widthRule}max-width:100%;margin-left:auto;margin-right:auto;`;
      const base = `display:block;box-sizing:border-box;overflow:hidden;${layout}`;

      if (/style="/i.test(attributes)) {
        attributes = attributes.replace(/style="([^"]*)"/i, (_styleMatch: string, styleValue: string) => {
          const cleaned = dropStyleProperties(styleValue, [
            "float",
            "clear",
            "width",
            "max-width",
            "display",
            "margin",
            "margin-left",
            "margin-right",
            "margin-bottom"
          ]);
          return `style="${escapeAttribute(`${cleaned};${base}`)}"`;
        });
      } else {
        attributes = `${attributes} style="${escapeAttribute(base)}"`;
      }

      return `<figure${attributes}>${innerHtml}</figure>`;
    })
    .replace(/<img\b([^>]*)>/gi, (_match, rawAttributes: string) => {
      let attributes = rawAttributes || "";
      const alignment = getImageAlignmentFromHtml(attributes);

      attributes = upsertHtmlAttribute(attributes, "data-align", alignment);

      if (/style="/i.test(attributes)) {
        attributes = attributes.replace(/style="([^"]*)"/i, (_styleMatch: string, styleValue: string) => {
          const safeStyle = `${styleValue};max-width:100%;height:auto;object-fit:contain;`;
          return `style="${escapeAttribute(safeStyle)}"`;
        });
      } else {
        attributes = `${attributes} style="max-width:100%;height:auto;object-fit:contain;"`;
      }

      return `<img${attributes}>`;
    });
}

function applyHighlightToHtmlString(html: string, highlight: HighlightRecord) {
  const selectedText = highlight.selectedText.trim();
  const pattern = createFlexibleTextRegExp(selectedText);

  if (!selectedText || !pattern) {
    return html;
  }

  const parts = html.split(/(<[^>]+>)/g);
  let isInsideMark = false;
  let isReplaced = false;

  return parts
    .map((part) => {
      if (!part) {
        return part;
      }

      if (part.startsWith("<")) {
        if (/^<mark\b/i.test(part)) {
          isInsideMark = true;
        } else if (/^<\/mark>/i.test(part)) {
          isInsideMark = false;
        }

        return part;
      }

      if (isInsideMark || isReplaced) {
        return part;
      }

      const match = part.match(pattern);
      if (!match || match.index === undefined) {
        return part;
      }

      isReplaced = true;
      const before = part.slice(0, match.index);
      const selected = part.slice(match.index, match.index + match[0].length);
      const after = part.slice(match.index + match[0].length);

      return `${before}<mark id="highlight-${escapeAttribute(highlight.id)}" data-highlight-id="${escapeAttribute(
        highlight.id
      )}" style="${getHighlightStyleText(highlight.color)}">${selected}</mark>${after}`;
    })
    .join("");
}

function applyHighlightToDom(container: Node, highlight: HighlightRecord) {
  const pattern = createFlexibleTextRegExp(highlight.selectedText);

  if (!pattern) {
    return false;
  }

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("mark[data-highlight-id]")) {
        return NodeFilter.FILTER_REJECT;
      }

      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  const fullText = textNodes.map((node) => node.data).join("");
  const match = fullText.match(pattern);

  if (!match || match.index === undefined || !match[0]) {
    return false;
  }

  const start = match.index;
  const end = start + match[0].length;
  let cursor = 0;
  let wroteId = false;

  for (const node of textNodes) {
    const nodeStart = cursor;
    const nodeEnd = cursor + node.data.length;
    cursor = nodeEnd;

    if (nodeEnd <= start || nodeStart >= end || !node.parentNode) {
      continue;
    }

    const localStart = Math.max(0, start - nodeStart);
    const localEnd = Math.min(node.data.length, end - nodeStart);
    let target: Text = node;

    if (localEnd < target.data.length) {
      target.splitText(localEnd);
    }

    if (localStart > 0) {
      target = target.splitText(localStart);
    }

    const parent = target.parentNode;
    if (!parent) {
      continue;
    }

    const mark = document.createElement("mark");
    if (!wroteId) {
      mark.id = `highlight-${highlight.id}`;
      wroteId = true;
    }
    mark.dataset.highlightId = highlight.id;
    mark.setAttribute("style", getHighlightStyleText(highlight.color));
    parent.insertBefore(mark, target);
    mark.appendChild(target);
  }

  return wroteId;
}

/**
 * HTML жолындағы іздеу сөзін `<mark data-search-hit>` ішіне алады.
 * Тегтердің ішіне тимейді. `counter` — тақырып бойынша жалпы реттік нөмір:
 * басты беттегі іздеу сол нөмір арқылы дәл сол сөзге сілтейді.
 */
function highlightSearchInHtml(html: string, term: string, counter: { value: number }, activeIndex: number) {
  if (!term) {
    return html;
  }

  const lowerTerm = term.toLowerCase();

  return html
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (!part || part.startsWith("<")) {
        return part;
      }

      const lower = part.toLowerCase();
      let out = "";
      let from = 0;

      for (;;) {
        const at = lower.indexOf(lowerTerm, from);
        if (at === -1) {
          break;
        }

        const rank = counter.value;
        counter.value += 1;
        out += part.slice(from, at);
        out += `<mark data-search-hit="${rank === activeIndex ? "active" : "true"}" data-hit-index="${rank}">${part.slice(
          at,
          at + term.length
        )}</mark>`;
        from = at + term.length;
      }

      return out + part.slice(from);
    })
    .join("");
}

function applyHighlightsToHtml(html: string, paragraphId: string, highlights: HighlightRecord[]) {
  const paragraphHighlights = highlights.filter((item) => item.paragraphId === paragraphId);
  const cleanHtml = sanitizeRichText(html);

  if (!paragraphHighlights.length) {
    return cleanHtml;
  }

  if (typeof document === "undefined") {
    return paragraphHighlights.reduce((current, highlight) => applyHighlightToHtmlString(current, highlight), cleanHtml);
  }

  const template = document.createElement("template");
  template.innerHTML = cleanHtml;

  for (const highlight of paragraphHighlights) {
    const applied = applyHighlightToDom(template.content, highlight);
    if (!applied) {
      template.innerHTML = applyHighlightToHtmlString(template.innerHTML, highlight);
    }
  }

  return template.innerHTML;
}

function DangerBox({
  title,
  text,
  bodyHtml,
  color,
  rightAligned = false
}: {
  title: string;
  text: string;
  bodyHtml?: string;
  color?: string;
  rightAligned?: boolean;
}) {
  const preset = colorPresets[(color || "red").toLowerCase()] ?? colorPresets.red;

  return (
    <div className={rightAligned ? "my-3 lg:float-right lg:clear-right lg:ml-6 lg:w-80" : "my-4"}>
      <div className={`rounded-3xl border p-4 ${preset.container} ${rightAligned ? "w-full shadow-lg" : ""}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-1 rounded-full p-2 ${preset.icon}`}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em]">{title}</p>
            {bodyHtml ? (
              <div
                className="mt-1 text-[18px] leading-8 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_p]:my-1 [&_strong]:font-semibold [&_u]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(bodyHtml) }}
              />
            ) : (
              <p className="mt-1 whitespace-pre-line text-[18px] leading-8">{text}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TermBox({
  title,
  text,
  bodyHtml,
  color,
  image,
  imageAlign = "top",
  imageWidth,
  imageHeight,
  surface = "default",
  backgroundColor
}: {
  title: string;
  text: string;
  bodyHtml?: string;
  color?: string;
  image?: string;
  imageAlign?: TermImageAlign;
  imageWidth?: string;
  imageHeight?: string;
  surface?: TermSurface;
  backgroundColor?: string;
}) {
  const preset = colorPresets[(color || "blue").toLowerCase()] ?? colorPresets.blue;
  const rowLayout = image && imageAlign !== "top";
  const width = Math.max(20, Number(imageWidth) || 220);
  const height = Math.max(0, Number(imageHeight) || 0);
  const surfaceClass =
    surface === "transparent"
      ? "border-slate-200 bg-white/40 text-slate-900 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/45 dark:text-zinc-50"
      : surface === "white"
        ? "border-slate-200 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        : "backdrop-blur-sm border-slate-200 bg-slate-50/80 text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-50";
  const normalizedBackground = (backgroundColor || "").trim().toLowerCase();
  const shouldUseInlineBackground = Boolean(normalizedBackground && normalizedBackground !== "transparent" && !["#ffffff", "#f8fafc"].includes(normalizedBackground));

  return (
    <div className="my-3">
      <div className={`border rounded-xl p-4 shadow-sm ${surfaceClass}`} style={shouldUseInlineBackground ? { background: backgroundColor } : undefined}>
        <div
          className={`flex gap-4 ${
            rowLayout ? (imageAlign === "right" ? "flex-col md:flex-row-reverse" : "flex-col md:flex-row") : "flex-col"
          }`}
        >
          {image ? (
            <div className={`${rowLayout ? "md:shrink-0" : "w-full"}`} style={rowLayout ? { width: `${width}px`, maxWidth: "100%" } : undefined}>
              <img
                src={image}
                alt=""
                className="mx-auto max-w-full rounded-xl shadow-md"
                style={{
                  width: `min(100%, ${width}px)`,
                  height: height ? `${height}px` : "auto",
                  objectFit: height ? "contain" : undefined
                }}
              />
            </div>
          ) : null}

          <div className="flex min-w-0 items-start gap-3">
            <div className={`mt-1 rounded-full p-2 ${surface === "white" || surface === "transparent" ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200" : preset.icon}`}>
              <BookType className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-7">{title}</p>
              {bodyHtml ? (
                <div
                  className="mt-1 text-[18px] font-normal leading-8 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_p]:my-1 [&_strong]:font-semibold [&_u]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(bodyHtml) }}
                />
              ) : (
                <p className="mt-1 whitespace-pre-line text-[18px] font-normal leading-8">{text}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TermGroupBox({
  title,
  text,
  color,
  backgroundColor,
  items
}: {
  title: string;
  text: string;
  color?: string;
  backgroundColor?: string;
  items?: TermGroupItem[];
}) {
  const preset = colorPresets[(color || "blue").toLowerCase()] ?? colorPresets.blue;
  const groupItems = items?.length ? items : parseTermGroupItemsFromText(text);
  const normalizedBackground = (backgroundColor || "").trim().toLowerCase();
  const shouldUseInlineBackground = Boolean(normalizedBackground && normalizedBackground !== "transparent" && !["#ffffff", "#f8fafc"].includes(normalizedBackground));

  return (
    <div className="my-4 clear-both">
      <div
        className={`rounded-3xl border border-slate-200 p-4 text-slate-900 shadow-sm dark:border-zinc-800 dark:text-zinc-50 ${shouldUseInlineBackground ? "" : "bg-slate-50/80 dark:bg-zinc-900/80"}`}
        style={shouldUseInlineBackground ? { background: backgroundColor } : undefined}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className={`rounded-full p-2 ${preset.icon}`}>
            <BookType className="h-4 w-4" />
          </div>
          <p className="text-base font-semibold leading-7">{title}</p>
        </div>

        <div className="grid gap-3">
          {groupItems.length ? (
            groupItems.map((item, index) => {
              const width = Math.max(30, Number(item.imageWidth) || 180);
              const height = Math.max(0, Number(item.imageHeight) || 0);
              const imageAlign = item.imageAlign || "top";
              const rowLayout = item.image && imageAlign !== "top";

              return (
              <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className={`flex gap-4 ${rowLayout ? (imageAlign === "right" ? "flex-col md:flex-row-reverse" : "flex-col md:flex-row") : "flex-col"}`}>
                  {item.image ? (
                    <div className={rowLayout ? "md:shrink-0" : "w-full"} style={rowLayout ? { width: `${width}px`, maxWidth: "100%" } : undefined}>
                      <img
                        src={item.image}
                        alt=""
                        className="mb-2 max-w-full rounded-xl shadow-sm"
                        style={{
                          width: `min(100%, ${width}px)`,
                          height: height ? `${height}px` : "auto",
                          objectFit: height ? "contain" : undefined
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950 dark:text-zinc-50">{item.title}</p>
                    <div
                      className="mt-1 text-[18px] font-normal leading-8 text-slate-700 dark:text-zinc-200 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_p]:my-1 [&_strong]:font-semibold [&_u]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.body) }}
                    />
                  </div>
                </div>
              </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
              Терминдер қосылмаған
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Оқулықтағы боялған блоктың кілегей түсі */
const COLORBOX_DEFAULT = "#ede5c3";

function ColorBox({ text, bodyHtml, color, textColor }: { text: string; bodyHtml?: string; color?: string; textColor?: string }) {
  // Оқулықтағы боялған блок тік бұрышты, жиексіз әрі астына қарай ағарады —
  // сол көрініс дәл қайталанады.
  const fill = color || COLORBOX_DEFAULT;

  return (
    <div className="my-4">
      <div
        className="juz-colorbox px-5 py-4"
        style={{
          ["--juz-colorbox-fill" as string]: fill,
          color: textColor || "#0f172a"
        } as CSSProperties}
      >
        {bodyHtml ? (
          <div
            className="text-[18px] leading-8 [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_p]:my-1 [&_strong]:font-semibold [&_u]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(bodyHtml) }}
          />
        ) : (
          <p className="whitespace-pre-line text-[18px] leading-8">{text}</p>
        )}
      </div>
    </div>
  );
}

export function ContentRenderer({
  content,
  activeParagraphId,
  activeSentenceText,
  focusParagraphId,
  highlights,
  searchTerm,
  searchHitIndex = 0,
  onSelectParagraph,
  onSelectHighlight
}: {
  content: string;
  activeParagraphId: string | null;
  activeSentenceText?: string | null;
  focusParagraphId: string | null;
  highlights: HighlightRecord[];
  /** Басты беттегі іздеуден келген сөз — мәтінде бояулы болып тұрады */
  searchTerm?: string | null;
  /** Сол сөздің нешінші кездесуіне бару керектігі */
  searchHitIndex?: number;
  onSelectParagraph: (paragraphId: string, text: string) => void;
  onSelectHighlight: (highlight: HighlightRecord, rect: DOMRect) => void;
}) {
  const blocks = parseBlocks(content);
  const normalizedSearchTerm = (searchTerm || "").trim();
  // Санауыш әр көрсетілім сайын нөлден басталады: блоктар құжат ретімен салынады,
  // сондықтан нөмірлеу серверде есептелген реттік нөмірмен сәйкес келеді.
  const searchCounter = { value: 0 };

  /** Блок HTML-індегі іздеу сөзін жалпы нөмірлеумен белгілейді */
  const markSearch = (html?: string) =>
    html ? highlightSearchInHtml(html, normalizedSearchTerm, searchCounter, searchHitIndex) : html;

  function renderHighlightedText(text: string, paragraphId: string) {
    const paragraphHighlights = highlights.filter((item) => item.paragraphId === paragraphId);
    const normalizedSentence = activeSentenceText?.replace(/\s+/g, " ").trim();
    const sentencePattern = normalizedSentence ? createFlexibleTextRegExp(normalizedSentence) : null;
    const sentenceMatch = sentencePattern ? text.match(sentencePattern) : null;
    const sentenceStart = sentenceMatch?.index ?? -1;
    const sentenceEnd = sentenceStart >= 0 && sentenceMatch?.[0] ? sentenceStart + sentenceMatch[0].length : -1;

    // Іздеу сөзінің осы абзацтағы орындарын жинаймыз (реттік нөмірімен бірге)
    const searchMatches: { start: number; end: number; rank: number }[] = [];
    if (normalizedSearchTerm) {
      const lowerText = text.toLowerCase();
      const lowerTerm = normalizedSearchTerm.toLowerCase();
      let from = 0;

      for (;;) {
        const at = lowerText.indexOf(lowerTerm, from);
        if (at === -1) {
          break;
        }
        searchMatches.push({ start: at, end: at + normalizedSearchTerm.length, rank: searchCounter.value });
        searchCounter.value += 1;
        from = at + normalizedSearchTerm.length;
      }
    }

    if (!paragraphHighlights.length && sentenceStart < 0 && !searchMatches.length) {
      return text;
    }

    const matches: Array<{
      start: number;
      end: number;
      highlight?: HighlightRecord;
      kind: "highlight" | "speech" | "search";
      rank?: number;
    }> = [];

    for (const item of searchMatches) {
      matches.push({ start: item.start, end: item.end, kind: "search", rank: item.rank });
    }

    if (sentenceStart >= 0 && sentenceEnd > sentenceStart) {
      matches.push({
        start: sentenceStart,
        end: sentenceEnd,
        kind: "speech"
      });
    }

    for (const highlight of paragraphHighlights) {
      const pattern = createFlexibleTextRegExp(highlight.selectedText);
      const match = pattern ? text.match(pattern) : null;
      const start = match?.index ?? -1;

      if (start >= 0 && match?.[0]) {
        matches.push({
          start,
          end: start + match[0].length,
          highlight,
          kind: "highlight"
        });
      }
    }

    matches.sort((left, right) => left.start - right.start || (left.kind === "speech" ? -1 : 1));

    const safeMatches = matches.filter((match, index) => {
      if (index === 0) {
        return true;
      }

      return match.start >= matches[index - 1].end;
    });

    const parts: Array<{
      text: string;
      highlight?: HighlightRecord;
      isSpeech?: boolean;
      searchRank?: number;
      key: string;
    }> = [];
    let cursor = 0;

    safeMatches.forEach((match) => {
      if (cursor < match.start) {
        parts.push({ text: text.slice(cursor, match.start), key: `${match.highlight?.id ?? paragraphId}-before-${match.start}` });
      }

      parts.push({
        text: text.slice(match.start, match.end),
        highlight: match.highlight,
        isSpeech: match.kind === "speech",
        searchRank: match.kind === "search" ? match.rank : undefined,
        key: match.highlight?.id ?? `${paragraphId}-${match.kind}-${match.start}`
      });

      cursor = match.end;
    });

    if (cursor < text.length) {
      parts.push({ text: text.slice(cursor), key: `${paragraphId}-tail` });
    }

    return parts.map((part) =>
      part.highlight ? (
        <mark
          id={`highlight-${part.highlight.id}`}
          key={part.key}
          onClick={(event) => {
            event.stopPropagation();
            onSelectHighlight(part.highlight!, event.currentTarget.getBoundingClientRect());
          }}
          className="cursor-pointer rounded px-1"
          style={getHighlightStyle(part.highlight.color)}
        >
          {part.text}
        </mark>
      ) : (
        part.searchRank !== undefined ? (
          <mark
            key={part.key}
            data-search-hit={part.searchRank === searchHitIndex ? "active" : "true"}
            data-hit-index={part.searchRank}
          >
            {part.text}
          </mark>
        ) : part.isSpeech ? (
          <span
            key={part.key}
            className="rounded-xl bg-sky-200/85 px-1.5 py-0.5 text-slate-950 ring-1 ring-sky-300 dark:bg-cyan-400/20 dark:text-zinc-50 dark:ring-cyan-400/35"
          >
            {part.text}
          </span>
        ) : (
          <Fragment key={part.key}>{part.text}</Fragment>
        )
      )
    );
  }

  return (
    <div className="flow-root space-y-4">
      {blocks.map((block, index) => {
        const paragraphId = `p-${index + 1}`;

        if (block.type === "danger") {
          return <DangerBox key={paragraphId} title={block.title || defaultDangerTitle} text={block.text} bodyHtml={markSearch(block.bodyHtml)} color={block.color} />;
        }

        if (block.type === "danger-right") {
          return (
            <DangerBox
              key={paragraphId}
              title={block.title || defaultDangerTitle}
              text={block.text}
              bodyHtml={markSearch(block.bodyHtml)}
              color={block.color}
              rightAligned
            />
          );
        }

        if (block.type === "term") {
          return (
            <TermBox
              key={paragraphId}
              title={block.title || "Термин"}
              text={block.text}
              bodyHtml={markSearch(block.bodyHtml)}
              color={block.color}
              image={block.image}
              imageAlign={block.imageAlign}
              imageWidth={block.imageWidth}
              imageHeight={block.imageHeight}
              surface={block.surface}
              backgroundColor={block.backgroundColor}
            />
          );
        }

        if (block.type === "termgroup") {
          return (
            <TermGroupBox
              key={paragraphId}
              title={block.title || "Терминдер"}
              text={block.text}
              color={block.color}
              backgroundColor={block.backgroundColor}
              items={block.items}
            />
          );
        }

        if (block.type === "colorbox") {
          return <ColorBox key={paragraphId} text={block.text} bodyHtml={markSearch(block.bodyHtml)} color={block.color} textColor={block.textColor} />;
        }

        if (block.type === "tree") {
          return (
            <div
              key={paragraphId}
              id={paragraphId}
              className="reader-prose w-full max-w-none [&_[data-juz-tree='true']]:text-slate-900 [&_svg]:mx-auto [&_svg]:max-w-full [&_svg]:rounded-2xl"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        }

        if (block.type === "html") {
          const highlightedHtml = applyHighlightsToHtml(block.html, paragraphId, highlights);

          return (
            <div
              key={paragraphId}
              id={paragraphId}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                const marker = target.closest("[data-highlight-id]") as HTMLElement | null;
                const highlight = marker ? highlights.find((item) => item.id === marker.dataset.highlightId) : null;

                if (highlight && marker) {
                  event.stopPropagation();
                  onSelectHighlight(highlight, marker.getBoundingClientRect());
                  return;
                }

                onSelectParagraph(paragraphId, stripHtml(block.html));
              }}
              className="reader-prose flow-root w-full max-w-none break-words text-[18px] leading-[2.05] tracking-[0.005em] text-slate-900 dark:text-zinc-50 [&_*]:max-w-full [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_a]:dark:text-sky-300 [&_b]:font-semibold [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-sky-300 [&_blockquote]:bg-sky-50/60 [&_blockquote]:py-3 [&_blockquote]:pl-5 [&_blockquote]:pr-4 [&_blockquote]:text-[18px] [&_blockquote]:text-slate-800 [&_blockquote]:dark:border-cyan-500/40 [&_blockquote]:dark:bg-cyan-500/10 [&_blockquote]:dark:text-zinc-100 [&_div[data-juz-tree='true']]:clear-both [&_div[data-juz-tree='true']]:w-full [&_div[data-juz-tree='true']]:max-w-full [&_div[data-juz-tree='true']]:rounded-3xl [&_div[data-juz-tree='true']]:bg-white [&_div[data-juz-tree='true']]:shadow-sm [&_em]:italic [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:italic [&_figcaption]:leading-6 [&_figcaption]:text-slate-500 [&_figure]:box-border [&_figure]:max-w-full [&_figure]:overflow-visible [&_i]:italic [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:shadow-md [&_li]:text-[18px] [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7 [&_ol]:text-[18px] [&_ol]:text-slate-900 [&_ol]:dark:text-zinc-100 [&_p]:my-3 [&_p]:text-[18px] [&_p]:leading-[2.05] [&_strong]:font-semibold [&_table]:my-4 [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-3 [&_td]:text-[18px] [&_td]:dark:border-zinc-700 [&_th]:border [&_th]:border-slate-300 [&_th]:p-3 [&_th]:text-[18px] [&_th]:dark:border-zinc-600 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7 [&_ul]:text-[18px] [&_ul]:text-slate-900 [&_ul]:dark:text-zinc-100"
              dangerouslySetInnerHTML={{
                __html: normalizeReaderHtml(
                  highlightSearchInHtml(highlightedHtml, normalizedSearchTerm, searchCounter, searchHitIndex)
                )
              }}
            />
          );
        }

        if (block.type === "heading") {
          return (
            <h3
              key={paragraphId}
              id={paragraphId}
              onClick={() => onSelectParagraph(paragraphId, block.text)}
              onDoubleClick={() => onSelectParagraph(paragraphId, block.text)}
              className="reader-prose mt-10 w-full max-w-none break-words text-2xl font-bold tracking-[-0.02em] text-slate-950 dark:text-zinc-50"
            >
              {renderHighlightedText(block.text, paragraphId)}
            </h3>
          );
        }

        const isActive = activeParagraphId === paragraphId;
        const isFocused = focusParagraphId === paragraphId;

        return (
          <p
            key={paragraphId}
            id={paragraphId}
            onClick={() => onSelectParagraph(paragraphId, block.text)}
            onDoubleClick={() => onSelectParagraph(paragraphId, block.text)}
            className={`reader-prose w-full max-w-none cursor-text break-words scroll-mt-32 rounded-2xl px-3 py-2 text-[19px] font-normal leading-[2.05] tracking-[0.005em] text-slate-900 transition-all dark:text-zinc-50 ${
              isFocused
                ? "bg-amber-100/90 text-amber-950 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-50 dark:ring-amber-500/35"
                : isActive
                  ? "bg-sky-100/90 text-slate-950 ring-1 ring-sky-300 dark:bg-cyan-500/15 dark:text-zinc-50 dark:ring-cyan-500/30"
                  : ""
            }`}
          >
            {renderHighlightedText(block.text, paragraphId)}
          </p>
        );
      })}
    </div>
  );
}

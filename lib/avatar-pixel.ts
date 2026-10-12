/**
 * Мини-персонажды пиксель-арт етіп салады (Minecraft стилі, алдыңғы көрініс).
 *
 * Спрайт торы 32×48: бас 16×16 (y 0–15), дене 16×16 (y 16–31), қолдар 6×16
 * (x 2–7 және 24–29), аяқтар 8×12 (y 32–43), аяқ киім y 44–47. Бас киім
 * бастан жоғары (y < 0) шығуы мүмкін — оған `AVATAR_HEAD_ROOM` қор беріледі.
 *
 * Профильде толық анықтықпен салынады. Бақта үйге пропорциясы сай болуы үшін
 * `lib/garden-pixel.ts` оны 2×2 блоктап 16×24-ке кішірейтеді.
 */
import {
  resolveAvatar,
  type AvatarBase,
  type AvatarBottom,
  type AvatarHat,
  type AvatarMask,
  type AvatarShoes,
  type AvatarTop,
  type HatStyle
} from "@/lib/avatar";
import type { AvatarLook } from "@/lib/types";

export const AVATAR_W = 32;
export const AVATAR_H = 48;
/** Бастан жоғары шығатын бас киімге (сиқыршы қалпағы, үкі, цилиндр) арналған қор */
export const AVATAR_HEAD_ROOM = 14;

export type PixelFill = (x: number, y: number, w: number, h: number, color: string) => void;

/**
 * RGBA спрайтты 2×2 блоктап екі есе кішірейтеді (бақтағы кішкентай персонаж үшін).
 * Әр блоктан ең жиі кездесетін түс алынады, тең болса — ең қоюы (контур мен көз
 * жоғалмауы үшін). Мөлдір пиксель басым блок мөлдір қалады.
 */
export function downsampleAvatarPixels(source: ArrayLike<number>, width: number, height: number) {
  const outWidth = Math.ceil(width / 2);
  const outHeight = Math.ceil(height / 2);
  const result = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let outY = 0; outY < outHeight; outY += 1) {
    for (let outX = 0; outX < outWidth; outX += 1) {
      const colors: number[] = [];
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const x = outX * 2 + dx;
          const y = outY * 2 + dy;
          if (x >= width || y >= height) continue;
          const index = (y * width + x) * 4;
          if (source[index + 3] >= 128) {
            colors.push((source[index] << 16) | (source[index + 1] << 8) | source[index + 2]);
          }
        }
      }
      if (colors.length < 2) continue;

      let best = colors[0];
      let bestCount = 0;
      let bestLuma = Number.POSITIVE_INFINITY;
      for (const color of colors) {
        const count = colors.filter((other) => other === color).length;
        const luma = ((color >> 16) & 255) * 299 + ((color >> 8) & 255) * 587 + (color & 255) * 114;
        if (count > bestCount || (count === bestCount && luma < bestLuma)) {
          best = color;
          bestCount = count;
          bestLuma = luma;
        }
      }

      const target = (outY * outWidth + outX) * 4;
      result[target] = (best >> 16) & 255;
      result[target + 1] = (best >> 8) & 255;
      result[target + 2] = best & 255;
      result[target + 3] = 255;
    }
  }

  return result;
}
type Plot = (x: number, y: number, w: number, h: number, color: string) => void;

export type AvatarDrawOptions = {
  /** Бір спрайт пикселінің өлшемі */
  scale?: number;
  /** Көзін жұмады (жыпылықтау анимациясы) */
  blink?: boolean;
};

/**
 * Бас киім шашты қаншалық жабады:
 * none — шаш толық көрінеді; top — бастан жоғары шыққан бөлігі салынбайды;
 * full — шаш мүлде салынбайды (басты толық жабатын дулыға).
 */
const HAT_COVERAGE: Record<HatStyle, "none" | "top" | "full"> = {
  none: "none",
  cap: "top",
  beanie: "top",
  headphones: "none",
  bow: "none",
  catears: "none",
  straw: "top",
  bandana: "top",
  wreath: "none",
  takiya: "top",
  cowboy: "top",
  grad: "top",
  pirate: "top",
  santa: "top",
  tophat: "top",
  viking: "top",
  wizard: "top",
  crown: "none",
  bearhood: "full",
  spacehelmet: "top",
  diving: "full",
  knight: "full",
  robot: "full",
  halo: "none"
};

function mixHex(first: string, second: string, amount: number) {
  if (!first.startsWith("#") || !second.startsWith("#")) {
    return first;
  }

  const read = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const [r1, g1, b1] = read(first);
  const [r2, g2, b2] = read(second);
  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

const lighten = (color: string, amount = 0.22) => mixHex(color, "#ffffff", amount);
const darken = (color: string, amount = 0.22) => mixHex(color, "#000000", amount);

/**
 * @param fill     тіктөртбұрыш салатын функция (canvas координатымен)
 * @param originX  спрайттың сол жақ шеті
 * @param footY    табанның астыңғы шегі
 */
export function drawAvatar(fill: PixelFill, originX: number, footY: number, look: AvatarLook, options: AvatarDrawOptions = {}) {
  const s = options.scale ?? 1;
  const top = footY - AVATAR_H * s;
  const p: Plot = (x, y, w, h, color) => fill(originX + x * s, top + y * s, w * s, h * s, color);
  const avatar = resolveAvatar(look);
  const coverage = HAT_COVERAGE[avatar.hat.style];

  if (coverage !== "full") {
    drawHairBack(p, avatar.base);
  }
  drawBottom(p, avatar.base, avatar.bottom);
  drawShoes(p, avatar.base, avatar.shoes);
  drawTop(p, avatar.base, avatar.top);
  drawHead(p, avatar.base, Boolean(options.blink));
  if (coverage !== "full") {
    drawHairFront(p, avatar.base, coverage === "top");
  }
  drawMask(p, avatar.base, avatar.mask);
  drawHat(p, avatar.hat);
}

/* ─────────────────────────── Бас пен шаш ─────────────────────────── */

function drawHead(p: Plot, base: AvatarBase, blink: boolean) {
  const girl = base.gender === "girl";
  const { skin, skinShade, eyes } = base;

  p(8, 0, 16, 16, skin);
  p(22, 0, 2, 16, skinShade);
  p(8, 14, 14, 2, skinShade);
  p(10, 14, 10, 1, skin);
  // Құлақтар
  p(6, 7, 2, 4, skin);
  p(6, 8, 1, 2, skinShade);
  p(24, 7, 2, 4, skinShade);
  p(25, 8, 1, 2, darken(skinShade, 0.15));
  // Қастар
  p(10, 6, 4, 1, base.hairShade);
  p(18, 6, 4, 1, base.hairShade);

  if (blink) {
    p(10, 9, 4, 1, darken(skinShade, 0.35));
    p(18, 9, 4, 1, darken(skinShade, 0.35));
  } else {
    p(10, 8, 2, 2, "#ffffff");
    p(12, 8, 2, 2, eyes);
    p(12, 8, 1, 1, lighten(eyes, 0.6));
    p(13, 9, 1, 1, darken(eyes, 0.4));
    p(18, 8, 2, 2, eyes);
    p(20, 8, 2, 2, "#ffffff");
    p(18, 8, 1, 1, lighten(eyes, 0.6));
    p(19, 9, 1, 1, darken(eyes, 0.4));
    if (girl) {
      p(10, 7, 4, 1, "#2b1a12");
      p(18, 7, 4, 1, "#2b1a12");
      p(9, 8, 1, 1, "#2b1a12");
      p(22, 8, 1, 1, "#2b1a12");
    }
  }

  // Мұрын мен ауыз
  p(15, 10, 2, 2, skinShade);
  p(16, 11, 1, 1, darken(skinShade, 0.15));
  if (girl) {
    p(13, 12, 6, 1, "#b84a5c");
    p(14, 13, 4, 1, "#e28b99");
    p(9, 11, 2, 1, "rgba(236, 110, 120, 0.5)");
    p(21, 11, 2, 1, "rgba(236, 110, 120, 0.5)");
  } else {
    p(13, 12, 6, 1, darken(skinShade, 0.4));
    p(14, 13, 4, 1, skinShade);
  }

  if (base.freckles) {
    const freckle = darken(skinShade, 0.1);
    p(10, 11, 1, 1, freckle);
    p(12, 12, 1, 1, freckle);
    p(19, 12, 1, 1, freckle);
    p(21, 11, 1, 1, freckle);
  }
}

function drawHairBack(p: Plot, base: AvatarBase) {
  if (base.hairStyle === "ponytail") {
    // Құйрық бастың оң жағынан шығып, иыққа түседі (қол оның астыңғы бөлігін жабады)
    p(24, 5, 5, 15, base.hair);
    p(27, 7, 2, 13, base.hairShade);
    p(25, 6, 1, 10, base.hairLight);
    p(24, 19, 5, 1, base.hairShade);
  }
}

function drawHairFront(p: Plot, base: AvatarBase, hatCoversTop: boolean) {
  const { hair: h, hairShade: sh, hairLight: li } = base;

  switch (base.hairStyle) {
    case "short":
      p(8, 0, 16, 4, h);
      p(8, 4, 2, 4, h);
      p(22, 4, 2, 4, sh);
      p(10, 4, 7, 2, h);
      p(17, 4, 3, 1, h);
      p(19, 0, 5, 4, sh);
      p(10, 1, 6, 1, li);
      p(9, 2, 1, 3, li);
      break;
    case "sidepart":
      p(8, 0, 16, 4, h);
      p(8, 4, 2, 5, h);
      p(22, 4, 2, 3, sh);
      p(10, 4, 10, 1, h);
      p(10, 5, 6, 1, h);
      p(18, 0, 1, 4, sh);
      p(10, 1, 7, 1, li);
      p(19, 1, 3, 1, li);
      p(21, 2, 3, 2, sh);
      break;
    case "spiky":
      p(8, 0, 16, 4, h);
      p(8, 4, 2, 4, h);
      p(22, 4, 2, 4, sh);
      p(10, 4, 4, 2, h);
      p(14, 4, 2, 1, h);
      p(17, 4, 3, 1, h);
      p(19, 0, 5, 3, sh);
      p(10, 1, 5, 1, li);
      if (!hatCoversTop) {
        p(8, -2, 3, 2, h);
        p(12, -4, 3, 4, h);
        p(13, -4, 1, 2, li);
        p(16, -2, 2, 2, h);
        p(18, -6, 3, 6, h);
        p(19, -6, 1, 3, li);
        p(21, -3, 3, 3, sh);
      }
      break;
    case "curly":
      p(6, 0, 20, 4, h);
      p(6, 4, 4, 6, h);
      p(22, 4, 4, 6, sh);
      p(10, 4, 4, 2, h);
      p(18, 4, 4, 2, h);
      for (let x = 6; x < 26; x += 2) {
        p(x, 1, 1, 1, sh);
        p(x + 1, 3, 1, 1, li);
      }
      p(7, 6, 1, 1, li);
      p(24, 8, 1, 1, li);
      if (!hatCoversTop) {
        p(7, -2, 18, 2, h);
        p(8, -4, 4, 2, h);
        p(14, -4, 4, 2, h);
        p(20, -4, 4, 2, h);
        for (let x = 8; x < 24; x += 3) p(x, -2, 1, 1, li);
        p(15, -4, 2, 1, li);
        p(22, -3, 2, 1, sh);
      }
      break;
    case "mohawk":
      // Қырылған бүйірлер
      p(8, 0, 5, 4, darken(base.skin, 0.14));
      p(19, 0, 5, 4, darken(base.skin, 0.2));
      p(13, 0, 6, 5, h);
      p(14, 1, 1, 3, li);
      p(17, 0, 2, 5, sh);
      if (!hatCoversTop) {
        p(13, -6, 6, 6, h);
        p(14, -6, 2, 5, li);
        p(17, -5, 2, 5, sh);
      }
      break;
    case "bob":
      p(6, 0, 20, 4, h);
      p(6, 4, 4, 12, h);
      p(22, 4, 4, 12, sh);
      p(10, 4, 12, 2, h);
      p(24, 4, 2, 12, darken(sh, 0.12));
      p(6, 15, 4, 1, sh);
      p(10, 1, 9, 1, li);
      p(7, 5, 1, 8, li);
      break;
    case "long":
    case "wavy":
      p(8, 0, 16, 4, h);
      p(10, 4, 9, 2, h);
      p(6, 2, 4, 20, h);
      p(22, 2, 4, 20, sh);
      p(6, 21, 4, 1, sh);
      p(22, 21, 4, 1, darken(sh, 0.12));
      p(10, 1, 6, 1, li);
      p(7, 5, 1, 12, li);
      p(20, 0, 4, 3, sh);
      if (base.hairStyle === "wavy") {
        for (let y = 8; y < 22; y += 4) {
          p(6, y, 1, 2, sh);
          p(9, y + 2, 1, 2, sh);
          p(23, y, 1, 2, li);
          p(25, y + 2, 1, 2, darken(sh, 0.15));
        }
      }
      break;
    case "ponytail":
      p(8, 0, 16, 4, h);
      p(10, 4, 8, 2, h);
      p(8, 4, 2, 4, h);
      p(22, 4, 2, 4, sh);
      p(19, 0, 5, 3, sh);
      p(10, 1, 6, 1, li);
      // Шаш бауы
      p(24, 3, 2, 3, "#f472b6");
      break;
    case "bun":
      p(8, 0, 16, 4, h);
      p(10, 4, 10, 2, h);
      p(8, 4, 2, 6, h);
      p(22, 4, 2, 6, sh);
      p(10, 1, 6, 1, li);
      p(19, 0, 5, 3, sh);
      if (!hatCoversTop) {
        p(12, -5, 8, 5, h);
        p(18, -5, 2, 5, sh);
        p(13, -5, 4, 1, li);
        p(12, -1, 8, 1, sh);
      }
      break;
    case "braids":
      p(8, 0, 16, 4, h);
      p(10, 4, 4, 2, h);
      p(18, 4, 4, 2, h);
      p(15, 0, 2, 3, sh);
      p(10, 1, 4, 1, li);
      p(18, 1, 4, 1, li);
      p(6, 4, 4, 24, h);
      p(22, 4, 4, 24, sh);
      for (let y = 8; y < 26; y += 5) {
        p(6, y, 4, 1, sh);
        p(22, y, 4, 1, darken(sh, 0.18));
        p(7, y + 2, 1, 1, li);
      }
      p(6, 27, 4, 2, "#f43f5e");
      p(22, 27, 4, 2, "#e11d48");
      break;
    case "puffs":
      p(8, 0, 16, 4, h);
      p(10, 4, 12, 2, h);
      p(8, 4, 2, 4, h);
      p(22, 4, 2, 4, sh);
      p(10, 1, 6, 1, li);
      if (!hatCoversTop) {
        p(3, -5, 8, 8, h);
        p(4, -4, 3, 2, li);
        p(9, -5, 2, 8, sh);
        p(21, -5, 8, 8, h);
        p(22, -4, 3, 2, li);
        p(27, -5, 2, 8, sh);
      }
      break;
  }
}

/* ─────────────────────────── Маска ─────────────────────────── */

function drawMask(p: Plot, base: AvatarBase, mask: AvatarMask) {
  const { main, shade, accent } = mask.colors;
  const light = mask.colors.light ?? lighten(main, 0.35);
  const frame = (x: number, y: number, w: number, h: number, color: string) => {
    p(x, y, w, 1, color);
    p(x, y + h - 1, w, 1, color);
    p(x, y, 1, h, color);
    p(x + w - 1, y, 1, h, color);
  };
  const redrawEyes = () => {
    p(10, 8, 2, 2, "#ffffff");
    p(12, 8, 2, 2, base.eyes);
    p(18, 8, 2, 2, base.eyes);
    p(20, 8, 2, 2, "#ffffff");
  };

  switch (mask.style) {
    case "none":
      return;
    case "glasses":
      p(10, 8, 4, 2, "rgba(186, 230, 253, 0.3)");
      p(18, 8, 4, 2, "rgba(186, 230, 253, 0.3)");
      frame(9, 7, 6, 4, main);
      frame(17, 7, 6, 4, main);
      p(15, 8, 2, 1, main);
      p(6, 8, 3, 1, main);
      p(23, 8, 3, 1, main);
      p(10, 7, 2, 1, lighten(main, 0.5));
      break;
    case "sunglasses":
      p(9, 7, 6, 4, main);
      p(17, 7, 6, 4, main);
      p(10, 8, 2, 1, light);
      p(18, 8, 2, 1, light);
      p(14, 9, 1, 1, accent);
      p(22, 9, 1, 1, accent);
      p(15, 7, 2, 1, main);
      p(6, 7, 3, 1, main);
      p(23, 7, 3, 1, main);
      break;
    case "shades3d":
      p(8, 6, 16, 6, main);
      p(9, 7, 6, 4, accent);
      p(17, 7, 6, 4, mask.colors.extra ?? "#3b82f6");
      p(15, 7, 2, 4, shade);
      p(6, 7, 2, 1, main);
      p(24, 7, 2, 1, main);
      p(10, 7, 2, 1, "rgba(255, 255, 255, 0.45)");
      p(18, 7, 2, 1, "rgba(255, 255, 255, 0.45)");
      break;
    case "medical":
      p(9, 10, 14, 5, main);
      p(22, 10, 1, 5, shade);
      p(9, 11, 14, 1, shade);
      p(9, 13, 14, 1, shade);
      p(10, 10, 12, 1, lighten(main, 0.4));
      p(6, 9, 3, 1, accent);
      p(23, 9, 3, 1, accent);
      p(6, 12, 3, 1, accent);
      p(23, 12, 3, 1, accent);
      break;
    case "domino":
      p(8, 7, 16, 4, main);
      p(6, 8, 2, 2, main);
      p(24, 8, 2, 2, shade);
      p(22, 7, 2, 4, shade);
      p(9, 7, 5, 1, light);
      redrawEyes();
      break;
    case "goggles":
      p(6, 7, 20, 1, accent);
      p(6, 10, 20, 1, accent);
      p(8, 6, 16, 6, "#111827");
      p(9, 7, 14, 4, main);
      p(10, 7, 12, 1, light);
      p(10, 10, 12, 1, shade);
      p(15, 8, 2, 2, shade);
      p(11, 8, 2, 1, "rgba(255, 255, 255, 0.7)");
      break;
    case "ninja":
      p(8, 10, 16, 6, main);
      p(22, 10, 2, 6, shade);
      p(9, 12, 13, 1, shade);
      p(10, 14, 11, 1, shade);
      p(8, 4, 16, 2, main);
      p(24, 4, 4, 2, main);
      p(26, 6, 2, 4, shade);
      p(9, 4, 12, 1, accent);
      break;
    case "fox":
      p(8, 4, 16, 12, main);
      p(22, 4, 2, 12, shade);
      p(11, 11, 10, 5, accent);
      p(13, 10, 6, 1, accent);
      p(15, 12, 2, 1, "#1f2937");
      p(10, 8, 4, 2, "#1f2937");
      p(18, 8, 4, 2, "#1f2937");
      p(10, 8, 1, 1, "#fde68a");
      p(21, 8, 1, 1, "#fde68a");
      p(9, 5, 3, 2, light);
      p(20, 5, 3, 2, light);
      p(14, 14, 4, 1, shade);
      break;
    case "gas":
      p(8, 5, 16, 11, main);
      p(22, 5, 2, 11, shade);
      p(9, 7, 5, 4, "#cbd5e1");
      p(18, 7, 5, 4, "#cbd5e1");
      p(10, 8, 3, 2, "#475569");
      p(19, 8, 3, 2, "#475569");
      p(10, 8, 1, 1, "#f8fafc");
      p(19, 8, 1, 1, "#f8fafc");
      p(12, 11, 8, 5, shade);
      p(13, 12, 6, 3, accent);
      p(13, 13, 6, 1, shade);
      p(6, 8, 2, 2, "#1f2937");
      p(24, 8, 2, 2, "#1f2937");
      p(9, 5, 12, 1, light);
      break;
    case "hockey":
      p(9, 1, 14, 15, main);
      p(10, 0, 12, 1, main);
      p(21, 1, 2, 15, shade);
      p(9, 15, 14, 1, shade);
      p(10, 7, 4, 3, "#111827");
      p(18, 7, 4, 3, "#111827");
      for (const y of [11, 13]) {
        for (const x of [12, 14, 17, 19]) p(x, y, 1, 1, "#111827");
      }
      p(15, 9, 2, 3, shade);
      // Қызыл шеврондар
      p(11, 3, 4, 1, accent);
      p(12, 4, 2, 1, accent);
      p(17, 3, 4, 1, accent);
      p(18, 4, 2, 1, accent);
      p(13, 5, 1, 1, accent);
      p(18, 5, 1, 1, accent);
      p(7, 6, 2, 2, "#374151");
      p(23, 6, 2, 2, "#374151");
      p(10, 1, 3, 1, "#ffffff");
      break;
    case "visor":
      p(8, 6, 16, 1, "rgba(34, 211, 238, 0.35)");
      p(7, 7, 18, 4, main);
      p(8, 8, 16, 2, accent);
      p(9, 8, 5, 1, light);
      p(18, 8, 5, 1, light);
      p(8, 11, 16, 1, "rgba(34, 211, 238, 0.3)");
      p(24, 7, 1, 4, shade);
      break;
    case "skull":
      p(9, 2, 14, 14, main);
      p(10, 1, 12, 1, main);
      p(21, 2, 2, 14, shade);
      p(10, 7, 4, 4, accent);
      p(18, 7, 4, 4, accent);
      p(11, 8, 1, 1, "#94a3b8");
      p(19, 8, 1, 1, "#94a3b8");
      p(15, 11, 2, 2, accent);
      p(11, 13, 10, 2, lighten(main, 0.3));
      for (const x of [12, 14, 16, 18]) p(x, 13, 1, 2, accent);
      p(10, 2, 3, 1, "#ffffff");
      break;
  }
}

/* ─────────────────────────── Бас киім ─────────────────────────── */

function drawHat(p: Plot, hat: AvatarHat) {
  const { main, shade, accent } = hat.colors;
  const light = hat.colors.light ?? lighten(main, 0.3);

  switch (hat.style) {
    case "none":
      return;
    case "cap":
      p(8, -4, 16, 6, main);
      p(10, -6, 12, 2, main);
      p(20, -5, 4, 7, shade);
      p(10, -5, 6, 1, light);
      p(14, -3, 4, 3, accent);
      p(15, -2, 2, 1, main);
      p(8, 2, 16, 1, shade);
      p(6, 3, 20, 2, shade);
      p(6, 4, 20, 1, darken(shade, 0.25));
      break;
    case "beanie":
      p(8, -4, 16, 7, main);
      p(10, -6, 12, 2, main);
      for (let x = 9; x < 23; x += 2) p(x, -3, 1, 5, shade);
      p(10, -5, 5, 1, light);
      p(7, 2, 18, 3, shade);
      p(7, 3, 18, 1, accent);
      p(14, -10, 4, 4, accent);
      p(15, -10, 2, 1, lighten(accent, 0.4));
      p(17, -8, 1, 2, darken(accent, 0.2));
      break;
    case "headphones":
      p(8, -2, 16, 2, main);
      p(10, -3, 12, 1, main);
      p(11, -3, 6, 1, light);
      p(6, 0, 2, 6, main);
      p(24, 0, 2, 6, main);
      p(4, 6, 4, 7, main);
      p(24, 6, 4, 7, main);
      p(7, 6, 1, 7, shade);
      p(24, 6, 1, 7, shade);
      p(5, 8, 1, 3, accent);
      p(26, 8, 1, 3, accent);
      break;
    case "bow":
      p(17, -3, 4, 5, main);
      p(22, -3, 4, 5, main);
      p(21, -2, 1, 3, shade);
      p(20, -1, 3, 1, shade);
      p(18, -3, 2, 1, light);
      p(23, -3, 2, 1, light);
      p(17, 1, 4, 1, shade);
      p(22, 1, 4, 1, shade);
      p(19, 2, 1, 2, main);
      p(23, 2, 1, 2, main);
      break;
    case "catears":
      p(8, 0, 16, 1, main);
      p(8, -5, 5, 5, main);
      p(9, -6, 3, 1, main);
      p(10, -4, 2, 3, accent);
      p(19, -5, 5, 5, main);
      p(20, -6, 3, 1, main);
      p(20, -4, 2, 3, accent);
      p(12, -5, 1, 5, shade);
      p(23, -5, 1, 5, shade);
      break;
    case "straw":
      p(10, -6, 12, 6, main);
      p(12, -7, 8, 1, main);
      for (let x = 11; x < 21; x += 3) p(x, -5, 1, 1, shade);
      p(10, -2, 12, 2, accent);
      p(2, 0, 28, 3, main);
      p(2, 2, 28, 1, shade);
      p(3, 0, 26, 1, light);
      p(1, 1, 1, 2, shade);
      p(30, 1, 1, 2, shade);
      break;
    case "bandana":
      p(8, -2, 16, 5, main);
      p(10, -3, 12, 1, main);
      p(22, -2, 2, 5, shade);
      p(24, 1, 4, 2, main);
      p(26, 3, 2, 4, shade);
      p(25, 3, 1, 3, main);
      for (const [x, y] of [
        [10, -1],
        [14, 1],
        [18, -1],
        [21, 1],
        [12, 2]
      ]) {
        p(x, y, 1, 1, accent);
      }
      break;
    case "wreath":
      for (let x = 7; x < 25; x += 1) p(x, 0, 1, 2, x % 2 ? main : shade);
      p(8, -2, 2, 2, accent);
      p(8, -2, 1, 1, light);
      p(13, -2, 2, 2, light);
      p(13, -2, 1, 1, "#ffffff");
      p(18, -2, 2, 2, accent);
      p(18, -2, 1, 1, light);
      p(22, -1, 2, 2, light);
      break;
    case "takiya":
      p(8, -4, 16, 6, main);
      p(10, -6, 12, 2, main);
      p(20, -5, 4, 7, shade);
      p(10, -5, 5, 1, light);
      p(8, 0, 16, 2, accent);
      for (let x = 9; x < 23; x += 3) p(x, 0, 1, 1, shade);
      p(11, -3, 2, 1, accent);
      p(15, -5, 2, 1, accent);
      p(19, -3, 2, 1, accent);
      p(14, -3, 4, 1, accent);
      // Үкі
      p(21, -10, 2, 6, "#f8fafc");
      p(23, -13, 2, 5, "#e2e8f0");
      p(22, -12, 1, 2, "#cbd5e1");
      p(20, -7, 1, 2, "#cbd5e1");
      break;
    case "cowboy":
      p(10, -8, 12, 8, main);
      p(14, -8, 4, 1, shade);
      p(20, -8, 2, 8, shade);
      p(11, -7, 2, 5, light);
      p(10, -2, 12, 2, accent);
      p(3, 0, 26, 2, main);
      p(1, -2, 3, 2, main);
      p(28, -2, 3, 2, main);
      p(3, 1, 26, 1, shade);
      break;
    case "grad":
      p(8, -2, 16, 4, main);
      p(20, -2, 4, 4, shade);
      p(4, -5, 24, 2, shade);
      p(6, -6, 20, 1, main);
      p(8, -6, 6, 1, light);
      p(15, -7, 2, 1, accent);
      p(25, -4, 1, 8, accent);
      p(24, 4, 3, 2, accent);
      p(24, 5, 3, 1, darken(accent, 0.2));
      break;
    case "pirate":
      p(6, -5, 20, 6, main);
      p(4, -3, 24, 3, main);
      p(8, -7, 16, 2, main);
      p(4, 0, 24, 1, accent);
      p(8, -7, 16, 1, accent);
      p(22, -5, 4, 6, shade);
      p(14, -5, 4, 3, "#f8fafc");
      p(15, -4, 1, 1, main);
      p(17, -4, 1, 1, main);
      p(15, -2, 2, 1, "#f8fafc");
      break;
    case "santa":
      p(8, -4, 16, 6, main);
      p(11, -8, 11, 4, main);
      p(17, -10, 7, 3, main);
      p(20, -8, 4, 10, shade);
      p(24, -10, 4, 4, accent);
      p(25, -10, 2, 1, "#ffffff");
      p(6, 1, 20, 3, accent);
      p(6, 3, 20, 1, darken(accent, 0.12));
      break;
    case "tophat":
      p(9, -12, 14, 12, main);
      p(19, -12, 4, 12, shade);
      p(11, -11, 2, 8, light);
      p(9, -3, 14, 2, accent);
      p(5, -1, 22, 2, main);
      p(5, 0, 22, 1, shade);
      break;
    case "viking":
      p(8, -4, 16, 6, main);
      p(10, -6, 12, 2, main);
      p(20, -5, 4, 7, shade);
      p(10, -5, 5, 1, light);
      p(8, 0, 16, 2, shade);
      for (const x of [10, 15, 21]) p(x, 0, 1, 1, light);
      p(15, 2, 2, 6, shade);
      // Мүйіздер
      p(3, -5, 5, 3, accent);
      p(2, -8, 3, 3, accent);
      p(1, -10, 2, 2, "#d6d3d1");
      p(24, -5, 5, 3, accent);
      p(27, -8, 3, 3, accent);
      p(29, -10, 2, 2, "#d6d3d1");
      break;
    case "wizard":
      p(3, 1, 26, 2, shade);
      p(8, -3, 16, 4, main);
      p(10, -7, 12, 4, main);
      p(12, -10, 8, 3, main);
      p(15, -13, 5, 3, main);
      p(19, -14, 4, 2, main);
      p(18, -10, 4, 11, shade);
      p(11, -2, 1, 1, accent);
      p(16, -8, 1, 1, accent);
      p(20, 0, 1, 1, accent);
      p(13, -5, 2, 1, lighten(accent, 0.3));
      p(14, -6, 1, 3, lighten(accent, 0.3));
      break;
    case "crown":
      p(8, -2, 16, 4, main);
      p(8, -6, 2, 4, main);
      p(14, -7, 4, 5, main);
      p(22, -6, 2, 4, main);
      p(11, -4, 2, 2, main);
      p(19, -4, 2, 2, main);
      p(8, 1, 16, 1, shade);
      p(11, -1, 2, 2, accent);
      p(15, -3, 2, 2, "#3b82f6");
      p(19, -1, 2, 2, accent);
      p(9, -5, 1, 3, light);
      p(15, -7, 1, 2, light);
      break;
    case "bearhood":
      p(5, -5, 22, 6, main);
      p(5, 1, 4, 16, main);
      p(23, 1, 4, 16, shade);
      p(9, -5, 14, 1, light);
      p(5, -9, 6, 5, main);
      p(6, -8, 3, 3, accent);
      p(21, -9, 6, 5, shade);
      p(23, -8, 3, 3, accent);
      p(9, 1, 14, 1, shade);
      p(5, 16, 22, 2, shade);
      break;
    case "spacehelmet":
      // Мөлдір шыны күмбез: бет пен шаш ішінен көрінеді
      p(5, -3, 22, 20, "rgba(186, 230, 253, 0.22)");
      p(8, -5, 16, 1, main);
      p(5, -4, 3, 1, main);
      p(24, -4, 3, 1, main);
      p(4, -3, 1, 3, main);
      p(27, -3, 1, 3, main);
      p(3, 0, 1, 14, main);
      p(28, 0, 1, 14, shade);
      p(4, 14, 1, 3, main);
      p(27, 14, 1, 3, shade);
      p(4, 17, 24, 3, main);
      p(4, 19, 24, 1, shade);
      p(14, 17, 4, 2, accent);
      p(7, -2, 2, 6, "rgba(255, 255, 255, 0.65)");
      p(8, 5, 1, 3, "rgba(255, 255, 255, 0.45)");
      break;
    case "diving":
      p(4, -4, 24, 7, main);
      p(4, 3, 5, 12, main);
      p(23, 3, 5, 12, shade);
      p(4, 15, 24, 4, main);
      p(24, -4, 4, 7, shade);
      p(9, 2, 14, 1, shade);
      p(9, 14, 14, 1, shade);
      p(9, 2, 1, 13, shade);
      p(22, 2, 1, 13, shade);
      p(10, 3, 12, 11, "rgba(125, 211, 252, 0.28)");
      for (const [x, y] of [
        [6, 0],
        [24, 0],
        [6, 15],
        [24, 15]
      ]) {
        p(x, y, 2, 2, accent);
      }
      p(13, -7, 6, 3, shade);
      p(14, -8, 4, 1, main);
      p(6, -3, 6, 1, light);
      break;
    case "knight":
      p(6, -4, 20, 20, main);
      p(8, -6, 16, 2, main);
      p(22, -4, 4, 20, shade);
      p(15, -4, 2, 20, shade);
      p(9, 7, 14, 2, "#111827");
      for (const x of [11, 13, 18, 20]) p(x, 11, 1, 3, "#111827");
      p(8, -3, 2, 9, light);
      p(14, -12, 4, 6, accent);
      p(15, -12, 2, 2, lighten(accent, 0.3));
      p(13, -9, 1, 3, darken(accent, 0.2));
      break;
    case "robot":
      p(6, -3, 20, 19, main);
      p(22, -3, 4, 19, shade);
      p(7, -2, 14, 1, light);
      p(9, 2, 14, 10, "#0b1220");
      p(11, 5, 3, 3, accent);
      p(18, 5, 3, 3, accent);
      p(11, 5, 1, 1, "#ffffff");
      p(18, 5, 1, 1, "#ffffff");
      p(12, 9, 8, 1, accent);
      p(15, -8, 2, 5, shade);
      p(14, -9, 4, 2, accent);
      p(7, 6, 1, 2, light);
      p(24, 6, 1, 2, light);
      p(6, 13, 20, 1, shade);
      break;
    case "halo":
      p(8, -11, 16, 6, "rgba(253, 224, 71, 0.2)");
      p(10, -9, 12, 2, main);
      p(8, -7, 2, 2, main);
      p(22, -7, 2, 2, main);
      p(10, -5, 12, 1, shade);
      p(12, -9, 3, 1, accent);
      break;
  }
}

/* ─────────────────────────── Үстіңгі киім ─────────────────────────── */

function drawArms(p: Plot, base: AvatarBase, fabric: string, fabricShade: string, length: "none" | "short" | "long") {
  const end = length === "long" ? 28 : length === "short" ? 22 : 16;

  if (end > 16) {
    p(2, 16, 6, end - 16, fabric);
    p(24, 16, 6, end - 16, fabric);
    p(28, 16, 2, end - 16, fabricShade);
    p(2, 16, 1, end - 16, lighten(fabric, 0.1));
    p(2, end - 1, 6, 1, fabricShade);
    p(24, end - 1, 6, 1, darken(fabricShade, 0.1));
  }

  p(2, end, 6, 32 - end, base.skin);
  p(24, end, 6, 32 - end, base.skin);
  p(28, end, 2, 32 - end, base.skinShade);
  p(2, 30, 6, 2, base.skinShade);
  p(24, 30, 6, 2, darken(base.skinShade, 0.08));
}

function drawTorso(p: Plot, main: string, shade: string, light: string) {
  p(8, 16, 16, 16, main);
  p(22, 16, 2, 16, shade);
  p(8, 16, 1, 16, light);
  p(8, 31, 16, 1, shade);
}

/** 3×5 цифрлар (әр нүкте 2×2) — майкадағы нөмір үшін */
const DIGITS: Record<string, number[]> = {
  "0": [7, 5, 5, 5, 7],
  "4": [5, 5, 7, 1, 1]
};

function drawDigit(p: Plot, x: number, y: number, digit: string, color: string) {
  (DIGITS[digit] ?? []).forEach((row, rowIndex) => {
    for (let bit = 0; bit < 3; bit += 1) {
      if (row & (1 << (2 - bit))) p(x + bit * 2, y + rowIndex * 2, 2, 2, color);
    }
  });
}

function drawTop(p: Plot, base: AvatarBase, top: AvatarTop) {
  const { main, shade, accent } = top.colors;
  const light = top.colors.light ?? lighten(main, 0.25);
  const neck = () => {
    p(13, 16, 6, 1, base.skinShade);
    p(14, 17, 4, 1, base.skinShade);
  };

  switch (top.style) {
    case "tee":
      drawTorso(p, main, shade, light);
      p(12, 16, 8, 2, shade);
      neck();
      drawArms(p, base, main, shade, "short");
      if (top.print === "star") {
        p(15, 20, 2, 7, accent);
        p(12, 22, 8, 2, accent);
        p(14, 21, 4, 4, accent);
        p(13, 25, 2, 2, accent);
        p(17, 25, 2, 2, accent);
      } else if (top.print === "heart") {
        p(12, 21, 3, 2, accent);
        p(17, 21, 3, 2, accent);
        p(12, 23, 8, 2, accent);
        p(13, 25, 6, 1, accent);
        p(14, 26, 4, 1, accent);
        p(15, 27, 2, 1, accent);
        p(13, 21, 1, 1, lighten(accent, 0.5));
      } else if (top.print === "bolt") {
        p(16, 19, 3, 2, accent);
        p(15, 21, 3, 2, accent);
        p(13, 23, 6, 2, accent);
        p(15, 25, 3, 2, accent);
        p(14, 27, 3, 2, accent);
      }
      break;
    case "polo":
      drawTorso(p, main, shade, light);
      neck();
      p(10, 16, 5, 3, light);
      p(17, 16, 5, 3, light);
      p(10, 18, 5, 1, shade);
      p(17, 18, 5, 1, shade);
      p(15, 17, 2, 6, shade);
      p(15, 19, 2, 1, accent);
      p(15, 21, 2, 1, accent);
      p(19, 21, 2, 2, accent);
      drawArms(p, base, main, shade, "short");
      p(2, 20, 6, 2, light);
      p(24, 20, 6, 2, light);
      break;
    case "hoodie":
      drawTorso(p, main, shade, light);
      p(9, 16, 14, 2, shade);
      p(13, 16, 6, 1, base.skinShade);
      // Сыдырма: бау қолданылмайды — екі ақ бау кеудеде бет-әлпетке ұқсап кетеді
      p(15, 18, 2, 11, shade);
      p(15, 20, 2, 2, accent);
      p(10, 25, 12, 4, shade);
      p(10, 25, 12, 1, darken(shade, 0.15));
      p(10, 26, 1, 3, main);
      p(21, 26, 1, 3, main);
      p(8, 29, 16, 3, shade);
      p(9, 30, 14, 1, main);
      drawArms(p, base, main, shade, "long");
      p(2, 25, 6, 3, shade);
      p(24, 25, 6, 3, shade);
      break;
    case "sweater":
      drawTorso(p, main, shade, light);
      p(12, 16, 8, 1, accent);
      p(13, 17, 6, 1, accent);
      p(14, 18, 4, 1, accent);
      p(13, 16, 6, 1, base.skinShade);
      p(14, 17, 4, 1, base.skinShade);
      p(15, 18, 2, 1, base.skinShade);
      for (let y = 20; y < 29; y += 3) {
        for (let x = 9; x < 22; x += 3) {
          p(x, y, 1, 1, shade);
          p(x + 1, y + 1, 1, 1, light);
        }
      }
      p(8, 29, 16, 3, shade);
      for (let x = 9; x < 23; x += 2) p(x, 29, 1, 3, main);
      drawArms(p, base, main, shade, "long");
      p(2, 25, 6, 3, shade);
      p(24, 25, 6, 3, shade);
      break;
    case "stripes":
      drawTorso(p, main, shade, light);
      for (let y = 18; y < 31; y += 4) p(8, y, 16, 2, accent);
      neck();
      drawArms(p, base, main, shade, "long");
      for (let y = 18; y < 27; y += 4) {
        p(2, y, 6, 2, accent);
        p(24, y, 6, 2, accent);
      }
      break;
    case "uniform":
      drawTorso(p, main, shade, light);
      p(13, 16, 6, 2, base.skinShade);
      p(10, 16, 4, 3, "#ffffff");
      p(18, 16, 4, 3, "#ffffff");
      p(12, 18, 2, 1, shade);
      p(18, 18, 2, 1, shade);
      p(14, 17, 4, 2, darken(accent, 0.2));
      p(15, 19, 2, 9, accent);
      p(14, 27, 4, 2, accent);
      p(15, 22, 2, 1, lighten(accent, 0.3));
      p(11, 22, 1, 1, shade);
      p(11, 26, 1, 1, shade);
      p(18, 21, 3, 3, shade);
      p(18, 21, 3, 1, darken(shade, 0.1));
      drawArms(p, base, main, shade, "long");
      p(2, 26, 6, 2, shade);
      p(24, 26, 6, 2, shade);
      break;
    case "pinafore": {
      // Ақ көйлек үстіне қою сарафан және бантик
      const shirt = top.colors.light ?? "#f8fafc";
      drawTorso(p, shirt, "#c7ceda", "#ffffff");
      p(13, 16, 6, 1, base.skinShade);
      p(10, 16, 4, 2, "#ffffff");
      p(18, 16, 4, 2, "#ffffff");
      p(13, 17, 6, 2, accent);
      p(15, 17, 2, 2, darken(accent, 0.25));
      p(13, 17, 1, 2, lighten(accent, 0.2));
      p(8, 20, 16, 12, main);
      p(22, 20, 2, 12, shade);
      p(9, 16, 3, 4, main);
      p(20, 16, 3, 4, main);
      p(12, 20, 8, 1, shade);
      p(15, 22, 2, 1, "#fbbf24");
      p(15, 25, 2, 1, "#fbbf24");
      drawArms(p, base, shirt, "#c7ceda", "long");
      p(2, 26, 6, 2, "#c7ceda");
      p(24, 26, 6, 2, "#c7ceda");
      break;
    }
    case "blouse":
      drawTorso(p, main, shade, light);
      p(10, 16, 12, 2, accent);
      p(11, 18, 10, 1, accent);
      for (let x = 11; x < 21; x += 2) p(x, 19, 1, 1, accent);
      p(13, 16, 6, 1, base.skinShade);
      for (const y of [21, 24, 27]) p(15, y, 2, 1, shade);
      drawArms(p, base, main, shade, "short");
      p(1, 17, 1, 4, main);
      p(30, 17, 1, 4, shade);
      p(2, 20, 6, 2, accent);
      p(24, 20, 6, 2, accent);
      break;
    case "denim":
      drawTorso(p, main, shade, light);
      p(14, 16, 4, 16, accent);
      p(14, 16, 4, 1, base.skinShade);
      p(11, 16, 3, 7, shade);
      p(18, 16, 3, 7, shade);
      p(12, 16, 1, 5, light);
      p(9, 20, 4, 4, shade);
      p(19, 20, 4, 4, shade);
      p(9, 20, 4, 1, darken(shade, 0.15));
      p(19, 20, 4, 1, darken(shade, 0.15));
      p(9, 24, 4, 1, light);
      p(19, 24, 4, 1, light);
      for (const y of [26, 29]) {
        p(12, y, 1, 1, "#fbbf24");
        p(19, y, 1, 1, "#fbbf24");
      }
      p(8, 30, 16, 2, shade);
      drawArms(p, base, main, shade, "long");
      p(2, 25, 6, 3, shade);
      p(24, 25, 6, 3, shade);
      break;
    case "leather":
      drawTorso(p, main, shade, light);
      p(9, 16, 5, 5, shade);
      p(18, 16, 5, 5, shade);
      p(13, 16, 6, 2, base.skinShade);
      p(14, 18, 4, 2, "#f8fafc");
      for (let index = 0; index < 11; index += 1) p(12 + Math.floor(index / 2), 19 + index, 1, 1, accent);
      p(9, 21, 1, 7, light);
      p(8, 29, 16, 2, shade);
      p(9, 29, 2, 2, accent);
      p(18, 24, 4, 1, accent);
      drawArms(p, base, main, shade, "long");
      p(2, 26, 6, 2, shade);
      p(24, 26, 6, 2, shade);
      p(3, 26, 1, 2, accent);
      p(25, 26, 1, 2, accent);
      break;
    case "varsity":
      drawTorso(p, main, shade, light);
      p(12, 16, 8, 2, accent);
      p(13, 16, 6, 1, base.skinShade);
      // «J» әрпі
      p(10, 20, 5, 2, accent);
      p(12, 20, 2, 7, accent);
      p(9, 25, 2, 2, accent);
      p(9, 26, 4, 1, accent);
      for (const y of [19, 22, 25, 28]) p(18, y, 1, 1, accent);
      p(8, 29, 16, 1, accent);
      p(8, 31, 16, 1, accent);
      drawArms(p, base, accent, darken(accent, 0.2), "long");
      p(2, 25, 6, 3, main);
      p(24, 25, 6, 3, main);
      p(2, 26, 6, 1, accent);
      p(24, 26, 6, 1, accent);
      break;
    case "puffer":
      drawTorso(p, main, shade, light);
      p(13, 16, 6, 1, base.skinShade);
      for (const y of [19, 23, 27]) {
        p(8, y, 16, 1, shade);
        p(9, y + 1, 13, 1, light);
      }
      p(15, 17, 2, 15, shade);
      drawArms(p, base, main, shade, "long");
      for (const y of [19, 23]) {
        p(2, y, 6, 1, shade);
        p(24, y, 6, 1, shade);
      }
      p(1, 17, 1, 10, main);
      p(30, 17, 1, 10, shade);
      break;
    case "raincoat":
      drawTorso(p, main, shade, light);
      p(9, 16, 14, 2, shade);
      p(13, 16, 6, 1, base.skinShade);
      for (const y of [20, 24, 28]) {
        p(11, y, 3, 1, accent);
        p(18, y, 3, 1, accent);
      }
      p(15, 18, 2, 14, shade);
      p(9, 18, 1, 12, light);
      p(8, 32, 16, 2, main);
      p(22, 32, 2, 2, shade);
      p(8, 33, 16, 1, shade);
      drawArms(p, base, main, shade, "long");
      break;
    case "kamzol": {
      // Ақ көйлек үстіне оюлы камзол
      const shirt = top.colors.light ?? "#f8fafc";
      drawTorso(p, shirt, "#c7ceda", "#ffffff");
      p(13, 16, 6, 1, base.skinShade);
      p(14, 17, 4, 2, "#e2e8f0");
      p(8, 16, 6, 16, main);
      p(18, 16, 6, 16, main);
      p(22, 16, 2, 16, shade);
      p(13, 16, 1, 16, accent);
      p(18, 16, 1, 16, accent);
      p(8, 30, 6, 2, accent);
      p(18, 30, 6, 2, accent);
      for (const [x, y] of [
        [9, 20],
        [20, 20],
        [9, 25],
        [20, 25]
      ]) {
        p(x, y, 3, 1, accent);
        p(x + 1, y - 1, 1, 3, accent);
      }
      drawArms(p, base, shirt, "#c7ceda", "long");
      p(2, 26, 6, 2, "#c7ceda");
      p(24, 26, 6, 2, "#c7ceda");
      break;
    }
    case "chapan":
      p(8, 16, 16, 20, main);
      p(22, 16, 2, 20, shade);
      p(8, 16, 1, 20, light);
      p(14, 16, 4, 4, "#f8fafc");
      p(14, 16, 4, 1, base.skinShade);
      p(12, 16, 2, 20, accent);
      p(18, 16, 2, 20, accent);
      p(14, 20, 4, 16, shade);
      p(8, 26, 16, 2, shade);
      p(15, 26, 2, 2, accent);
      p(8, 34, 16, 2, accent);
      for (const [x, y] of [
        [9, 20],
        [21, 20],
        [9, 30],
        [21, 30]
      ]) {
        p(x, y, 2, 2, accent);
      }
      drawArms(p, base, main, shade, "long");
      p(2, 24, 6, 4, accent);
      p(24, 24, 6, 4, accent);
      p(2, 25, 6, 1, darken(accent, 0.2));
      p(24, 25, 6, 1, darken(accent, 0.2));
      break;
    case "labcoat":
      p(8, 16, 16, 20, main);
      p(22, 16, 2, 20, shade);
      p(8, 35, 16, 1, shade);
      p(13, 16, 6, 6, accent);
      p(15, 17, 2, 5, "#1e3a8a");
      p(13, 16, 6, 1, base.skinShade);
      p(11, 16, 2, 9, shade);
      p(19, 16, 2, 9, shade);
      p(18, 25, 4, 4, shade);
      p(19, 26, 2, 2, main);
      p(20, 23, 1, 3, "#2563eb");
      p(20, 23, 1, 1, "#f8fafc");
      p(15, 27, 1, 9, shade);
      p(13, 27, 1, 1, shade);
      p(13, 31, 1, 1, shade);
      drawArms(p, base, main, shade, "long");
      break;
    case "chef":
      drawTorso(p, main, shade, light);
      p(11, 16, 10, 2, shade);
      p(13, 16, 6, 1, base.skinShade);
      p(13, 18, 6, 2, accent);
      for (const y of [21, 25, 29]) {
        p(11, y, 2, 2, "#9ca3af");
        p(19, y, 2, 2, "#9ca3af");
      }
      p(15, 20, 1, 12, shade);
      drawArms(p, base, main, shade, "long");
      p(2, 25, 6, 3, shade);
      p(24, 25, 6, 3, shade);
      break;
    case "ninja":
      drawTorso(p, main, shade, light);
      for (let index = 0; index < 9; index += 1) {
        p(9 + index, 16 + index, 2, 1, shade);
        p(21 - index, 16 + index, 1, 1, darken(shade, 0.2));
      }
      p(8, 26, 16, 3, accent);
      p(8, 27, 16, 1, darken(accent, 0.2));
      p(19, 26, 3, 6, accent);
      drawArms(p, base, main, shade, "long");
      for (const y of [25, 27]) {
        p(2, y, 6, 1, shade);
        p(24, y, 6, 1, shade);
      }
      break;
    case "space":
      drawTorso(p, main, shade, light);
      p(12, 16, 8, 2, shade);
      p(10, 19, 12, 7, shade);
      p(11, 20, 10, 5, "#1f2937");
      p(12, 21, 2, 2, "#ef4444");
      p(15, 21, 2, 2, "#22c55e");
      p(18, 21, 2, 2, "#3b82f6");
      p(12, 24, 8, 1, "#38bdf8");
      p(8, 27, 16, 2, accent);
      p(19, 17, 3, 2, "#2563eb");
      drawArms(p, base, main, shade, "long");
      p(2, 21, 6, 2, accent);
      p(24, 21, 6, 2, accent);
      // Қолғап
      p(2, 28, 6, 4, light);
      p(24, 28, 6, 4, shade);
      break;
    case "hero": {
      const cape = top.colors.extra ?? accent;
      p(0, 17, 2, 15, cape);
      p(30, 17, 2, 15, darken(cape, 0.25));
      drawTorso(p, main, shade, light);
      p(13, 16, 6, 1, base.skinShade);
      p(12, 19, 8, 7, accent);
      p(11, 21, 10, 3, accent);
      p(14, 26, 4, 1, accent);
      p(14, 20, 4, 5, "#fde047");
      p(15, 21, 2, 3, "#ca8a04");
      p(8, 28, 16, 2, "#facc15");
      p(15, 28, 2, 2, "#ca8a04");
      drawArms(p, base, main, shade, "long");
      p(2, 24, 6, 8, accent);
      p(24, 24, 6, 8, darken(accent, 0.15));
      break;
    }
    case "armor":
    case "gold": {
      const gold = top.style === "gold";
      drawTorso(p, main, shade, light);
      p(9, 17, 14, 8, light);
      p(10, 18, 12, 6, main);
      p(21, 17, 2, 8, shade);
      p(8, 25, 16, 1, shade);
      p(8, 28, 16, 1, shade);
      for (const [x, y] of [
        [10, 18],
        [21, 18],
        [10, 23],
        [21, 23]
      ]) {
        p(x, y, 1, 1, accent);
      }
      p(8, 30, 16, 2, gold ? "#92400e" : "#78350f");
      p(15, 30, 2, 2, gold ? "#fef08a" : "#d6d3d1");
      drawArms(p, base, main, shade, "long");
      // Иық сауыты мен қолғап
      p(1, 15, 7, 4, main);
      p(24, 15, 7, 4, main);
      p(1, 18, 7, 1, shade);
      p(24, 18, 7, 1, shade);
      p(2, 15, 3, 1, light);
      p(25, 15, 3, 1, light);
      p(2, 26, 6, 6, shade);
      p(24, 26, 6, 6, darken(shade, 0.1));
      p(3, 27, 2, 1, light);
      if (gold) {
        p(11, 18, 2, 1, "#ffffff");
        p(26, 16, 2, 1, "#ffffff");
        p(15, 21, 2, 2, "#ef4444");
      }
      break;
    }
    case "tank":
      drawTorso(p, main, shade, light);
      p(12, 16, 8, 2, accent);
      p(13, 16, 6, 2, base.skinShade);
      p(8, 16, 2, 6, accent);
      p(22, 16, 2, 6, accent);
      drawDigit(p, 10, 20, "4", accent);
      drawDigit(p, 17, 20, "0", accent);
      p(8, 31, 16, 1, accent);
      drawArms(p, base, main, shade, "none");
      break;
  }
}

/* ─────────────────────────── Астыңғы киім ─────────────────────────── */

function drawPants(p: Plot, main: string, shade: string, light: string) {
  p(8, 32, 16, 12, main);
  p(22, 32, 2, 12, shade);
  p(15, 34, 2, 10, shade);
  p(8, 32, 1, 12, light);
  p(8, 43, 16, 1, shade);
}

function drawSkinLegs(p: Plot, base: AvatarBase, fromY: number, thin = false) {
  const height = 44 - fromY;
  if (thin) {
    p(10, fromY, 4, height, base.skin);
    p(18, fromY, 4, height, base.skin);
    p(13, fromY, 1, height, base.skinShade);
    p(21, fromY, 1, height, base.skinShade);
  } else {
    p(8, fromY, 16, height, base.skin);
    p(15, fromY, 2, height, base.skinShade);
    p(22, fromY, 2, height, base.skinShade);
  }
}

/** Кеңейе түсетін етек: әр жолы [y, x, ені]; бүрмелер тұрақты x бойынша сызылады */
function drawFlare(
  p: Plot,
  rows: Array<[number, number, number]>,
  main: string,
  shade: string,
  light: string,
  pleatStep: number
) {
  for (const [y, x, width] of rows) {
    p(x, y, width, 1, main);
    for (let column = x; column < x + width; column += 1) {
      const phase = (column + 20) % pleatStep;
      if (phase === 0) p(column, y, 1, 1, shade);
      else if (phase === 1) p(column, y, 1, 1, light);
    }
    p(x + width - 2, y, 2, 1, darken(shade, 0.05));
  }
}

function drawBottom(p: Plot, base: AvatarBase, bottom: AvatarBottom) {
  const { main, shade, accent } = bottom.colors;
  const light = bottom.colors.light ?? lighten(main, 0.25);

  switch (bottom.style) {
    case "jeans":
    case "ripped":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, shade);
      p(10, 32, 1, 2, darken(shade, 0.2));
      p(21, 32, 1, 2, darken(shade, 0.2));
      p(15, 32, 2, 2, accent);
      p(9, 34, 3, 1, light);
      p(20, 34, 3, 1, light);
      p(10, 38, 3, 2, light);
      p(19, 38, 3, 2, light);
      p(8, 42, 7, 1, light);
      p(17, 42, 7, 1, light);
      if (bottom.style === "ripped") {
        p(9, 38, 4, 1, base.skin);
        p(10, 39, 3, 1, "#f1f5f9");
        p(18, 36, 4, 1, base.skin);
        p(19, 37, 2, 1, "#f1f5f9");
        p(11, 41, 2, 1, base.skin);
      }
      break;
    case "trousers":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, shade);
      p(8, 32, 16, 1, "#030712");
      p(15, 32, 2, 1, accent);
      p(11, 35, 1, 8, light);
      p(20, 35, 1, 8, light);
      break;
    case "sweat":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, shade);
      p(13, 34, 1, 3, accent);
      p(18, 34, 1, 3, accent);
      p(8, 34, 1, 8, accent);
      p(23, 34, 1, 8, accent);
      p(8, 41, 16, 3, shade);
      for (let x = 9; x < 23; x += 2) p(x, 41, 1, 3, main);
      break;
    case "cargo":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, accent);
      p(8, 37, 5, 5, shade);
      p(19, 37, 5, 5, shade);
      p(8, 37, 5, 1, darken(shade, 0.2));
      p(19, 37, 5, 1, darken(shade, 0.2));
      p(10, 38, 1, 1, accent);
      p(21, 38, 1, 1, accent);
      break;
    case "leggings":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, accent);
      p(10, 35, 1, 7, light);
      p(19, 35, 1, 7, light);
      break;
    case "shorts":
    case "sportshorts":
      drawSkinLegs(p, base, 38);
      p(8, 32, 16, 6, main);
      p(22, 32, 2, 6, shade);
      p(15, 35, 2, 3, shade);
      p(8, 32, 16, 2, shade);
      p(8, 37, 16, 1, light);
      p(10, 40, 3, 1, base.skinShade);
      p(19, 40, 3, 1, base.skinShade);
      if (bottom.style === "sportshorts") {
        p(8, 32, 1, 6, accent);
        p(23, 32, 1, 6, accent);
        p(8, 37, 16, 1, accent);
      }
      break;
    case "skirt":
    case "plaid":
      // Жіңішке аяқ пен қысқа ақ ұйық
      drawSkinLegs(p, base, 41, true);
      p(10, 42, 4, 2, "#f8fafc");
      p(18, 42, 4, 2, "#f8fafc");
      p(13, 42, 1, 2, "#cbd5e1");
      p(21, 42, 1, 2, "#cbd5e1");
      // Белдік
      p(8, 32, 16, 2, shade);
      p(9, 32, 14, 1, darken(shade, 0.15));
      p(20, 32, 2, 2, accent);
      // Жұмсақ A-пішінді бүрмелі етек (дененің енінен сәл ғана кең)
      drawFlare(
        p,
        [
          [34, 8, 16],
          [35, 7, 18],
          [36, 7, 18],
          [37, 7, 18],
          [38, 6, 20],
          [39, 6, 20],
          [40, 6, 20]
        ],
        main,
        shade,
        light,
        4
      );
      p(8, 34, 16, 1, lighten(main, 0.12));
      p(6, 40, 20, 1, shade);
      if (bottom.style === "plaid") {
        p(7, 36, 18, 1, accent);
        p(6, 39, 20, 1, accent);
        for (let x = 9; x < 25; x += 4) p(x, 34, 1, 6, darken(main, 0.35));
      }
      break;
    case "denimskirt":
      drawSkinLegs(p, base, 38, true);
      p(8, 32, 16, 2, shade);
      p(15, 32, 2, 2, accent);
      drawFlare(
        p,
        [
          [34, 7, 18],
          [35, 7, 18],
          [36, 7, 18],
          [37, 6, 20]
        ],
        main,
        shade,
        light,
        9
      );
      p(15, 34, 2, 4, shade);
      p(9, 34, 3, 1, light);
      p(20, 34, 3, 1, light);
      for (let x = 6; x < 26; x += 2) p(x, 37, 1, 1, light);
      break;
    case "longskirt":
      drawFlare(
        p,
        [
          [32, 8, 16],
          [33, 8, 16],
          [34, 8, 16],
          [35, 8, 16],
          [36, 7, 18],
          [37, 7, 18],
          [38, 7, 18],
          [39, 7, 18],
          [40, 6, 20],
          [41, 6, 20],
          [42, 6, 20],
          [43, 6, 20]
        ],
        main,
        shade,
        light,
        5
      );
      p(8, 32, 16, 2, shade);
      p(8, 33, 16, 1, accent);
      p(18, 33, 3, 3, accent);
      p(7, 41, 18, 1, accent);
      p(6, 43, 20, 1, shade);
      break;
    case "ninja":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, shade);
      p(7, 36, 2, 6, main);
      p(23, 36, 2, 6, shade);
      p(8, 40, 16, 1, accent);
      p(8, 42, 16, 1, accent);
      break;
    case "space":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, accent);
      p(9, 37, 5, 3, shade);
      p(18, 37, 5, 3, shade);
      p(10, 38, 3, 1, light);
      p(19, 38, 3, 1, light);
      p(8, 34, 2, 3, shade);
      p(22, 34, 2, 3, shade);
      break;
    case "armor":
    case "gold":
      drawPants(p, main, shade, light);
      p(8, 32, 16, 2, shade);
      p(8, 35, 16, 1, shade);
      p(8, 40, 16, 1, shade);
      p(9, 37, 5, 3, light);
      p(18, 37, 5, 3, light);
      p(11, 38, 1, 1, accent);
      p(20, 38, 1, 1, accent);
      if (bottom.style === "gold") {
        p(10, 37, 1, 1, "#ffffff");
      }
      break;
  }
}

/* ─────────────────────────── Аяқ киім ─────────────────────────── */

function drawShoes(p: Plot, base: AvatarBase, shoes: AvatarShoes) {
  const { main, shade, accent } = shoes.colors;
  const light = shoes.colors.light ?? lighten(main, 0.25);
  const pair = (draw: (x: number) => void) => {
    draw(8);
    draw(16);
  };

  switch (shoes.style) {
    case "sneakers":
      pair((x) => {
        p(x, 44, 8, 4, main);
        p(x, 47, 8, 1, shade);
        p(x + 2, 44, 4, 1, accent);
        p(x + 4, 46, 3, 1, accent);
        p(x, 45, 2, 2, light);
        p(x + 7, 44, 1, 3, shade);
      });
      break;
    case "hightop":
      pair((x) => {
        p(x, 41, 8, 7, main);
        p(x, 41, 8, 1, light);
        p(x + 7, 41, 1, 6, shade);
        for (const y of [42, 44]) p(x + 2, y, 4, 1, accent);
        p(x, 46, 8, 1, "#f8fafc");
        p(x, 47, 8, 1, "#cbd5e1");
        p(x + 1, 45, 2, 1, "#f8fafc");
      });
      break;
    case "school":
      pair((x) => {
        p(x, 44, 8, 1, "#f8fafc");
        p(x, 45, 8, 3, main);
        p(x + 1, 45, 3, 1, light);
        p(x, 47, 8, 1, shade);
        p(x + 7, 45, 1, 2, shade);
      });
      break;
    case "boots":
    case "rain":
      pair((x) => {
        p(x, 39, 8, 9, main);
        p(x, 39, 8, 2, accent);
        p(x + 6, 39, 2, 9, shade);
        p(x, 47, 8, 1, darken(shade, 0.2));
        p(x + 1, 41, 1, 5, light);
        if (shoes.style === "boots") p(x + 3, 43, 2, 1, "#d6d3d1");
      });
      break;
    case "sandals":
      pair((x) => {
        p(x, 45, 8, 3, base.skin);
        p(x + 7, 45, 1, 3, base.skinShade);
        p(x, 45, 8, 1, main);
        p(x + 3, 46, 2, 1, main);
        p(x, 47, 8, 1, shade);
        p(x + 1, 46, 1, 1, base.skinShade);
        p(x + 3, 45, 2, 1, accent);
      });
      break;
    case "flats":
      pair((x) => {
        p(x + 1, 45, 6, 3, main);
        p(x + 1, 47, 6, 1, shade);
        p(x + 3, 45, 2, 1, accent);
        p(x + 2, 45, 1, 1, light);
      });
      break;
    case "skates":
      pair((x) => {
        p(x, 41, 8, 5, main);
        p(x, 41, 8, 1, light);
        p(x + 7, 41, 1, 5, shade);
        p(x + 2, 42, 4, 1, accent);
        p(x, 45, 8, 1, "#9ca3af");
        for (const wheel of [0, 3, 6]) {
          p(x + wheel, 46, 2, 2, "#111827");
          p(x + wheel, 46, 1, 1, accent);
        }
      });
      break;
    case "tabi":
      pair((x) => {
        p(x, 43, 8, 5, main);
        p(x + 2, 45, 1, 3, shade);
        p(x, 43, 8, 1, accent);
        p(x, 47, 8, 1, shade);
      });
      break;
    case "space":
      for (const x of [6, 16]) {
        p(x, 41, 10, 7, main);
        p(x, 43, 10, 1, accent);
        p(x, 47, 10, 1, shade);
        p(x + 8, 41, 2, 6, shade);
        p(x + 1, 44, 2, 2, light);
      }
      break;
    case "armor":
    case "gold":
      for (const x of [7, 16]) {
        p(x, 41, 9, 7, main);
        p(x, 43, 9, 1, shade);
        p(x, 45, 9, 1, shade);
        p(x, 47, 9, 1, darken(shade, 0.2));
        p(x + 1, 42, 2, 1, light);
        if (shoes.style === "gold") p(x + 2, 42, 1, 1, "#ffffff");
      }
      break;
  }
}

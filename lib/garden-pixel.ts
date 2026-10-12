/**
 * Пиксель-бақ генераторы: аралдар, ағаштар, ағаш үй, бұлттар, жәндіктер.
 * Барлығы canvas-қа пиксельдеп салынады — дайын сурет қолданылмайды,
 * сондықтан кез келген өлшемде анық көрінеді.
 */

import { AVATAR_H, AVATAR_HEAD_ROOM, AVATAR_W, downsampleAvatarPixels, drawAvatar } from "@/lib/avatar-pixel";
import type { AvatarLook } from "@/lib/types";

/**
 * Бақтағы персонаж спрайты: профильдегі толық 32×48 сурет жасырын canvas-қа
 * салынып, 2×2 блоктап кішірейтіледі — үй мен ағаштардың масштабына сай келеді.
 * Түнде сахнамен бірге қараяды.
 */
function buildGardenAvatar(look: AvatarLook, blink: boolean, night: boolean) {
  const fullWidth = AVATAR_W;
  const fullHeight = AVATAR_H + AVATAR_HEAD_ROOM;
  const sprite = document.createElement("canvas");
  sprite.width = Math.ceil(fullWidth / 2);
  sprite.height = Math.ceil(fullHeight / 2);
  const full = document.createElement("canvas");
  full.width = fullWidth;
  full.height = fullHeight;
  const fullCtx = full.getContext("2d");
  const spriteCtx = sprite.getContext("2d");
  if (!fullCtx || !spriteCtx) return sprite;

  drawAvatar(
    (x, y, fw, fh, color) => {
      fullCtx.fillStyle = color;
      fullCtx.fillRect(x, y, fw, fh);
    },
    0,
    fullHeight,
    look,
    { blink }
  );

  const small = downsampleAvatarPixels(fullCtx.getImageData(0, 0, fullWidth, fullHeight).data, fullWidth, fullHeight);
  if (night) {
    const tint = [8, 16, 42];
    for (let index = 0; index < small.length; index += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        small[index + channel] = Math.round(small[index + channel] * 0.62 + tint[channel] * 0.38);
      }
    }
  }
  const image = spriteCtx.createImageData(sprite.width, sprite.height);
  image.data.set(small);
  spriteCtx.putImageData(image, 0, 0);
  return sprite;
}

export const GARDEN_COLORS = {
  skyTop: "#2f86cf",
  skyMid: "#68bde8",
  skyLow: "#aadcf0",
  nTop: "#050b1c",
  nMid: "#0e2140",
  nLow: "#274264",
  grassH: "#a5e05a",
  grassL: "#7fcc3c",
  grass: "#5da42b",
  grassD: "#3f7c1c",
  grassE: "#2a5412",
  dirtH: "#a97343",
  dirtL: "#8f5c31",
  dirt: "#7a4a26",
  dirtD: "#5b3419",
  dirtX: "#3d2110",
  stoneL: "#7b7d89",
  stone: "#63656f",
  stoneD: "#4a4c55",
  stoneX: "#33353c",
  barkH: "#b87a44",
  barkL: "#96602f",
  bark: "#7a4a22",
  barkD: "#5a3316",
  barkX: "#3c1f0c",
  woodL: "#a8763f",
  wood: "#87582c",
  woodD: "#5e3a18",
  roofL: "#a8543c",
  roof: "#8e3f2c",
  roofD: "#63291b",
  win: "#8fd0e8",
  winN: "#ffce4a",
  door: "#4b2d13"
} as const;

const C = GARDEN_COLORS;

type TreeConfig = { th: number; tw: number; depth: number; cr: number; n: number; tone: number };

const TREE: (TreeConfig | null)[] = [
  null,
  { th: 12, tw: 3, depth: 0, cr: 0, n: 0, tone: 1 },
  { th: 18, tw: 5, depth: 1, cr: 11, n: 9, tone: 1 },
  { th: 24, tw: 7, depth: 2, cr: 13, n: 10, tone: 2 },
  { th: 32, tw: 9, depth: 2, cr: 16, n: 11, tone: 2 },
  { th: 38, tw: 11, depth: 3, cr: 18, n: 11, tone: 3 },
  { th: 44, tw: 13, depth: 3, cr: 20, n: 12, tone: 3 },
  { th: 50, tw: 14, depth: 3, cr: 21, n: 12, tone: 4 },
  { th: 56, tw: 15, depth: 3, cr: 22, n: 12, tone: 4 },
  { th: 62, tw: 16, depth: 3, cr: 23, n: 12, tone: 5 }
];

const TONES: Record<number, { d: string; m: string; l: string; h: string }> = {
  1: { d: "#2f6b18", m: "#5aa82c", l: "#8ad84c", h: "#b7ef78" },
  2: { d: "#28601a", m: "#4f9c28", l: "#7dcd45", h: "#a9e86b" },
  3: { d: "#1f5416", m: "#438f22", l: "#6dbe3a", h: "#9adf5e" },
  4: { d: "#194a13", m: "#37821c", l: "#5faf30", h: "#8ed352" },
  5: { d: "#7a5610", m: "#c08f1c", l: "#ecc245", h: "#f9e388" }
};

const FRUIT: Record<number, string> = { 6: "#f4a6cd", 7: "#d3352c", 8: "#d3352c", 9: "#f28a16" };

const LEAF5 = [0b01010, 0b11111, 0b11111, 0b01110, 0b00100];
const LEAF3 = [0b010, 0b111, 0b010];

function rnd(s: number) {
  const v = Math.sin(s * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function mkRnd(seed: number) {
  let s = seed * 7.31 + 1.7;
  return () => {
    s += 1.13;
    return rnd(s);
  };
}

function mix(a: string, b: string, k: number) {
  const p = (h: string) => {
    const c = h.replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const A = p(a);
  const B = p(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(
    A[2] + (B[2] - A[2]) * k
  )})`;
}

function rgba(hex: string, a: number) {
  const c = hex.replace("#", "");
  return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a})`;
}

type Tools = {
  px: (x: number, y: number, w: number, h: number, c: string) => void;
  disc: (cx: number, cy: number, r: number, c: string) => void;
  ell: (cx: number, cy: number, rx: number, ry: number, c: string) => void;
  sprite: (x: number, y: number, rows: number[], bits: number, c: string) => void;
};

function tools(ctx: CanvasRenderingContext2D): Tools {
  const px: Tools["px"] = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  };
  const disc: Tools["disc"] = (cx, cy, r, c) => {
    ctx.fillStyle = c;
    const R = Math.round(r);
    for (let dy = -R; dy <= R; dy += 1) {
      const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
      if (half > 0) ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2, 1);
    }
  };
  const ell: Tools["ell"] = (cx, cy, rx, ry, c) => {
    ctx.fillStyle = c;
    for (let dy = -Math.round(ry); dy <= Math.round(ry); dy += 1) {
      const k = 1 - (dy * dy) / (ry * ry);
      if (k <= 0) continue;
      const half = Math.round(rx * Math.sqrt(k));
      if (half > 0) ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2, 1);
    }
  };
  const sprite: Tools["sprite"] = (x, y, rows, bits, c) => {
    ctx.fillStyle = c;
    for (let r = 0; r < rows.length; r += 1)
      for (let b = 0; b < bits; b += 1)
        if (rows[r] & (1 << (bits - 1 - b))) ctx.fillRect(Math.round(x) + b, Math.round(y) + r, 1, 1);
  };
  return { px, disc, ell, sprite };
}

function drawIsland(
  t: Tools,
  cx: number,
  topY: number,
  halfW: number,
  depth: number,
  night: boolean,
  seed: number
) {
  const { px } = t;
  const R = mkRnd(seed);
  const sh = night ? 0.5 : 0;
  const gH = mix(C.grassH, "#050b1c", sh);
  const gL = mix(C.grassL, "#050b1c", sh);
  const gM = mix(C.grass, "#050b1c", sh);
  const gD = mix(C.grassD, "#050b1c", sh);
  const gE = mix(C.grassE, "#050b1c", sh);
  const dL = mix(C.dirtL, "#050b1c", sh);
  const dM = mix(C.dirt, "#050b1c", sh);
  const dD = mix(C.dirtD, "#050b1c", sh);
  const dX = mix(C.dirtX, "#050b1c", sh);
  const sL = mix(C.stoneL, "#050b1c", sh);
  const sM = mix(C.stone, "#050b1c", sh);
  const sD = mix(C.stoneD, "#050b1c", sh);
  const sX = mix(C.stoneX, "#050b1c", sh);

  const halves: number[] = [];
  for (let i = 0; i < depth; i += 1) {
    const f = i / depth;
    const base = halfW * (1 - Math.pow(f, 1.45) * 0.97);
    const jag = i < 3 ? 0 : R() > 0.62 ? -2 - Math.floor(R() * 3) : 0;
    halves.push(Math.max(2, Math.round(base + jag)));
  }
  for (let i = depth - 2; i >= 3; i -= 1) halves[i] = Math.max(halves[i], halves[i + 1] + 1);

  for (let i = 0; i < depth; i += 1) {
    const half = halves[i];
    const y = topY + i;
    const stoneStart = depth * 0.46;
    const body = i < 2 ? gM : i < 4 ? gD : i < stoneStart ? dM : sM;
    px(cx - half, y, half * 2, 1, body);
    if (i === 0) px(cx - half, y, half * 2, 1, gH);
    if (i === 1) px(cx - half, y, half * 2, 1, gL);
    if (i >= 4 && i < stoneStart) {
      px(cx - half, y, 2, 1, dD);
      px(cx + half - 2, y, 2, 1, dD);
    }
    if (i >= stoneStart) {
      px(cx - half, y, 2, 1, sD);
      px(cx + half - 2, y, 2, 1, sD);
    }
    if (i > depth - 4) px(cx - half, y, half * 2, 1, sX);
  }
  for (let i = 0; i < depth; i += 1) {
    const half = halves[i];
    px(cx - half - 1, topY + i, 1, 1, i < 4 ? gE : i < depth * 0.46 ? dX : sX);
    px(cx + half, topY + i, 1, 1, i < 4 ? gE : i < depth * 0.46 ? dX : sX);
  }
  for (let i = 0; i < 5; i += 1) {
    const side = i % 2 ? 1 : -1;
    const row = 2 + Math.floor(R() * 3);
    px(cx + side * (halves[row] - 1), topY + row, 2, 3 + Math.floor(R() * 3), gD);
  }
  for (let i = 0; i < Math.floor(halfW * 0.9); i += 1) {
    const row = 5 + Math.floor(R() * (depth * 0.46 - 5));
    if (row < 5) continue;
    const half = halves[row];
    const x = cx - half + 2 + R() * (half * 2 - 4);
    px(x, topY + row, 1 + Math.floor(R() * 3), 1, R() > 0.5 ? dL : dD);
  }
  for (let i = 0; i < Math.floor(halfW * 0.5); i += 1) {
    const row = Math.floor(depth * 0.46) + Math.floor(R() * (depth * 0.5));
    const half = halves[Math.min(row, depth - 1)] || 3;
    const x = cx - half + 2 + R() * Math.max(1, half * 2 - 6);
    px(x, topY + row, 2 + Math.floor(R() * 4), 2, R() > 0.55 ? sL : sD);
  }
  for (let i = 0; i < Math.max(3, Math.floor(halfW / 22)); i += 1) {
    const row = Math.floor(depth * 0.55 + R() * depth * 0.4);
    const half = halves[Math.min(row, depth - 1)] || 3;
    const x = cx - half + 3 + R() * Math.max(1, half * 2 - 6);
    const len = 8 + Math.floor(R() * 22);
    let dx = 0;
    for (let j = 0; j < len; j += 1) {
      dx += Math.sin(j * 0.35 + i) * 0.18;
      px(x + dx, topY + row + j, j < len * 0.6 ? 2 : 1, 1, j < len * 0.5 ? dD : dX);
    }
    px(x + dx - 1, topY + row + len, 3, 1, gD);
    px(x + dx, topY + row + len + 1, 1, 1, gM);
  }
}

function drawTufts(t: Tools, cx: number, topY: number, halfW: number, seed: number, night: boolean) {
  const { px } = t;
  const R = mkRnd(seed + 9);
  const sh = night ? 0.5 : 0;
  const gL = mix(C.grassH, "#050b1c", sh);
  const gD = mix(C.grassD, "#050b1c", sh);
  const n = Math.floor(halfW / 5);
  for (let i = 0; i < n; i += 1) {
    const x = cx - halfW + 4 + i * 5 + R() * 3;
    const h = 3 + Math.floor(R() * 4);
    px(x, topY - h, 1, h, gD);
    px(x + 1, topY - h + 1, 1, h - 1, gL);
  }
}

function drawFlowers(t: Tools, x0: number, x1: number, baseY: number, seed: number, night: boolean) {
  const { px } = t;
  const R = mkRnd(seed + 21);
  const sh = night ? 0.5 : 0;
  for (let i = 0; i < 8; i += 1) {
    const x = x0 + R() * (x1 - x0);
    const c = mix(["#f4a6cd", "#ffd873", "#eaf7d2", "#c9a8f2"][Math.floor(R() * 4)], "#050b1c", sh);
    px(x, baseY - 5, 1, 5, mix(C.grassD, "#050b1c", sh));
    px(x - 1, baseY - 6, 3, 1, c);
    px(x, baseY - 7, 1, 1, c);
    px(x, baseY - 6, 1, 1, mix("#fff3c4", "#050b1c", sh));
  }
}

function drawTree(
  t: Tools,
  idx: number,
  cx: number,
  baseY: number,
  seed: number,
  night: boolean,
  bounds?: [number, number]
) {
  const { px, disc, ell, sprite } = t;
  const lo = bounds ? bounds[0] : -1e9;
  const hi = bounds ? bounds[1] : 1e9;
  const clampX = (v: number) => Math.min(hi, Math.max(lo, v));
  const sh = night ? 0.42 : 0;
  const bk = {
    h: mix(C.barkH, "#050b1c", sh),
    l: mix(C.barkL, "#050b1c", sh),
    m: mix(C.bark, "#050b1c", sh),
    d: mix(C.barkD, "#050b1c", sh),
    x: mix(C.barkX, "#050b1c", sh)
  };

  if (idx === 0) {
    px(cx - 11, baseY - 3, 22, 3, mix(C.dirtL, "#050b1c", sh));
    px(cx - 8, baseY - 5, 16, 2, mix(C.dirt, "#050b1c", sh));
    px(cx - 5, baseY - 6, 10, 1, mix(C.dirtD, "#050b1c", sh));
    px(cx - 4, baseY - 4, 3, 2, mix(C.dirtX, "#050b1c", sh));
    px(cx - 1, baseY - 10, 2, 5, mix("#6f9c2e", "#050b1c", sh));
    sprite(cx - 6, baseY - 13, LEAF3, 3, mix("#8ad84c", "#050b1c", sh));
    sprite(cx + 2, baseY - 15, LEAF3, 3, mix("#b7ef78", "#050b1c", sh));
    return;
  }

  const cfg = TREE[idx] as TreeConfig;
  const tn = TONES[cfg.tone];
  const leafD = mix(tn.d, "#050b1c", sh);
  const leafM = mix(tn.m, "#050b1c", sh);
  const leafL = mix(tn.l, "#050b1c", sh);
  const leafH = mix(tn.h, "#050b1c", sh);

  if (idx === 1) {
    px(cx - 5, baseY - 2, 10, 2, mix(C.dirtD, "#050b1c", sh));
    for (let y = 0; y < 13; y += 1) px(cx - 1, baseY - 3 - y, 2, 1, y > 8 ? mix("#6f9c2e", "#050b1c", sh) : bk.m);
    for (let i = 0; i < 5; i += 1) sprite(cx - 11 + i, baseY - 15 - i, LEAF5, 5, i < 3 ? leafM : leafL);
    for (let i = 0; i < 5; i += 1) sprite(cx + 3 + i, baseY - 17 - i, LEAF5, 5, i < 3 ? leafM : leafL);
    sprite(cx - 2, baseY - 19, LEAF5, 5, leafH);
    return;
  }

  const R = mkRnd(seed);
  const th = cfg.th;
  const tw = cfg.tw;
  const topY = baseY - th;
  const tips: { x: number; y: number; w: number }[] = [];

  const MAXDEV = 1.05;
  const clampAng = (a: number) => {
    let d = a + Math.PI / 2;
    if (d > MAXDEV) d = MAXDEV;
    if (d < -MAXDEV) d = -MAXDEV;
    return d - Math.PI / 2;
  };
  const limb = (x: number, y: number, ang: number, len: number, wid: number, depth: number) => {
    let a = clampAng(ang);
    const curve = (R() - 0.5) * 0.022;
    let px0 = x;
    let py0 = y;
    const steps = Math.max(3, Math.round(len));
    for (let i = 0; i < steps; i += 1) {
      a = clampAng(a + curve);
      px0 += Math.cos(a);
      py0 += Math.sin(a);
      const f = i / steps;
      const cw = Math.max(1, Math.round(wid * (1 - f * 0.5)));
      px(px0 - cw / 2, py0, cw, 2, bk.m);
      px(px0 - cw / 2, py0, 1, 2, bk.x);
      if (cw > 2) px(px0 + cw / 2 - 1, py0, 1, 2, bk.l);
    }
    if (depth <= 0) {
      tips.push({ x: clampX(px0), y: py0, w: wid });
      return;
    }
    const n = R() > 0.55 ? 3 : 2;
    for (let k = 0; k < n; k += 1) {
      const spread = (k - (n - 1) / 2) * (0.5 + R() * 0.16) + (R() - 0.5) * 0.16;
      limb(px0, py0, clampAng(a + spread), len * (0.66 + R() * 0.12), Math.max(1.6, wid * 0.6), depth - 1);
    }
  };

  const nMain = idx <= 3 ? 2 : 3;
  for (let k = 0; k < nMain; k += 1) {
    const spread = (k - (nMain - 1) / 2) * (0.6 + R() * 0.12) + (R() - 0.5) * 0.12;
    limb(cx, topY + 2, -Math.PI / 2 + spread, th * 0.42 + 6, Math.max(3, tw * 0.5), cfg.depth);
  }

  const spots: { x: number; y: number; k: number }[] = [];
  const mr = cfg.cr * 0.56;
  tips.forEach((tp) => ell(tp.x, tp.y + 3, mr * 1.2, mr * 0.86, mix(tn.d, "#0a2409", 0.4)));
  tips.forEach((tp, i) => {
    ell(tp.x, tp.y, mr * 1.12, mr * 0.8, leafD);
    for (let k = 0; k < cfg.n; k += 1) {
      const a = R() * Math.PI * 2;
      const d = Math.sqrt(R());
      spots.push({
        x: clampX(tp.x + Math.cos(a) * d * mr * 1.35),
        y: tp.y + Math.sin(a) * d * mr * 1.0,
        k: i * 31 + k
      });
    }
  });

  for (let y = 0; y < th; y += 1) {
    const f = y / th;
    const flare = Math.pow(1 - f, 3.2) * tw * 0.85;
    const w = Math.max(3, Math.round(tw * (1 - f * 0.42) + flare));
    const x = Math.round(cx - w / 2);
    px(x, baseY - 1 - y, w, 1, bk.m);
    px(x, baseY - 1 - y, 1, 1, bk.x);
    px(x + 1, baseY - 1 - y, 1, 1, bk.d);
    px(x + w - 1, baseY - 1 - y, 1, 1, bk.x);
    px(x + w - 2, baseY - 1 - y, 1, 1, bk.l);
    if (w > 6) {
      const s1 = x + 2 + Math.round(Math.sin(y * 0.22) * 1.2 + w * 0.22);
      px(s1, baseY - 1 - y, 1, 1, bk.d);
      if (w > 10) px(x + w - 4 + Math.round(Math.sin(y * 0.18 + 2) * 1.2), baseY - 1 - y, 1, 1, bk.d);
      if (w > 14 && y % 7 < 4) px(x + Math.round(w * 0.5), baseY - 1 - y, 1, 1, bk.h);
    }
  }

  const roots = idx >= 4 ? 3 : 2;
  for (let k = 0; k < roots; k += 1) {
    for (const side of [-1, 1]) {
      const len = 5 + k * 3 + Math.round(tw * 0.4);
      const ry = baseY - 1 - k * 2;
      for (let j = 0; j < len; j += 1) {
        const hh = Math.max(1, 3 - Math.floor(j / (len / 3)));
        px(cx + side * (tw * 0.4 + j), ry + j * 0.32, 2, hh, j < len * 0.6 ? bk.m : bk.d);
        px(cx + side * (tw * 0.4 + j), ry + j * 0.32, 1, 1, bk.x);
      }
    }
  }

  spots.sort((a, b) => a.y - b.y);
  let minY = 1e9;
  let maxY = -1e9;
  spots.forEach((s) => {
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  });
  const cy0 = (minY + maxY) / 2;
  const span = Math.max(8, (maxY - minY) / 2);
  spots.forEach((sp) => {
    const rr = mkRnd(sp.k)();
    const lit = (cy0 - sp.y) / span + (cx - sp.x) / (span * 6);
    const col = lit > 0.55 ? leafH : lit > 0.05 ? leafL : lit > -0.5 ? leafM : leafD;
    if (rr > 0.28) sprite(sp.x - 2, sp.y - 2, LEAF5, 5, col);
    else sprite(sp.x - 1, sp.y - 1, LEAF3, 3, col);
  });

  if (FRUIT[idx]) {
    const fc = mix(FRUIT[idx], "#050b1c", sh);
    const RF = mkRnd(seed + 55);
    for (let i = 0; i < (idx === 6 ? 11 : 9); i += 1) {
      const tp = tips[Math.floor(RF() * tips.length)];
      if (!tp) continue;
      const a = RF() * Math.PI * 2;
      const d = Math.sqrt(RF()) * mr * 1.15;
      const fx = tp.x + Math.cos(a) * d;
      const fy = tp.y + Math.sin(a) * d * 0.85 + 2;
      if (idx === 6) {
        px(fx - 2, fy, 5, 1, fc);
        px(fx, fy - 2, 1, 5, fc);
        px(fx - 1, fy - 1, 3, 3, fc);
        px(fx, fy, 1, 1, mix("#fff3c4", "#050b1c", sh));
      } else {
        disc(fx, fy, 2.4, mix(fc, "#000000", 0.4));
        disc(fx, fy, 1.6, fc);
        px(fx - 1, fy - 1, 1, 1, mix(fc, "#ffffff", 0.55));
      }
    }
  }

  if (idx === 9) {
    const RG = mkRnd(seed + 77);
    for (let i = 0; i < 22; i += 1) {
      const tp = tips[Math.floor(RG() * tips.length)];
      if (!tp) continue;
      const a = RG() * Math.PI * 2;
      px(tp.x + Math.cos(a) * mr * 1.4, tp.y + Math.sin(a) * mr * 1.2, 2, 2, rgba("#f9e388", 0.45));
    }
  }
}

/**
 * Құдық — судың қайдан алынатынын көрсетеді.
 * x — құдықтың ортасы, baseY — аралдың шөп деңгейі.
 */
function drawWell(t: Tools, x: number, baseY: number, night: boolean) {
  const { px } = t;
  const sh = night ? 0.45 : 0;
  const sL = mix(C.stoneL, "#050b1c", sh);
  const sM = mix(C.stone, "#050b1c", sh);
  const sD = mix(C.stoneD, "#050b1c", sh);
  const sX = mix(C.stoneX, "#050b1c", sh);
  const wL = mix(C.woodL, "#050b1c", sh);
  const wM = mix(C.wood, "#050b1c", sh);
  const wD = mix(C.woodD, "#050b1c", sh);
  const roofM = mix(C.roof, "#050b1c", sh);
  const roofL = mix(C.roofL, "#050b1c", sh);

  const halfW = 13;
  const bodyH = 14;
  const top = baseY - bodyH;

  // Тас қабырға
  px(x - halfW, top, halfW * 2, bodyH, sM);
  for (let row = 0; row < bodyH; row += 3) {
    for (let col = 0; col < halfW * 2; col += 7) {
      const shift = (row / 3) % 2 === 0 ? 0 : 3;
      px(x - halfW + col + shift, top + row, 6, 2, (row + col) % 6 === 0 ? sL : sD);
    }
  }
  px(x - halfW, top, halfW * 2, 2, sL);
  px(x - halfW, baseY - 2, halfW * 2, 2, sX);
  px(x - halfW - 1, top, 1, bodyH, sX);
  px(x + halfW, top, 1, bodyH, sX);

  // Су беті
  px(x - halfW + 3, top + 2, halfW * 2 - 6, 3, mix("#2f86cf", "#050b1c", sh));
  px(x - halfW + 5, top + 2, 4, 1, mix("#8fd0e8", "#050b1c", sh));

  // Тіреуіш бағаналар мен шатыр
  px(x - halfW + 2, top - 16, 3, 16, wM);
  px(x + halfW - 5, top - 16, 3, 16, wM);
  px(x - halfW + 2, top - 16, 1, 16, wD);
  px(x + halfW - 3, top - 16, 1, 16, wD);

  for (let i = 0; i < 6; i += 1) {
    const inset = i * 2;
    px(x - halfW - 3 + inset, top - 18 - i * 2, (halfW + 3) * 2 - inset * 2, 2, i % 2 === 0 ? roofM : roofL);
  }

  // Иінтірек пен шелек
  px(x - 1, top - 14, 2, 3, wD);
  px(x - 6, top - 12, 12, 2, wL);
  px(x - 1, top - 10, 2, 5, mix("#6b7280", "#050b1c", sh));
  px(x - 3, top - 5, 6, 5, wM);
  px(x - 3, top - 5, 6, 1, wL);
  px(x - 3, top - 1, 6, 1, wD);
}

function drawHouse(t: Tools, x: number, baseY: number, night: boolean) {
  const { px } = t;
  const w = 66;
  const h = 36;
  const y = baseY - h;
  px(x + 3, baseY - 1, w - 6, 2, "#1a2a10");
  px(x, y, w, h, C.wood);
  for (let i = 0; i < h; i += 4) px(x, y + i, w, 1, C.woodD);
  for (let i = 0; i < w; i += 14) px(x + i, y, 1, h, rgba("#5e3a18", 0.75));
  px(x, y, 2, h, C.woodD);
  px(x + w - 2, y, 2, h, C.woodD);
  px(x - 6, y - 2, w + 12, 4, C.roofD);
  for (let i = 0; i < 13; i += 1) {
    const inset = i * 2.7;
    px(x - 6 + inset, y - 2 - i * 1.7, w + 12 - inset * 2, 2, i % 2 === 0 ? C.roof : C.roofL);
  }
  px(x + w - 18, y - 26, 8, 14, "#63656f");
  px(x + w - 18, y - 26, 8, 2, "#7b7d89");
  px(x + w - 17, y - 24, 2, 12, "#4a4c55");
  const dx = x + 9;
  px(dx, y + 13, 14, h - 13, C.door);
  px(dx + 1, y + 14, 12, h - 15, "#5c3a17");
  px(dx + 11, y + 21, 2, 2, "#e8c15a");
  const wx = x + 33;
  px(wx - 2, y + 8, 24, 19, C.woodD);
  px(wx, y + 10, 20, 15, night ? C.winN : C.win);
  px(wx + 9, y + 10, 2, 15, C.woodD);
  px(wx, y + 16, 20, 2, C.woodD);
  if (night) {
    px(wx - 7, y + 3, 34, 29, rgba("#ffce4a", 0.09));
    px(wx - 3, y + 7, 26, 21, rgba("#ffce4a", 0.11));
  } else {
    px(wx + 1, y + 11, 7, 4, rgba("#ffffff", 0.5));
  }
  px(x - 3, baseY - 4, 4, 4, C.woodD);
  px(x + w - 1, baseY - 4, 4, 4, C.woodD);
}

export type GardenSceneConfig = {
  w: number;
  h: number;
  night: boolean;
  cloudSpeed?: number;
  critters?: boolean;
  wide: boolean;
  island: { cx: number; top: number; half: number; depth: number };
  satellite?: { cx: number; top: number; half: number; depth: number } | null;
  house?: number | null;
  /** Құдықтың x координаты (су сонан алынады) */
  well?: number | null;
  trees: { x: number; idx: number }[];
  /** Оқушының мини-персонажы: сол жақ шетінің x координаты мен киімі */
  avatar?: { x: number; look: AvatarLook } | null;
};

/**
 * Сахнаны canvas-қа салып, анимациясын жүргізеді.
 * Қайтаратын функция анимацияны тоқтатады (компонент жабылғанда шақыру керек).
 */
export function runGardenScene(canvas: HTMLCanvasElement, cfg: GardenSceneConfig) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  ctx.imageSmoothingEnabled = false;

  const { w, h, night } = cfg;
  const isl = cfg.island;
  const cloudSpeed = cfg.cloudSpeed ?? 1;
  const critters = cfg.critters ?? true;
  const seedBase = cfg.trees[0].idx * 4.7 + w * 0.031 + 3;

  const layer = (fn: (t: Tools, c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    cx.imageSmoothingEnabled = false;
    fn(tools(cx), cx);
    return c;
  };

  const back = layer((t) => {
    const { px, disc } = t;
    const top = night ? C.nTop : C.skyTop;
    const mid = night ? C.nMid : C.skyMid;
    const low = night ? C.nLow : C.skyLow;
    const bands = 26;
    for (let i = 0; i < bands; i += 1) {
      const k = i / (bands - 1);
      px(0, (h / bands) * i, w, h / bands + 1, k < 0.55 ? mix(top, mid, k / 0.55) : mix(mid, low, (k - 0.55) / 0.45));
    }
    if (night) {
      for (let i = 0; i < Math.floor(w / 6); i += 1) {
        const sx = rnd(i * 1.3) * w;
        const sy = rnd(i * 2.7) * h * 0.85;
        px(sx, sy, 1, 1, rgba("#ffffff", 0.3 + rnd(i * 5.1) * 0.55));
        if (rnd(i * 7.9) > 0.92) {
          px(sx - 1, sy, 3, 1, rgba("#ffffff", 0.28));
          px(sx, sy - 1, 1, 3, rgba("#ffffff", 0.28));
        }
      }
      const mx = w - 62;
      const my = 40;
      disc(mx, my, 17, rgba("#dfe8ff", 0.09));
      disc(mx, my, 12, "#e9eefc");
      disc(mx, my, 10, "#f8faff");
      disc(mx + 5, my - 4, 4, rgba("#c3cee8", 0.9));
      disc(mx - 4, my + 4, 3, rgba("#c3cee8", 0.75));
    } else {
      const sx = w - 60;
      const sy = 38;
      disc(sx, sy, 18, rgba("#fff7d6", 0.13));
      disc(sx, sy, 12, "#ffe98a");
      disc(sx, sy, 9, "#fff9e0");
    }
  });

  const front = layer((t) => {
    if (cfg.satellite) {
      const s = cfg.satellite;
      drawIsland(t, s.cx, s.top, s.half, s.depth, night, 41);
      drawTufts(t, s.cx, s.top, s.half - 4, 41, night);
      drawTree(t, 2, s.cx + 3, s.top, 12.5, night, [10, w - 10]);
    }
    drawIsland(t, isl.cx, isl.top, isl.half, isl.depth, night, seedBase);
    drawTufts(t, isl.cx, isl.top, isl.half - 6, seedBase, night);
    if (cfg.wide) {
      drawFlowers(t, isl.cx - 130, isl.cx - 70, isl.top, 3.3, night);
      drawFlowers(t, isl.cx + 40, isl.cx + 110, isl.top, 8.8, night);
      if (cfg.house !== null && cfg.house !== undefined) drawHouse(t, cfg.house, isl.top, night);
      if (cfg.well !== null && cfg.well !== undefined) drawWell(t, cfg.well, isl.top, night);
      cfg.trees.forEach((tr, i) => drawTree(t, tr.idx, tr.x, isl.top, i * 6.3 + 4, night, [10, w - 10]));
    } else {
      if (cfg.trees[0].idx >= 2) drawFlowers(t, isl.cx - 54, isl.cx + 54, isl.top, seedBase, night);
      drawTree(t, cfg.trees[0].idx, isl.cx, isl.top, seedBase, night, [12, w - 12]);
    }
  });

  type Cloud = { x: number; y: number; s: number; sp: number; a: number; fg: boolean };
  const clouds: Cloud[] = [];
  const nClouds = cfg.wide ? 7 : 4;
  for (let i = 0; i < nClouds; i += 1) {
    const fg = i >= nClouds - 2;
    clouds.push({
      x: rnd(i * 3.7 + w) * (w + 80) - 40,
      y: fg ? isl.top + isl.depth * 0.5 + rnd(i * 4.4) * 40 : 10 + rnd(i * 5.1 + w) * (isl.top * 0.55),
      s: fg ? 3 : 2 + Math.floor(rnd(i * 2.3 + w) * 2),
      sp: (fg ? 2.6 : 1.3 + rnd(i * 7.1) * 1.4) * cloudSpeed,
      a: night ? (fg ? 0.16 : 0.2 + rnd(i) * 0.1) : fg ? 0.4 : 0.6 + rnd(i) * 0.3,
      fg
    });
  }

  const drawCloud = (t: Tools, c: Cloud) => {
    const body = rgba(night ? "#9fb4d8" : "#ffffff", c.a);
    const under = rgba(night ? "#6d81a8" : "#cfe8f4", c.a * 0.9);
    const s = c.s;
    const x = c.x;
    const y = c.y;
    t.px(x + 4 * s, y, 6 * s, s, body);
    t.px(x + 2 * s, y + s, 11 * s, s, body);
    t.px(x, y + 2 * s, 16 * s, s, body);
    t.px(x + s, y + 3 * s, 14 * s, s, under);
    t.px(x + 5 * s, y + 4 * s, 7 * s, s, under);
  };

  const idx = cfg.trees[cfg.trees.length - 1].idx;
  const treeCfg = TREE[Math.max(idx, 1)];
  const flyTop = Math.max(18, isl.top - (treeCfg ? treeCfg.th : 20) - 20);
  const flyBottom = isl.top - 12;
  const bugs: { bx: number; by: number; ph: number; sp: number }[] = [];
  if (critters) {
    const n = night ? (idx >= 3 ? 8 : 4) : idx >= 4 ? 5 : 2;
    for (let i = 0; i < n; i += 1) {
      bugs.push({
        bx: 20 + rnd(i * 4.1 + w) * (w - 40),
        by: flyTop + rnd(i * 6.3) * Math.max(20, flyBottom - flyTop),
        ph: rnd(i * 9.7) * 6.28,
        sp: 0.15 + rnd(i * 1.9) * 0.15
      });
    }
  }

  const petals: { x: number; y: number; vy: number; life: number }[] = [];
  const smoke: { x: number; y: number; r: number; life: number; vx: number }[] = [];
  const T = tools(ctx);
  // Персонаж бір рет салынады: ашық көз және жұмылған көз нұсқалары
  const avatarSprites = cfg.avatar
    ? {
        open: buildGardenAvatar(cfg.avatar.look, false, night),
        blink: buildGardenAvatar(cfg.avatar.look, true, night)
      }
    : null;
  let t0 = performance.now();
  let acc = 0;
  let tick = 0;
  let raf = 0;
  let stopped = false;

  const paint = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(back, 0, 0);
    clouds.forEach((c) => {
      if (!c.fg) drawCloud(T, c);
    });
    ctx.drawImage(front, 0, 0);
    if (cfg.avatar && avatarSprites) {
      const ax = cfg.avatar.x;
      // Табан астындағы көлеңке
      T.px(ax + 3, isl.top - 1, 10, 2, rgba("#0b1a08", night ? 0.4 : 0.26));
      // ~3 секунд сайын көзін жұмады
      const sprite = tick % 96 < 4 ? avatarSprites.blink : avatarSprites.open;
      ctx.drawImage(sprite, ax, isl.top - sprite.height);
    }
    const flick = 0.55 + ((tick >> 2) % 3) * 0.18;
    bugs.forEach((b, i) => {
      if (night) {
        T.px(b.bx - 1, b.by - 1, 4, 4, rgba("#d9ff8a", 0.1 * flick));
        T.px(b.bx, b.by, 2, 2, rgba("#eaff9c", flick));
      } else {
        const flap = (tick >> 2) % 2;
        const col = ["#ffd873", "#f4a6cd", "#eaf7d2", "#c9a8f2"][i % 4];
        T.px(b.bx, b.by, 1, 3, "#3c2a12");
        T.px(b.bx - 3, b.by - (flap ? 1 : 0), 3, flap ? 3 : 2, col);
        T.px(b.bx + 1, b.by - (flap ? 1 : 0), 3, flap ? 3 : 2, col);
      }
    });
    petals.forEach((p) => {
      const base = TREE[Math.max(idx, 1)];
      const c = idx === 9 ? "#f9e388" : idx === 6 ? "#f4a6cd" : TONES[base ? base.tone : 1].l;
      T.px(p.x, p.y, 2, 2, rgba(c, Math.min(1, p.life)));
    });
    smoke.forEach((s) =>
      T.px(s.x, s.y, s.r, s.r, rgba(night ? "#8899b8" : "#e6eef2", Math.max(0, s.life) * 0.45))
    );
    clouds.forEach((c) => {
      if (c.fg) drawCloud(T, c);
    });
  };

  const advance = () => {
    clouds.forEach((c) => {
      c.x += c.sp / 30;
      if (c.x > w + 50) {
        c.x = -18 * c.s;
        c.y = c.fg
          ? isl.top + isl.depth * 0.5 + rnd(tick + c.s) * 40
          : 10 + rnd(tick * 1.7 + c.s) * (isl.top * 0.55);
      }
    });
    bugs.forEach((b) => {
      b.ph += b.sp / 30;
      b.bx += Math.cos(b.ph) * 0.5;
      b.by += Math.sin(b.ph * 1.7) * 0.32;
      if (b.bx < isl.cx - isl.half) b.bx = isl.cx - isl.half;
      if (b.bx > isl.cx + isl.half) b.bx = isl.cx + isl.half;
      if (b.by < 16) b.by = 16;
      if (b.by > isl.top - 8) b.by = isl.top - 8;
    });
    const cfgT = TREE[Math.max(idx, 1)];
    if (cfgT && idx >= 4 && petals.length < 9 && tick % 24 === 0 && rnd(tick) > 0.35) {
      petals.push({
        x: isl.cx - cfgT.cr * 1.6 + rnd(tick * 1.7) * cfgT.cr * 3.2,
        y: isl.top - cfgT.th * 0.7 - rnd(tick * 3.1) * cfgT.cr,
        vy: 0.2 + rnd(tick * 5.3) * 0.14,
        life: 1
      });
    }
    for (let i = petals.length - 1; i >= 0; i -= 1) {
      const p = petals[i];
      p.y += p.vy;
      p.x += Math.sin(p.y * 0.055) * 0.35;
      if (p.y > isl.top - 2) p.life -= 0.05;
      if (p.life <= 0 || p.y > isl.top + 4) petals.splice(i, 1);
    }
    if (cfg.house !== null && cfg.house !== undefined) {
      if (tick % 18 === 0) smoke.push({ x: cfg.house + 50, y: isl.top - 64, r: 2, life: 1, vx: 0.11 });
      for (let i = smoke.length - 1; i >= 0; i -= 1) {
        const s = smoke[i];
        s.y -= 0.26;
        s.x += s.vx;
        s.r = 2 + (1 - s.life) * 4;
        s.life -= 0.0055;
        if (s.life <= 0) smoke.splice(i, 1);
      }
    }
  };

  const step = (now: number) => {
    if (stopped) return;
    const dt = Math.min(64, now - t0);
    t0 = now;
    acc += dt;
    while (acc >= 1000 / 30) {
      acc -= 1000 / 30;
      tick += 1;
      advance();
    }
    paint();
    raf = requestAnimationFrame(step);
  };

  paint();
  raf = requestAnimationFrame(step);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

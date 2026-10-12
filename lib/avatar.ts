/**
 * Minecraft стиліндегі мини-персонаж: кейіпкер түрлері мен киімдер каталогы
 * және олардың ашылу шарттары. Дайын сурет жоқ — бәрі `lib/avatar-pixel.ts`
 * ішінде кодпен салынады.
 *
 * Ашылу: оқылған жалпы сағат не ағаш бағының деңгейі. Басында әр бөлімнің
 * аз ғана бөлігі ашық (~15%), қалғаны 120 сағат пен 10-деңгейге дейін
 * біртіндеп ашылады — қызығушылық ұзақ сақталуы үшін.
 *
 * Кейіпкерлердің аты жоқ: `name` тек экран оқитын құралдарға арналған сипаттама.
 */
import type { AvatarLook } from "@/lib/types";

export type AvatarPart = "base" | "hat" | "mask" | "top" | "bottom" | "shoes";

export type AvatarUnlock = { kind: "free" } | { kind: "hours"; hours: number } | { kind: "level"; level: number };

export type AvatarProgress = {
  /** Барлық уақытта оқылған сағат */
  readingHours: number;
  /** Бақтағы ең биік ағаштың деңгейі (1–10) */
  treeLevel: number;
};

export type HairStyle =
  | "short"
  | "sidepart"
  | "spiky"
  | "curly"
  | "mohawk"
  | "bob"
  | "long"
  | "wavy"
  | "ponytail"
  | "bun"
  | "braids"
  | "puffs";

export type HatStyle =
  | "none"
  | "cap"
  | "beanie"
  | "headphones"
  | "bow"
  | "catears"
  | "straw"
  | "bandana"
  | "wreath"
  | "takiya"
  | "cowboy"
  | "grad"
  | "pirate"
  | "santa"
  | "tophat"
  | "viking"
  | "wizard"
  | "crown"
  | "bearhood"
  | "spacehelmet"
  | "diving"
  | "knight"
  | "robot"
  | "halo";

export type MaskStyle =
  | "none"
  | "glasses"
  | "sunglasses"
  | "shades3d"
  | "medical"
  | "domino"
  | "goggles"
  | "ninja"
  | "fox"
  | "gas"
  | "hockey"
  | "visor"
  | "skull";

export type TopStyle =
  | "tee"
  | "polo"
  | "hoodie"
  | "sweater"
  | "stripes"
  | "uniform"
  | "pinafore"
  | "blouse"
  | "denim"
  | "leather"
  | "varsity"
  | "puffer"
  | "raincoat"
  | "kamzol"
  | "chapan"
  | "labcoat"
  | "chef"
  | "ninja"
  | "space"
  | "hero"
  | "armor"
  | "gold"
  | "tank";

export type BottomStyle =
  | "jeans"
  | "ripped"
  | "shorts"
  | "sportshorts"
  | "skirt"
  | "plaid"
  | "longskirt"
  | "denimskirt"
  | "trousers"
  | "sweat"
  | "cargo"
  | "leggings"
  | "ninja"
  | "space"
  | "armor"
  | "gold";

export type ShoesStyle =
  | "sneakers"
  | "hightop"
  | "school"
  | "boots"
  | "rain"
  | "sandals"
  | "flats"
  | "skates"
  | "tabi"
  | "space"
  | "armor"
  | "gold";

export type WearPalette = {
  main: string;
  shade: string;
  accent: string;
  light?: string;
  /** Қосымша түс (мысалы, суперқаһарман желбегейі) */
  extra?: string;
};

export type AvatarBase = {
  id: string;
  part: "base";
  /** Экран оқитын құралға арналған сипаттама — бетте көрсетілмейді */
  name: string;
  gender: "boy" | "girl";
  unlock: AvatarUnlock;
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairLight: string;
  hairStyle: HairStyle;
  eyes: string;
  freckles?: boolean;
};

type Wear<P extends Exclude<AvatarPart, "base">, S extends string> = {
  id: string;
  part: P;
  name: string;
  unlock: AvatarUnlock;
  style: S;
  colors: WearPalette;
  /** Футболкадағы сурет */
  print?: "star" | "heart" | "bolt";
};

export type AvatarHat = Wear<"hat", HatStyle>;
export type AvatarMask = Wear<"mask", MaskStyle>;
export type AvatarTop = Wear<"top", TopStyle>;
export type AvatarBottom = Wear<"bottom", BottomStyle>;
export type AvatarShoes = Wear<"shoes", ShoesStyle>;
export type AvatarItem = AvatarBase | AvatarHat | AvatarMask | AvatarTop | AvatarBottom | AvatarShoes;

const FREE: AvatarUnlock = { kind: "free" };
const hours = (value: number): AvatarUnlock => ({ kind: "hours", hours: value });
const level = (value: number): AvatarUnlock => ({ kind: "level", level: value });
const NONE_COLORS: WearPalette = { main: "#000000", shade: "#000000", accent: "#000000" };

export const AVATAR_BASES: AvatarBase[] = [
  { id: "boy-classic", part: "base", name: "Ұл, қысқа шаш", gender: "boy", unlock: FREE, skin: "#e2ad83", skinShade: "#c98f66", hair: "#5b3a22", hairShade: "#412814", hairLight: "#7a5234", hairStyle: "short", eyes: "#2f5fa7" },
  { id: "boy-spiky", part: "base", name: "Ұл, тікірейген шаш", gender: "boy", unlock: FREE, skin: "#c98f62", skinShade: "#ad7449", hair: "#1d1a19", hairShade: "#0e0c0b", hairLight: "#453c39", hairStyle: "spiky", eyes: "#3d2a17" },
  { id: "girl-classic", part: "base", name: "Қыз, ұзын шаш", gender: "girl", unlock: FREE, skin: "#ecbf9a", skinShade: "#d4a27c", hair: "#2a1d18", hairShade: "#150e0b", hairLight: "#4d3a31", hairStyle: "long", eyes: "#5a3b1f" },
  { id: "girl-ponytail", part: "base", name: "Қыз, құйрық шаш", gender: "girl", unlock: FREE, skin: "#f2cba8", skinShade: "#dbae88", hair: "#8a4b24", hairShade: "#6b3818", hairLight: "#ad6a3e", hairStyle: "ponytail", eyes: "#3f7a3a" },
  { id: "boy-blond", part: "base", name: "Ұл, ақшыл шаш", gender: "boy", unlock: hours(3), skin: "#f3d1b0", skinShade: "#dcb28e", hair: "#e2c46a", hairShade: "#bf9c42", hairLight: "#f5df9b", hairStyle: "sidepart", eyes: "#3f8ac2", freckles: true },
  { id: "girl-bob", part: "base", name: "Қыз, каре", gender: "girl", unlock: hours(3), skin: "#e9b891", skinShade: "#cf9a70", hair: "#c9803a", hairShade: "#a0602a", hairLight: "#e3a25f", hairStyle: "bob", eyes: "#4a6fb0", freckles: true },
  { id: "boy-curly", part: "base", name: "Ұл, бұйра шаш", gender: "boy", unlock: level(2), skin: "#8f5c3c", skinShade: "#74462b", hair: "#1f1511", hairShade: "#0f0a08", hairLight: "#453026", hairStyle: "curly", eyes: "#2b1b10" },
  { id: "girl-bun", part: "base", name: "Қыз, түйін шаш", gender: "girl", unlock: level(2), skin: "#d9a179", skinShade: "#be845c", hair: "#6e2f1d", hairShade: "#521f12", hairLight: "#914b33", hairStyle: "bun", eyes: "#3b2616" },
  { id: "girl-braids", part: "base", name: "Қыз, бұрым", gender: "girl", unlock: hours(10), skin: "#b97b50", skinShade: "#9c6239", hair: "#191212", hairShade: "#0a0707", hairLight: "#3e2d2d", hairStyle: "braids", eyes: "#2d1c10" },
  { id: "girl-puffs", part: "base", name: "Қыз, екі түйін", gender: "girl", unlock: level(4), skin: "#7a4a2e", skinShade: "#5f3820", hair: "#1a1210", hairShade: "#0b0706", hairLight: "#3d2c25", hairStyle: "puffs", eyes: "#2a1a10" },
  { id: "boy-mohawk", part: "base", name: "Ұл, ирокез", gender: "boy", unlock: hours(15), skin: "#e0a77c", skinShade: "#c48b60", hair: "#dc2626", hairShade: "#991b1b", hairLight: "#f87171", hairStyle: "mohawk", eyes: "#3b2616" },
  { id: "girl-wavy", part: "base", name: "Қыз, толқынды шаш", gender: "girl", unlock: level(5), skin: "#f0c6a4", skinShade: "#d9a883", hair: "#4a2c1a", hairShade: "#2f1b0f", hairLight: "#704b31", hairStyle: "wavy", eyes: "#5f8a2a" },
  { id: "boy-silver", part: "base", name: "Ұл, күміс шаш", gender: "boy", unlock: level(6), skin: "#d8a47d", skinShade: "#bd8860", hair: "#cfd6e0", hairShade: "#9aa4b2", hairLight: "#f1f4f8", hairStyle: "spiky", eyes: "#7a3fb8" },
  { id: "girl-star", part: "base", name: "Қыз, қызғылт шаш", gender: "girl", unlock: hours(60), skin: "#f0c6a4", skinShade: "#d9a883", hair: "#f09cc6", hairShade: "#cf6fa3", hairLight: "#fcc9e2", hairStyle: "wavy", eyes: "#9d4fd6" },
  { id: "hero-gold", part: "base", name: "Ұл, алтын шаш", gender: "boy", unlock: level(10), skin: "#e3b184", skinShade: "#c7925f", hair: "#f7c948", hairShade: "#cf9412", hairLight: "#fde68a", hairStyle: "curly", eyes: "#e8a317" },
  { id: "heroine-gold", part: "base", name: "Қыз, алтын бұрым", gender: "girl", unlock: hours(120), skin: "#f1c9a5", skinShade: "#d7a880", hair: "#fcd34d", hairShade: "#d9a21f", hairLight: "#fef3c7", hairStyle: "braids", eyes: "#d97706" }
];

export const AVATAR_HATS: AvatarHat[] = [
  { id: "none", part: "hat", name: "Бас киімсіз", unlock: FREE, style: "none", colors: NONE_COLORS },
  { id: "cap", part: "hat", name: "Кепка", unlock: FREE, style: "cap", colors: { main: "#2563eb", shade: "#1e40af", accent: "#f8fafc", light: "#60a5fa" } },
  { id: "beanie", part: "hat", name: "Тоқыма бөрік", unlock: hours(1), style: "beanie", colors: { main: "#dc2626", shade: "#991b1b", accent: "#fde68a", light: "#f87171" } },
  { id: "headphones", part: "hat", name: "Құлаққап", unlock: hours(2), style: "headphones", colors: { main: "#1f2937", shade: "#0b1220", accent: "#22d3ee", light: "#4b5563" } },
  { id: "bow", part: "hat", name: "Бантик", unlock: level(2), style: "bow", colors: { main: "#f472b6", shade: "#be185d", accent: "#fdf2f8", light: "#fbcfe8" } },
  { id: "catears", part: "hat", name: "Мысық құлақ", unlock: hours(5), style: "catears", colors: { main: "#1f2937", shade: "#0b1220", accent: "#f9a8d4", light: "#4b5563" } },
  { id: "straw", part: "hat", name: "Сабан қалпақ", unlock: level(3), style: "straw", colors: { main: "#e9c46a", shade: "#b8923c", accent: "#b5523b", light: "#f5dc9b" } },
  { id: "bandana", part: "hat", name: "Бандана", unlock: hours(8), style: "bandana", colors: { main: "#16a34a", shade: "#166534", accent: "#f8fafc", light: "#4ade80" } },
  { id: "wreath", part: "hat", name: "Гүл тәж", unlock: hours(12), style: "wreath", colors: { main: "#4ade80", shade: "#15803d", accent: "#f472b6", light: "#fde047" } },
  { id: "takiya", part: "hat", name: "Үкілі тақия", unlock: level(4), style: "takiya", colors: { main: "#9f1239", shade: "#6b0f2a", accent: "#fbbf24", light: "#e11d48" } },
  { id: "cowboy", part: "hat", name: "Ковбой қалпағы", unlock: hours(18), style: "cowboy", colors: { main: "#92400e", shade: "#5c2a0b", accent: "#1f2937", light: "#b45309" } },
  { id: "grad", part: "hat", name: "Түлек қалпағы", unlock: hours(25), style: "grad", colors: { main: "#111827", shade: "#030712", accent: "#facc15", light: "#374151" } },
  { id: "pirate", part: "hat", name: "Қарақшы қалпағы", unlock: level(5), style: "pirate", colors: { main: "#1c1917", shade: "#0c0a09", accent: "#eab308", light: "#44403c" } },
  { id: "santa", part: "hat", name: "Аяз ата бөркі", unlock: hours(30), style: "santa", colors: { main: "#dc2626", shade: "#991b1b", accent: "#f8fafc", light: "#ef4444" } },
  { id: "tophat", part: "hat", name: "Цилиндр", unlock: hours(35), style: "tophat", colors: { main: "#18181b", shade: "#09090b", accent: "#b91c1c", light: "#3f3f46" } },
  { id: "viking", part: "hat", name: "Викинг дулығасы", unlock: level(6), style: "viking", colors: { main: "#94a3b8", shade: "#475569", accent: "#f5f5f4", light: "#e2e8f0" } },
  { id: "wizard", part: "hat", name: "Сиқыршы қалпағы", unlock: hours(45), style: "wizard", colors: { main: "#5b21b6", shade: "#3b0764", accent: "#fcd34d", light: "#7c3aed" } },
  { id: "crown", part: "hat", name: "Тәж", unlock: hours(55), style: "crown", colors: { main: "#facc15", shade: "#b45309", accent: "#ef4444", light: "#fef9c3" } },
  { id: "bearhood", part: "hat", name: "Аю капюшон", unlock: level(7), style: "bearhood", colors: { main: "#8b5a2b", shade: "#5c3a1a", accent: "#f5d0a9", light: "#a9743f" } },
  { id: "spacehelmet", part: "hat", name: "Скафандр дулығасы", unlock: hours(70), style: "spacehelmet", colors: { main: "#e5e7eb", shade: "#9ca3af", accent: "#f97316", light: "#ffffff" } },
  { id: "diving", part: "hat", name: "Сүңгуір дулығасы", unlock: level(8), style: "diving", colors: { main: "#c28a2c", shade: "#8a5a14", accent: "#fde68a", light: "#e9b95a" } },
  { id: "knight", part: "hat", name: "Рыцарь дулығасы", unlock: hours(90), style: "knight", colors: { main: "#9ca3af", shade: "#4b5563", accent: "#dc2626", light: "#e5e7eb" } },
  { id: "robot", part: "hat", name: "Робот басы", unlock: level(9), style: "robot", colors: { main: "#94a3b8", shade: "#475569", accent: "#22d3ee", light: "#cbd5e1" } },
  { id: "halo", part: "hat", name: "Алтын шұғыла", unlock: hours(120), style: "halo", colors: { main: "#fde047", shade: "#eab308", accent: "#fff7ae" } }
];

export const AVATAR_MASKS: AvatarMask[] = [
  { id: "none", part: "mask", name: "Маскасыз", unlock: FREE, style: "none", colors: NONE_COLORS },
  { id: "glasses", part: "mask", name: "Дөңгелек көзілдірік", unlock: FREE, style: "glasses", colors: { main: "#1f2937", shade: "#111827", accent: "#bae6fd" } },
  { id: "sunglasses", part: "mask", name: "Күннен қорғайтын көзілдірік", unlock: hours(2), style: "sunglasses", colors: { main: "#111827", shade: "#030712", accent: "#64748b", light: "#94a3b8" } },
  { id: "shades3d", part: "mask", name: "3D көзілдірік", unlock: level(2), style: "shades3d", colors: { main: "#f8fafc", shade: "#cbd5e1", accent: "#ef4444", extra: "#3b82f6" } },
  { id: "medical", part: "mask", name: "Медициналық маска", unlock: hours(6), style: "medical", colors: { main: "#bae6fd", shade: "#7dd3fc", accent: "#e2e8f0" } },
  { id: "domino", part: "mask", name: "Қаһарман маскасы", unlock: level(3), style: "domino", colors: { main: "#dc2626", shade: "#991b1b", accent: "#f87171" } },
  { id: "goggles", part: "mask", name: "Шаңғы көзілдірігі", unlock: hours(14), style: "goggles", colors: { main: "#f97316", shade: "#c2410c", accent: "#1f2937", light: "#fdba74" } },
  { id: "ninja", part: "mask", name: "Ниндзя маскасы", unlock: level(5), style: "ninja", colors: { main: "#18181b", shade: "#09090b", accent: "#dc2626" } },
  { id: "fox", part: "mask", name: "Түлкі маскасы", unlock: hours(28), style: "fox", colors: { main: "#f97316", shade: "#c2410c", accent: "#fff7ed", light: "#fdba74" } },
  { id: "gas", part: "mask", name: "Противогаз", unlock: hours(40), style: "gas", colors: { main: "#4b5a2e", shade: "#2f3a1c", accent: "#9ca3af", light: "#6b7a3f" } },
  { id: "hockey", part: "mask", name: "Хоккей маскасы", unlock: level(7), style: "hockey", colors: { main: "#f5f5f0", shade: "#cfcfc4", accent: "#dc2626" } },
  { id: "visor", part: "mask", name: "Кибер визор", unlock: hours(80), style: "visor", colors: { main: "#0e7490", shade: "#164e63", accent: "#22d3ee", light: "#a5f3fc" } },
  { id: "skull", part: "mask", name: "Қаңқа маскасы", unlock: level(9), style: "skull", colors: { main: "#f1eee4", shade: "#c9c3b0", accent: "#111827" } }
];

export const AVATAR_TOPS: AvatarTop[] = [
  { id: "tee-sky", part: "top", name: "Көгілдір футболка", unlock: FREE, style: "tee", colors: { main: "#38bdf8", shade: "#0369a1", accent: "#e0f2fe", light: "#7dd3fc" } },
  { id: "tee-white", part: "top", name: "Ақ футболка", unlock: FREE, style: "tee", colors: { main: "#f8fafc", shade: "#b8c2d0", accent: "#94a3b8", light: "#ffffff" } },
  { id: "uniform", part: "top", name: "Мектеп көйлегі", unlock: FREE, style: "uniform", colors: { main: "#f8fafc", shade: "#c7ceda", accent: "#dc2626", light: "#ffffff" } },
  { id: "tee-red", part: "top", name: "Жұлдызды футболка", unlock: hours(1), style: "tee", print: "star", colors: { main: "#ef4444", shade: "#b91c1c", accent: "#fde047", light: "#f87171" } },
  { id: "hoodie", part: "top", name: "Сұр худи", unlock: hours(1), style: "hoodie", colors: { main: "#6b7280", shade: "#404652", accent: "#e5e7eb", light: "#8b919c" } },
  { id: "polo", part: "top", name: "Поло", unlock: hours(2), style: "polo", colors: { main: "#10b981", shade: "#047857", accent: "#f8fafc", light: "#34d399" } },
  { id: "stripes", part: "top", name: "Жолақ свитер", unlock: level(2), style: "stripes", colors: { main: "#f97316", shade: "#c2410c", accent: "#fff7ed", light: "#fb923c" } },
  { id: "pinafore", part: "top", name: "Мектеп сарафаны", unlock: hours(4), style: "pinafore", colors: { main: "#1e3a8a", shade: "#172554", accent: "#dc2626", light: "#f8fafc" } },
  { id: "blouse", part: "top", name: "Қызғылт блузка", unlock: hours(5), style: "blouse", colors: { main: "#f9a8d4", shade: "#db2777", accent: "#fdf2f8", light: "#fbcfe8" } },
  { id: "sweater", part: "top", name: "Тоқыма свитер", unlock: level(3), style: "sweater", colors: { main: "#d97706", shade: "#92400e", accent: "#fef3c7", light: "#f59e0b" } },
  { id: "tee-black", part: "top", name: "Найзағай футболка", unlock: hours(7), style: "tee", print: "bolt", colors: { main: "#1f2937", shade: "#0b1220", accent: "#facc15", light: "#374151" } },
  { id: "tee-heart", part: "top", name: "Жүрекше футболка", unlock: hours(8), style: "tee", print: "heart", colors: { main: "#f5f3ff", shade: "#c4b5fd", accent: "#e11d48", light: "#ffffff" } },
  { id: "denim", part: "top", name: "Джинсы куртка", unlock: hours(9), style: "denim", colors: { main: "#3b82f6", shade: "#1e3a8a", accent: "#fde68a", light: "#93c5fd" } },
  { id: "tank", part: "top", name: "JUZ40 баскетбол майкасы", unlock: level(4), style: "tank", colors: { main: "#10b981", shade: "#065f46", accent: "#f8fafc", light: "#34d399" } },
  { id: "raincoat", part: "top", name: "Сары плащ", unlock: hours(13), style: "raincoat", colors: { main: "#facc15", shade: "#ca8a04", accent: "#1f2937", light: "#fde68a" } },
  { id: "varsity", part: "top", name: "Колледж куртка", unlock: hours(17), style: "varsity", colors: { main: "#b91c1c", shade: "#7f1d1d", accent: "#f8fafc", light: "#dc2626" } },
  { id: "kamzol", part: "top", name: "Камзол", unlock: level(5), style: "kamzol", colors: { main: "#9f1239", shade: "#6b0f2a", accent: "#fbbf24", light: "#f8fafc" } },
  { id: "chapan", part: "top", name: "Шапан", unlock: hours(22), style: "chapan", colors: { main: "#1e3a8a", shade: "#172554", accent: "#fbbf24", light: "#3b5bb5" } },
  { id: "puffer", part: "top", name: "Пуховик", unlock: hours(30), style: "puffer", colors: { main: "#0ea5e9", shade: "#0369a1", accent: "#e0f2fe", light: "#7dd3fc" } },
  { id: "leather", part: "top", name: "Былғары куртка", unlock: level(6), style: "leather", colors: { main: "#27272a", shade: "#09090b", accent: "#d4d4d8", light: "#52525b" } },
  { id: "labcoat", part: "top", name: "Ғалым халаты", unlock: hours(38), style: "labcoat", colors: { main: "#ffffff", shade: "#c9d1dc", accent: "#93c5fd", light: "#ffffff" } },
  { id: "chef", part: "top", name: "Аспазшы киімі", unlock: hours(46), style: "chef", colors: { main: "#fafafa", shade: "#d4d4d8", accent: "#ef4444", light: "#ffffff" } },
  { id: "ninja", part: "top", name: "Ниндзя киімі", unlock: level(7), style: "ninja", colors: { main: "#27272a", shade: "#09090b", accent: "#dc2626", light: "#3f3f46" } },
  { id: "space", part: "top", name: "Ғарышкер киімі", unlock: hours(65), style: "space", colors: { main: "#e5e7eb", shade: "#9ca3af", accent: "#f97316", light: "#ffffff" } },
  { id: "hero", part: "top", name: "Суперқаһарман", unlock: level(8), style: "hero", colors: { main: "#2563eb", shade: "#1e3a8a", accent: "#dc2626", light: "#60a5fa", extra: "#dc2626" } },
  { id: "armor", part: "top", name: "Темір сауыт", unlock: hours(95), style: "armor", colors: { main: "#9ca3af", shade: "#4b5563", accent: "#e5e7eb", light: "#d1d5db" } },
  { id: "gold", part: "top", name: "Алтын сауыт", unlock: level(10), style: "gold", colors: { main: "#facc15", shade: "#b45309", accent: "#fef9c3", light: "#fde68a" } }
];

export const AVATAR_BOTTOMS: AvatarBottom[] = [
  { id: "jeans", part: "bottom", name: "Джинсы", unlock: FREE, style: "jeans", colors: { main: "#2563eb", shade: "#1e3a8a", accent: "#fbbf24", light: "#60a5fa" } },
  { id: "trousers", part: "bottom", name: "Мектеп шалбары", unlock: FREE, style: "trousers", colors: { main: "#1f2937", shade: "#0b1220", accent: "#9ca3af", light: "#374151" } },
  { id: "skirt", part: "bottom", name: "Бүрмелі юбка", unlock: FREE, style: "skirt", colors: { main: "#ec4899", shade: "#9d174d", accent: "#fdf2f8", light: "#f9a8d4" } },
  { id: "shorts", part: "bottom", name: "Шорты", unlock: hours(1), style: "shorts", colors: { main: "#a3845a", shade: "#7a5f3c", accent: "#3f2a14", light: "#c2a47a" } },
  { id: "sportshorts", part: "bottom", name: "Спорт шорты", unlock: level(2), style: "sportshorts", colors: { main: "#111827", shade: "#030712", accent: "#f8fafc", light: "#374151" } },
  { id: "sweat", part: "bottom", name: "Спорт шалбары", unlock: hours(3), style: "sweat", colors: { main: "#9ca3af", shade: "#5b6270", accent: "#f8fafc", light: "#cbd5e1" } },
  { id: "leggings", part: "bottom", name: "Леггинс", unlock: hours(6), style: "leggings", colors: { main: "#27272a", shade: "#09090b", accent: "#a855f7", light: "#52525b" } },
  { id: "cargo", part: "bottom", name: "Карго шалбар", unlock: level(3), style: "cargo", colors: { main: "#6b7a3f", shade: "#4b5629", accent: "#3a2a16", light: "#8a9a58" } },
  { id: "ripped", part: "bottom", name: "Жыртық джинсы", unlock: hours(12), style: "ripped", colors: { main: "#60a5fa", shade: "#1d4ed8", accent: "#fbbf24", light: "#bfdbfe" } },
  { id: "plaid", part: "bottom", name: "Торлы юбка", unlock: level(4), style: "plaid", colors: { main: "#b91c1c", shade: "#7f1d1d", accent: "#fbbf24", light: "#ef4444" } },
  { id: "denimskirt", part: "bottom", name: "Джинсы юбка", unlock: hours(20), style: "denimskirt", colors: { main: "#3b82f6", shade: "#1e3a8a", accent: "#fbbf24", light: "#93c5fd" } },
  { id: "longskirt", part: "bottom", name: "Ұзын юбка", unlock: level(5), style: "longskirt", colors: { main: "#0d9488", shade: "#115e59", accent: "#fbbf24", light: "#2dd4bf" } },
  { id: "ninja", part: "bottom", name: "Ниндзя шалбары", unlock: level(7), style: "ninja", colors: { main: "#27272a", shade: "#09090b", accent: "#dc2626", light: "#3f3f46" } },
  { id: "space", part: "bottom", name: "Ғарышкер шалбары", unlock: hours(65), style: "space", colors: { main: "#e5e7eb", shade: "#9ca3af", accent: "#f97316", light: "#ffffff" } },
  { id: "armor", part: "bottom", name: "Темір аяқ сауыт", unlock: hours(95), style: "armor", colors: { main: "#9ca3af", shade: "#4b5563", accent: "#e5e7eb", light: "#d1d5db" } },
  { id: "gold", part: "bottom", name: "Алтын аяқ сауыт", unlock: level(10), style: "gold", colors: { main: "#facc15", shade: "#b45309", accent: "#fef9c3", light: "#fde68a" } }
];

export const AVATAR_SHOES: AvatarShoes[] = [
  { id: "sneakers", part: "shoes", name: "Ақ кроссовка", unlock: FREE, style: "sneakers", colors: { main: "#f8fafc", shade: "#9aa6b6", accent: "#ef4444", light: "#ffffff" } },
  { id: "school", part: "shoes", name: "Мектеп туфлиі", unlock: FREE, style: "school", colors: { main: "#111827", shade: "#030712", accent: "#f8fafc", light: "#6b7280" } },
  { id: "boots", part: "shoes", name: "Былғары етік", unlock: hours(2), style: "boots", colors: { main: "#78350f", shade: "#451a03", accent: "#b45309", light: "#92400e" } },
  { id: "hightop-red", part: "shoes", name: "Қызыл кеды", unlock: level(2), style: "hightop", colors: { main: "#ef4444", shade: "#991b1b", accent: "#f8fafc", light: "#f87171" } },
  { id: "rain", part: "shoes", name: "Резеңке етік", unlock: level(3), style: "rain", colors: { main: "#facc15", shade: "#a16207", accent: "#1f2937", light: "#fef08a" } },
  { id: "sandals", part: "shoes", name: "Сандал", unlock: hours(7), style: "sandals", colors: { main: "#92400e", shade: "#5c2a0b", accent: "#fbbf24" } },
  { id: "flats", part: "shoes", name: "Балетка", unlock: hours(11), style: "flats", colors: { main: "#f472b6", shade: "#be185d", accent: "#fdf2f8", light: "#fbcfe8" } },
  { id: "hightop-black", part: "shoes", name: "Қара кеды", unlock: level(4), style: "hightop", colors: { main: "#18181b", shade: "#09090b", accent: "#f8fafc", light: "#3f3f46" } },
  { id: "skates", part: "shoes", name: "Роликтер", unlock: hours(26), style: "skates", colors: { main: "#14b8a6", shade: "#0f766e", accent: "#fde047", light: "#5eead4" } },
  { id: "tabi", part: "shoes", name: "Ниндзя табиі", unlock: level(7), style: "tabi", colors: { main: "#27272a", shade: "#09090b", accent: "#dc2626" } },
  { id: "space", part: "shoes", name: "Ғарышкер етігі", unlock: hours(65), style: "space", colors: { main: "#e5e7eb", shade: "#6b7280", accent: "#f97316", light: "#ffffff" } },
  { id: "armor", part: "shoes", name: "Темір етік", unlock: hours(95), style: "armor", colors: { main: "#9ca3af", shade: "#4b5563", accent: "#e5e7eb", light: "#d1d5db" } },
  { id: "gold", part: "shoes", name: "Алтын етік", unlock: level(10), style: "gold", colors: { main: "#facc15", shade: "#b45309", accent: "#fef9c3", light: "#fde68a" } }
];

export const AVATAR_PART_LABELS: Record<AvatarPart, string> = {
  base: "Кейіпкер",
  hat: "Бас киім",
  mask: "Маска",
  top: "Үстіңгі киім",
  bottom: "Астыңғы киім",
  shoes: "Аяқ киім"
};

export const AVATAR_PARTS: AvatarPart[] = ["base", "hat", "mask", "top", "bottom", "shoes"];

export const DEFAULT_AVATAR: AvatarLook = {
  base: "boy-classic",
  hat: "none",
  mask: "none",
  top: "tee-sky",
  bottom: "jeans",
  shoes: "sneakers"
};

export function getAvatarItems(part: AvatarPart): AvatarItem[] {
  switch (part) {
    case "base":
      return AVATAR_BASES;
    case "hat":
      return AVATAR_HATS;
    case "mask":
      return AVATAR_MASKS;
    case "top":
      return AVATAR_TOPS;
    case "bottom":
      return AVATAR_BOTTOMS;
    default:
      return AVATAR_SHOES;
  }
}

export function findAvatarItem(part: AvatarPart, id: string): AvatarItem | null {
  return getAvatarItems(part).find((item) => item.id === id) ?? null;
}

export function isAvatarItemUnlocked(unlock: AvatarUnlock, progress: AvatarProgress) {
  if (unlock.kind === "free") {
    return true;
  }

  if (unlock.kind === "hours") {
    return progress.readingHours >= unlock.hours;
  }

  return progress.treeLevel >= unlock.level;
}

export function describeUnlock(unlock: AvatarUnlock) {
  if (unlock.kind === "free") {
    return "Бірден ашық";
  }

  return unlock.kind === "hours" ? `${unlock.hours} сағат оқу` : `Ағаш ${unlock.level}-деңгей`;
}

/** Сақталған мәнді тексереді: каталогта жоқ id (не жаңа бөлім) әдепкі мәнмен толтырылады */
export function normalizeAvatarLook(raw: unknown): AvatarLook {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof AvatarLook, unknown>>;
  const pick = (part: AvatarPart, fallback: string) => {
    const candidate = value[part];
    return typeof candidate === "string" && findAvatarItem(part, candidate) ? candidate : fallback;
  };

  return {
    base: pick("base", DEFAULT_AVATAR.base),
    hat: pick("hat", DEFAULT_AVATAR.hat),
    mask: pick("mask", DEFAULT_AVATAR.mask),
    top: pick("top", DEFAULT_AVATAR.top),
    bottom: pick("bottom", DEFAULT_AVATAR.bottom),
    shoes: pick("shoes", DEFAULT_AVATAR.shoes)
  };
}

export function resolveAvatar(look: AvatarLook) {
  return {
    base: AVATAR_BASES.find((item) => item.id === look.base) ?? AVATAR_BASES[0],
    hat: AVATAR_HATS.find((item) => item.id === look.hat) ?? AVATAR_HATS[0],
    mask: AVATAR_MASKS.find((item) => item.id === look.mask) ?? AVATAR_MASKS[0],
    top: AVATAR_TOPS.find((item) => item.id === look.top) ?? AVATAR_TOPS[0],
    bottom: AVATAR_BOTTOMS.find((item) => item.id === look.bottom) ?? AVATAR_BOTTOMS[0],
    shoes: AVATAR_SHOES.find((item) => item.id === look.shoes) ?? AVATAR_SHOES[0]
  };
}

export function countUnlockedAvatarItems(progress: AvatarProgress) {
  const all = AVATAR_PARTS.flatMap((part) => getAvatarItems(part)).filter((item) => item.id !== "none");
  return {
    unlocked: all.filter((item) => isAvatarItemUnlocked(item.unlock, progress)).length,
    total: all.length
  };
}

/** Келесі ашылатын сыйлықтар: сағат бойынша ең жақыны және деңгей бойынша ең жақыны */
export function nextAvatarUnlocks(progress: AvatarProgress) {
  const locked = AVATAR_PARTS.flatMap((part) => getAvatarItems(part)).filter(
    (item) => !isAvatarItemUnlocked(item.unlock, progress)
  );

  const byHours = locked
    .filter((item): item is AvatarItem & { unlock: { kind: "hours"; hours: number } } => item.unlock.kind === "hours")
    .sort((left, right) => left.unlock.hours - right.unlock.hours)[0];
  const byLevel = locked
    .filter((item): item is AvatarItem & { unlock: { kind: "level"; level: number } } => item.unlock.kind === "level")
    .sort((left, right) => left.unlock.level - right.unlock.level)[0];

  return { byHours: byHours ?? null, byLevel: byLevel ?? null, lockedCount: locked.length };
}

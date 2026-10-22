import { createHash } from "node:crypto";

/**
 * Тақырып мәтінін эмбеддеуге жарамды бөліктерге бөледі.
 *
 * Неге бөлеміз: бір тақырып орта есеппен алты мың таңба. Соның бәрін бір
 * векторға сыйғызсақ, мағына «жуылып» кетеді де, нақты абзац туралы сұрау
 * табылмай қалады. Ал тым ұсақтасақ, контекст жоғалады. Мың екі жүз таңба —
 * бір-екі абзац, яғни бір ойдың көлемі.
 *
 * Бөліктер сөйлем шекарасымен бөлінеді де, көршілерімен сәл қабысады:
 * шекарада тұрған сөйлем екі бөлікте де болады, сонда ол жоғалмайды.
 */

/** Бір бөліктің мақсатты ұзындығы */
export const CHUNK_CHARS = 1200;
/** Көршілес бөліктердің қабысуы */
const OVERLAP_CHARS = 150;
/** Бұдан қысқа бөлік бөлек сақталмайды — алдыңғысына қосылады */
const MIN_CHUNK_CHARS = 200;

export type Chunk = {
  position: number;
  text: string;
};

/** Белгілеу тегтерін алып, таза мәтін қалдырады */
export function toPlainText(content: string): string {
  return content
    .replace(
      /\[(?:danger-right|rightdanger|danger|termgroup|term|colorbox|tree)([^\]]*)\]/gi,
      (_match, attributes: string) => {
        const title = /title\s*=\s*"([^"]*)"/i.exec(attributes)?.[1]?.trim();
        return title ? ` ${title}. ` : " ";
      }
    )
    .replace(/\[\/(?:danger-right|rightdanger|danger|termgroup|term|colorbox|tree)\]/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Тақырыпты бөліктерге бөледі.
 *
 * Әр бөліктің басына тақырыптың атауы қосылады: эмбеддинг үшін бұл маңызды
 * контекст, әйтпесе беттің ортасындағы абзац қай тақырыпқа жататыны
 * белгісіз болып қалады.
 */
export function splitIntoChunks(title: string, content: string): Chunk[] {
  const plain = toPlainText(content);
  if (plain.length < MIN_CHUNK_CHARS) {
    return plain ? [{ position: 0, text: `${title}. ${plain}`.trim() }] : [];
  }

  // Сөйлем шекаралары
  const sentences = plain.split(/(?<=[.!?…])\s+/).filter((part) => part.trim().length > 0);

  const chunks: Chunk[] = [];
  let current = "";
  let carry = "";

  const push = () => {
    const text = current.trim();
    if (!text) {
      return;
    }
    chunks.push({ position: chunks.length, text: `${title}. ${text}` });
    // Келесі бөлік соңғы сөйлемнен басталсын — шекарадағы ой жоғалмайды
    carry = text.length > OVERLAP_CHARS ? text.slice(-OVERLAP_CHARS) : text;
    current = "";
  };

  for (const sentence of sentences) {
    if (!current) {
      current = carry ? `${carry} ${sentence}` : sentence;
      continue;
    }

    if (current.length + sentence.length + 1 > CHUNK_CHARS) {
      push();
      current = carry ? `${carry} ${sentence}` : sentence;
      continue;
    }

    current = `${current} ${sentence}`;
  }

  if (current.trim().length >= MIN_CHUNK_CHARS || !chunks.length) {
    push();
  } else if (current.trim() && chunks.length) {
    // Соңғы қиқым бөлек бөлік болуға тұрмайды — алдыңғысына жалғаймыз
    chunks[chunks.length - 1].text = `${chunks[chunks.length - 1].text} ${current.trim()}`;
  }

  return chunks;
}

/**
 * Тақырыптың мазмұнының таңбасы.
 *
 * Әкімші мәтінді өңдегенде осы таңба өзгереді де, индекстеуші сол тақырыпты
 * ғана қайта эмбеддейді. Өзгермегенін қайта эмбеддеудің қажеті жоқ.
 */
export function hashChapter(title: string, content: string): string {
  return createHash("sha1").update(`${title}\u0000${content}`).digest("hex");
}

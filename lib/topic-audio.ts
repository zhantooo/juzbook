import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { expandRomanNumerals } from "@/lib/text-numerals";

/** Аудиодағы бір сөздің уақыт белгісі */
export type AudioMark = {
  /** Басталу уақыты (мс) */
  t: number;
  /** Ұзақтығы (мс) */
  d: number;
  /** Сөздің өзі */
  w: string;
};

export const AUDIO_VOICES = [
  "kk-KZ-AigulNeural",
  "kk-KZ-DauletNeural",
  "ru-RU-SvetlanaNeural",
  "en-US-JennyNeural"
] as const;

export type AudioVoice = (typeof AUDIO_VOICES)[number];

/** Дайын аудио файлдар сақталатын қалта (public емес — dev серверді мазаламау үшін) */
export function getAudioStorageDir() {
  return process.env.JUZBOOK_AUDIO_DIR?.trim() || path.join(process.cwd(), "storage", "topic-audio");
}

/**
 * Аудионы осы ортада дайындауға бола ма.
 *
 * Орналастырылған нұсқада (Vercel) екі нәрсе жоқ: Python да, жазуға
 * болатын қалта да — бүкіл файл жүйесі тек оқуға ашық. Бұрын сол жерде
 * `mkdir '/var/task/storage'` деген шикі қате оқушыға көрсетілетін.
 * Енді алдын ала тексереміз де, түсінікті себебін айтамыз.
 */
export function describeAudioUnavailable(): string | null {
  if (process.env.JUZBOOK_AUDIO_DIR?.trim()) {
    return null;
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return "Аудио дайындау бұл нұсқада қолжетімсіз: серверде дыбыс қызметі орнатылмаған.";
  }

  return null;
}

export function getPythonExecutable() {
  return (
    process.env.JUZBOOK_PYTHON_PATH?.trim() ||
    "C:\\Users\\user\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe"
  );
}

/**
 * Тақырып мәтінін дыбысталатын түрге келтіреді.
 * Оқу бетіндегі мәтінмен сәйкес болуы үшін тегтер алынып, бос орын біріктіріледі.
 */
export function buildAudioText(title: string, content: string) {
  const plain = content
    // [danger], [term], [colorbox] сияқты белгілеу таңбалары дауыстап оқылмауы керек.
    // Ашылатын тегтегі title мәні экранда тақырып болып көрінеді — оны сақтаймыз.
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

  /**
   * Рим цифрларын сөзбен жазып береміз. Дыбыс қызметі «XVIII» дегенді сан
   * деп танымай, әріптеп оқиды — «икс вэ и и и» болып шығады. Оқулықта
   * мұндай жазу көп: ғасырлар, тараулар, патша нөмірлері.
   */
  return expandRomanNumerals(`${title}. ${plain}`.trim());
}

function describeTtsError(stderr: string) {
  if (stderr.includes("EDGE_TTS_NOT_INSTALLED") || stderr.includes("No module named 'edge_tts'")) {
    return "Python ішінде edge_tts орнатылмаған.";
  }
  if (stderr.includes("EDGE_TTS_EMPTY_TEXT")) {
    return "Аудио жасауға мәтін жеткіліксіз.";
  }
  if (stderr.includes("EDGE_TTS_NO_AUDIO") || stderr.includes("NoAudioReceived")) {
    return "Серверлік дауыс бұл мәтінге аудио қайтара алмады.";
  }
  return "Аудио сервисі мәтінді дыбысқа айналдыра алмады.";
}

/**
 * Мәтінді дыбысқа айналдырып, файлды `outputPath` жолына жазады.
 * Қосымша әр сөздің уақыты (`marks`) қайтарылады — оқу кезінде сөзді
 * ерекшелеу осы белгілер арқылы жасалады.
 */
export async function synthesizeAudio(options: {
  text: string;
  voice: string;
  outputPath: string;
  /** edge-tts мәтін шегі; әдепкі 5000 таңба */
  maxChars?: number;
  timeoutMs?: number;
}) {
  const { text, voice, outputPath } = options;
  const safeText = text.replace(/\s+/g, " ").trim().slice(0, options.maxChars ?? 5000);
  const marksPath = path.join(os.tmpdir(), `juzbook-marks-${randomUUID()}.json`);
  const scriptPath = path.join(process.cwd(), "scripts", "topic_podcast.py");

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(getPythonExecutable(), [scriptPath, safeText, outputPath, voice, marksPath], {
        windowsHide: true
      });

      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Аудио дайындау тым ұзаққа созылды."));
      }, options.timeoutMs ?? 300000);

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        /**
         * Орналастырылған ортада (Vercel) Python жоқ: аудио тек жергілікті
         * машинада дайындалады да, дайын файлдар сонда сақталады. Бұл
         * бұзылу емес, сондықтан хабарлама да нақты болуы керек.
         */
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new Error("Серверлік дауыс бұл ортада қолжетімсіз: Python орнатылмаған."));
          return;
        }
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(describeTtsError(stderr)));
      });
    });

    const [stat, marksRaw] = await Promise.all([
      fs.stat(outputPath),
      fs.readFile(marksPath, "utf-8").catch(() => "")
    ]);

    let durationMs = 0;
    let marks: AudioMark[] = [];

    if (marksRaw) {
      try {
        const parsed = JSON.parse(marksRaw) as { durationMs?: number; marks?: AudioMark[] };
        durationMs = Number(parsed.durationMs) || 0;
        marks = Array.isArray(parsed.marks) ? parsed.marks : [];
      } catch {
        marks = [];
      }
    }

    return { byteSize: stat.size, durationMs, marks, charCount: safeText.length };
  } finally {
    await fs.unlink(marksPath).catch(() => undefined);
  }
}

/**
 * Бір тақырыптың аудиосын дайындап, сақтайды.
 *
 * Әкімшінің топтамалық дайындауы да, оқушының «аудио тыңдау» түймесі де осы
 * бір жолдан өтеді: файл да, сөздердің уақыт белгілері де бірдей сақталады.
 * Бұрын оқушының жолы бөлек болатын да, белгілер жоғалып, оқылып жатқан сөз
 * мәтінде ерекшеленбейтін.
 */
export async function prepareChapterAudio(options: {
  chapterId: string;
  voice: AudioVoice;
  /** Бар аудионы қайта жасау керек пе */
  force?: boolean;
  createdById?: string | null;
}) {
  const { chapterId, voice } = options;
  const key = `${chapterId}:${voice}`;

  // Екі оқушы бір тақырыпты қатар ашса, бір файлға екі процесс жазып,
  // MP3 бүлінер еді. Сондықтан жүріп жатқан дайындауға қосыламыз.
  const running = inFlight.get(key);
  if (running) {
    return running;
  }

  const task = runPrepare(options).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, task);
  return task;
}

/** Жүріп жатқан дайындаулар: кілт — тақырып пен дауыс */
const inFlight = new Map<string, Promise<{ created: boolean; row: TopicAudioRow }>>();

type TopicAudioRow = Awaited<ReturnType<typeof prisma.topicAudio.upsert>>;

async function runPrepare(options: {
  chapterId: string;
  voice: AudioVoice;
  force?: boolean;
  createdById?: string | null;
}): Promise<{ created: boolean; row: TopicAudioRow }> {
  const { chapterId, voice, force = false, createdById = null } = options;

  const existing = await prisma.topicAudio.findUnique({
    where: { chapterId_voice: { chapterId, voice } }
  });

  if (existing && !force) {
    return { created: false, row: existing };
  }

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, title: true, content: true }
  });

  if (!chapter) {
    throw new Error("Тақырып табылмады.");
  }

  const text = buildAudioText(chapter.title, chapter.content);
  if (text.length < 40) {
    throw new Error("Аудио жасауға мәтін тым қысқа.");
  }

  const unavailable = describeAudioUnavailable();
  if (unavailable) {
    throw new Error(unavailable);
  }

  const fileName = `${chapter.id}--${voice}.mp3`;
  const outputPath = path.join(getAudioStorageDir(), fileName);

  try {
    const audio = await synthesizeAudio({ text, voice, outputPath });

    const row = await prisma.topicAudio.upsert({
      where: { chapterId_voice: { chapterId: chapter.id, voice } },
      create: {
        chapterId: chapter.id,
        voice,
        fileName,
        byteSize: audio.byteSize,
        durationMs: audio.durationMs,
        wordCount: audio.marks.length,
        marks: audio.marks,
        createdById
      },
      update: {
        fileName,
        byteSize: audio.byteSize,
        durationMs: audio.durationMs,
        wordCount: audio.marks.length,
        marks: audio.marks
      }
    });

    return { created: true, row };
  } catch (error) {
    await fs.unlink(outputPath).catch(() => undefined);
    throw error;
  }
}

/** Клиентке берілетін түрі */
export function describeTopicAudio(row: {
  id: string;
  chapterId: string;
  voice: string;
  durationMs: number;
  wordCount: number;
  marks: unknown;
}) {
  return {
    id: row.id,
    chapterId: row.chapterId,
    voice: row.voice,
    durationMs: row.durationMs,
    wordCount: row.wordCount,
    url: `/api/topic-audio/file/${row.id}`,
    marks: (row.marks as unknown as AudioMark[]) ?? []
  };
}

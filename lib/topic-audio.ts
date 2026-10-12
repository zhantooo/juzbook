import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

  return `${title}. ${plain}`.trim();
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

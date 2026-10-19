import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(10, "Аудио жасау үшін мәтін тым қысқа."),
  voice: z.string().trim().optional().default("kk-KZ-AigulNeural")
});

function getPythonExecutable() {
  return process.env.JUZBOOK_PYTHON_PATH?.trim() || "C:\\Users\\user\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse((await request.json()) as unknown);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Сұраныс деректері жарамсыз." },
      { status: 400 }
    );
  }

  const { text, voice } = parsed.data;
  const safeText = text.replace(/\s+/g, " ").trim().slice(0, 5000);
  const outputFilePath = path.join(os.tmpdir(), `juzbook-topic-${randomUUID()}.mp3`);
  const scriptPath = path.join(process.cwd(), "scripts", "topic_podcast.py");
  const pythonExecutable = getPythonExecutable();

  // Диагностикаға: скрипттің нақты қатесі dev режимінде жауапқа қосылады
  let lastStderr = "";

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(pythonExecutable, [scriptPath, safeText, outputFilePath, voice], {
        windowsHide: true
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => reject(error));
      child.on("close", (code) => {
        lastStderr = stderr;
        if (code === 0) {
          resolve();
          return;
        }

        if (stderr.includes("EDGE_TTS_NOT_INSTALLED") || stderr.includes("No module named 'edge_tts'")) {
          reject(new Error("Python ішінде edge_tts орнатылмаған. Уақытша браузер дауысы қолданылады."));
          return;
        }

        if (stderr.includes("EDGE_TTS_EMPTY_TEXT")) {
          reject(new Error("Аудио жасауға мәтін жеткіліксіз."));
          return;
        }

        if (stderr.includes("EDGE_TTS_NO_AUDIO") || stderr.includes("NoAudioReceived")) {
          reject(new Error("Серверлік дауыс бұл мәтінге аудио қайтара алмады. Уақытша браузер дауысы қолданылады."));
          return;
        }

        reject(new Error("Аудио сервисі мәтінді дыбысқа айналдыра алмады. Уақытша браузер дауысы қолданылады."));
      });
    });

    const fileBuffer = await fs.readFile(outputFilePath);
    await fs.unlink(outputFilePath).catch(() => undefined);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="topic-podcast.mp3"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    await fs.unlink(outputFilePath).catch(() => undefined);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Аудио жасау кезінде қате пайда болды.",
        // Диагностика dev режимінде ғана: өнімде скрипттің ішкі қатесі
        // пайдаланушыға көрсетілмеуі керек
        ...(process.env.NODE_ENV === "development" ? { stderr: lastStderr.slice(0, 1200) } : {})
      },
      { status: 500 }
    );
  }
}

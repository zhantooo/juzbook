import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/security/auth";

export const runtime = "nodejs";

/**
 * Редакторда өңделген (қиылған) суретті файл етіп сақтайды.
 *
 * Сурет тақырып мәтініне data-URL болып жазылса, мәтін өлшемі бірнеше есе
 * артып, сақтау шегінен (600 000 таңба) асып кетеді. Сондықтан сурет
 * `public/uploads` ішіне жазылып, мәтінде тек қысқа сілтемесі тұрады.
 * Файл атауы мазмұнының хэшінен жасалады: бірдей сурет екі рет сақталмайды
 * әрі кэш өздігінен жаңарады.
 */
const MAX_BYTES = 12 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const bodySchema = z.object({
  dataUrl: z
    .string()
    .min(32)
    .max(Math.ceil(MAX_BYTES * 1.4))
});

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse((await request.json()) as unknown);
  } catch {
    return NextResponse.json({ error: "Дерек жарамсыз." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: "Дерек жарамсыз." }, { status: 400 });
  }

  const match = DATA_URL.exec(parsed.data.dataUrl.trim());
  if (!match) {
    return NextResponse.json({ error: "Тек PNG, JPEG немесе WebP сурет қабылданады." }, { status: 400 });
  }

  const extension = EXTENSIONS[match[1]];
  const buffer = Buffer.from(match[2], "base64");

  if (!buffer.length || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: "Сурет тым үлкен (12 МБ-қа дейін)." }, { status: 413 });
  }

  try {
    const name = `${createHash("sha1").update(buffer).digest("hex").slice(0, 20)}.${extension}`;
    const directory = join(process.cwd(), "public", "uploads");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, name), buffer);

    return NextResponse.json({ ok: true, url: `/uploads/${name}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Суретті сақтау мүмкін болмады." },
      { status: 500 }
    );
  }
}

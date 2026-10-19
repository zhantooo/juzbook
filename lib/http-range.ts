import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";

/**
 * Файлды `Range` сұранысын қолдап береді.
 *
 * Браузердің `<audio>` элементі жүгірткіні (seek) тек сервер файлды
 * бөлшектеп беруге дайын болғанда ғана ашады: `Accept-Ranges: bytes` пен
 * 206 жауабы керек. Бүкіл файлды бір бөлікпен қайтарсаң, аудио ойнайды,
 * бірақ уақытын өзгерту мүмкін болмайды.
 *
 * Аудио файлдары `public` қалтасында емес (авторлық құқық), сондықтан оларды
 * Next-тің статикалық қызметі емес, осы функция береді.
 */
export async function serveFileWithRange(options: {
  filePath: string;
  contentType: string;
  rangeHeader: string | null;
  cacheControl?: string;
}) {
  const { filePath, contentType, rangeHeader } = options;
  const stat = await fs.stat(filePath).catch(() => null);

  if (!stat || !stat.isFile()) {
    return null;
  }

  const total = stat.size;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": options.cacheControl ?? "private, max-age=86400"
  };

  if (!rangeHeader) {
    const file = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: { ...headers, "Content-Length": String(total) }
    });
  }

  const unsatisfiable = () =>
    new NextResponse(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${total}` }
    });

  // «bytes=1000-», «bytes=1000-2000» немесе «bytes=-500» (соңғы 500 байт)
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return unsatisfiable();
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return unsatisfiable();
  }

  let start = rawStart ? Number(rawStart) : 0;
  let end = rawEnd ? Number(rawEnd) : total - 1;

  if (!rawStart) {
    start = Math.max(0, total - Number(rawEnd));
    end = total - 1;
  }

  end = Math.min(end, total - 1);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
    return unsatisfiable();
  }

  const length = end - start + 1;
  const handle = await fs.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);

    return new NextResponse(new Uint8Array(buffer), {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(length),
        "Content-Range": `bytes ${start}-${end}/${total}`
      }
    });
  } finally {
    await handle.close();
  }
}

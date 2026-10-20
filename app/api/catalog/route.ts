import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { getCatalogFromDatabase, getCatalogNavigationFromDatabase } from "@/lib/catalog-db";

export const runtime = "nodejs";

/**
 * Каталог жауабы үлкен: оқушыға берілетін навигация мыңдаған тақырыптың
 * атауынан тұрады. Сондықтан үш нәрсе қосылды:
 *
 * - **gzip** — қайталанатын JSON он есеге жуық сығылады;
 * - **ETag** — мазмұн өзгермесе, браузер `If-None-Match` жіберіп, `304`
 *   алады да, дене мүлде тасымалданбайды;
 * - **`Vary: Accept-Encoding`** — аралық кэш сығылған және сығылмаған
 *   нұсқаларды шатастырмауы үшін.
 *
 * `Cache-Control: private, max-age=0, must-revalidate` — каталог
 * пайдаланушыға қарай өзгереді (жасырылған пәндер), сондықтан ортақ
 * кэшке сақталмауы керек, бірақ әр сұранымда `ETag` арқылы тексеріледі.
 */
function buildResponse(request: Request, payload: unknown, status = 200) {
  const body = JSON.stringify(payload);
  const etag = `"${createHash("sha1").update(body).digest("hex")}"`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, max-age=0, must-revalidate",
    Vary: "Accept-Encoding",
    ETag: etag
  };

  if (status === 200 && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const acceptsGzip = (request.headers.get("accept-encoding") || "").toLowerCase().includes("gzip");
  if (!acceptsGzip) {
    return new Response(body, { status, headers });
  }

  const compressed = gzipSync(Buffer.from(body, "utf8"));
  return new Response(new Uint8Array(compressed), {
    status,
    headers: { ...headers, "Content-Encoding": "gzip" }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");
    const includeHidden = searchParams.get("includeHidden") === "1";
    const subjects =
      view === "navigation"
        ? await getCatalogNavigationFromDatabase()
        : await getCatalogFromDatabase(includeHidden);

    return buildResponse(request, { subjects });
  } catch (error) {
    return buildResponse(
      request,
      {
        subjects: [],
        error: error instanceof Error ? error.message : "Каталогты базадан оқу мүмкін болмады."
      },
      500
    );
  }
}

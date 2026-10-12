import { getCatalogFromDatabase, getCatalogNavigationFromDatabase } from "@/lib/catalog-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");
    const includeHidden = searchParams.get("includeHidden") === "1";
    const subjects =
      view === "navigation"
        ? await getCatalogNavigationFromDatabase()
        : await getCatalogFromDatabase(includeHidden);
    return Response.json({ subjects });
  } catch (error) {
    return Response.json(
      {
        subjects: [],
        error: error instanceof Error ? error.message : "Каталогты базадан оқу мүмкін болмады."
      },
      { status: 500 }
    );
  }
}

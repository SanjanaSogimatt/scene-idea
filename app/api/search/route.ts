import { getCatalog } from "@/lib/catalog";
import { parseQuery } from "@/lib/parseQuery";
import { rankProducts } from "@/lib/rank";
import { buildOutfits } from "@/lib/combine";
import { hasKey } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "Type something to search for." }, { status: 400 });
    }

    const catalog = await getCatalog();
    const parsed = await parseQuery(query.trim());
    const ranked = await rankProducts(catalog, parsed);
    const outfits = buildOutfits(ranked, parsed);

    return Response.json({
      parsed,
      outfits,
      topProducts: ranked.slice(0, 20),
      mode: hasKey ? "ai" : "keyword",
    });
  } catch (e: any) {
    console.error(e);
    return Response.json({ error: e?.message || "Search failed" }, { status: 500 });
  }
}

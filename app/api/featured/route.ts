import { getCatalog } from "@/lib/catalog";
import { buildOutfits } from "@/lib/combine";
import type { ParsedQuery, RankedProduct } from "@/lib/types";

export const runtime = "nodejs";

// Landing-page looks: no LLM call, just well-rated pieces combined into outfits
export async function GET() {
  try {
    const catalog = await getCatalog();
    const ranked: RankedProduct[] = catalog
      .filter((p) => p.price <= 200) // keep the landing page approachable
      .map(({ embedding, ...p }) => ({ ...p, score: p.rating / 5 }))
      .sort((a, b) => b.score - a.score);

    const neutral: ParsedQuery = {
      searchText: "", gender: null, budget: null, budgetOriginal: null,
      slotsNeeded: null, occasion: null, timeOfDay: null, formality: null,
    };
    return Response.json({ outfits: buildOutfits(ranked, neutral) });
  } catch (e: any) {
    console.error(e);
    return Response.json({ outfits: [], error: e?.message }, { status: 200 });
  }
}

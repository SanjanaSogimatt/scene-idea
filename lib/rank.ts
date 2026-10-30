import { embed, hasKey } from "./gemini";
import type { ParsedQuery, Product, RankedProduct } from "./types";

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Keyword overlap – used when there is no API key / embeddings
function keywordSim(query: string, p: Product) {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const text = `${p.title} ${p.description} ${p.category} ${p.styleWords.join(" ")}`.toLowerCase();
  if (!words.length) return 0;
  return words.filter((w) => text.includes(w)).length / words.length;
}

export async function rankProducts(
  products: Product[],
  parsed: ParsedQuery,
): Promise<RankedProduct[]> {
  const useEmb = hasKey && products[0]?.embedding;
  let qVec: number[] | null = null;
  if (useEmb) {
    try {
      qVec = (await embed([parsed.searchText], "RETRIEVAL_QUERY"))[0];
    } catch (e) {
      console.error("Query embedding failed, using keyword match:", e);
    }
  }

  const ranked = products
    .filter((p) => !parsed.gender || p.gender === parsed.gender || p.gender === "unisex")
    .map((p) => {
      const sim = qVec && p.embedding ? cosine(qVec, p.embedding) : keywordSim(parsed.searchText, p);
      const formalityFit = parsed.formality == null ? 0.5 : 1 - Math.abs(parsed.formality - p.formality) / 4;
      const score = 0.7 * sim + 0.2 * formalityFit + 0.1 * (p.rating / 5);
      const { embedding, ...rest } = p; // never send vectors to the browser
      return { ...rest, score };
    });

  // Normalise to 0–1 so scores are comparable across queries
  const max = Math.max(...ranked.map((r) => r.score));
  const min = Math.min(...ranked.map((r) => r.score));
  ranked.forEach((r) => (r.score = max === min ? 1 : (r.score - min) / (max - min)));

  return ranked.sort((a, b) => b.score - a.score);
}

import fs from "fs";
import path from "path";
import { embed, hasKey, EMBED_MODEL } from "./gemini";
import type { Gender, Product, Slot } from "./types";

// DummyJSON fashion categories → outfit slot + gender
// Note: DummyJSON's "tops" category is actually frocks/dresses.
const CATEGORIES: Record<string, { slot: Slot; gender: Gender; label: string }> = {
  tops: { slot: "dress", gender: "female", label: "women's dress" },
  "womens-dresses": { slot: "dress", gender: "female", label: "women's dress" },
  "mens-shirts": { slot: "top", gender: "male", label: "men's shirt" },
  "womens-shoes": { slot: "shoes", gender: "female", label: "women's shoes" },
  "mens-shoes": { slot: "shoes", gender: "male", label: "men's shoes" },
  "womens-bags": { slot: "bag", gender: "female", label: "women's bag" },
  "womens-jewellery": { slot: "accessory", gender: "female", label: "women's jewellery" },
  "womens-watches": { slot: "accessory", gender: "female", label: "women's watch" },
  "mens-watches": { slot: "accessory", gender: "male", label: "men's watch" },
  sunglasses: { slot: "accessory", gender: "unisex", label: "sunglasses" },
};

// Most DummyJSON watches are $5k–$16k Rolexes; they'd dominate every budget, so skip them
const MAX_PRICE = 500;

// Light keyword heuristics so ranking has a formality signal even without an LLM pass
const FORMAL = ["formal", "gown", "corset", "suit", "earring", "crystal", "golden", "wedding", "evening", "gown", "heel", "pump", "oxford", "suit", "blazer", "gold", "diamond", "silk", "elegant", "luxury", "leather", "chronograph", "party", "classic"];
const CASUAL = ["casual", "t-shirt", "tee", "sneaker", "trainer", "denim", "cotton", "sport", "running", "everyday", "relaxed", "comfortable", "canvas", "slipper", "check", "plaid", "summer", "backpack", "frock", "slipper", "short sleeve", "tshirt", "sneakers", "trainers", "cleats"];

function inferFormality(text: string): number {
  const t = text.toLowerCase();
  const f = FORMAL.filter((w) => t.includes(w)).length;
  const c = CASUAL.filter((w) => t.includes(w)).length;
  return Math.max(1, Math.min(5, 3 + f - c));
}

function inferStyleWords(text: string): string[] {
  const t = text.toLowerCase();
  return [...FORMAL, ...CASUAL].filter((w) => t.includes(w));
}

const CACHE_FILE = path.join(process.cwd(), "data", "catalog.json");

async function fetchFromDummyJSON(): Promise<Product[]> {
  const out: Product[] = [];
  for (const [slug, meta] of Object.entries(CATEGORIES)) {
    const res = await fetch(`https://dummyjson.com/products/category/${slug}?limit=0`);
    if (!res.ok) throw new Error(`DummyJSON ${slug}: ${res.status}`);
    const json = await res.json();
    for (const p of json.products) {
      if (p.price > MAX_PRICE) continue;
      if ((p.tags || []).some((t: string) => /girls|kids|boys/i.test(t))) continue; // adult outfits only
      const tags: string[] = p.tags || [];
      const text = `${p.title} ${p.description} ${tags.join(" ")}`;
      out.push({
        id: p.id,
        title: p.title,
        description: p.description,
        category: meta.label,
        brand: p.brand,
        price: p.price,
        rating: p.rating,
        thumbnail: p.thumbnail,
        images: p.images?.length ? p.images : [p.thumbnail],
        slot: meta.slot,
        gender: meta.gender,
        formality: inferFormality(text),
        styleWords: [...new Set([...inferStyleWords(text), ...tags.filter((t) => !/^(clothing|footwear|watches|eyewear|fashion accessories)$/.test(t))])],
      });
    }
  }
  return out;
}

export function productText(p: Product): string {
  return [p.title, p.brand, p.category, p.description, p.styleWords.join(", ")]
    .filter(Boolean)
    .join(". ");
}

let catalogPromise: Promise<Product[]> | null = null;

async function loadCatalog(): Promise<Product[]> {
  const wantModel = `dummyjson:${hasKey ? EMBED_MODEL : "none"}`;

  // 1. Use the cached file if it was built with the same embedding model
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      if (cached?.embedModel === wantModel && cached.products?.length) return cached.products;
    } catch {
      /* corrupt or old format – rebuild */
    }
  }

  // 2. Otherwise fetch + embed once, then save for next time
  const products = await fetchFromDummyJSON();
  if (hasKey) {
    const vectors = await embed(products.map(productText), "RETRIEVAL_DOCUMENT");
    products.forEach((p, i) => (p.embedding = vectors[i]));
  }
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ embedModel: wantModel, products }));
  } catch {
    /* read-only filesystem (e.g. Vercel) – keep in memory only */
  }
  return products;
}

export function getCatalog(): Promise<Product[]> {
  if (!catalogPromise) {
    catalogPromise = loadCatalog().catch((e) => {
      catalogPromise = null; // allow retry on next request
      throw e;
    });
  }
  return catalogPromise;
}

export async function rebuildCatalog(): Promise<number> {
  if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  catalogPromise = null;
  return (await getCatalog()).length;
}

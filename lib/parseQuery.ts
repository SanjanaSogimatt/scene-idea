import { hasKey, generateJSON } from "./gemini";
import type { ParsedQuery, Slot } from "./types";

const INR_PER_USD = 88; // rough; DummyJSON prices are in USD
const SLOTS: Slot[] = ["top", "dress", "shoes", "bag", "accessory"];

// Regex budget parser – used as a fallback and as a sanity check on the LLM
export function parseBudget(q: string): { usd: number; original: string } | null {
  const s = q.toLowerCase().replace(/,/g, "");
  const m =
    s.match(/(₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(k)?/) ||
    s.match(/(\d+(?:\.\d+)?)\s*(k)?\s*(rupees|inr|rs)\b/) ||
    s.match(/(\$|usd)\s*(\d+(?:\.\d+)?)\s*(k)?/) ||
    s.match(/(\d+(?:\.\d+)?)\s*(k)?\s*(dollars|usd|bucks)\b/) ||
    s.match(/(?:under|below|less than|within|max|budget(?: of| is)?|upto|up to|around|about)\s*(\d+(?:\.\d+)?)\s*(k)?/);
  if (!m) return null;

  const isInr = /₹|rs|inr|rupee/.test(m[0]);
  const num = parseFloat(m.find((g, i) => i > 0 && g && /^\d/.test(g))!);
  const mult = /k\b|\dk/.test(m[0]) ? 1000 : 1;
  const value = num * mult;
  return { usd: isInr ? value / INR_PER_USD : value, original: m[0].trim() };
}

function fallbackParse(q: string): ParsedQuery {
  const s = q.toLowerCase();
  const b = parseBudget(q);
  const gender = /\b(men|man|male|guy|boy|him|his|husband|boyfriend)\b/.test(s)
    ? "male"
    : /\b(women|woman|female|girl|her|she|wife|girlfriend|lady)\b/.test(s)
      ? "female"
      : null;
  const WORDS: Record<Slot, RegExp> = {
    top: /\b(tops?|tees?|t-shirts?|shirts?)\b/,
    outerwear: /$^/,
    dress: /\b(dress(es)?|frocks?|gowns?)\b/,
    shoes: /\b(shoes?|sneakers?|heels?|trainers?|footwear)\b/,
    bag: /\b(bags?|backpacks?|handbags?|purses?)\b/,
    accessory: /\b(jewell?e?ry|earrings?|watch(es)?|sunglasses|accessor(y|ies))\b/,
  };
  const only = SLOTS.filter((sl) => WORDS[sl].test(s));
  const wantsOutfit = /outfit|look|wear|dress up|what to wear/.test(s);
  return {
    searchText: q,
    gender,
    budget: b?.usd ?? null,
    budgetOriginal: b?.original ?? null,
    slotsNeeded: only.length && !wantsOutfit ? only : null,
    occasion: null,
    timeOfDay: null,
    formality: /wedding|gala|formal|interview|office|meeting/.test(s) ? 4 : /coffee|brunch|beach|gym|casual|park/.test(s) ? 2 : null,
  };
}

const SYSTEM = `You turn a fashion search query into JSON filters for an outfit search engine.
Return ONLY JSON with these keys:
- searchText: a rich 1-2 sentence description of the ideal clothing/accessories for this query (style, vibe, fabrics, colours). Used for semantic search.
- gender: "male" | "female" | null (null if not stated or implied)
- budget: number | null  (total budget as a plain number in the currency the user wrote)
- currency: "USD" | "INR" | null
- slotsNeeded: array of "top" | "dress" | "shoes" | "bag" | "accessory" (top = men's shirts, accessory = earrings, watches, sunglasses), or null if the user wants a complete outfit. Only list specific slots if the user asks for specific items (e.g. "shoes for a wedding" -> ["shoes"], "sunglasses for the beach" -> ["accessory"]).
- occasion: short string or null
- timeOfDay: "morning" | "afternoon" | "evening" | "night" | null
- formality: integer 1 (very casual) to 5 (black tie), or null
Words like "cheap" or "affordable" with no number mean budget 60 USD; "luxury" means no budget.`;

export async function parseQuery(q: string): Promise<ParsedQuery> {
  if (!hasKey) return fallbackParse(q);
  try {
    const j = await generateJSON(SYSTEM, q);
    const regexBudget = parseBudget(q);

    let budget: number | null = typeof j.budget === "number" && j.budget > 0 ? j.budget : null;
    if (budget && j.currency === "INR") budget = budget / INR_PER_USD;
    if (regexBudget) budget = regexBudget.usd; // explicit numbers in the text win

    const slots: Slot[] | null = Array.isArray(j.slotsNeeded)
      ? j.slotsNeeded.filter((s: string) => SLOTS.includes(s as Slot))
      : null;

    return {
      searchText: j.searchText || q,
      gender: j.gender === "male" || j.gender === "female" ? j.gender : null,
      budget,
      budgetOriginal: regexBudget?.original ?? (budget ? `$${Math.round(budget)}` : null),
      slotsNeeded: slots && slots.length ? slots : null,
      occasion: j.occasion ?? null,
      timeOfDay: j.timeOfDay ?? null,
      formality: typeof j.formality === "number" ? j.formality : null,
    };
  } catch (e) {
    console.error("parseQuery LLM failed, using fallback:", e);
    return fallbackParse(q);
  }
}

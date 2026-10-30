import { shortTitle } from "./format";
import type { Gender, Outfit, ParsedQuery, RankedProduct, Slot } from "./types";

const MAX_OUTFITS = 12;

// Which slots make up a complete outfit, per gender. First slot = the "hero" piece.
function templatesFor(gender: "male" | "female"): Slot[][] {
  return gender === "female"
    ? [
        ["dress", "shoes", "bag", "accessory"],
        ["dress", "shoes", "accessory"],
        ["dress", "shoes", "bag"],
      ]
    : [
        ["top", "shoes", "accessory"],
        ["top", "shoes"],
      ];
}

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((a) => list.map((x) => [...a, x])), [[]]);
}

// Candidates for one slot: the best matches, plus some cheap good-enough options when on a budget
function candidates(pool: RankedProduct[], slot: Slot, budget: number | null): RankedProduct[] {
  let inSlot = pool.filter((p) => p.slot === slot && (budget == null || p.price <= budget));
  // Budget too small for anything in this slot → offer the cheapest pieces anyway
  if (!inSlot.length && budget != null) {
    return pool.filter((p) => p.slot === slot).sort((a, b) => a.price - b.price).slice(0, 3);
  }
  const best = inSlot.slice(0, 5);
  if (budget == null) return best;
  const cheap = inSlot.slice(0, 15).sort((a, b) => a.price - b.price).slice(0, 3);
  return [...new Map([...best, ...cheap].map((p) => [p.id, p])).values()];
}

const NOUN: Record<string, string> = {
  top: "a shirt", outerwear: "a jacket", bag: "a bag", accessory: "an accessory", dress: "a dress", shoes: "shoes",
};

function reasonFor(parsed: ParsedQuery, items: RankedProduct[], total: number, within: boolean | null) {
  const [hero, ...rest] = items;
  let r = shortTitle(hero.title);
  if (rest.length) {
    const nouns = rest.map((i) => shortTitle(i.title));
    r += `, with ${nouns.length > 1 ? nouns.slice(0, -1).join(", ") + " and " + nouns.at(-1) : nouns[0]}`;
  }
  const context = [parsed.occasion, parsed.timeOfDay].filter(Boolean).join(", ");
  if (context) r += ` for ${context}`;
  if (within === true && parsed.budget) r += ` · $${Math.round(parsed.budget - total)} to spare`;
  if (within === false) r += ` · closest to your budget`;
  return r;
}

export function buildOutfits(ranked: RankedProduct[], parsed: ParsedQuery): Outfit[] {
  const genders: ("male" | "female")[] = parsed.gender ? [parsed.gender] : ["female", "male"];
  const budget = parsed.budget;
  let all: Outfit[] = [];

  for (const g of genders) {
    const pool = ranked.filter((p) => p.gender === g || p.gender === "unisex");
    const templates = parsed.slotsNeeded ? [parsed.slotsNeeded] : templatesFor(g);

    for (const slots of templates) {
      const lists = slots.map((s) => candidates(pool, s, budget));
      if (lists.some((l) => l.length === 0)) continue;

      for (const items of cartesian(lists)) {
        if (new Set(items.map((i) => i.id)).size !== items.length) continue;
        const total = items.reduce((s, i) => s + i.price, 0);
        // Hero piece counts double so the main item drives relevance
        const score = (items[0].score * 2 + items.slice(1).reduce((s, i) => s + i.score, 0)) / (items.length + 1);
        all.push({
          id: `${g}-${items.map((i) => i.id).join("-")}`,
          gender: g as Gender,
          items,
          total: Math.round(total * 100) / 100,
          score,
          withinBudget: budget == null ? null : total <= budget,
          reason: "",
        });
      }
    }
  }

  let pickFrom = all;
  if (budget != null) {
    const fits = all.filter((o) => o.withinBudget);
    // Nothing fits → show the cheapest combinations instead of an empty page
    if (fits.length) pickFrom = fits.sort((a, b) => b.score - a.score);
    else pickFrom = [...all].sort((a, b) => a.total - b.total).slice(0, 30);
  } else {
    pickFrom.sort((a, b) => b.score - a.score);
  }

  // Diversify: small catalog, so allow a hero twice and any item three times, never the same set twice
  const chosen: Outfit[] = [];
  const heroUses = new Map<number, number>();
  const itemUses = new Map<number, number>();
  const seenSets = new Set<string>();
  const multi = (parsed.slotsNeeded?.length ?? 2) > 1;
  for (const o of pickFrom) {
    if (chosen.length >= MAX_OUTFITS) break;
    const key = o.items.map((i) => i.id).sort((a, b) => a - b).join("-");
    if (seenSets.has(key)) continue;
    if ((heroUses.get(o.items[0].id) || 0) >= (multi ? 2 : 1)) continue;
    if (multi && o.items.some((i) => (itemUses.get(i.id) || 0) >= 3)) continue;
    seenSets.add(key);
    heroUses.set(o.items[0].id, (heroUses.get(o.items[0].id) || 0) + 1);
    o.items.forEach((i) => itemUses.set(i.id, (itemUses.get(i.id) || 0) + 1));
    o.reason = reasonFor(parsed, o.items, o.total, o.withinBudget);
    chosen.push(o);
  }
  return chosen;
}

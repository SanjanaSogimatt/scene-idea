// Trims long product titles for card captions (e.g. "Heshe Women's Leather Bag" → "Leather Bag").
// Trim the shouting brand prefix and keep the first few meaningful words.
export function shortTitle(title: string): string {
  let t = title.split(/[,(\-–]| - /)[0].trim();
  t = t.replace(/^[A-Z]{3,}\s+/, "").replace(/^(Heshe)\s+/i, "");
  t = t.replace(/\b(women'?s|womens|men'?s|mens|women|men)\b\s*/gi, "").trim();
  const words = t.split(/\s+/);
  return words.length > 5 ? words.slice(0, 5).join(" ") : t;
}

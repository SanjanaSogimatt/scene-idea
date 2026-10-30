# Scene: outfit search

Describe the moment ("coffee date at 3pm under $150") and get complete outfits, ranked and budget-aware.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

`GEMINI_API_KEY` is read from `.env`. It uses Gemini (`gemini-2.5-flash`) to understand queries and `gemini-embedding-001` for embeddings. You can override either with `GEMINI_MODEL` / `GEMINI_EMBEDDING_MODEL`. On the first search the app fetches the fashion categories from DummyJSON, embeds them, and caches everything in `data/catalog.json`. To rebuild that cache, run `npm run catalog`.

## How it works

1. **Parse** (`lib/parseQuery.ts`): Gemini turns the query into filters (budget, gender, occasion, time of day, formality, slots needed). A regex parser double-checks budgets like `$150`, `₹15000` and `2k`.
2. **Rank** (`lib/rank.ts`): `0.7 × Gemini embedding similarity + 0.2 × formality fit + 0.1 × rating`.
3. **Combine** (`lib/combine.ts`): takes the top candidates per slot and tries every combination. With a budget, it keeps the combinations that fit, and shows the closest ones if none do. Results are diversified so each outfit has a different hero piece.
4. **Display** (`app/page.tsx`): a masonry grid of outfit cards with a detail sheet. The landing page shows floating starter looks from `/api/featured`, which makes no Gemini call.

DummyJSON has about 49 fashion products. Watches over $500 (mostly Rolexes) are left out so budgets stay realistic, and its `tops` category is treated as dresses because that's what it contains.

Without an API key it still works, in keyword mode.

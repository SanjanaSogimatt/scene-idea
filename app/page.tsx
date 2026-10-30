"use client";

import { useEffect, useState } from "react";
import type { Outfit, ParsedQuery } from "@/lib/types";
import { shortTitle } from "@/lib/format";

const EXAMPLES = [
  "Coffee date at 3pm under $150",
  "Men's weekend look",
  "Beach day, something breezy",
  "Wedding guest under ₹20000",
  "Shoes for a night out",
];

const SLOT_LABEL: Record<string, string> = {
  top: "Top", outerwear: "Outerwear", dress: "Dress", shoes: "Shoes", bag: "Bag", accessory: "Accessory",
};

const money = (n: number) => `$${n.toFixed(2)}`;

function SearchBar({ value, onChange, onSubmit, loading, autoFocus }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean; autoFocus?: boolean;
}) {
  return (
    <form className="searchbar" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Coffee with friends at 3pm, under $100"
        aria-label="Describe the occasion"
        autoFocus={autoFocus}
      />
      <button className="go" type="submit" disabled={loading || !value.trim()} aria-label="Search">
        {loading ? <span className="spinner" /> : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </form>
  );
}

function OutfitCard({ o, idx, floating, onOpen }: { o: Outfit; idx: number; floating?: boolean; onOpen: (o: Outfit) => void }) {
  // Each floating block bobs on its own rhythm so the grid feels alive, not mechanical
  const floatStyle = floating
    ? { animationDuration: `${6 + (idx % 4) * 1.3}s`, animationDelay: `${-(idx * 0.9)}s` }
    : undefined;
  return (
    <div className={floating ? "float" : "slot-wrap"} style={floatStyle}>
      <article className="pin" style={{ animationDelay: `${idx * 50}ms` }} onClick={() => onOpen(o)}>
        <div className={`collage n${Math.min(o.items.length, 4)}`}>
          {o.items.slice(0, 4).map((it, i) => (
            <div key={it.id} className={i === 0 ? "cell hero-img" : "cell"}>
              <img src={it.thumbnail} alt={it.title} loading="lazy" />
            </div>
          ))}
        </div>
        <div className="pin-body">
          <div className="pin-top">
            <span className="total">{money(o.total)}</span>
            {o.withinBudget === true && <span className="badge ok">Within budget</span>}
            {o.withinBudget === false && <span className="badge over">Over budget</span>}
          </div>
          <p className="reason">{o.reason}</p>
          <p className="meta">
            {o.items.length} {o.items.length === 1 ? "piece" : "pieces"} · {o.gender === "male" ? "Men" : o.gender === "female" ? "Women" : "Unisex"}
          </p>
        </div>
      </article>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [featured, setFeatured] = useState<Outfit[] | null>(null);
  const [parsed, setParsed] = useState<ParsedQuery | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [open, setOpen] = useState<Outfit | null>(null);

  useEffect(() => {
    fetch("/api/featured")
      .then((r) => r.json())
      .then((d) => setFeatured(d.outfits || []))
      .catch(() => setFeatured([]));
  }, []);

  async function search(q: string) {
    if (!q.trim()) return;
    setQuery(q);
    setLastQuery(q);
    setLoading(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setOutfits(data.outfits);
      setParsed(data.parsed);
      setMode(data.mode);
    } catch (e: any) {
      setError(e.message);
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setOutfits(null); setParsed(null); setError(null); setQuery("");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const isInr = parsed?.budgetOriginal && /₹|rs|inr|rupee/i.test(parsed.budgetOriginal);
  const chips = parsed
    ? [
        parsed.budget != null && (isInr ? `${parsed.budgetOriginal} ≈ ${money(parsed.budget)}` : `Under $${Math.round(parsed.budget)}`),
        parsed.gender && (parsed.gender === "female" ? "Women" : "Men"),
        parsed.occasion,
        parsed.timeOfDay,
        parsed.slotsNeeded ? parsed.slotsNeeded.map((s) => SLOT_LABEL[s]).join(" + ") : "Full outfit",
      ].filter(Boolean) as string[]
    : [];

  const started = outfits !== null || loading;

  return (
    <>
      {started && (
        <nav className="nav">
          <div className="nav-inner">
            <button className="brand" onClick={reset}>Scene</button>
            <SearchBar value={query} onChange={setQuery} onSubmit={() => search(query)} loading={loading} />
          </div>
        </nav>
      )}

      <main>
        {!started && (
          <>
            <header className="hero">
              <p className="eyebrow">Scene</p>
              <h1>Dress for the moment.</h1>
              <p className="sub">Tell us where you&apos;re going. We&apos;ll put the whole look together, on budget.</p>
              <SearchBar value={query} onChange={setQuery} onSubmit={() => search(query)} loading={loading} autoFocus />
              <div className="examples">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => search(ex)}>{ex}</button>
                ))}
              </div>
            </header>

            <section className="featured">
              <p className="section-label">Looks to start with</p>
              <div className="masonry floating">
                {featured === null
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="pin skeleton" style={{ height: 240 + ((i * 89) % 180) }} />
                    ))
                  : featured.map((o, idx) => (
                      <OutfitCard key={o.id} o={o} idx={idx} floating onOpen={setOpen} />
                    ))}
              </div>
            </section>
          </>
        )}

        {started && (
          <section className="results-head">
            <h2>{loading ? "Styling…" : `“${lastQuery}”`}</h2>
            {!loading && parsed && (
              <div className="understood">
                {chips.map((c) => <span key={c} className="chip">{c}</span>)}
                {mode === "keyword" && <span className="chip warn">Keyword mode · add GEMINI_API_KEY</span>}
              </div>
            )}
          </section>
        )}

        {loading && (
          <div className="masonry">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="pin skeleton" style={{ height: 260 + ((i * 89) % 180) }} />
            ))}
          </div>
        )}

        {!loading && error && <p className="error">{error}</p>}

        {!loading && !error && outfits?.length === 0 && (
          <p className="empty">Nothing quite fits. Try a looser budget or a different description.</p>
        )}

        {!loading && outfits && outfits.length > 0 && (
          <div className="masonry">
            {outfits.map((o, idx) => (
              <OutfitCard key={o.id} o={o} idx={idx} onOpen={setOpen} />
            ))}
          </div>
        )}
      </main>

      {open && (
        <div className="modal-bg" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="close" onClick={() => setOpen(null)} aria-label="Close">✕</button>
            <h2>{money(open.total)}</h2>
            <p className="reason">{open.reason}</p>
            <div className="items">
              {open.items.map((it) => (
                <div key={it.id} className="item">
                  <div className="thumb"><img src={it.thumbnail} alt={it.title} /></div>
                  <div>
                    <span className="slot">{SLOT_LABEL[it.slot]}</span>
                    <h3 title={it.title}>{shortTitle(it.title)}</h3>
                    <p className="desc">{it.description}</p>
                  </div>
                  <div className="item-price">
                    {money(it.price)}
                    <small>{Math.round(it.score * 100)}% match</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

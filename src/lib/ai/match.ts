// The built-in matcher: maps free text to tracked trades, places and sectors
// with plain keyword scoring. Deterministic, instant, and needs no API key.
import { PLACE_ALIASES, SKILL_WORDS, STATE_ALIASES, TERMS } from "./lexicon";
import { geo, taxonomy } from "../data";

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+/g, " ");
const isLatin = (s: string) => /^[\x00-\x7f]+$/.test(s);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Position of a term in the text, or -1. Latin terms must match on word boundaries. */
function find(text: string, term: string): number {
  if (!isLatin(term)) return text.indexOf(term);
  const m = new RegExp(`(?<![a-z0-9])${esc(term)}(?![a-z0-9])`).exec(text);
  return m ? m.index : -1;
}

export interface TradeMatch { trade: string; confidence: number; matched: string[] }

export function matchTrades(raw: string, limit = 3): TradeMatch[] {
  const text = norm(raw);
  const scored: { trade: string; score: number; matched: string[] }[] = [];
  for (const t of taxonomy().trades) {
    const terms = [...(TERMS[t.id] ?? []), norm(t.name.replace(/\(.*?\)/g, "").trim())];
    let score = 0;
    const matched: string[] = [];
    for (const term of new Set(terms)) {
      const at = find(text, term);
      if (at < 0) continue;
      const words = term.split(" ").length;
      score += (1 + 0.6 * (words - 1)) * (at < 90 ? 1.5 : 1);      // phrases and the headline count for more
      matched.push(term);
    }
    if (score > 0) scored.push({ trade: t.id, score, matched });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  const second = scored[1]?.score ?? 0;
  return scored.slice(0, limit).map((s, i) => ({
    trade: s.trade,
    matched: s.matched,
    confidence: Math.round(Math.min(0.95, (s.score / (top + 0.6 * second + 1.2)) * (i === 0 ? 1 : 0.9)) * 100) / 100,
  }));
}

export interface Entities { state?: string; district?: string; sector?: string; trade?: string }

/** Places, sectors and trades named in a question or advertisement. */
export function findEntities(raw: string): Entities {
  const text = norm(raw);
  const g = geo();
  const tx = taxonomy();
  const out: Entities = {};

  let best = -1;
  for (const d of g.districts) {
    const name = norm(d.name);
    if (name.length >= 4 && find(text, name) >= 0 && name.length > best) {
      out.district = d.id;
      best = name.length;
    }
  }
  for (const [alias, id] of Object.entries(PLACE_ALIASES)) {
    if (find(text, alias) >= 0 && alias.length > best) {
      out.district = id;
      best = alias.length;
    }
  }
  for (const [alias, id] of Object.entries(STATE_ALIASES)) if (find(text, alias) >= 0) out.state = id;
  for (const s of g.states) if (find(text, s.id.toLowerCase()) >= 0 && /\b(mh|tn|up|gj)\b/i.test(raw)) out.state = s.id;
  if (out.district && !out.state) out.state = g.districts.find((d) => d.id === out.district)!.state;

  for (const s of tx.sectors) {
    const words = norm(s.name).split(/[ &()/-]+/).filter((w) => w.length > 3);
    if (words.some((w) => find(text, w) >= 0) || text.includes(s.hi)) out.sector = s.id;
  }
  const tm = matchTrades(raw, 1)[0];
  if (tm && tm.confidence >= 0.3) {
    out.trade = tm.trade;
    out.sector = undefined;
  }
  return out;
}

export function findSkills(raw: string): string[] {
  const text = norm(raw);
  return SKILL_WORDS.filter((w) => find(text, w) >= 0).slice(0, 8);
}

// Grounding for the assistant. A question is resolved to a scope and an intent,
// the relevant figures are pulled from the same data the dashboard shows, and
// only those figures are given to the language model. Without a model, the same
// figures are returned with a plain summary.
import { findEntities, type Entities } from "./match";
import { cells, flags, geo, meta, overall, plan, taxonomy, tradeRows } from "../data";
import { int, signed } from "../format";
import { classOf } from "../scale";

export interface Figure { label: string; value: string }
export interface Grounding { entities: Entities; intent: string; scope: string; facts: string[]; figures: Figure[]; summary: string }

const CLASS_WORD: Record<string, string> = {
  acute_shortage: "acute shortage", shortage: "shortage", balanced: "balanced", surplus: "surplus", saturated: "saturated",
};
const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

function intentOf(q: string): string {
  const t = q.toLowerCase();
  if (has(t, ["warning", "flag", "alert", "critical", "चेतावनी", "எச்சரிக்கை", "ચેતવણી", "इशारा"])) return "warnings";
  if (has(t, ["plan", "seat", "target", "allocat", "change", "recommend", "सीट", "लक्ष्य", "योजना", "जागा"])) return "plan";
  if (has(t, ["oversuppl", "surplus", "saturat", "too many", "excess", "अधिक", "ज़्यादा", "संतृप्त", "अतिरिक्त"])) return "surplus";
  if (has(t, ["shortage", "short ", "unmet", "lack", "scarc", "कमी", "तुटवडा", "பற்றாக்குறை", "અછત"])) return "shortage";
  return "overview";
}

export function ground(question: string): Grounding {
  const e = findEntities(question);
  const intent = intentOf(question);
  const m = meta();
  const g = geo();
  const tx = taxonomy();
  const tName = (id: string) => tx.trades.find((t) => t.id === id)!.name;
  const dName = (id: string) => g.districts.find((d) => d.id === id)!.name;
  const sName = (id: string) => g.states.find((s) => s.id === id)!.name;
  const fy = `FY ${m.planFY}`;
  const scope = e.district ? `${dName(e.district)} district, ${sName(e.state!)}` : e.state ? sName(e.state) : "all four pilot states";
  const facts: string[] = [`Scope: ${scope}. Planning year: ${fy}. Data to ${m.dataAsOf}.`];
  const figures: Figure[] = [];
  let summary = "";
  const line = (name: string, d: number, s: number, score: number) =>
    `${name}: demand ${int(d)}, supply ${int(s)}, gap ${signed(d - s)}, ${CLASS_WORD[classOf(score)]} (score ${signed(score)})`;

  if (intent === "warnings") {
    const list = flags({ state: e.state, district: e.district, trade: e.trade }).slice(0, 6);
    facts.push(`Early warnings in scope: ${list.length === 0 ? "none" : ""}`);
    for (const f of list) {
      const where = f.level === "state" ? `${sName(f.geo)} (state-wide)` : dName(f.geo);
      facts.push(`[${f.severity}] ${tName(f.trade)} in ${where}: ${CLASS_WORD[f.from_class]} now, ${CLASS_WORD[f.to_class]} by ${f.month}; gap ${signed(f.gap)} in ${fy}`);
      figures.push({ label: `${tName(f.trade)} · ${where}`, value: `${f.severity}, ${signed(f.gap)}` });
    }
    summary = list.length
      ? `${list.length} early warnings stand out in ${scope}. The most severe is ${tName(list[0].trade)} in ${list[0].level === "state" ? sName(list[0].geo) : dName(list[0].geo)}, moving from ${CLASS_WORD[list[0].from_class]} to ${CLASS_WORD[list[0].to_class]} by ${list[0].month}.`
      : `There are no early warnings for ${scope} with these filters.`;
  } else if (intent === "plan" && (e.district || e.state)) {
    const rows = plan(e.state!).filter((r) => (!e.district || r.district === e.district) && (!e.trade || r.trade === e.trade));
    const up = [...rows].sort((a, b) => (b.rec - b.draft) - (a.rec - a.draft)).slice(0, 4).filter((r) => r.rec > r.draft);
    const down = [...rows].sort((a, b) => (a.rec - a.draft) - (b.rec - b.draft)).slice(0, 4).filter((r) => r.rec < r.draft);
    const draft = rows.reduce((s, r) => s + r.draft, 0);
    const rec = rows.reduce((s, r) => s + r.rec, 0);
    facts.push(`Seat plan for ${fy} (before any budget limit): draft ${int(draft)} seats, recommended ${int(rec)}.`);
    const where = (r: { district: string }) => (e.district ? "" : ` in ${dName(r.district)}`);
    for (const r of up) {
      facts.push(`Raise ${tName(r.trade)}${where(r)}: ${int(r.draft)} to ${int(r.rec)} seats (needed ${int(r.need)})`);
      figures.push({ label: `${tName(r.trade)}${where(r)}`, value: `${int(r.draft)} → ${int(r.rec)}` });
    }
    for (const r of down) {
      facts.push(`Cut ${tName(r.trade)}${where(r)}: ${int(r.draft)} to ${int(r.rec)} seats (needed ${int(r.need)})`);
      figures.push({ label: `${tName(r.trade)}${where(r)}`, value: `${int(r.draft)} → ${int(r.rec)}` });
    }
    summary = `For ${scope}, the plan moves seats from oversupplied to short trades. Largest increase: ${up[0] ? `${tName(up[0].trade)}${where(up[0])}, ${int(up[0].draft)} to ${int(up[0].rec)} seats` : "none"}. Largest cut: ${down[0] ? `${tName(down[0].trade)}${where(down[0])}, ${int(down[0].draft)} to ${int(down[0].rec)} seats` : "none"}.`;
  } else if (e.trade && !e.district) {
    const rows = cells({ state: e.state, trade: e.trade }).sort((a, b) => (b.dx - b.sx) - (a.dx - a.sx));
    const nat = tradeRows(e.state).find((r) => r.trade === e.trade)!;
    const want = intent === "surplus" ? [...rows].reverse().slice(0, 5) : rows.slice(0, 5);
    facts.push(line(`${tName(e.trade)} across ${scope}`, nat.dx, nat.sx, nat.s1));
    facts.push(`${intent === "surplus" ? "Districts with the largest surplus" : "Districts with the largest shortage"}:`);
    for (const c of want) {
      facts.push(line(dName(c.district), c.dx, c.sx, c.s1));
      figures.push({ label: dName(c.district), value: signed(c.dx - c.sx) });
    }
    summary = `${tName(e.trade)} is in ${CLASS_WORD[classOf(nat.s1)]} across ${scope} for ${fy}: demand ${int(nat.dx)} against supply ${int(nat.sx)}. The ${intent === "surplus" ? "largest surplus" : "largest gap"} is in ${want[0] ? dName(want[0].district) : "no district"} (${want[0] ? signed(want[0].dx - want[0].sx) : "0"}).`;
  } else {
    const o = overall({ state: e.state, district: e.district });
    facts.push(line(`All tracked trades in ${scope}`, o.dx, o.sx, o.s1));
    const rows = e.district
      ? cells({ district: e.district }).map((c) => ({ trade: c.trade, dx: c.dx, sx: c.sx, s1: c.s1 }))
      : tradeRows(e.state).filter((r) => !e.sector || tx.trades.find((t) => t.id === r.trade)!.sector === e.sector);
    const short = [...rows].sort((a, b) => (b.dx - b.sx) - (a.dx - a.sx)).slice(0, 5);
    const over = [...rows].sort((a, b) => (a.dx - a.sx) - (b.dx - b.sx)).slice(0, 5);
    if (intent !== "surplus") {
      facts.push("Largest shortages:");
      for (const r of short) facts.push(line(tName(r.trade), r.dx, r.sx, r.s1));
    }
    if (intent !== "shortage") {
      facts.push("Largest surpluses:");
      for (const r of over) facts.push(line(tName(r.trade), r.dx, r.sx, r.s1));
    }
    const show = intent === "surplus" ? over : intent === "shortage" ? short : [...short.slice(0, 3), ...over.slice(0, 3)];
    for (const r of show) figures.push({ label: tName(r.trade), value: signed(r.dx - r.sx) });
    summary = intent === "surplus"
      ? `In ${scope}, the most oversupplied trades for ${fy} are ${over.slice(0, 3).map((r) => `${tName(r.trade)} (${signed(r.dx - r.sx)})`).join(", ")}.`
      : intent === "shortage"
        ? `In ${scope}, the largest shortages for ${fy} are ${short.slice(0, 3).map((r) => `${tName(r.trade)} (${signed(r.dx - r.sx)})`).join(", ")}.`
        : `In ${scope}, demand for ${fy} is ${int(o.dx)} against a supply of ${int(o.sx)}. The largest shortage is ${tName(short[0].trade)} (${signed(short[0].dx - short[0].sx)}) and the largest surplus is ${tName(over[0].trade)} (${signed(over[0].dx - over[0].sx)}).`;
  }
  return { entities: e, intent, scope, facts, figures: figures.slice(0, 8), summary };
}

// Budget logic for the seat plan. Shared by the planner screen and the export
// API so a downloaded target sheet always matches what was on screen.
import type { PlanRow } from "./types";

export type BudgetMode = "neutral" | "plus5" | "plus10" | "free";
export const BUDGET_FACTOR: Record<BudgetMode, number | null> = { neutral: 1, plus5: 1.05, plus10: 1.1, free: null };

export interface PlannedRow extends PlanRow {
  /** Seats after the budget constraint (and any manual override). */
  final: number;
  edited: boolean;
}

export interface PlanSummary {
  draft: number; final: number; added: number; cut: number; changed: number;
  /** Share of seats or openings left unmatched: sum |entrants - demand| / sum max(entrants, demand). */
  mismatchBefore: number; mismatchAfter: number;
  matchedBefore: number; matchedAfter: number; demand: number;
  /** How much of each recommended increase survived the budget (1 = all of it). */
  scale: number;
}

const batch = (n: number) => Math.max(0, Math.round(n / 5) * 5);

/**
 * Cuts are taken in full. Increases are scaled back in proportion when the
 * total would otherwise exceed the budget. Manual overrides are honoured as
 * entered and are not rescaled.
 */
export function applyBudget(rows: PlanRow[], mode: BudgetMode, overrides: Record<string, number> = {}): { rows: PlannedRow[]; summary: PlanSummary } {
  const key = (r: PlanRow) => `${r.district}|${r.trade}`;
  const draft = rows.reduce((s, r) => s + r.draft, 0);
  const factor = BUDGET_FACTOR[mode];
  let fixed = 0;
  let wantUp = 0;
  for (const r of rows) {
    const o = overrides[key(r)];
    if (o !== undefined) fixed += o;
    else if (r.rec > r.draft) {
      fixed += r.draft;
      wantUp += r.rec - r.draft;
    } else fixed += r.rec;
  }
  const room = factor === null ? Infinity : draft * factor - fixed;
  const scale = wantUp <= 0 ? 1 : Math.max(0, Math.min(1, room / wantUp));

  const out: PlannedRow[] = rows.map((r) => {
    const o = overrides[key(r)];
    if (o !== undefined) return { ...r, final: o, edited: true };
    const final = r.rec > r.draft ? batch(r.draft + (r.rec - r.draft) * scale) : r.rec;
    return { ...r, final, edited: false };
  });

  let added = 0, cut = 0, changed = 0, misB = 0, misA = 0, den = 0, mB = 0, mA = 0, demand = 0, total = 0;
  for (const r of out) {
    total += r.final;
    if (r.final > r.draft) added += r.final - r.draft;
    if (r.final < r.draft) cut += r.draft - r.final;
    if (r.final !== r.draft) changed++;
    const before = r.draft * r.conv;
    const after = r.final * r.conv;
    misB += Math.abs(before - r.demand);
    misA += Math.abs(after - r.demand);
    den += Math.max(before, after, r.demand);
    mB += Math.min(before, r.demand);
    mA += Math.min(after, r.demand);
    demand += r.demand;
  }
  return {
    rows: out,
    summary: {
      draft, final: total, added, cut, changed,
      mismatchBefore: den ? misB / den : 0, mismatchAfter: den ? misA / den : 0,
      matchedBefore: mB, matchedAfter: mA, demand, scale,
    },
  };
}

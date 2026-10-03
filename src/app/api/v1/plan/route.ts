import type { NextRequest } from "next/server";
import writeExcelFile from "write-excel-file/node";
import { CONF, csv, envelope, fail, nameIndex, ok, preflight } from "@/lib/api";
import { geo, isState, meta, plan } from "@/lib/data";
import { applyBudget, BUDGET_FACTOR, type BudgetMode } from "@/lib/plan";

export const OPTIONS = preflight;

const REASON: Record<string, string> = {
  hold: "Within 15% of need: keep",
  hold_small: "Too small to act on",
  cut_saturated: "Saturated: cut toward need",
  cut_surplus: "Surplus: cut toward need",
  cut_capped: "Cut limited to 30% a cycle",
  raise_acute: "Acute shortage: raise toward need",
  raise_shortage: "Shortage: raise toward need",
  raise_capped: "Rise limited to 40% a cycle",
  new_course: "No course here: start one",
};

/**
 * The target sheet for one state and the next training cycle: seats per
 * district and trade, with the reason for every change. JSON, CSV or Excel.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const state = q.get("state");
  if (!isState(state)) return fail(400, `state is required. Use one of: ${geo().states.map((s) => s.id).join(", ")}.`);
  const mode = (q.get("budget") ?? "neutral") as BudgetMode;
  if (!(mode in BUDGET_FACTOR)) return fail(400, "budget must be one of: neutral, plus5, plus10, free.");

  const m = meta();
  const n = nameIndex();
  const { rows, summary } = applyBudget(plan(state), mode);
  const out = rows
    .filter((r) => q.get("changes") !== "only" || r.final !== r.draft)
    .map((r) => ({
      state, district: r.district, districtName: n.d.get(r.district)!.name,
      trade: r.trade, tradeName: n.t.get(r.trade)!.name, sector: n.t.get(r.trade)!.sector, nco: n.t.get(r.trade)!.nco,
      seatsDraft: r.draft, seatsNeeded: r.need, seatsRecommended: r.final, change: r.final - r.draft,
      demandAtGraduation: r.demand, seatToEntrantYield: r.conv, reasonCode: r.reason, reason: REASON[r.reason],
      confidence: CONF[r.conf], scoreNext: r.score,
    }));
  const name = `kaushal-radar-target-sheet-${state}-FY${m.planFY}`;

  const format = q.get("format");
  if (format === "csv") return csv(out, name);
  if (format === "xlsx") {
    const head = (v: string) => ({ value: v, fontWeight: "bold" as const, backgroundColor: "#EEF0FF" });
    const cols = [
      ["District", 24], ["Trade", 38], ["Sector", 10], ["NCO-2015", 10], ["Draft seats", 12], ["Needed", 10],
      ["Recommended", 14], ["Change", 10], ["Demand at graduation", 20], ["Why", 34], ["Confidence", 12],
    ] as const;
    const sheet = [
      cols.map(([c]) => head(c)),
      ...out.map((r) => [
        r.districtName, r.tradeName, r.sector, r.nco, r.seatsDraft, r.seatsNeeded, r.seatsRecommended, r.change,
        r.demandAtGraduation, r.reason, r.confidence,
      ]),
    ];
    const about = [
      [head("Kaushal Radar target sheet"), null],
      ["State", geo().states.find((s) => s.id === state)!.name],
      ["Training cycle", `FY ${m.planFY}`],
      ["Budget", mode],
      ["Draft seats", summary.draft],
      ["Recommended seats", summary.final],
      ["Seats added", summary.added],
      ["Seats cut", summary.cut],
      ["Mismatch before", `${(summary.mismatchBefore * 100).toFixed(1)}%`],
      ["Mismatch after", `${(summary.mismatchAfter * 100).toFixed(1)}%`],
      ["Data to", m.dataAsOf],
      ["Note", m.demo ? "Demo data: district-level labour-market figures are simulated." : `Computed from supplied input files: ${m.inputs.join(", ")}.`],
    ];
    const buffer = await writeExcelFile([
      { data: sheet, sheet: "Target sheet", columns: cols.map(([, width]) => ({ width })), stickyRowsCount: 1 },
      { data: about, sheet: "About", columns: [{ width: 26 }, { width: 60 }] },
    ]).toBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${name}.xlsx"`,
        "access-control-allow-origin": "*",
      },
    });
  }
  const round = Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
  return ok({ meta: envelope({ state, budget: mode, total: out.length }), summary: round, rows: out });
}

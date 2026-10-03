import type { NextRequest } from "next/server";
import { csv, envelope, fail, intParam, nameIndex, ok, preflight, publicCell } from "@/lib/api";
import {
  cells, districtLayer, geo, isDistrict, isSector, isState, isTrade, sectorRows, stateLayer, taxonomy, tradeRows,
} from "@/lib/data";
import { classOf } from "@/lib/scale";
import type { Balance } from "@/lib/types";

export const OPTIONS = preflight;

const LEVELS = ["cell", "state-trade", "national-trade", "district", "state", "sector"] as const;
type Level = (typeof LEVELS)[number];

const common = (b: Balance) => ({
  demandNow: b.dn, supplyNow: b.sn, scoreNow: b.s0, classNow: classOf(b.s0),
  demandNext: b.dx, demandLow: b.lo, demandHigh: b.hi, supplyNext: b.sx,
  gapNext: b.dx - b.sx, scoreNext: b.s1, classNext: classOf(b.s1),
});

/**
 * Demand, supply and the balance score at any level of the hierarchy.
 * `level=cell` is one row per district x trade; the other levels are aggregates.
 */
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const level = (q.get("level") ?? "cell") as Level;
  if (!LEVELS.includes(level)) return fail(400, `level must be one of: ${LEVELS.join(", ")}.`);
  const state = q.get("state") ?? undefined;
  const district = q.get("district") ?? undefined;
  const sector = q.get("sector") ?? undefined;
  const trade = q.get("trade") ?? undefined;
  if (state && !isState(state)) return fail(400, `Unknown state "${state}".`);
  if (district && !isDistrict(district)) return fail(400, `Unknown district "${district}".`);
  if (sector && !isSector(sector)) return fail(400, `Unknown sector "${sector}".`);
  if (trade && !isTrade(trade)) return fail(400, `Unknown trade "${trade}".`);

  const n = nameIndex();
  const tx = taxonomy();
  let rows: Record<string, unknown>[];

  if (level === "cell") {
    rows = cells({ state, district, sector, trade }).map(publicCell);
  } else if (level === "state-trade" || level === "national-trade") {
    const scopes = level === "national-trade" ? [undefined] : state ? [state] : geo().states.map((s) => s.id);
    rows = scopes.flatMap((st) =>
      tradeRows(st)
        .filter((r) => (!trade || r.trade === trade) && (!sector || n.t.get(r.trade)!.sector === sector))
        .map((r) => ({
          ...(st ? { state: st } : {}),
          trade: r.trade, tradeName: n.t.get(r.trade)!.name, sector: n.t.get(r.trade)!.sector, nco: n.t.get(r.trade)!.nco,
          ...common(r), demandIndex: r.cdi, momentumPct: r.mom, movableSharePct: r.realloc,
        })),
    );
  } else if (level === "district") {
    rows = districtLayer(state, { sector, trade }).map((r) => ({
      district: r.id, districtName: n.d.get(r.id)!.name, state: n.d.get(r.id)!.state, ...common(r),
      ...(r.mi !== undefined ? { mismatchPct: r.mi } : {}),
    }));
  } else if (level === "state") {
    rows = stateLayer({ sector, trade }).filter((r) => !state || r.id === state).map((r) => ({
      state: r.id, stateName: geo().states.find((s) => s.id === r.id)!.name, ...common(r),
      ...(r.mi !== undefined ? { mismatchPct: r.mi } : {}),
    }));
  } else {
    rows = sectorRows({ state, district }).filter((r) => !sector || r.id === sector).map((r) => ({
      sector: r.id, sectorName: tx.sectors.find((s) => s.id === r.id)!.name, ...common(r), mismatchPct: r.mi,
    }));
  }

  const minSize = intParam(q.get("minSize"), 0, 0, 1e9);
  if (minSize > 0) rows = rows.filter((r) => Math.max(r.demandNext as number, r.supplyNext as number) >= minSize);

  // priority = how far off balance, weighted by how many people are involved
  for (const r of rows) {
    r.priority = Math.round((Math.abs(r.scoreNext as number) / 100) * Math.log10(1 + Math.abs(r.gapNext as number)) * 100) / 100;
  }
  const sortKey = { gap: "gapNext", score: "scoreNext", demand: "demandNext", supply: "supplyNext", momentum: "momentumPct", priority: "priority" }[q.get("sort") ?? "gap"];
  if (!sortKey) return fail(400, "sort must be one of: gap, score, demand, supply, momentum, priority.");
  const sign = q.get("order") === "asc" ? 1 : -1;
  rows.sort((a, b) => (((a[sortKey] as number) ?? 0) - ((b[sortKey] as number) ?? 0)) * sign);

  const total = rows.length;
  const offset = intParam(q.get("offset"), 0, 0, 1e9);
  const limit = intParam(q.get("limit"), 100, 1, 20000);
  rows = rows.slice(offset, offset + limit);

  if (q.get("format") === "csv") return csv(rows, `kaushal-radar-gaps-${level}`);
  return ok({ meta: envelope({ level, total, returned: rows.length, offset }), rows });
}

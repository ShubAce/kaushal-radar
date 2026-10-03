import type { NextRequest } from "next/server";
import { csv, envelope, fail, ok, preflight } from "@/lib/api";
import { isDistrict, isSector, isState, isTrade, meta, series } from "@/lib/data";

export const OPTIONS = preflight;

/**
 * Rolling 12-month demand and supply, month by month: 36 months of history and
 * 18 months of forecast with an 80% range. Scope is the nation, a state or a
 * district; the series is all trades, a sector or a single trade.
 */
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const state = q.get("state") ?? undefined;
  const district = q.get("district") ?? undefined;
  const sector = q.get("sector") ?? undefined;
  const trade = q.get("trade") ?? undefined;
  if (state && !isState(state)) return fail(400, `Unknown state "${state}".`);
  if (district && !isDistrict(district)) return fail(400, `Unknown district "${district}".`);
  if (sector && !isSector(sector)) return fail(400, `Unknown sector "${sector}".`);
  if (trade && !isTrade(trade)) return fail(400, `Unknown trade "${trade}".`);

  const m = meta();
  const file = series({ state, district });
  const s = trade ? file.trades[trade] : sector ? file.sectors[sector] : file.all;
  if (!s) return fail(404, "This trade has no measurable demand or supply in the selected district.");

  const points = m.months.map((month, i) => {
    const fc = i >= m.histLen;
    return {
      month, kind: fc ? "forecast" : "history", demand: s.d[i], supply: s.s[i],
      demandLow: fc ? s.lo[i - m.histLen] : null, demandHigh: fc ? s.hi[i - m.histLen] : null,
    };
  });
  if (q.get("format") === "csv") return csv(points, "kaushal-radar-forecast");
  return ok({
    meta: envelope({
      scope: district ? { district } : state ? { state } : { national: true },
      series: trade ? { trade } : sector ? { sector } : { allTrades: true },
      unit: "people per year (trailing 12-month total)", historyMonths: m.histLen, forecastMonths: m.fcLen,
      planningYear: m.planMonths, range: "80% interval from back-test errors",
    }),
    points,
    detail: district && trade ? file.detail?.[trade] ?? null : undefined,
  });
}

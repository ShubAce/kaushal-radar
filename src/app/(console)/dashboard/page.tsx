import type { Metadata } from "next";
import { DashboardView } from "./view";
import {
  cells, districtLayer, flags, geo, isSector, isState, isTrade, mapIndia, mapState, meta, overall, sectorRows,
  series, stateLayer, taxonomy, tradeRows, type LayerRow,
} from "@/lib/data";
import type { Balance } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]));

export default async function Page(props: PageProps<"/dashboard">) {
  const sp = await props.searchParams;
  const state = isState(one(sp.state)) ? one(sp.state) : undefined;
  const trade = isTrade(one(sp.trade)) ? one(sp.trade) : undefined;
  const sector = !trade && isSector(one(sp.sector)) ? one(sp.sector) : undefined;
  const by = { sector, trade };
  const g = geo();

  const trades = tradeRows(state);
  const sectors = sectorRows({ state });
  const scope: Balance & { mi?: number } = trade
    ? trades.find((r) => r.trade === trade)!
    : sector ? sectors.find((r) => r.id === sector)! : overall({ state });

  const file = series({ state });
  const line = trade ? file.trades[trade] : sector ? file.sectors[sector] : file.all;

  const scopeCells = cells({ state, sector, trade });
  const counts = { acute: 0, shortage: 0, balanced: 0, surplus: 0, saturated: 0 };
  for (const c of scopeCells) {
    if (c.s1 >= 60) counts.acute++;
    else if (c.s1 >= 25) counts.shortage++;
    else if (c.s1 > -25) counts.balanced++;
    else if (c.s1 > -60) counts.surplus++;
    else counts.saturated++;
  }
  const byGap = [...scopeCells].sort((a, b) => (b.dx - b.sx) - (a.dx - a.sx));
  const allFlags = flags({ state, sector, trade });

  // Entrants trained in the wrong district of the right state, within the current filters.
  const wanted = new Set(
    taxonomy().trades.filter((x) => (trade ? x.id === trade : sector ? x.sector === sector : true)).map((x) => x.id),
  );
  const movable = (state ? [state] : g.states.map((s) => s.id))
    .flatMap((s) => tradeRows(s))
    .filter((r) => wanted.has(r.trade))
    .reduce((sum, r) => sum + (r.realloc * r.sx) / 100, 0);

  return (
    <DashboardView
      meta={meta()}
      india={mapIndia()}
      stateMaps={Object.fromEntries(g.states.map((s) => [s.id, mapState(s.id)]))}
      districts={byId<LayerRow>(districtLayer(undefined, by))}
      stateRows={byId<LayerRow>(stateLayer(by))}
      sel={{ state, sector, trade }}
      scope={scope}
      line={line}
      trades={trades}
      matrix={[{ id: "ALL", rows: sectorRows() }, ...g.states.map((s) => ({ id: s.id, rows: sectorRows({ state: s.id }) }))]}
      flags={allFlags.slice(0, 5)}
      flagCounts={{
        critical: allFlags.filter((f) => f.severity === "critical").length,
        warning: allFlags.filter((f) => f.severity === "warning").length,
        watch: allFlags.filter((f) => f.severity === "watch").length,
      }}
      topShort={byGap.slice(0, 6)}
      topSurplus={byGap.slice(-6).reverse()}
      counts={counts}
      movable={Math.round(movable)}
      blips={allFlags.filter((f) => f.severity === "critical" && f.level === "district").map((f) => f.geo)}
      districtRows={state ? districtLayer(state, by) : []}
    />
  );
}

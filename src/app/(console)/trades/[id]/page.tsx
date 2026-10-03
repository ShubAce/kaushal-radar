import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TradeView } from "./view";
import {
  cells, districtLayer, flags, geo, isState, isTrade, mapIndia, mapState, meta, method, series, stateLayer, taxonomy,
  tradeRows, type LayerRow,
} from "@/lib/data";

export async function generateMetadata(props: PageProps<"/trades/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: taxonomy().trades.find((t) => t.id === id)?.name ?? "Trade" };
}

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]));

export default async function Page(props: PageProps<"/trades/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!isTrade(id)) notFound();
  const raw = Array.isArray(sp.state) ? sp.state[0] : sp.state;
  const state = isState(raw) ? raw : undefined;
  const g = geo();
  const byGap = cells({ state, trade: id }).sort((a, b) => (b.dx - b.sx) - (a.dx - a.sx));

  return (
    <TradeView
      id={id}
      state={state}
      meta={meta()}
      row={tradeRows(state).find((r) => r.trade === id)!}
      stateRows={byId<LayerRow>(stateLayer({ trade: id }))}
      stateTrade={Object.fromEntries(g.states.map((s) => [s.id, tradeRows(s.id).find((r) => r.trade === id)!]))}
      line={series({ state }).trades[id]}
      india={mapIndia()}
      stateMaps={Object.fromEntries(g.states.map((s) => [s.id, mapState(s.id)]))}
      districts={byId<LayerRow>(districtLayer(undefined, { trade: id }))}
      topShort={byGap.filter((c) => c.dx > c.sx).slice(0, 6)}
      topSurplus={byGap.filter((c) => c.sx > c.dx).slice(-6).reverse()}
      flags={flags({ trade: id, state }).slice(0, 6)}
      coverage={method().sources.map((s) => ({ id: s.id, share: s.coverageByTrade[id] ?? 0 }))}
    />
  );
}

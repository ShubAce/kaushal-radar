import { HomeView } from "./home-view";
import { districtLayer, flags, geo, mapIndia, mapState, meta, method, taxonomy } from "@/lib/data";

export default function Home() {
  const g = geo();
  const tx = taxonomy();
  const m = method();
  const bt = m.backtest;
  const districts = new Map(g.districts.map((d) => [d.id, d]));
  const critical = flags({ severity: "critical", level: "district" });
  const cut = (model: number, naive: number) => Math.round((1 - model / naive) * 100);

  return (
    <HomeView
      meta={meta()}
      india={mapIndia()}
      stateMaps={g.states.map((s) => mapState(s.id))}
      scores={Object.fromEntries(districtLayer(undefined).map((r) => [r.id, r.s1]))}
      blips={critical.map((f) => f.geo)}
      alerts={critical.slice(0, 3).map((f) => ({
        id: f.id, trade: tx.trades.find((t) => t.id === f.trade)!.name, tradeHi: tx.trades.find((t) => t.id === f.trade)!.hi,
        place: districts.get(f.geo)!.name, type: f.type, month: f.month, district: f.geo,
      }))}
      proof={{
        index: m.recovery && { err: Math.round(m.recovery.index.wape * 100), portalErr: Math.round(m.recovery.portalOnly.wape * 100) },
        national: cut(bt.model.national["18"], bt.naive.national["18"]),
        fast: cut(bt.byGroup.fast["12"].model, bt.byGroup.fast["12"].naive),
      }}
    />
  );
}

import type { Metadata } from "next";
import { TradesView } from "./view";
import { meta, series, tradeRows } from "@/lib/data";

export const metadata: Metadata = { title: "Trades" };

export default function Page() {
  const s = series();
  return (
    <TradesView
      meta={meta()}
      rows={tradeRows()}
      sparks={Object.fromEntries(Object.entries(s.trades).map(([id, v]) => [id, v.d]))}
    />
  );
}

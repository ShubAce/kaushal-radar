"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { BalanceMeter } from "@/components/charts/bits";
import { Quadrant, type QPoint } from "@/components/charts/quadrant";
import { PageHeader } from "@/components/shell/console-shell";
import { Confidence } from "@/components/ui/badges";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented, Select, Switch } from "@/components/ui/controls";
import { SortTable, type Col } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { int, signed, signedPct } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import { useApi } from "@/lib/use-api";

type Level = "cell" | "state-trade" | "district" | "national-trade";
type Order = "short" | "surplus" | "severe";

interface Row {
  district?: string; districtName?: string; state?: string; trade?: string; tradeName?: string; sector?: string;
  demandNext: number; supplyNext: number; gapNext: number; scoreNow: number; scoreNext: number;
  confidence?: "low" | "medium" | "high"; momentumPct?: number; mismatchPct?: number; movableSharePct?: number;
  demandIndex?: number; priority: number;
}
interface Res { meta: { total: number; returned: number }; rows: Row[] }

const CONF = { low: 0, medium: 1, high: 2 } as const;

export function RankingsView() {
  const { t } = useT();
  const ref = useRefData();
  const router = useRouter();
  const fy = ref.meta.planFY;
  const [level, setLevel] = useState<Level>("cell");
  const [order, setOrder] = useState<Order>("short");
  const [state, setState] = useState("");
  const [sector, setSector] = useState("");
  const [hideSmall, setHideSmall] = useState(true);

  const query = useMemo(() => {
    const q = new URLSearchParams({ level, limit: "300" });
    if (state && level !== "national-trade") q.set("state", state);
    if (sector) q.set("sector", sector);
    if (order === "severe") q.set("sort", "priority");
    else {
      q.set("sort", "gap");
      q.set("order", order === "short" ? "desc" : "asc");
    }
    if (hideSmall && level === "cell") q.set("minSize", "100");
    return q.toString();
  }, [level, order, state, sector, hideSmall]);

  const { data, loading, error } = useApi<Res>(`/api/v1/gaps?${query}`);
  const rows = data?.rows ?? [];

  const keyOf = (r: Row) => `${r.district ?? r.state ?? ""}|${r.trade ?? ""}`;
  const hrefOf = (r: Row) =>
    r.district ? `/district/${r.district}${r.trade ? `?trade=${r.trade}` : ""}` : r.trade ? `/trades/${r.trade}${r.state ? `?state=${r.state}` : ""}` : undefined;
  const nameOf = (r: Row) =>
    [r.district ? ref.districtName(r.district) : r.state && level !== "national-trade" ? ref.stateName(r.state) : "", r.trade ? ref.tradeName(r.trade) : ""].filter(Boolean).join(" · ");

  const cols: Col<Row>[] = [
    ...(level === "cell" || level === "district" ? [{
      key: "place", header: t("common.district"), sort: (r: Row) => r.districtName ?? "",
      cell: (r: Row) => (
        <div>
          <div className="font-medium">{ref.districtName(r.district!)}</div>
          <div className="text-xs text-muted">{ref.stateName(r.state!)}</div>
        </div>
      ),
    }] : []),
    ...(level === "state-trade" ? [{ key: "state", header: t("common.state"), sort: (r: Row) => r.state ?? "", cell: (r: Row) => <span className="font-medium">{ref.stateName(r.state!)}</span> }] : []),
    ...(level !== "district" ? [{
      key: "trade", header: t("common.trade"), sort: (r: Row) => r.tradeName ?? "",
      cell: (r: Row) => (
        <div className="min-w-[11rem]">
          <div className="font-medium">{ref.tradeName(r.trade!)}</div>
          <div className="text-xs text-muted">{ref.sectorName(r.sector!)}</div>
        </div>
      ),
    }] : []),
    { key: "bal", header: t("dash.colBalance", { fy }), sort: (r) => r.scoreNext, cell: (r) => <BalanceMeter now={r.scoreNow} next={r.scoreNext} width={104} /> },
    { key: "d", header: t("dash.colDemand"), align: "right", sort: (r) => r.demandNext, cell: (r) => int(r.demandNext) },
    { key: "s", header: t("dash.colSupply"), align: "right", sort: (r) => r.supplyNext, cell: (r) => int(r.supplyNext) },
    { key: "gap", header: t("dash.colGap"), align: "right", sort: (r) => r.gapNext, cell: (r) => <span className="font-semibold">{signed(r.gapNext)}</span> },
    ...(level === "cell" ? [{ key: "conf", header: t("common.confidence"), sort: (r: Row) => CONF[r.confidence ?? "low"], cell: (r: Row) => <Confidence level={CONF[r.confidence ?? "low"]} /> }] : []),
    ...(level === "district" ? [{ key: "mi", header: t("dash.colMismatch"), title: t("dash.mapMismatchHelp"), align: "right" as const, sort: (r: Row) => r.mismatchPct ?? 0, cell: (r: Row) => `${r.mismatchPct ?? 0}%` }] : []),
    ...(level === "state-trade" || level === "national-trade" ? [
      { key: "mom", header: t("dash.colMomentum"), align: "right" as const, sort: (r: Row) => r.momentumPct ?? 0, cell: (r: Row) => signedPct(r.momentumPct ?? 0) },
      { key: "mv", header: t("dash.colRealloc"), title: t("dash.kpiMovableHint"), align: "right" as const, sort: (r: Row) => r.movableSharePct ?? 0, cell: (r: Row) => `${r.movableSharePct ?? 0}%` },
    ] : []),
  ];

  const useMismatch = level === "district";
  const points: QPoint[] = rows.slice(0, 180).map((r) => {
    const y = useMismatch ? r.mismatchPct ?? 0 : Math.max(-60, Math.min(120, r.momentumPct ?? 0));
    return {
      id: keyOf(r), x: r.scoreNext, y, size: Math.abs(r.gapNext), label: nameOf(r),
      sub: r.district && r.state ? ref.stateName(r.state) : undefined,
      yText: useMismatch ? `${r.mismatchPct ?? 0}%` : signedPct(r.momentumPct ?? 0), href: hrefOf(r),
    };
  });

  return (
    <div>
      <PageHeader
        title={t("rank.title")}
        subtitle={t("rank.subtitle", { fy })}
        actions={
          <a
            href={`/api/v1/gaps?${query.replace("limit=300", "limit=20000")}&format=csv`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2"
          >
            <Download className="h-4 w-4" />{t("common.downloadCsv")}
          </a>
        }
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label={t("rank.level")} value={level} onChange={setLevel}
          options={[
            { value: "cell", label: t("rank.lvCell") }, { value: "state-trade", label: t("rank.lvStateTrade") },
            { value: "district", label: t("rank.lvDistrict") }, { value: "national-trade", label: t("rank.lvTrade") },
          ]}
        />
        <Select label={t("common.state")} value={state} onChange={(e) => setState(e.target.value)} disabled={level === "national-trade"}>
          <option value="">{t("common.allStates")}</option>
          {ref.states.map((x) => <option key={x.id} value={x.id}>{ref.stateName(x.id)}</option>)}
        </Select>
        <Select label={t("common.sector")} value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">{t("common.allSectors")}</option>
          {ref.sectors.map((x) => <option key={x.id} value={x.id}>{ref.sectorName(x.id)}</option>)}
        </Select>
        <Select label={t("rank.order")} value={order} onChange={(e) => setOrder(e.target.value as Order)}>
          <option value="short">{t("rank.ordShort")}</option>
          <option value="surplus">{t("rank.ordSurplus")}</option>
          <option value="severe">{t("rank.ordScore")}</option>
        </Select>
        {level === "cell" && (
          <div className="w-44"><Switch label={t("rank.minSize")} checked={hideSmall} onChange={setHideSmall} /></div>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-critical-soft px-3 py-2 text-[13px] text-critical-ink">{error}</p>}

      <div className={cn("space-y-4 transition-opacity duration-200", loading && "opacity-60")} aria-busy={loading}>
        <Card>
          <CardHeader title={t("rank.quadTitle")} subtitle={t("rank.quadSub")} />
          <div className="px-3 pb-3 pt-3">
            {data ? (
              <Quadrant
                key={query}
                points={points} xLabel={t("rank.quadX")} yLabel={useMismatch ? t("dash.colMismatch") : t("rank.quadY")}
                yFormat={(v) => `${v}%`} label={t("rank.quadTitle")} height={340}
                onSelect={(pt) => pt.href && router.push(pt.href)}
              />
            ) : <div className="skeleton h-[340px]" />}
          </div>
        </Card>
        <Card>
          <CardHeader
            title={t("rank.title")}
            subtitle={data ? t("rank.showing", { n: int(rows.length), total: int(data.meta.total) }) : t("common.loading")}
          />
          <div className="px-2 pb-3 pt-2">
            {data ? (
              <SortTable key={`${level}-${order}`} rows={rows} cols={cols} rowKey={keyOf} rowHref={hrefOf} pageSize={15} dense />
            ) : (
              <div className="space-y-2 p-3">{Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton h-9" />)}</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

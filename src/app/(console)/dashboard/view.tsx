"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, GraduationCap, Scale, Shuffle, TrendingUp, TriangleAlert } from "lucide-react";
import { ChartCard, LegendItem } from "@/components/charts/base";
import { BalanceMeter, BarRows, Matrix, ScaleLegend, StatTile } from "@/components/charts/bits";
import { TrendChart, trendTable } from "@/components/charts/trend-chart";
import { FlagItem } from "@/components/flag-item";
import { IndiaMap } from "@/components/map/india-map";
import { PageHeader } from "@/components/shell/console-shell";
import { Badge } from "@/components/ui/badges";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented, Select } from "@/components/ui/controls";
import { Reveal } from "@/components/ui/motion";
import { SortTable, type Col } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { LayerRow } from "@/lib/data";
import { compact, int, signed, signedPct } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import { classFill } from "@/lib/scale";
import type { Balance, CellRow, Flag, GroupRow, MapIndia, MapState, Meta, Series, TradeRow } from "@/lib/types";

interface Sel { state?: string; sector?: string; trade?: string }
interface Props {
  meta: Meta;
  india: MapIndia;
  stateMaps: Record<string, MapState>;
  districts: Record<string, LayerRow>;
  stateRows: Record<string, LayerRow>;
  sel: Sel;
  scope: Balance & { mi?: number };
  line: Series;
  trades: TradeRow[];
  matrix: { id: string; rows: GroupRow[] }[];
  flags: Flag[];
  flagCounts: { critical: number; warning: number; watch: number };
  topShort: CellRow[];
  topSurplus: CellRow[];
  counts: { acute: number; shortage: number; balanced: number; surplus: number; saturated: number };
  movable: number;
  blips: string[];
  districtRows: LayerRow[];
}

export function DashboardView(p: Props) {
  const { t } = useT();
  const ref = useRefData();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [view, setView] = useState<"now" | "next">("next");
  const [gapTab, setGapTab] = useState<"short" | "surplus">("short");
  const { sel, meta } = p;
  const fy = meta.planFY;
  const next = view === "next";

  function go(patch: Sel) {
    const s = { ...sel, ...patch };
    if (patch.trade) s.sector = undefined;                         // a trade implies its sector
    if ("sector" in patch && !("trade" in patch)) s.trade = undefined;
    const q = new URLSearchParams();
    if (s.state) q.set("state", s.state);
    if (s.sector) q.set("sector", s.sector);
    if (s.trade) q.set("trade", s.trade);
    const qs = q.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const d = next ? p.scope.dx : p.scope.dn;
  const s = next ? p.scope.sx : p.scope.sn;
  const gap = d - s;
  const layerName = sel.trade ? ref.tradeName(sel.trade) : sel.sector ? ref.sectorName(sel.sector) : t("common.allTrades");
  const place = sel.state ? ref.stateName(sel.state) : t("common.allStates");
  const nDistricts = sel.state ? ref.state(sel.state)!.districts : meta.counts.districts;

  const tradeRows = useMemo(
    () => p.trades.filter((r) => (sel.trade ? r.trade === sel.trade : sel.sector ? ref.trade(r.trade)?.sector === sel.sector : true)),
    [p.trades, sel.trade, sel.sector, ref],
  );

  const tradeCols: Col<TradeRow>[] = [
    {
      key: "trade", header: t("common.trade"), sort: (r) => ref.tradeName(r.trade),
      cell: (r) => {
        const tr = ref.trade(r.trade)!;
        return (
          <div className="min-w-[12rem]">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              {ref.tradeName(r.trade)}
              {tr.emerging && <Badge tone="brand">{t("common.emerging")}</Badge>}
            </div>
            <div className="mt-0.5 whitespace-nowrap text-xs text-muted">
              {ref.sectorName(tr.sector)} · <span className="font-mono text-[11px]">NCO {tr.nco}</span>
            </div>
          </div>
        );
      },
    },
    { key: "bal", header: t("dash.colBalance", { fy }), sort: (r) => (next ? r.s1 : r.s0), cell: (r) => <BalanceMeter now={r.s0} next={r.s1} width={104} /> },
    { key: "d", header: t("dash.colDemand"), align: "right", sort: (r) => (next ? r.dx : r.dn), cell: (r) => int(next ? r.dx : r.dn) },
    { key: "s", header: t("dash.colSupply"), align: "right", sort: (r) => (next ? r.sx : r.sn), cell: (r) => int(next ? r.sx : r.sn) },
    {
      key: "gap", header: t("dash.colGap"), align: "right", sort: (r) => (next ? r.dx - r.sx : r.dn - r.sn),
      cell: (r) => <span className="font-semibold">{signed(next ? r.dx - r.sx : r.dn - r.sn)}</span>,
    },
    { key: "cdi", header: t("dash.colCdi"), title: t("dash.cdiHelp"), align: "right", sort: (r) => r.cdi, cell: (r) => r.cdi },
    { key: "mom", header: t("dash.colMomentum"), align: "right", sort: (r) => r.mom, cell: (r) => signedPct(r.mom) },
    { key: "re", header: t("dash.colRealloc"), title: t("dash.kpiMovableHint"), align: "right", sort: (r) => r.realloc, cell: (r) => `${r.realloc}%` },
  ];

  const districtCols: Col<LayerRow>[] = [
    { key: "name", header: t("common.district"), sort: (r) => ref.districtName(r.id), cell: (r) => <span className="font-medium">{ref.districtName(r.id)}</span> },
    { key: "bal", header: t("dash.colBalance", { fy }), sort: (r) => (next ? r.s1 : r.s0), cell: (r) => <BalanceMeter now={r.s0} next={r.s1} /> },
    { key: "d", header: t("dash.colDemand"), align: "right", sort: (r) => (next ? r.dx : r.dn), cell: (r) => int(next ? r.dx : r.dn) },
    { key: "s", header: t("dash.colSupply"), align: "right", sort: (r) => (next ? r.sx : r.sn), cell: (r) => int(next ? r.sx : r.sn) },
    {
      key: "gap", header: t("dash.colGap"), align: "right", sort: (r) => (next ? r.dx - r.sx : r.dn - r.sn),
      cell: (r) => <span className="font-semibold">{signed(next ? r.dx - r.sx : r.dn - r.sn)}</span>,
    },
    ...(sel.trade ? [] : [{ key: "mi", header: t("dash.colMismatch"), title: t("dash.mapMismatchHelp"), align: "right" as const, sort: (r: LayerRow) => r.mi ?? 0, cell: (r: LayerRow) => `${r.mi ?? 0}%` }]),
  ];

  const gapRows = (gapTab === "short" ? p.topShort : p.topSurplus).filter((c) => (gapTab === "short" ? c.dx > c.sx : c.sx > c.dx));

  return (
    <div>
      <PageHeader
        crumbs={sel.state ? [{ label: t("common.india"), href: "/dashboard" }, { label: ref.stateName(sel.state) }] : undefined}
        title={sel.state ? ref.stateName(sel.state) : t("dash.titleNational")}
        subtitle={t("dash.subtitle", { n: nDistricts, fy })}
        actions={
          <>
            <Select label={t("common.state")} value={sel.state ?? ""} onChange={(e) => go({ state: e.target.value || undefined })} className="max-sm:w-full">
              <option value="">{t("common.allStates")}</option>
              {ref.states.map((x) => <option key={x.id} value={x.id}>{ref.stateName(x.id)}</option>)}
            </Select>
            <Select label={t("common.sector")} value={sel.sector ?? (sel.trade ? ref.trade(sel.trade)!.sector : "")} onChange={(e) => go({ sector: e.target.value || undefined, trade: undefined })} className="max-sm:w-full">
              <option value="">{t("common.allSectors")}</option>
              {ref.sectors.map((x) => <option key={x.id} value={x.id}>{ref.sectorName(x.id)}</option>)}
            </Select>
            <Select label={t("common.trade")} value={sel.trade ?? ""} onChange={(e) => go({ trade: e.target.value || undefined })} className="max-sm:w-full sm:max-w-[15rem]">
              <option value="">{t("common.allTrades")}</option>
              {ref.sectors.map((sec) => (
                <optgroup key={sec.id} label={ref.sectorName(sec.id)}>
                  {ref.trades.filter((x) => x.sector === sec.id).map((x) => <option key={x.id} value={x.id}>{ref.tradeName(x.id)}</option>)}
                </optgroup>
              ))}
            </Select>
            <Segmented
              label={t("common.forecast")}
              value={view}
              onChange={setView}
              options={[{ value: "now", label: t("dash.viewNow") }, { value: "next", label: t("dash.viewNext", { fy }) }]}
            />
          </>
        }
      />

      <div className={cn("space-y-4 transition-opacity duration-200", pending && "opacity-60")} aria-busy={pending}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile
            tone="demand" Icon={TrendingUp} label={t("dash.kpiDemand")} value={d} format={compact}
            spark={{ values: p.line.d, histLen: meta.histLen }}
            hint={next ? `${compact(p.scope.lo)} – ${compact(p.scope.hi)} · ${t("common.range")}` : t("dash.kpiDemandHint")}
          />
          <StatTile tone="supply" Icon={GraduationCap} label={t("dash.kpiSupply")} value={s} format={compact} hint={t("dash.kpiSupplyHint")} />
          <StatTile
            Icon={Scale} label={gap >= 0 ? t("dash.kpiGapShort") : t("dash.kpiGapSurplus")} value={Math.abs(gap)} format={compact}
            hint={<BalanceMeter now={p.scope.s0} next={p.scope.s1} width={104} wrap />}
          />
          <StatTile
            Icon={TriangleAlert} label={t("dash.kpiCells")} value={p.counts.acute + p.counts.saturated} format={int}
            hint={t("dash.kpiCellsHint", { a: int(p.counts.acute), b: int(p.counts.saturated), n: int(p.counts.acute + p.counts.shortage + p.counts.balanced + p.counts.surplus + p.counts.saturated) })}
          />
          <StatTile className="col-span-2 lg:col-span-1" Icon={Shuffle} label={t("dash.kpiMovable")} value={p.movable} format={compact} hint={t("dash.kpiMovableHint")} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="flex flex-col xl:col-span-7">
            <CardHeader title={t("dash.mapTitle")} subtitle={`${t("dash.mapSub")} · ${layerName} · ${next ? t("common.fy", { fy }) : t("dash.viewNow")}`} />
            <div className="min-h-[460px] flex-1 px-3 pt-2">
              <IndiaMap
                india={p.india} states={p.stateMaps} districts={p.districts} stateRows={p.stateRows} view={view}
                focus={sel.state ?? null} onFocus={(st) => go({ state: st ?? undefined })}
                districtHref={(id) => `/district/${id}${sel.trade ? `?trade=${sel.trade}` : ""}`}
                blips={p.blips} names={ref.geoName}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 pb-4 pt-2">
              <ScaleLegend />
              <p className="text-xs text-muted">{sel.state ? t("dash.mapHintState") : t("dash.mapHintIndia")}</p>
            </div>
          </Card>

          <div className="flex flex-col gap-4 xl:col-span-5">
            <Card>
              <CardHeader
                title={t("dash.warnTitle")}
                subtitle={t("warn.counts", { c: p.flagCounts.critical, w: p.flagCounts.warning, t: p.flagCounts.watch })}
                actions={
                  <Link href={`/warnings${sel.state ? `?state=${sel.state}` : ""}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                    {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="px-5 pb-3 pt-1.5">
                {p.flags.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-muted">{t("common.empty")}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {p.flags.map((f) => <li key={f.id}><FlagItem flag={f} /></li>)}
                  </ul>
                )}
              </div>
            </Card>

            <Card className="flex-1">
              <CardHeader
                title={t("dash.topTitle")}
                subtitle={`${place} · ${t("common.fy", { fy })}`}
                actions={
                  <Segmented
                    size="sm" label={t("dash.topTitle")} value={gapTab} onChange={setGapTab}
                    options={[{ value: "short", label: t("dash.topShort") }, { value: "surplus", label: t("dash.topSurplus") }]}
                  />
                }
              />
              <div className="px-5 pb-3 pt-2">
                {gapRows.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-muted">{t("common.empty")}</p>
                ) : (
                  <BarRows
                    key={gapTab}
                    rows={gapRows.map((c) => ({
                      key: `${c.district}|${c.trade}`,
                      label: `${ref.districtName(c.district)} · ${ref.tradeName(c.trade)}`,
                      sub: `${t("common.demand")} ${int(c.dx)} · ${t("common.supply")} ${int(c.sx)}`,
                      value: c.dx - c.sx,
                      display: signed(c.dx - c.sx),
                      href: `/district/${c.district}?trade=${c.trade}`,
                      color: classFill(gapTab === "short" ? "acute_shortage" : "saturated"),
                    }))}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Reveal className="xl:col-span-7">
            <ChartCard
              className="h-full"
              title={`${t("dash.trendTitle")} · ${layerName}`}
              subtitle={`${place}. ${t("dash.trendSub")}`}
              legend={
                <>
                  <LegendItem color="var(--demand)" label={`${t("common.demand")} (${t("common.openings")})`} />
                  <LegendItem color="var(--supply)" label={`${t("common.supply")} (${t("common.entrants")})`} />
                  <LegendItem color="var(--ink-2)" kind="dash" label={t("common.forecast")} />
                  <LegendItem color="var(--demand)" kind="band" label={t("common.range")} />
                </>
              }
              table={trendTable(meta.months, meta.histLen, p.line, t, "demand-supply")}
            >
              <TrendChart
                key={`${sel.state}|${sel.sector}|${sel.trade}`}
                months={meta.months} histLen={meta.histLen} series={p.line} planMonths={meta.planMonths}
                label={`${t("dash.trendTitle")}: ${layerName}, ${place}`}
              />
            </ChartCard>
          </Reveal>

          <Reveal className="xl:col-span-5" delay={0.05}>
            <Card className="h-full">
              <CardHeader title={t("dash.matrixTitle")} subtitle={t("dash.matrixSub", { fy })} />
              <div className="px-5 pb-4 pt-3">
                <Matrix
                  corner={t("common.sector")}
                  rows={ref.sectors.map((x) => ({ id: x.id, label: ref.sectorName(x.id) }))}
                  cols={p.matrix.map((m) => ({ id: m.id, label: m.id === "ALL" ? t("common.india") : m.id }))}
                  cell={(r, c) => {
                    const row = p.matrix.find((m) => m.id === c)!.rows.find((x) => x.id === r)!;
                    const st = c === "ALL" ? undefined : c;
                    return {
                      score: next ? row.s1 : row.s0,
                      title: `${ref.sectorName(r)} · ${st ? ref.stateName(st) : t("common.india")}: ${t("common.demand")} ${int(next ? row.dx : row.dn)}, ${t("common.supply")} ${int(next ? row.sx : row.sn)}`,
                      active: sel.sector === r && sel.state === st,
                      onSelect: () => go({ state: st, sector: r, trade: undefined }),
                    };
                  }}
                />
              </div>
            </Card>
          </Reveal>
        </div>

        {sel.state && (
          <Reveal>
            <Card>
              <CardHeader title={t("dash.districtsTitle")} subtitle={`${t("dash.districtsSub")} · ${layerName}`} />
              <div className="px-2 pb-3 pt-2">
                <SortTable
                  rows={p.districtRows.filter((r) => r.act !== 0)}
                  cols={districtCols}
                  rowKey={(r) => r.id}
                  rowHref={(r) => `/district/${r.id}${sel.trade ? `?trade=${sel.trade}` : ""}`}
                  initial={{ key: "gap", dir: "desc" }}
                  pageSize={10}
                />
              </div>
            </Card>
          </Reveal>
        )}

        <Reveal>
          <Card>
            <CardHeader title={t("dash.tradesTitle")} subtitle={`${t("dash.tradesSub", { fy })} · ${place}`} />
            <div className="px-2 pb-3 pt-2">
              <SortTable
                rows={tradeRows}
                cols={tradeCols}
                rowKey={(r) => r.trade}
                rowHref={(r) => `/trades/${r.trade}${sel.state ? `?state=${sel.state}` : ""}`}
                initial={{ key: "gap", dir: "desc" }}
                pageSize={10}
              />
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

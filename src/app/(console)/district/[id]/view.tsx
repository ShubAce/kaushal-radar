"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Briefcase, Building2, CalendarClock, GraduationCap, Printer, Scale, TrendingUp, Users } from "lucide-react";
import { ChartCard, LegendItem } from "@/components/charts/base";
import { BalanceMeter, BarRows, StatTile } from "@/components/charts/bits";
import { TrendChart, trendTable } from "@/components/charts/trend-chart";
import { FlagItem } from "@/components/flag-item";
import { StateMini } from "@/components/map/state-mini";
import { PageHeader } from "@/components/shell/console-shell";
import { Badge, Confidence } from "@/components/ui/badges";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, Select } from "@/components/ui/controls";
import { Reveal } from "@/components/ui/motion";
import { SortTable, type Col } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { LayerRow } from "@/lib/data";
import { compact, int, month, signed } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import type { CellRow, DistrictInfo, Flag, GroupRow, MapState, Meta, Project, SeriesFile } from "@/lib/types";

interface Props {
  meta: Meta; info: DistrictInfo; overall: GroupRow; sectors: GroupRow[]; cells: CellRow[]; series: SeriesFile;
  flags: Flag[]; projects: Project[]; map: MapState; layer: Record<string, LayerRow>; initialTrade: string | null;
}

const SOURCES = ["portal", "ncs", "payroll", "naps"] as const;
const QUIET = "color-mix(in oklab, var(--ink-2) 42%, var(--surface))";

export function DistrictView(p: Props) {
  const { t, locale } = useT();
  const ref = useRefData();
  const [trade, setTrade] = useState<string | null>(p.initialTrade);
  const { meta, info } = p;
  const fy = meta.planFY;
  const o = p.overall;
  const gap = o.dx - o.sx;
  const short = p.cells.filter((c) => c.s1 >= 25).length;
  const over = p.cells.filter((c) => c.s1 <= -25).length;
  const seats = p.cells.reduce((s, c) => s + c.seats, 0);

  const line = trade ? p.series.trades[trade] : p.series.all;
  const sel = trade ? p.cells.find((c) => c.trade === trade) : undefined;
  const detail = trade ? p.series.detail?.[trade] : undefined;
  const name = trade ? ref.tradeName(trade) : t("common.allTrades");

  const cols: Col<CellRow>[] = useMemo(() => [
    {
      key: "trade", header: t("common.trade"), sort: (r) => ref.tradeName(r.trade),
      cell: (r) => (
        <div className="min-w-[12rem]">
          <div className={cn("flex items-center gap-1.5 font-medium", r.trade === trade ? "text-brand" : "text-ink")}>
            {ref.tradeName(r.trade)}
            {ref.trade(r.trade)?.emerging && <Badge tone="brand">{t("common.emerging")}</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-muted">{ref.sectorName(ref.trade(r.trade)!.sector)}</div>
        </div>
      ),
    },
    { key: "bal", header: t("dash.colBalance", { fy }), sort: (r) => r.s1, cell: (r) => <BalanceMeter now={r.s0} next={r.s1} width={104} /> },
    {
      key: "d", header: t("dash.colDemand"), align: "right", sort: (r) => r.dx,
      cell: (r) => <span title={`${int(r.lo)} – ${int(r.hi)} · ${t("common.range")}`}>{int(r.dx)}</span>,
    },
    { key: "s", header: t("dash.colSupply"), align: "right", sort: (r) => r.sx, cell: (r) => int(r.sx) },
    { key: "gap", header: t("dash.colGap"), align: "right", sort: (r) => r.dx - r.sx, cell: (r) => <span className="font-semibold">{signed(r.dx - r.sx)}</span> },
    { key: "seats", header: t("district.kpiSeats"), align: "right", sort: (r) => r.seats, cell: (r) => int(r.seats) },
    { key: "plc", header: t("district.placement"), align: "right", sort: (r) => r.plc, cell: (r) => (r.plc < 0 ? "–" : `${r.plc}%`) },
    { key: "conf", header: t("common.confidence"), sort: (r) => r.conf, cell: (r) => <Confidence level={r.conf} /> },
  ], [t, ref, fy, trade]);

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: t("common.india"), href: "/dashboard" },
          { label: ref.stateName(info.state), href: `/dashboard?state=${info.state}` },
          { label: info.name },
        ]}
        title={info.name}
        subtitle={
          <>
            {t("district.facts", { pop: compact(info.pop), urban: info.urban, state: ref.stateName(info.state) })}
            <span className="ml-2 text-xs text-muted">({t("district.basis", { basis: info.basis })})</span>
          </>
        }
        actions={<Button onClick={() => window.print()}><Printer className="h-4 w-4" />{t("district.print")}</Button>}
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile tone="demand" Icon={TrendingUp} label={t("dash.kpiDemand")} value={o.dx} format={compact}
            spark={{ values: p.series.all.d, histLen: meta.histLen }}
            hint={`${compact(o.lo)} – ${compact(o.hi)} · ${t("common.range")}`} />
          <StatTile tone="supply" Icon={GraduationCap} label={t("dash.kpiSupply")} value={o.sx} format={compact} hint={t("dash.kpiSupplyHint")} />
          <StatTile Icon={Scale} label={gap >= 0 ? t("dash.kpiGapShort") : t("dash.kpiGapSurplus")} value={Math.abs(gap)} format={compact}
            hint={<BalanceMeter now={o.s0} next={o.s1} width={104} wrap />} />
          <StatTile Icon={Briefcase} label={t("district.kpiTrades")} value={p.cells.length} format={int} hint={t("district.kpiTradesHint", { a: short, b: over })} />
          <StatTile className="col-span-2 lg:col-span-1" Icon={Users} label={t("district.kpiSeats")} value={seats} format={compact} hint={t("district.kpiSeatsHint")} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <ChartCard
            className="xl:col-span-8"
            title={`${t("dash.trendTitle")} · ${name}`}
            subtitle={t("dash.trendSub")}
            actions={
              <Select label={t("common.trade")} value={trade ?? ""} onChange={(e) => setTrade(e.target.value || null)} className="max-w-[14rem]">
                <option value="">{t("common.allTrades")}</option>
                {ref.sectors.map((sec) => {
                  const list = p.cells.filter((c) => ref.trade(c.trade)!.sector === sec.id);
                  return list.length ? (
                    <optgroup key={sec.id} label={ref.sectorName(sec.id)}>
                      {list.map((c) => <option key={c.trade} value={c.trade}>{ref.tradeName(c.trade)}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </Select>
            }
            legend={
              <>
                <LegendItem color="var(--demand)" label={`${t("common.demand")} (${t("common.openings")})`} />
                <LegendItem color="var(--supply)" label={`${t("common.supply")} (${t("common.entrants")})`} />
                <LegendItem color="var(--ink-2)" kind="dash" label={t("common.forecast")} />
                <LegendItem color="var(--demand)" kind="band" label={t("common.range")} />
              </>
            }
            table={trendTable(meta.months, meta.histLen, line, t, `${info.id}-${trade ?? "all"}`)}
          >
            <TrendChart key={trade ?? "all"} months={meta.months} histLen={meta.histLen} series={line} planMonths={meta.planMonths} label={`${name}, ${info.name}`} height={340} />
          </ChartCard>

          <Card className="flex flex-col xl:col-span-4">
            <CardHeader title={t("district.locator")} subtitle={ref.stateName(info.state)} />
            <div className="mx-auto h-52 w-full max-w-xs px-4 pt-2">
              <StateMini map={p.map} layer={p.layer} current={info.id} href={(id) => `/district/${id}`} label={`${info.name}, ${ref.stateName(info.state)}`} />
            </div>
            <div className="border-t border-line px-5 pb-4 pt-3">
              <h3 className="mb-2 text-xs font-medium text-muted">{t("district.sectors")} · {t("common.fy", { fy })}</h3>
              <ul className="space-y-1.5">
                {p.sectors.filter((s) => s.dx + s.sx > 0).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-ink">{ref.sectorName(s.id)}</span>
                    <BalanceMeter now={s.s0} next={s.s1} width={92} />
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title={t("district.tradesTitle")} subtitle={t("district.tradesSub")} />
          <div className="px-2 pb-3 pt-2">
            <SortTable
              rows={p.cells} cols={cols} rowKey={(r) => r.trade} initial={{ key: "gap", dir: "desc" }} pageSize={10}
              onRow={(r) => setTrade(r.trade === trade ? null : r.trade)} selected={(r) => r.trade === trade}
            />
          </div>
        </Card>

        {sel && detail ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal>
              <Card className="h-full">
                <CardHeader
                  title={t("district.sourcesTitle")}
                  subtitle={t("district.sourcesSub")}
                  actions={
                    <Link href={`/trades/${sel.trade}?state=${info.state}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                      {ref.tradeName(sel.trade)} <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
                <div className="px-5 pb-4 pt-2">
                  <BarRows
                    key={sel.trade}
                    rows={[
                      { key: "idx", label: t("district.composite"), sub: t("common.last12"), value: sel.dn, display: int(sel.dn), color: "var(--demand)" },
                      ...SOURCES.map((s) => ({
                        key: s,
                        label: t(`src.${s}` as Key),
                        sub: `${t("district.weight", { n: Math.round(detail.w[s] * 100) })} · ${t("district.rawCount", { n: int(detail.raw[s]) })}`,
                        value: detail.src[s], display: int(detail.src[s]), color: QUIET,
                      })),
                    ]}
                  />
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.05}>
              <Card className="h-full">
                <CardHeader title={t("district.capacityTitle")} subtitle={`${ref.tradeName(sel.trade)} · ${t("district.capacitySub")}`} />
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 pb-4 pt-2 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-medium text-muted">{t("district.seatsByYear")}</h3>
                    <BarRows
                      key={`seats-${sel.trade}`}
                      rows={Object.entries(detail.seats).map(([y, v]) => ({
                        key: y,
                        label: `${Number(y) - 1}-${y.slice(2)}${y === "2028" ? ` (${t("district.draft")})` : ""}`,
                        value: v, display: int(v), color: "var(--supply)",
                      }))}
                    />
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-muted">{t("district.funnel")}</h3>
                    <BarRows
                      key={`funnel-${sel.trade}`}
                      rows={[
                        { key: "e", label: t("district.enrolled"), value: detail.enrolled, display: int(detail.enrolled), color: "var(--supply)" },
                        { key: "c", label: t("district.certified"), sub: t("district.conversion", { n: detail.enrolled ? Math.round((detail.certified / detail.enrolled) * 100) : 0 }), value: detail.certified, display: int(detail.certified), color: "var(--supply)" },
                        { key: "l", label: t("district.entered"), sub: t("district.conversion", { n: detail.certified ? Math.round((detail.entrants / detail.certified) * 100) : 0 }), value: detail.entrants, display: int(detail.entrants), color: "var(--supply)" },
                      ]}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-4 border-t border-line pt-3 sm:col-span-2">
                    <div>
                      <dt className="text-xs text-muted">{t("district.placement")}</dt>
                      <dd className="mt-0.5 text-lg font-semibold text-ink">{sel.plc < 0 ? <span className="text-sm font-normal text-muted">{t("district.placementNone")}</span> : `${sel.plc}%`}</dd>
                    </div>
                    {(ref.meta.demo || ref.meta.inputs.includes("eshram.csv")) && (
                      <div title={t("district.eshramHelp")}>
                        <dt className="text-xs text-muted">{t("district.eshram")}</dt>
                        <dd className="mt-0.5 text-lg font-semibold text-ink">{int(detail.eshram)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </Card>
            </Reveal>
          </div>
        ) : (
          <p className="no-print rounded-2xl border border-dashed border-line-strong px-5 py-6 text-center text-[13px] text-muted">{t("district.selectTrade")}</p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("district.pipelineTitle")} subtitle={t("district.pipelineSub")} />
            <div className="px-5 pb-4 pt-2">
              {p.projects.length === 0 ? (
                <p className="py-5 text-center text-[13px] text-muted">{t("district.pipelineNone")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {p.projects.map((pr) => (
                    <li key={pr.id} className="py-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Building2 className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ink">{pr.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                            <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{t("district.commissioning", { month: month(pr.month, locale) })}</span>
                            <span>{t("district.jobs", { n: int(pr.total) })}</span>
                            <span>{t("district.probability", { n: Math.round(pr.p * 100) })}</span>
                            <Badge>{t("common.illustrative")}</Badge>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(pr.jobs).map(([id, n]) => (
                              <button key={id} type="button" onClick={() => p.cells.some((c) => c.trade === id) && setTrade(id)} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2 hover:bg-surface-3">
                                {ref.tradeName(id)} <span className="tabular font-semibold text-ink">{int(n)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title={t("district.flagsTitle")} />
            <div className="px-5 pb-3 pt-1.5">
              {p.flags.length === 0 ? (
                <p className="py-5 text-center text-[13px] text-muted">{t("district.flagsNone")}</p>
              ) : (
                <ul className="divide-y divide-line">{p.flags.slice(0, 6).map((f) => <li key={f.id}><FlagItem flag={f} /></li>)}</ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

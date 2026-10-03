"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Gauge, GraduationCap, Scale, TrendingUp, Zap } from "lucide-react";
import { ChartCard, LegendItem } from "@/components/charts/base";
import { BalanceMeter, BarRows, PairBars, ScaleLegend, StatTile } from "@/components/charts/bits";
import { TrendChart, trendTable } from "@/components/charts/trend-chart";
import { FlagItem } from "@/components/flag-item";
import { IndiaMap } from "@/components/map/india-map";
import { PageHeader } from "@/components/shell/console-shell";
import { Badge, ClassChip } from "@/components/ui/badges";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented, Select } from "@/components/ui/controls";
import { Reveal } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import type { LayerRow } from "@/lib/data";
import { compact, int, signed, signedPct } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import { classFill } from "@/lib/scale";
import type { CellRow, Flag, MapIndia, MapState, Meta, Series, TradeRow } from "@/lib/types";

interface Props {
  id: string; state?: string; meta: Meta; row: TradeRow; stateRows: Record<string, LayerRow>;
  stateTrade: Record<string, TradeRow>; line: Series; india: MapIndia; stateMaps: Record<string, MapState>;
  districts: Record<string, LayerRow>; topShort: CellRow[]; topSurplus: CellRow[]; flags: Flag[];
  coverage: { id: string; share: number }[];
}

const QUIET = "color-mix(in oklab, var(--ink-2) 42%, var(--surface))";

export function TradeView(p: Props) {
  const { t } = useT();
  const ref = useRefData();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"short" | "surplus">(p.topShort.length ? "short" : "surplus");
  const tr = ref.trade(p.id)!;
  const sector = ref.sector(tr.sector)!;
  const fy = p.meta.planFY;
  const r = p.row;
  const gap = r.dx - r.sx;
  const place = p.state ? ref.stateName(p.state) : t("common.allStates");
  const go = (state?: string) => start(() => router.push(state ? `${pathname}?state=${state}` : pathname, { scroll: false }));
  const growth = p.state ? p.stateTrade[p.state].growth : undefined;
  const list = tab === "short" ? p.topShort : p.topSurplus;

  const facts: [string, React.ReactNode][] = [
    [t("trade.nco"), <span key="n"><span className="font-mono">{tr.nco}</span> · {tr.ncoTitle}</span>],
    [t("trade.nsqf"), tr.nsqf],
    [t("trade.qp"), tr.qp ? <span className="font-mono">{tr.qp}</span> : <span className="text-muted">{t("trade.qpNone")}</span>],
    [t("trade.ssc"), sector.ssc],
    [t("trade.type"), tr.kind === "ITI" ? t("common.iti") : t("common.stt")],
    [t("trade.duration"), t("common.months", { n: tr.months })],
    [t("trade.yield"), <span key="y" title={t("trade.yieldHelp", { n: Math.round(tr.yield_ * 100) })}>{Math.round(tr.yield_ * 100)}%</span>],
  ];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: t("nav.trades"), href: "/trades" }, { label: ref.sectorName(tr.sector) }]}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {ref.tradeName(p.id)}
            {tr.emerging && <Badge tone="brand" className="text-xs">{t("common.emerging")}</Badge>}
          </span>
        }
        subtitle={<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">{place} · {t("common.fy", { fy })} <ClassChip score={r.s1} /></span>}
        actions={
          <Select label={t("common.state")} value={p.state ?? ""} onChange={(e) => go(e.target.value || undefined)}>
            <option value="">{t("common.allStates")}</option>
            {ref.states.map((x) => <option key={x.id} value={x.id}>{ref.stateName(x.id)}</option>)}
          </Select>
        }
      />

      <div className={cn("space-y-4 transition-opacity duration-200", pending && "opacity-60")}>
        <Card className="px-5 py-4">
          <h2 className="sr-only">{t("trade.about")}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {facts.map(([k, v]) => (
              <div key={k} className={cn(k === t("trade.nco") && "col-span-2 sm:col-span-1 xl:col-span-1")}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-0.5 text-[13px] font-medium leading-5 text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile tone="demand" Icon={TrendingUp} label={t("dash.kpiDemand")} value={r.dx} format={compact}
            spark={{ values: p.line.d, histLen: p.meta.histLen }} hint={`${compact(r.lo)} – ${compact(r.hi)} · ${t("common.range")}`} />
          <StatTile tone="supply" Icon={GraduationCap} label={t("dash.kpiSupply")} value={r.sx} format={compact} hint={t("dash.kpiSupplyHint")} />
          <StatTile Icon={Scale} label={gap >= 0 ? t("dash.kpiGapShort") : t("dash.kpiGapSurplus")} value={Math.abs(gap)} format={compact}
            hint={<BalanceMeter now={r.s0} next={r.s1} width={104} wrap />} />
          <StatTile Icon={Gauge} label={t("dash.colCdi")} value={r.cdi} format={int} hint={t("dash.cdiHelp")} />
          <StatTile className="col-span-2 lg:col-span-1" Icon={Zap} label={t("dash.colMomentum")} value={r.mom} format={(n) => signedPct(Math.round(n))}
            hint={growth !== undefined
              ? `${t("trade.growth")}: ${growth === 0 ? t("trade.growthNone") : signedPct(growth, 1)}${p.stateTrade[p.state!].broke ? ` · ${t("trade.trendBreak")}` : ""}`
              : t("common.vsLast12")} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <ChartCard
            className="xl:col-span-7"
            title={t("dash.trendTitle")}
            subtitle={`${place}. ${t("dash.trendSub")}`}
            legend={
              <>
                <LegendItem color="var(--demand)" label={`${t("common.demand")} (${t("common.openings")})`} />
                <LegendItem color="var(--supply)" label={`${t("common.supply")} (${t("common.entrants")})`} />
                <LegendItem color="var(--ink-2)" kind="dash" label={t("common.forecast")} />
                <LegendItem color="var(--demand)" kind="band" label={t("common.range")} />
              </>
            }
            table={trendTable(p.meta.months, p.meta.histLen, p.line, t, `${p.id}-${p.state ?? "all"}`)}
          >
            <TrendChart key={p.state ?? "all"} months={p.meta.months} histLen={p.meta.histLen} series={p.line} planMonths={p.meta.planMonths} label={`${tr.name}, ${place}`} />
          </ChartCard>

          <Card className="xl:col-span-5">
            <CardHeader title={t("trade.statesTitle")} subtitle={t("trade.statesSub", { fy })} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-2.5">
              <LegendItem color="var(--demand)" kind="box" label={t("common.demand")} />
              <LegendItem color="var(--supply)" kind="box" label={t("common.supply")} />
            </div>
            <div className="px-5 pb-3 pt-1.5">
              <PairBars
                format={compact}
                rows={ref.states.map((s) => ({
                  key: s.id, label: s.name, demand: p.stateTrade[s.id].dx, supply: p.stateTrade[s.id].sx,
                  href: `${pathname}?state=${s.id}`, note: <ClassChip score={p.stateTrade[s.id].s1} className="text-xs" />,
                }))}
              />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="flex flex-col xl:col-span-7">
            <CardHeader title={t("trade.mapTitle")} subtitle={`${place} · ${t("common.fy", { fy })}`} />
            <div className="min-h-[440px] flex-1 px-3 pt-2">
              <IndiaMap
                india={p.india} states={p.stateMaps} districts={p.districts} stateRows={p.stateRows} view="next"
                focus={p.state ?? null} onFocus={(st) => go(st ?? undefined)}
                districtHref={(d) => `/district/${d}?trade=${p.id}`} names={ref.geoName}
              />
            </div>
            <div className="px-5 pb-4 pt-2"><ScaleLegend /></div>
          </Card>

          <div className="flex flex-col gap-4 xl:col-span-5">
            <Card>
              <CardHeader
                title={t("trade.topTitle")}
                subtitle={place}
                actions={
                  <Segmented size="sm" label={t("trade.topTitle")} value={tab} onChange={setTab}
                    options={[{ value: "short", label: t("dash.topShort") }, { value: "surplus", label: t("dash.topSurplus") }]} />
                }
              />
              <div className="px-5 pb-3 pt-2">
                {list.length === 0 ? <p className="py-6 text-center text-[13px] text-muted">{t("common.empty")}</p> : (
                  <BarRows
                    key={tab}
                    rows={list.map((c) => ({
                      key: c.district, label: ref.districtName(c.district),
                      sub: `${ref.stateName(ref.district(c.district)!.state)} · ${t("common.demand")} ${int(c.dx)} · ${t("common.supply")} ${int(c.sx)}`,
                      value: c.dx - c.sx, display: signed(c.dx - c.sx), href: `/district/${c.district}?trade=${p.id}`,
                      color: classFill(tab === "short" ? "acute_shortage" : "saturated"),
                    }))}
                  />
                )}
              </div>
            </Card>
            <Card className="flex-1">
              <CardHeader title={t("trade.flagsTitle")} />
              <div className="px-5 pb-3 pt-1.5">
                {p.flags.length === 0 ? <p className="py-5 text-center text-[13px] text-muted">{t("trade.flagsNone")}</p> : (
                  <ul className="divide-y divide-line">{p.flags.map((f) => <li key={f.id}><FlagItem flag={f} /></li>)}</ul>
                )}
              </div>
            </Card>
          </div>
        </div>

        <Reveal>
          <Card>
            <CardHeader title={t("trade.coverageTitle")} subtitle={t("trade.coverageSub")} />
            <div className="px-5 pb-4 pt-2">
              <BarRows
                max={1}
                className="sm:grid sm:grid-cols-2 sm:gap-x-8 sm:space-y-0"
                rows={p.coverage.map((c) => ({
                  key: c.id, label: t(`src.${c.id}` as Key), value: c.share,
                  display: t("trade.coverageOf", { n: Math.round(c.share * 100) }), color: QUIET,
                }))}
              />
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

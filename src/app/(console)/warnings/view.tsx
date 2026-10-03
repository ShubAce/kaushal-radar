"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, ChevronDown, Lightbulb } from "lucide-react";
import { LegendItem, Tip, useSize } from "@/components/charts/base";
import { BalanceMeter } from "@/components/charts/bits";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/shell/console-shell";
import { ClassChip, Confidence, SeverityBadge } from "@/components/ui/badges";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented, Select } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { int, month, monthShort, signed } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import { useApi } from "@/lib/use-api";
import type { Flag, Meta, Series } from "@/lib/types";

const TYPES = ["emerging_shortage", "deepening_shortage", "approaching_saturation", "deepening_saturation", "demand_accelerating", "demand_slowing"] as const;
const isShort = (f: Flag) => f.type === "emerging_shortage" || f.type === "deepening_shortage" || f.type === "demand_accelerating";
const WARM = "var(--cls-acute)";
const COOL = "var(--cls-saturated)";

interface Point { month: string; kind: string; demand: number; supply: number; demandLow: number | null; demandHigh: number | null }

/** Flags by the month their threshold is crossed: shortages above the line, saturation below. */
function Timeline({ flags, months, onPick, picked }: { flags: Flag[]; months: string[]; onPick: (m: string | null) => void; picked: string | null }) {
  const { t, locale } = useT();
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 150;
  const counts = months.map((m) => {
    const here = flags.filter((f) => f.month === m && f.lead > 0);
    return { m, up: here.filter(isShort).length, down: here.filter((f) => !isShort(f)).length };
  });
  const max = Math.max(...counts.map((c) => Math.max(c.up, c.down)), 1);
  const W = Math.max(w, 300);
  const band = (W - 36) / months.length;
  const mid = 68;
  const unit = 52 / max;
  return (
    <div ref={ref} className="relative" style={{ height: H }}>
      {w > 0 && (
        <svg width={W} height={H} role="img" aria-label={t("warn.title")}>
          <line x1={30} x2={W} y1={mid} y2={mid} stroke="var(--axis)" strokeWidth={1} />
          <text x={24} y={mid - 26} textAnchor="end" className="tabular fill-muted text-[10px]">{max}</text>
          <text x={24} y={mid + 30} textAnchor="end" className="tabular fill-muted text-[10px]">{max}</text>
          {counts.map((c, i) => {
            const x = 34 + i * band + band / 2;
            const bw = Math.min(22, band - 6);
            const on = picked === c.m;
            return (
              <g
                key={c.m} tabIndex={0} role="button" aria-pressed={on}
                aria-label={`${month(c.m, locale)}: ${c.up} + ${c.down}`}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                onClick={() => onPick(on ? null : c.m)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(on ? null : c.m)}
                style={{ cursor: "pointer", outlineOffset: 2 }}
              >
                <rect x={x - band / 2} y={4} width={band} height={H - 8} rx={6} fill={on || hover === i ? "var(--surface-2)" : "transparent"} />
                {c.up > 0 && (
                  <motion.path
                    d={`M${x - bw / 2},${mid - 1} v${-(c.up * unit - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${c.up * unit - 4} z`}
                    fill={WARM} initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
                    style={{ transformOrigin: `${x}px ${mid}px` }} transition={{ duration: 0.45, delay: i * 0.02 }}
                  />
                )}
                {c.down > 0 && (
                  <motion.path
                    d={`M${x - bw / 2},${mid + 1} v${c.down * unit - 4} q0,4 4,4 h${bw - 8} q4,0 4,-4 v${-(c.down * unit - 4)} z`}
                    fill={COOL} initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
                    style={{ transformOrigin: `${x}px ${mid}px` }} transition={{ duration: 0.45, delay: i * 0.02 }}
                  />
                )}
                {(band >= 34 || i % 3 === 0 || on) && (                 // narrow screens: label every third month
                  <text x={x} y={H - 6} textAnchor="middle" className={cn("text-[10.5px]", on ? "fill-ink font-semibold" : "fill-muted")}>
                    {monthShort(c.m, locale)}{c.m.endsWith("-01") || i === 0 ? ` ’${c.m.slice(2, 4)}` : ""}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <Tip show={hover !== null} x={hover !== null ? 34 + hover * band + band / 2 : 0} y={18} width={W}>
        {hover !== null && (
          <>
            <div className="mb-1 font-medium text-ink">{month(counts[hover].m, locale)}</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: WARM }} /><b className="tabular text-ink">{counts[hover].up}</b><span className="text-muted">{t("cls.shortage")}</span></div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COOL }} /><b className="tabular text-ink">{counts[hover].down}</b><span className="text-muted">{t("cls.saturated")}</span></div>
          </>
        )}
      </Tip>
    </div>
  );
}

function FlagCard({ flag, meta, open, onToggle }: { flag: Flag; meta: Meta; open: boolean; onToggle: () => void }) {
  const { t, locale } = useT();
  const ref = useRefData();
  const el = useRef<HTMLDivElement>(null);
  const tr = ref.trade(flag.trade)!;
  const fy = meta.planFY;
  const url = open ? `/api/v1/forecast?${flag.level === "state" ? "state" : "district"}=${flag.geo}&trade=${flag.trade}` : null;
  const { data } = useApi<{ points: Point[] }>(url);
  const series = useMemo<Series | null>(() => {
    if (!data) return null;
    const fc = data.points.filter((p) => p.kind === "forecast");
    return { d: data.points.map((p) => p.demand), s: data.points.map((p) => p.supply), lo: fc.map((p) => p.demandLow ?? 0), hi: fc.map((p) => p.demandHigh ?? 0) };
  }, [data]);

  useEffect(() => {
    if (open) el.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const seats = Math.max(10, Math.round(Math.abs(flag.gap) / tr.yield_ / 10) * 10);
  const action = flag.type === "demand_slowing" ? t("warn.actReview")
    : flag.type === "demand_accelerating" ? t("warn.actWatch")
      : isShort(flag) ? (flag.s_next < 12 ? t("warn.actNew") : t("warn.actRaise", { n: int(seats), fy }))
        : t("warn.actCut", { n: int(seats) });
  const lead = flag.lead === 1 ? t("warn.leadIn1") : t("warn.leadIn", { n: flag.lead });
  const when = flag.lead > 0 ? `${t("warn.by", { month: month(flag.month, locale) })} (${lead})` : t("warn.leadNow");
  const likelihood = (["warn.uncertain", "warn.uncertain", "warn.possible", "warn.likely"] as Key[])[flag.likelihood];
  const geoHref = flag.level === "state" ? `/dashboard?state=${flag.geo}&trade=${flag.trade}` : `/district/${flag.geo}?trade=${flag.trade}`;

  return (
    <div ref={el} id={flag.id} className={cn("rounded-2xl border bg-surface shadow-card transition-colors", open ? "border-brand-line" : "border-line")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left">
        <SeverityBadge severity={flag.severity} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{ref.tradeName(flag.trade)}</span>
          <span className="block truncate text-[13px] text-muted">
            {ref.geoName(flag.geo)}{flag.level === "state" ? ` · ${t("warn.stateWide")}` : ` · ${ref.stateName(ref.district(flag.geo)!.state)}`} · {t(`warn.${flag.type}`)}
          </span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-[13px] font-medium text-ink">{flag.lead > 0 ? month(flag.month, locale) : t("common.now")}</span>
          <span className="block text-xs text-muted">{flag.lead > 0 ? lead : t("warn.leadNow")}</span>
        </span>
        <span className="hidden shrink-0 md:block"><BalanceMeter now={flag.score_now} next={flag.score_next} width={100} showNumbers={false} /></span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-5 border-t border-line px-4 py-4 lg:grid-cols-5">
              <div className="space-y-3 lg:col-span-2">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <ClassChip cls={flag.from_class} /> <ArrowRight className="h-3.5 w-3.5 text-muted" /> <ClassChip cls={flag.to_class} />
                  <span className="text-muted">{when}</span>
                </div>
                <dl className="grid grid-cols-3 gap-3 rounded-xl bg-surface-2 p-3 text-xs">
                  <div><dt className="text-muted">{t("common.demand")} · {fy}</dt><dd className="tabular mt-0.5 text-sm font-semibold text-ink">{int(flag.d_next)}</dd></div>
                  <div><dt className="text-muted">{t("common.supply")} · {fy}</dt><dd className="tabular mt-0.5 text-sm font-semibold text-ink">{int(flag.s_next)}</dd></div>
                  <div><dt className="text-muted">{t("common.gap")}</dt><dd className="tabular mt-0.5 text-sm font-semibold text-ink">{signed(flag.gap)}</dd></div>
                </dl>
                <div>
                  <h3 className="text-xs font-medium text-muted">{t("warn.evidence")}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] leading-5 text-ink-2">
                    <li>{t("warn.movesFrom", { from: t(`cls.${flag.from_class}`), to: t(`cls.${flag.to_class}`), month: month(flag.month, locale) })}</li>
                    {flag.project_share >= 0.15 && <li>{t("warn.fromProject", { n: Math.round(flag.project_share * 100) })}</li>}
                    {flag.accel !== undefined && <li>{t("warn.accel", { n: signed(flag.accel) })}</li>}
                  </ul>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                  <span title={t("warn.likelihoodHelp")}>{t(likelihood)}</span>
                  <Confidence level={flag.conf} />
                </div>
                <div className="flex gap-2.5 rounded-xl border border-brand-line bg-brand-soft p-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <h3 className="text-xs font-semibold text-brand">{t("warn.action")}</h3>
                    <p className="mt-0.5 text-[13px] leading-5 text-ink">{action}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-brand">
                  <Link href={geoHref} className="inline-flex items-center gap-1 hover:underline">{ref.geoName(flag.geo)} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                  <Link href={`/trades/${flag.trade}`} className="inline-flex items-center gap-1 hover:underline">{ref.tradeName(flag.trade)} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                </div>
              </div>
              <div className="lg:col-span-3">
                <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1">
                  <LegendItem color="var(--demand)" label={t("common.demand")} />
                  <LegendItem color="var(--supply)" label={t("common.supply")} />
                  <LegendItem color="var(--demand)" kind="band" label={t("common.range")} />
                </div>
                {series ? (
                  <TrendChart months={meta.months} histLen={meta.histLen} series={series} planMonths={meta.planMonths} height={250} label={`${tr.name}, ${ref.geoName(flag.geo)}`} />
                ) : <div className="skeleton h-[250px]" />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WarningsView({ flags, meta, initialState, focus }: { flags: Flag[]; meta: Meta; initialState: string; focus?: string }) {
  const { t, locale } = useT();
  const ref = useRefData();
  const [sev, setSev] = useState<"all" | "critical" | "warning" | "watch">("all");
  const [type, setType] = useState("");
  const [state, setState] = useState(initialState);
  const [sector, setSector] = useState("");
  const [level, setLevel] = useState("");
  const [monthPick, setMonthPick] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(focus ?? null);
  const [shown, setShown] = useState(20);

  const base = useMemo(() => flags.filter((f) => {
    const st = f.level === "state" ? f.geo : ref.district(f.geo)!.state;
    return (!state || st === state) && (!sector || ref.trade(f.trade)!.sector === sector) && (!type || f.type === type) && (!level || f.level === level);
  }), [flags, state, sector, type, level, ref]);
  const list = useMemo(() => {
    const out = base.filter((f) => (sev === "all" || f.severity === sev) && (!monthPick || (f.month === monthPick && f.lead > 0)));
    const i = focus ? out.findIndex((f) => f.id === focus) : -1;
    return i > 0 ? [out[i], ...out.slice(0, i), ...out.slice(i + 1)] : out;
  }, [base, sev, monthPick, focus]);
  const n = (s: string) => base.filter((f) => f.severity === s).length;
  const fcMonths = meta.months.slice(meta.histLen);

  return (
    <div>
      <PageHeader title={t("warn.title")} subtitle={t("warn.subtitle")} />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label={t("warn.severity")} value={sev} onChange={setSev}
          options={[
            { value: "all", label: `${t("common.viewAll")} ${base.length}` },
            { value: "critical", label: `${t("warn.critical")} ${n("critical")}` },
            { value: "warning", label: `${t("warn.warning")} ${n("warning")}` },
            { value: "watch", label: `${t("warn.watch")} ${n("watch")}` },
          ]}
        />
        <Select label={t("warn.type")} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("common.allTypes")}</option>
          {TYPES.map((x) => <option key={x} value={x}>{t(`warn.${x}`)}</option>)}
        </Select>
        <Select label={t("common.state")} value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">{t("common.allStates")}</option>
          {ref.states.map((x) => <option key={x.id} value={x.id}>{ref.stateName(x.id)}</option>)}
        </Select>
        <Select label={t("common.sector")} value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">{t("common.allSectors")}</option>
          {ref.sectors.map((x) => <option key={x.id} value={x.id}>{ref.sectorName(x.id)}</option>)}
        </Select>
        <Select label={t("warn.level")} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">{t("common.allLevels")}</option>
          <option value="district">{t("common.district")}</option>
          <option value="state">{t("common.state")}</option>
        </Select>
      </div>

      <Card className="mb-4">
        <CardHeader
          title={t("warn.timelineTitle")}
          subtitle={monthPick ? `${month(monthPick, locale)} · ${t("warn.timelineClear")}` : t("warn.timelineSub")}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-2">
          <LegendItem color={WARM} kind="box" label={t("warn.towardShortage")} />
          <LegendItem color={COOL} kind="box" label={t("warn.towardSaturation")} />
        </div>
        <div className="px-4 pb-3 pt-1">
          <Timeline flags={base.filter((f) => sev === "all" || f.severity === sev)} months={fcMonths} onPick={setMonthPick} picked={monthPick} />
        </div>
      </Card>

      {list.length === 0 && <p className="py-14 text-center text-sm text-muted">{t("common.empty")}</p>}
      <div className="space-y-2.5">
        {list.slice(0, shown).map((f) => (
          <FlagCard key={f.id} flag={f} meta={meta} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />
        ))}
      </div>
      {list.length > shown && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-xs text-muted">{t("rank.showing", { n: shown, total: list.length })}</span>
          <button type="button" onClick={() => setShown((v) => v + 30)} className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2">
            {t("common.viewAll")}
          </button>
        </div>
      )}
    </div>
  );
}

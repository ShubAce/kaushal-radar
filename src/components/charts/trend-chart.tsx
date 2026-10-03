"use client";

// Demand against supply over time: history, forecast and the forecast range.
// One axis (both series are people per year), a crosshair that snaps to months,
// and the planning year marked so the reader sees which stretch drives the plan.
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { area, line } from "d3-shape";
import { Tip, TipRow, useSize, type TableSpec } from "./base";
import { ClassChip } from "@/components/ui/badges";
import { axisLabel, compact, int, month, ticks } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { scoreOf } from "@/lib/scale";
import type { Series } from "@/lib/types";

interface Props {
  months: string[];
  histLen: number;
  series: Series;
  planMonths: [string, string];
  height?: number;
  label: string;
}

const M = { l: 46, r: 62, t: 20, b: 26 };

export function trendTable(months: string[], histLen: number, s: Series, t: (k: "common.month" | "common.demand" | "common.supply" | "common.range") => string, filename: string): TableSpec {
  return {
    filename,
    columns: [
      { key: "m", label: t("common.month") },
      { key: "d", label: t("common.demand"), align: "right" },
      { key: "lo", label: `${t("common.range")} ↓`, align: "right" },
      { key: "hi", label: `${t("common.range")} ↑`, align: "right" },
      { key: "s", label: t("common.supply"), align: "right" },
    ],
    rows: months.map((m, i) => ({
      m, d: Math.round(s.d[i]), s: Math.round(s.s[i]),
      lo: i >= histLen ? Math.round(s.lo[i - histLen]) : "", hi: i >= histLen ? Math.round(s.hi[i - histLen]) : "",
    })),
  };
}

export function TrendChart({ months, histLen, series, planMonths, height = 290, label }: Props) {
  const { t, locale } = useT();
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = months.length;
  const last = histLen - 1;

  const geo = useMemo(() => {
    const W = Math.max(w, 320);
    const iw = W - M.l - M.r;
    const ih = height - M.t - M.b;
    const top = Math.max(...series.d, ...series.s, ...series.hi, 1);
    const yt = ticks(top);
    const yMax = yt[yt.length - 1];
    const x = (i: number) => M.l + (i / (n - 1)) * iw;
    const y = (v: number) => M.t + (1 - v / yMax) * ih;
    const pts = (arr: number[], from: number, to: number) => arr.slice(from, to + 1).map((v, k) => [x(from + k), y(v)] as [number, number]);
    const path = line<[number, number]>().x((p) => p[0]).y((p) => p[1]);
    const band = area<number>()
      .x((_, k) => x(last + k))
      .y0((_, k) => y(k === 0 ? series.d[last] : series.lo[k - 1]))
      .y1((_, k) => y(k === 0 ? series.d[last] : series.hi[k - 1]));
    const p0 = months.indexOf(planMonths[0]);
    const p1 = months.indexOf(planMonths[1]);
    return {
      W, iw, ih, x, y, yt,
      dHist: path(pts(series.d, 0, last))!, dFc: path(pts(series.d, last, n - 1))!,
      sHist: path(pts(series.s, 0, last))!, sFc: path(pts(series.s, last, n - 1))!,
      band: band(Array.from({ length: n - last }, (_, k) => k))!,
      plan: p0 >= 0 && p1 >= 0 ? { x0: x(p0 - 0.5), x1: Math.min(x(p1 + 0.5), M.l + iw) } : null,
    };
  }, [w, height, series, n, last, months, planMonths]);

  const { W, x, y, yt } = geo;
  // a label every six months, or once a year when the plot is too narrow for that
  const halfYearly = geo.iw >= 380;
  const xTicks = months.map((m, i) => ({ m, i })).filter(({ m }) => m.endsWith("-04") || (halfYearly && m.endsWith("-10")));
  const dEnd = series.d[n - 1];
  const sEnd = series.s[n - 1];
  let yd = y(dEnd);
  let ys = y(sEnd);
  if (Math.abs(yd - ys) < 15) {                       // keep the two end labels legible when the lines meet
    const mid = (yd + ys) / 2;
    yd = yd <= ys ? mid - 8 : mid + 8;
    ys = yd < mid ? mid + 8 : mid - 8;
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1)))));
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(n - 1, (h ?? last) + (e.key === "ArrowRight" ? 1 : -1))));
  }

  const hi = hover;
  const isFc = hi !== null && hi > last;
  const shortLabel = (m: string) => month(m, locale).replace(/\s?20(\d\d)$/, " ’$1");

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {w > 0 && (
        <svg
          width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" tabIndex={0}
          aria-label={`${label}. ${t("common.demand")} ${int(series.d[last])}, ${t("common.supply")} ${int(series.s[last])} (${month(months[last], locale)}); ${t("common.forecast")} ${int(dEnd)} / ${int(sEnd)} (${month(months[n - 1], locale)}).`}
          className="block overflow-visible rounded-lg outline-offset-4"
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          onFocus={() => setHover((h) => h ?? last)} onBlur={() => setHover(null)} onKeyDown={onKey}
        >
          {geo.plan && (
            <g>
              <rect x={geo.plan.x0} y={M.t - 6} width={geo.plan.x1 - geo.plan.x0} height={geo.ih + 6} fill="var(--surface-2)" rx={6} />
              <text x={(geo.plan.x0 + geo.plan.x1) / 2} y={M.t + 8} textAnchor="middle" className="fill-muted text-[10.5px] font-medium">
                {t("common.planYear")}
              </text>
            </g>
          )}
          {yt.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
              <text x={M.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">{axisLabel(v)}</text>
            </g>
          ))}
          {xTicks.map(({ m, i }) => (
            <text key={m} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">{shortLabel(m)}</text>
          ))}
          <line x1={x(last)} x2={x(last)} y1={M.t - 4} y2={M.t + geo.ih} stroke="var(--axis)" strokeWidth={1} />
          <text x={x(last) - 6} y={M.t + 8} textAnchor="end" className="fill-muted text-[10.5px] font-medium">{t("common.today")}</text>

          <motion.path d={geo.band} fill="var(--demand)" initial={{ opacity: 0 }} animate={{ opacity: 0.13 }} transition={{ delay: 0.7, duration: 0.5 }} />
          <motion.path d={geo.sHist} fill="none" stroke="var(--supply)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
          <motion.path d={geo.dHist} fill="none" stroke="var(--demand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75, duration: 0.45 }}>
            <path d={geo.sFc} fill="none" stroke="var(--supply)" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
            <path d={geo.dFc} fill="none" stroke="var(--demand)" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
            <circle cx={x(n - 1)} cy={y(sEnd)} r={4} fill="var(--supply)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={x(n - 1)} cy={y(dEnd)} r={4} fill="var(--demand)" stroke="var(--surface)" strokeWidth={2} />
            <text x={x(n - 1) + 9} y={yd} dy="0.32em" className="tabular fill-ink text-[11.5px] font-semibold">{compact(dEnd)}</text>
            <text x={x(n - 1) + 9} y={ys} dy="0.32em" className="tabular fill-ink text-[11.5px] font-semibold">{compact(sEnd)}</text>
          </motion.g>

          {hi !== null && (
            <g pointerEvents="none">
              <line x1={x(hi)} x2={x(hi)} y1={M.t - 4} y2={M.t + geo.ih} stroke="var(--ink-2)" strokeWidth={1} />
              <circle cx={x(hi)} cy={y(series.s[hi])} r={4} fill="var(--supply)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={x(hi)} cy={y(series.d[hi])} r={4} fill="var(--demand)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      <Tip show={hi !== null} x={hi !== null ? x(hi) : 0} y={hi !== null ? Math.min(y(series.d[hi]), y(series.s[hi])) : 0} width={W}>
        {hi !== null && (
          <>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="font-medium text-ink">{month(months[hi], locale)}</span>
              {isFc && <span className="rounded bg-surface-2 px-1 text-[10px] font-medium text-muted">{t("common.forecast")}</span>}
            </div>
            <TipRow color="var(--demand)" dashed={isFc} value={int(series.d[hi])} label={t("common.demand")} />
            {isFc && (
              <div className="pl-[22px] text-[11px] text-muted tabular">
                {int(series.lo[hi - histLen])} – {int(series.hi[hi - histLen])} · {t("common.range")}
              </div>
            )}
            <TipRow color="var(--supply)" dashed={isFc} value={int(series.s[hi])} label={t("common.supply")} />
            <div className="mt-1.5 border-t border-line pt-1.5">
              <ClassChip score={scoreOf(series.d[hi], series.s[hi])} className="text-xs" />
            </div>
          </>
        )}
      </Tip>
    </div>
  );
}

/** A tiny demand trace for tables and tiles. History in grey, forecast in the demand colour. */
export function Sparkline({ values, histLen, width = 84, height = 26 }: { values: number[]; histLen: number; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = Math.max(max - min, max * 0.05, 1);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 6);
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
  const path = line<number>().x((_, i) => x(i)).y((v) => y(v));
  const hist = path(values.slice(0, histLen))!;
  const fc = line<number>().x((_, i) => x(histLen - 1 + i)).y((v) => y(v))(values.slice(histLen - 1))!;
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <path d={hist} fill="none" stroke="var(--line-strong)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={fc} fill="none" stroke="var(--demand)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.5} fill="var(--demand)" />
    </svg>
  );
}

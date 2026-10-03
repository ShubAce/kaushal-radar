"use client";

// Small figures used across screens: the balance meter, stat tiles, the class
// legend, ranked bars and the sector-by-place heat grid.
import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "./trend-chart";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { signed } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { CLASS_ORDER, classFill, classInk, classOf } from "@/lib/scale";

/** Where a place or trade sits between saturated (left) and acute shortage (right), now and next year. */
export function BalanceMeter({
  now, next, width = 128, showNumbers = true, wrap = false,
}: { now: number; next: number; width?: number; showNumbers?: boolean; wrap?: boolean }) {
  const { t } = useT();
  const pad = 7;
  const x = (s: number) => pad + ((Math.max(-100, Math.min(100, s)) + 100) / 200) * (width - 2 * pad);
  const label = `${t("common.score")}: ${signed(Math.round(now))} → ${signed(Math.round(next))} (${t(`cls.${classOf(next)}`)})`;
  return (
    <span className={cn("inline-flex items-center gap-x-2", wrap && "flex-wrap")} title={label}>
      <svg width={width} height={18} role="img" aria-label={label} className="shrink-0">
        <line x1={pad} x2={width - pad} y1={9} y2={9} stroke="var(--surface-3)" strokeWidth={4} strokeLinecap="round" />
        <line x1={width / 2} x2={width / 2} y1={3} y2={15} stroke="var(--axis)" strokeWidth={1} />
        <line x1={x(now)} x2={x(next)} y1={9} y2={9} stroke="var(--ink-2)" strokeWidth={1.5} />
        <circle cx={x(now)} cy={9} r={3.5} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.5} />
        <circle cx={x(next)} cy={9} r={5} fill={classFill(classOf(next))} stroke="var(--surface)" strokeWidth={2} />
      </svg>
      {showNumbers && (
        <span className="tabular whitespace-nowrap text-xs text-ink-2">
          {signed(Math.round(now))} <span aria-hidden className="text-muted">→</span>{" "}
          <span className="font-semibold text-ink">{signed(Math.round(next))}</span>
        </span>
      )}
    </span>
  );
}

export function StatTile({
  label, value, format, hint, Icon, spark, tone, className,
}: {
  label: string; value: number; format: (n: number) => string; hint?: ReactNode; Icon?: LucideIcon;
  spark?: { values: number[]; histLen: number }; tone?: "demand" | "supply"; className?: string;
}) {
  return (
    <Card className={cn("@container relative overflow-hidden p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
          {tone && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--${tone})` }} />}
          {label}
        </div>
        {Icon && <Icon aria-hidden className="h-4 w-4 text-muted" />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <CountUp value={value} format={format} className="whitespace-nowrap text-[26px] font-semibold leading-8 tracking-tight text-ink" />
        {spark && <span className="hidden @[13rem]:block"><Sparkline values={spark.values} histLen={spark.histLen} /></span>}
      </div>
      {hint && <div className="mt-1 text-xs leading-5 text-muted">{hint}</div>}
    </Card>
  );
}

/** The five ordered classes, cool (more supply) to warm (more demand). */
export function ScaleLegend({ className, counts }: { className?: string; counts?: Record<string, number> }) {
  const { t } = useT();
  return (
    <div className={cn("text-xs text-ink-2", className)}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        {CLASS_ORDER.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5" title={t(`clsHelp.${c}`)}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: classFill(c) }} />
            {t(`cls.${c}`)}
            {counts && <span className="tabular text-muted">{counts[c] ?? 0}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarRow { key: string; label: ReactNode; sub?: ReactNode; value: number; display: string; href?: string; color: string }

/** Ranked horizontal bars: thin, rounded at the data end, value at the tip. */
export function BarRows({ rows, className, max: fixedMax }: { rows: BarRow[]; className?: string; max?: number }) {
  const max = fixedMax ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ol className={cn("space-y-0.5", className)}>
      {rows.map((r, i) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] font-medium text-ink">{r.label}</span>
              <span className="tabular shrink-0 text-[13px] font-semibold text-ink">{r.display}</span>
            </div>
            {r.sub && <div className="truncate text-xs text-muted">{r.sub}</div>}
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-2">
              <motion.div
                className="h-1.5 rounded-r-full"
                style={{ background: r.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(2, (Math.abs(r.value) / max) * 100))}%` }}
                transition={{ duration: 0.6, delay: 0.04 * i, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <Link href={r.href} className="-mx-2 block rounded-lg px-2 py-2 transition-colors hover:bg-surface-2">{body}</Link>
            ) : (
              <div className="py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export interface MatrixCell { score: number; title: string; onSelect?: () => void; active?: boolean }

/** A heat grid of balance scores. Colour is the class; the number is the score. */
export function Matrix({
  rows, cols, cell, corner,
}: { rows: { id: string; label: string }[]; cols: { id: string; label: string }[]; cell: (r: string, c: string) => MatrixCell; corner?: string }) {
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th scope="col" className="px-1 pb-1 text-left text-xs font-medium text-muted">{corner}</th>
            {cols.map((c) => (
              <th key={c.id} scope="col" className="px-1 pb-1 text-center text-xs font-medium text-muted">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.id}>
              <th scope="row" className="w-[34%] min-w-[7.5rem] pr-2 text-left text-[12.5px] font-medium leading-4 text-ink">{r.label}</th>
              {cols.map((c, ci) => {
                const v = cell(r.id, c.id);
                const cls = classOf(v.score);
                return (
                  <td key={c.id} className="p-0">
                    <motion.button
                      type="button"
                      title={v.title}
                      onClick={v.onSelect}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.015 * (ri * cols.length + ci) }}
                      className={cn(
                        "tabular h-9 w-full min-w-12 rounded-md text-xs font-semibold transition-shadow hover:shadow-[0_0_0_2px_var(--ink)]",
                        v.active && "shadow-[0_0_0_2px_var(--ink)]",
                      )}
                      style={{ background: classFill(cls), color: classInk(cls) }}
                    >
                      {signed(Math.round(v.score))}
                    </motion.button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface PairRow { key: string; label: ReactNode; demand: number; supply: number; href?: string; note?: ReactNode }

/** Demand beside supply for a handful of places: two thin bars per row on one shared scale. */
export function PairBars({ rows, format }: { rows: PairRow[]; format: (n: number) => string }) {
  const max = Math.max(...rows.flatMap((r) => [r.demand, r.supply]), 1);
  const bar = (v: number, color: string, delay: number) => (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-2">
        <motion.div
          className="h-1.5 rounded-r-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${Math.max(1.5, (v / max) * 100)}%` }}
          transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="tabular w-14 shrink-0 text-right text-xs font-medium text-ink">{format(v)}</span>
    </div>
  );
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => {
        const body = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-ink">{r.label}</span>
              {r.note}
            </div>
            <div className="space-y-1">
              {bar(r.demand, "var(--demand)", 0.05 * i)}
              {bar(r.supply, "var(--supply)", 0.05 * i + 0.05)}
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? <Link href={r.href} className="-mx-2 block rounded-lg px-2 py-2 hover:bg-surface-2">{body}</Link> : <div className="py-2">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export interface DumbbellRow { key: string; label: ReactNode; before: number; after: number; display: ReactNode }

/** Before against after on one shared scale: a hollow dot for the draft, a filled dot for the recommendation. */
export function Dumbbell({ rows, beforeLabel, afterLabel }: { rows: DumbbellRow[]; beforeLabel: string; afterLabel: string }) {
  const max = Math.max(...rows.flatMap((r) => [r.before, r.after]), 1);
  const pos = (v: number) => `${4 + (v / max) * 92}%`;
  return (
    <ul className="space-y-0.5">
      {rows.map((r, i) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3 py-1.5">
          <span className="truncate text-[13px] font-medium text-ink">{r.label}</span>
          <span className="relative h-5" role="img" aria-label={`${beforeLabel} ${r.before}, ${afterLabel} ${r.after}`}>
            <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
            <motion.span
              className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
              style={{ background: "var(--brand)", opacity: 0.55, left: pos(Math.min(r.before, r.after)) }}
              initial={{ width: 0 }}
              animate={{ width: `${(Math.abs(r.after - r.before) / max) * 92}%` }}
              transition={{ duration: 0.5, delay: 0.03 * i, ease: [0.22, 1, 0.36, 1] }}
            />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-2 bg-surface" style={{ left: pos(r.before) }} />
            <motion.span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand"
              initial={{ left: pos(r.before) }} animate={{ left: pos(r.after) }}
              transition={{ duration: 0.5, delay: 0.03 * i, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
          <span className="tabular whitespace-nowrap text-right text-xs text-ink-2">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}

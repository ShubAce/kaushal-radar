"use client";

// Balance against a second measure (momentum or mismatch). Colour is the
// balance class, size is the size of the gap. Hover picks the nearest dot, so
// small dots are as easy to read as large ones.
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Tip, useSize } from "./base";
import { ClassChip } from "@/components/ui/badges";
import { signed } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { CUTS, scoreFill } from "@/lib/scale";

export interface QPoint { id: string; x: number; y: number; size: number; label: string; sub?: string; yText: string; href?: string }

const M = { l: 50, r: 18, t: 16, b: 40 };

export function Quadrant({
  points, xLabel, yLabel, yFormat, height = 380, onSelect, label,
}: {
  points: QPoint[]; xLabel: string; yLabel: string; yFormat: (v: number) => string; height?: number;
  onSelect?: (p: QPoint) => void; label: string;
}) {
  const { t } = useT();
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<QPoint | null>(null);

  const g = useMemo(() => {
    const W = Math.max(w, 320);
    const ys = points.map((p) => p.y);
    let y0 = Math.min(0, ...ys);
    let y1 = Math.max(0, ...ys);
    const span = y1 - y0 || 1;
    y0 -= span * 0.06;
    y1 += span * 0.08;
    const maxSize = Math.max(...points.map((p) => p.size), 1);
    const x = (v: number) => M.l + ((v + 100) / 200) * (W - M.l - M.r);
    const y = (v: number) => M.t + (1 - (v - y0) / (y1 - y0)) * (height - M.t - M.b);
    const r = (s: number) => 3.5 + 12 * Math.sqrt(s / maxSize);
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => (y1 - y0) / s <= 6) ?? 100;
    const yTicks: number[] = [];
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) yTicks.push(v);
    return { W, x, y, r, yTicks };
  }, [w, points, height]);

  const labelled = useMemo(() => [...points].sort((a, b) => b.size - a.size).slice(0, 4), [points]);
  const drawn = useMemo(() => [...points].sort((a, b) => b.size - a.size), [points]);       // big first, small on top

  function nearest(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * g.W;
    const py = e.clientY - rect.top;
    let best: QPoint | null = null;
    let bd = 34 ** 2;
    for (const p of points) {
      const d = (g.x(p.x) - px) ** 2 + (g.y(p.y) - py) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    setHover(best);
  }

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {w > 0 && (
        <svg
          width={g.W} height={height} role="img" aria-label={label} className="block overflow-visible"
          onPointerMove={nearest} onPointerLeave={() => setHover(null)}
          onClick={() => hover && onSelect?.(hover)} style={{ cursor: hover && onSelect ? "pointer" : undefined }}
        >
          {g.yTicks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={g.W - M.r} y1={g.y(v)} y2={g.y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
              <text x={M.l - 8} y={g.y(v)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">{yFormat(v)}</text>
            </g>
          ))}
          {[-100, -CUTS[1], -CUTS[0], 0, CUTS[0], CUTS[1], 100].map((v) => (
            <g key={v}>
              <line x1={g.x(v)} x2={g.x(v)} y1={M.t} y2={height - M.b} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
              <text x={g.x(v)} y={height - M.b + 15} textAnchor="middle" className="tabular fill-muted text-[11px]">{signed(v)}</text>
            </g>
          ))}
          <text x={M.l} y={height - 6} className="fill-muted text-[11px]">← {t("cls.moreSupply")}</text>
          <text x={g.W - M.r} y={height - 6} textAnchor="end" className="fill-muted text-[11px]">{t("cls.moreDemand")} →</text>
          <text x={(M.l + g.W - M.r) / 2} y={height - 6} textAnchor="middle" className="fill-ink-2 text-[11px] font-medium">{xLabel}</text>
          <text transform={`translate(12 ${(M.t + height - M.b) / 2}) rotate(-90)`} textAnchor="middle" className="fill-ink-2 text-[11px] font-medium">{yLabel}</text>

          {drawn.map((p, i) => (
            <motion.circle
              key={p.id}
              cx={g.x(p.x)} cy={g.y(p.y)}
              fill={scoreFill(p.x)} stroke="var(--surface)" strokeWidth={1.5}
              initial={{ r: 0, opacity: 0 }}
              animate={{ r: g.r(p.size), opacity: hover && hover.id !== p.id ? 0.45 : 0.92 }}
              transition={{ r: { duration: 0.45, delay: Math.min(i * 0.004, 0.5) }, opacity: { duration: 0.15 } }}
            />
          ))}
          {hover && <circle cx={g.x(hover.x)} cy={g.y(hover.y)} r={g.r(hover.size) + 2.5} fill="none" stroke="var(--ink)" strokeWidth={1.5} pointerEvents="none" />}
          {labelled.map((p) => {
            const right = g.x(p.x) < g.W - 190;
            return (
              <text
                key={p.id} x={g.x(p.x) + (right ? g.r(p.size) + 5 : -g.r(p.size) - 5)} y={g.y(p.y)} dy="0.32em"
                textAnchor={right ? "start" : "end"} pointerEvents="none"
                className="fill-ink text-[11px] font-medium" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round"
              >
                {p.label.length > 30 ? `${p.label.slice(0, 29)}…` : p.label}
              </text>
            );
          })}
        </svg>
      )}
      <Tip show={!!hover} x={hover ? g.x(hover.x) : 0} y={hover ? g.y(hover.y) : 0} width={g.W}>
        {hover && (
          <>
            <div className="font-semibold text-ink">{hover.label}</div>
            {hover.sub && <div className="text-muted">{hover.sub}</div>}
            <div className="mt-1.5"><ClassChip score={hover.x} className="text-xs" /></div>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted">{xLabel}</dt>
              <dd className="tabular text-right font-medium text-ink">{signed(Math.round(hover.x))}</dd>
              <dt className="text-muted">{yLabel}</dt>
              <dd className="tabular text-right font-medium text-ink">{hover.yText}</dd>
              <dt className="text-muted">{t("common.gap")}</dt>
              <dd className="tabular text-right font-medium text-ink">{signed(Math.round(hover.size) * (hover.x >= 0 ? 1 : -1))}</dd>
            </dl>
          </>
        )}
      </Tip>
    </div>
  );
}

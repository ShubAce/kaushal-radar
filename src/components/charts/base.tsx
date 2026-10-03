"use client";

// Shared chart furniture: sizing, the tooltip, the legend, and the card that
// gives every chart a table-view twin (so no value is reachable only by hover).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChartLine, Download, Table2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { IconButton } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Floating readout. Lives inside a `relative` chart container and never takes pointer events. */
export function Tip({
  x, y, width, children, show,
}: { x: number; y: number; width: number; children: ReactNode; show: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(180);
  useEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth);
  }, [children]);
  if (!show) return null;
  const left = x + 14 + w > width ? Math.max(4, x - 14 - w) : x + 14;
  return (
    <div
      ref={ref}
      role="status"
      className="pointer-events-none absolute z-20 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop"
      style={{ left, top: Math.max(4, y - 12) }}
    >
      {children}
    </div>
  );
}

/** One tooltip row: a short stroke in the series colour, the value leading, the name following. */
export function TipRow({ color, value, label, dashed }: { color?: string; value: ReactNode; label: ReactNode; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color && (
        <span
          aria-hidden
          className="inline-block h-0 w-3.5 shrink-0 border-t-2"
          style={{ borderColor: color, borderTopStyle: dashed ? "dashed" : "solid" }}
        />
      )}
      <span className="tabular font-semibold text-ink">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

export function LegendItem({ color, label, kind = "line" }: { color: string; label: ReactNode; kind?: "line" | "dash" | "band" | "box" | "dot" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      {kind === "band" ? (
        <span aria-hidden className="h-2.5 w-4 rounded-sm" style={{ background: color, opacity: 0.22 }} />
      ) : kind === "box" ? (
        <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      ) : kind === "dot" ? (
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      ) : (
        <span aria-hidden className="h-0 w-4 border-t-2" style={{ borderColor: color, borderTopStyle: kind === "dash" ? "dashed" : "solid" }} />
      )}
      {label}
    </span>
  );
}

export interface TableSpec {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
  filename?: string;
}

function toCsv(t: TableSpec): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [t.columns.map((c) => esc(c.label)).join(","), ...t.rows.map((r) => t.columns.map((c) => esc(r[c.key] ?? "")).join(","))].join("\n");
}

export function downloadCsv(t: TableSpec) {
  const blob = new Blob(["﻿" + toCsv(t)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${t.filename ?? "kaushal-radar"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable({ table, className, maxHeight = 320 }: { table: TableSpec; className?: string; maxHeight?: number }) {
  return (
    <div className={cn("overflow-auto scroll-thin", className)} style={{ maxHeight }}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-surface">
          <tr>
            {table.columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn("border-b border-line px-3 py-2 text-xs font-medium text-muted", c.align === "right" ? "text-right" : "text-left")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {table.columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-1.5 text-ink", c.align === "right" && "text-right tabular")}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A card holding a chart, with a switch to the same data as a table and a CSV download. */
export function ChartCard({
  title, subtitle, legend, table, children, className, actions, bodyClassName,
}: {
  title: ReactNode; subtitle?: ReactNode; legend?: ReactNode; table?: TableSpec; children: ReactNode;
  className?: string; actions?: ReactNode; bodyClassName?: string;
}) {
  const { t } = useT();
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            {table && (
              <>
                <IconButton
                  label={asTable ? t("common.showChart") : t("common.showTable")}
                  aria-pressed={asTable}
                  active={asTable}
                  onClick={() => setAsTable((v) => !v)}
                  className="h-8 w-8"
                >
                  {asTable ? <ChartLine className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
                </IconButton>
                <IconButton label={t("common.downloadCsv")} onClick={() => downloadCsv(table)} className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </IconButton>
              </>
            )}
          </>
        }
      />
      {legend && !asTable && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-2.5">{legend}</div>}
      <div className={cn("flex-1 px-5 pb-4 pt-3", bodyClassName)}>
        {asTable && table ? <DataTable table={table} className="-mx-3" /> : children}
      </div>
    </Card>
  );
}

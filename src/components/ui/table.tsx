"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "./controls";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

export interface Col<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Value to sort by. Omit for a column that cannot be sorted. */
  sort?: (row: T) => number | string;
  align?: "left" | "right";
  title?: string;
  className?: string;
}

/** A sortable table. Rows can be links; long tables open a page at a time. */
export function SortTable<T>({
  rows, cols, rowKey, rowHref, onRow, selected, initial, pageSize = 12, className, dense,
}: {
  rows: T[]; cols: Col<T>[]; rowKey: (row: T) => string; rowHref?: (row: T) => string | undefined;
  /** Select a row in place instead of navigating. */
  onRow?: (row: T) => void; selected?: (row: T) => boolean;
  initial?: { key: string; dir: "asc" | "desc" }; pageSize?: number; className?: string; dense?: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [sort, setSort] = useState(initial);
  const [shown, setShown] = useState(pageSize);

  const sorted = useMemo(() => {
    const col = cols.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = col.sort!(a);
      const y = col.sort!(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign;
    });
  }, [rows, cols, sort]);

  const visible = sorted.slice(0, shown);
  return (
    <div className={className}>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {cols.map((c) => {
                const on = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    title={c.title}
                    aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("whitespace-nowrap border-b border-line px-3 py-2 text-xs font-medium text-muted", c.align === "right" ? "text-right" : "text-left", c.className)}
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => setSort({ key: c.key, dir: on && sort!.dir === "desc" ? "asc" : "desc" })}
                        className={cn("inline-flex items-center gap-1 rounded hover:text-ink", on && "text-ink", c.align === "right" && "flex-row-reverse")}
                      >
                        {c.header}
                        {on ? (sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <span className="w-3" />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const href = rowHref?.(r);
              const on = selected?.(r);
              const act = onRow ? () => onRow(r) : href ? () => router.push(href) : undefined;
              return (
                <tr
                  key={rowKey(r)}
                  onClick={act}
                  tabIndex={onRow ? 0 : undefined}
                  aria-selected={onRow ? !!on : undefined}
                  onKeyDown={onRow ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRow(r)) : undefined}
                  className={cn("border-b border-line last:border-0", act && "cursor-pointer transition-colors hover:bg-surface-2", on && "bg-brand-soft hover:bg-brand-soft")}
                >
                  {cols.map((c) => (
                    <td key={c.key} className={cn("px-3 text-ink", dense ? "py-1.5" : "py-2.5", c.align === "right" && "text-right tabular", c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-muted">{t("common.empty")}</p>}
      {sorted.length > shown && (
        <div className="mt-2 flex items-center justify-between px-3">
          <span className="text-xs text-muted">{t("rank.showing", { n: visible.length, total: sorted.length })}</span>
          <Button size="sm" variant="ghost" onClick={() => setShown((n) => n + pageSize * 2)}>{t("common.viewAll")}</Button>
        </div>
      )}
    </div>
  );
}

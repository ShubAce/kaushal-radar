"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { BalanceMeter } from "@/components/charts/bits";
import { Sparkline } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/shell/console-shell";
import { Badge, ClassChip } from "@/components/ui/badges";
import { cn } from "@/lib/cn";
import { compact, signedPct } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import type { Meta, TradeRow } from "@/lib/types";

export function TradesView({ meta, rows, sparks }: { meta: Meta; rows: TradeRow[]; sparks: Record<string, number[]> }) {
  const { t } = useT();
  const ref = useRefData();
  const [sector, setSector] = useState<string>("");
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ref.sectors
      .filter((s) => !sector || s.id === sector)
      .map((s) => ({
        sector: s,
        rows: rows.filter((r) => {
          const tr = ref.trade(r.trade)!;
          return tr.sector === s.id && (!needle || `${tr.name} ${tr.hi} ${tr.nco} ${tr.ncoTitle} ${tr.qp ?? ""}`.toLowerCase().includes(needle));
        }),
      }))
      .filter((g) => g.rows.length > 0);
  }, [rows, sector, q, ref]);

  return (
    <div>
      <PageHeader
        title={t("trade.listTitle")}
        subtitle={t("trade.listSub", { n: meta.counts.trades, s: meta.counts.sectors })}
        actions={
          <label className="relative">
            <span className="sr-only">{t("common.search")}</span>
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
            <input
              type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")}
              className="h-9 w-56 rounded-lg border border-line-strong bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-muted"
            />
          </label>
        }
      />

      <div role="tablist" aria-label={t("trade.filterSector")} className="no-print mb-5 flex flex-wrap gap-1.5">
        {[{ id: "", name: t("common.allSectors") }, ...ref.sectors.map((s) => ({ id: s.id, name: ref.sectorName(s.id) }))].map((s) => (
          <button
            key={s.id} type="button" role="tab" aria-selected={sector === s.id} onClick={() => setSector(s.id)}
            className={cn(
              "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
              sector === s.id ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="py-16 text-center text-sm text-muted">{t("common.empty")}</p>}

      <div className="space-y-7">
        {groups.map(({ sector: s, rows: list }) => (
          <section key={s.id} aria-labelledby={`sec-${s.id}`}>
            <div className="mb-2.5 flex items-baseline gap-2">
              <h2 id={`sec-${s.id}`} className="text-[15px] font-semibold text-ink">{ref.sectorName(s.id)}</h2>
              <span className="text-xs text-muted">{s.ssc}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((r, i) => {
                const tr = ref.trade(r.trade)!;
                return (
                  <motion.div
                    key={r.trade}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03 }}
                  >
                    <Link
                      href={`/trades/${r.trade}`}
                      className="group block h-full rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-line"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold leading-5 text-ink group-hover:text-brand">{ref.tradeName(r.trade)}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            <span className="font-mono text-[11px]">NCO {tr.nco}</span>
                            <span aria-hidden>·</span>
                            <span>NSQF {tr.nsqf}</span>
                            <span aria-hidden>·</span>
                            <span>{tr.kind === "ITI" ? t("common.iti") : t("common.stt")}</span>
                            {tr.emerging && <Badge tone="brand">{t("common.emerging")}</Badge>}
                          </div>
                        </div>
                        <Sparkline values={sparks[r.trade]} histLen={meta.histLen} width={72} height={28} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <ClassChip score={r.s1} />
                        <BalanceMeter now={r.s0} next={r.s1} width={100} />
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                        <div>
                          <dt className="text-muted">{t("common.demand")}</dt>
                          <dd className="tabular mt-0.5 text-sm font-semibold text-ink">{compact(r.dx)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">{t("common.supply")}</dt>
                          <dd className="tabular mt-0.5 text-sm font-semibold text-ink">{compact(r.sx)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">{t("dash.colMomentum")}</dt>
                          <dd className="tabular mt-0.5 text-sm font-semibold text-ink">{signedPct(r.mom)}</dd>
                        </div>
                      </dl>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

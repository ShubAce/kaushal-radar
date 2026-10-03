"use client";

import { BadgeCheck, FileCheck, FlaskConical, PencilRuler, type LucideIcon } from "lucide-react";
import { StatTile } from "@/components/charts/bits";
import { PageHeader } from "@/components/shell/console-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Reveal } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { compact, int } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { REGISTRY, SCHEMAS, type SourceStatus } from "@/lib/registry";
import type { Meta, Method } from "@/lib/types";

const STATUS: Record<SourceStatus, { Icon: LucideIcon; cls: string }> = {
  real: { Icon: BadgeCheck, cls: "bg-good-soft text-good-ink" },
  synthetic: { Icon: FlaskConical, cls: "bg-warning-soft text-warning-ink" },
  illustrative: { Icon: PencilRuler, cls: "bg-surface-2 text-ink-2" },
  supplied: { Icon: FileCheck, cls: "bg-brand-soft text-brand" },
};

function Status({ status }: { status: SourceStatus }) {
  const { t } = useT();
  const { Icon, cls } = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold", cls)} title={t(`data.${status}Help` as Key)}>
      <Icon aria-hidden className="h-3 w-3" />
      {t(`data.${status}` as Key)}
    </span>
  );
}

export function DataView({ method, meta }: { method: Method; meta: Meta }) {
  const { t } = useT();
  const q = method.quality;
  // a source counts as supplied when the run read its input file
  const statusOf = (s: (typeof REGISTRY)[number]): SourceStatus => (s.file && meta.inputs.includes(s.file) ? "supplied" : s.status);
  // de-duplication happens before the input files, so there is nothing to report on supplied data
  const dup = q.portalDuplicateRate != null && q.portalRawPostings != null ? { rate: q.portalDuplicateRate, raw: q.portalRawPostings } : null;
  const legend: SourceStatus[] = meta.demo ? ["real", "synthetic", "illustrative"] : ["real", "supplied", "illustrative"];
  return (
    <div>
      <PageHeader title={t("data.title")} subtitle={t("data.subtitle")} />

      <div className="space-y-4">
        <Card className="border-brand-line bg-brand-soft">
          <div className="px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">{t(meta.demo ? "data.honestTitle" : "data.suppliedTitle")}</h2>
            <p className="mt-1 max-w-4xl text-[13px] leading-[1.6] text-ink-2">
              {meta.demo ? t("data.honestBody") : t("data.suppliedBody", { n: meta.inputs.length, files: meta.inputs.join(", ") })}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-2">
              {legend.map((s) => (
                <span key={s} className="inline-flex items-center gap-2"><Status status={s} />{t(`data.${s}Help` as Key)}</span>
              ))}
            </div>
          </div>
        </Card>

        <div className={cn("grid grid-cols-2 gap-3", dup ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          <StatTile label={t("data.recordsTitle")} value={meta.counts.records} format={compact} hint={method.sources.map((s) => `${t(`src.${s.id}` as Key)}: ${compact(s.records)}`).join(" · ")} />
          {dup && <StatTile label={t("data.q1")} value={dup.rate * 100} format={(n) => `${n.toFixed(0)}%`} hint={`${compact(dup.raw)} → ${compact(dup.raw * (1 - dup.rate))}`} />}
          <StatTile label={t("data.q2")} value={q.ncsSpikesDamped} format={int} hint={t("data.q2hint")} />
          <StatTile label={t("data.q3")} value={q.payrollLagMonths} format={int} hint={`${t("data.q4")}: ${q.benchmarkYears.map((y) => `${y - 1}-${String(y).slice(2)}`).join(", ")}`} />
        </div>

        <Card>
          <div className="overflow-x-auto px-2 py-2 scroll-thin">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {(["data.colSource", "data.colStatus", "data.colGrain", "data.colFreq", "data.colAccess"] as Key[]).map((k) => (
                    <th key={k} scope="col" className="border-b border-line px-3 py-2.5 text-left text-xs font-medium text-muted">{t(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REGISTRY.map((s) => (
                  <tr key={s.name} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="min-w-[13rem] px-3 py-3 text-left">
                      <div className="font-medium text-ink">{s.name}</div>
                      <div className="mt-0.5 text-xs font-normal leading-[1.45] text-muted">{s.role}</div>
                    </th>
                    <td className="px-3 py-3"><Status status={statusOf(s)} /></td>
                    <td className="min-w-[10rem] px-3 py-3 text-ink-2">{s.grain}</td>
                    <td className="min-w-[8rem] px-3 py-3 text-ink-2">{s.refresh}</td>
                    <td className="min-w-[18rem] px-3 py-3 leading-[1.5] text-ink-2">{s.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Reveal>
          <Card>
            <CardHeader title={t("data.schemaTitle")} subtitle={t("data.schemaSub")} />
            <div className="grid grid-cols-1 gap-3 px-5 pb-5 pt-3 md:grid-cols-2 xl:grid-cols-3">
              {SCHEMAS.map((s) => (
                <div key={s.file} className="rounded-xl border border-line p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="font-mono text-[13px] font-semibold text-ink">{s.file}</span>
                    {s.optional && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{t("data.optional")}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{s.purpose}</p>
                  <dl className="mt-2.5 space-y-1">
                    {s.columns.map(([name, note]) => (
                      <div key={name} className="flex items-baseline gap-2 text-xs">
                        <dt className="font-mono text-ink">{name}</dt>
                        {note && <dd className="text-muted">{note}</dd>}
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-5 py-3">
              <code className="block font-mono text-xs leading-6 text-ink-2">
                python pipeline/run.py --export-inputs pipeline/inputs<br />
                python pipeline/run.py --inputs pipeline/inputs
              </code>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

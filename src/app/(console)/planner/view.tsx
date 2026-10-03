"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Download, FileSpreadsheet, RotateCcw, Shuffle, Target, Users } from "lucide-react";
import { downloadCsv } from "@/components/charts/base";
import { Dumbbell, StatTile } from "@/components/charts/bits";
import { PageHeader } from "@/components/shell/console-shell";
import { Confidence } from "@/components/ui/badges";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, Segmented, Select, Switch } from "@/components/ui/controls";
import { SortTable, type Col } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { compact, int, pct, signed, signedPct } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { applyBudget, type BudgetMode, type PlannedRow } from "@/lib/plan";
import { useRefData } from "@/lib/ref";
import type { PlanReason, PlanRow } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface ApiRow {
  district: string; trade: string; seatsDraft: number; seatsNeeded: number; seatsRecommended: number;
  demandAtGraduation: number; seatToEntrantYield: number; reasonCode: PlanReason; confidence: "low" | "medium" | "high"; scoreNext: number;
}
const CONF = { low: 0, medium: 1, high: 2 } as const;
const keyOf = (r: { district: string; trade: string }) => `${r.district}|${r.trade}`;
const NO_EDITS: Record<string, number> = {};

export function PlannerView({ initialState }: { initialState: string }) {
  const { t } = useT();
  const ref = useRefData();
  const fy = ref.meta.planFY;
  const [state, setState] = useState(initialState);
  const [mode, setMode] = useState<BudgetMode>("neutral");
  const [sector, setSector] = useState("");
  const [district, setDistrict] = useState("");
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [edits, setEdits] = useState<Record<string, Record<string, number>>>({});
  const overrides = edits[state] ?? NO_EDITS;

  // The unconstrained recommendation comes from the API; the budget and any edits are applied here.
  const { data, loading } = useApi<{ rows: ApiRow[] }>(`/api/v1/plan?state=${state}&budget=free`);
  const base = useMemo<PlanRow[]>(
    () => (data?.rows ?? []).map((r) => ({
      district: r.district, trade: r.trade, draft: r.seatsDraft, need: r.seatsNeeded, rec: r.seatsRecommended,
      conv: r.seatToEntrantYield, demand: r.demandAtGraduation, reason: r.reasonCode, conf: CONF[r.confidence], score: r.scoreNext,
    })),
    [data],
  );
  const { rows, summary } = useMemo(() => applyBudget(base, mode, overrides), [base, mode, overrides]);

  const byTrade = useMemo(() => {
    const m = new Map<string, { before: number; after: number }>();
    for (const r of rows) {
      const e = m.get(r.trade) ?? { before: 0, after: 0 };
      e.before += r.draft;
      e.after += r.final;
      m.set(r.trade, e);
    }
    return [...m.entries()].sort((a, b) => Math.abs(b[1].after - b[1].before) - Math.abs(a[1].after - a[1].before)).slice(0, 14);
  }, [rows]);

  const visible = useMemo(
    () => rows.filter((r) =>
      (!sector || ref.trade(r.trade)!.sector === sector) && (!district || r.district === district) && (!onlyChanges || r.final !== r.draft || r.edited)),
    [rows, sector, district, onlyChanges, ref],
  );

  const setEdit = (r: PlannedRow, v: number | null) =>
    setEdits((all) => {
      const mine = { ...(all[state] ?? {}) };
      if (v === null) delete mine[keyOf(r)];
      else mine[keyOf(r)] = v;
      return { ...all, [state]: mine };
    });

  const cols: Col<PlannedRow>[] = [
    { key: "district", header: t("common.district"), sort: (r) => ref.districtName(r.district), cell: (r) => <span className="font-medium">{ref.districtName(r.district)}</span> },
    {
      key: "trade", header: t("common.trade"), sort: (r) => ref.tradeName(r.trade),
      cell: (r) => (
        <div className="min-w-[11rem]">
          <div className="font-medium">{ref.tradeName(r.trade)}</div>
          <div className="text-xs text-muted">{ref.sectorName(ref.trade(r.trade)!.sector)}</div>
        </div>
      ),
    },
    { key: "draft", header: t("plan.colDraft"), align: "right", sort: (r) => r.draft, cell: (r) => int(r.draft) },
    { key: "need", header: t("plan.colNeed"), title: t("plan.needHelp"), align: "right", sort: (r) => r.need, cell: (r) => <span className="text-ink-2">{int(r.need)}</span> },
    {
      key: "rec", header: t("plan.colRec"), align: "right", sort: (r) => r.final,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {r.edited && (
            <button type="button" title={t("plan.resetEdits")} aria-label={t("plan.resetEdits")} onClick={() => setEdit(r, null)} className="rounded p-0.5 text-muted hover:text-ink">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            type="number" min={0} step={5} value={r.final} aria-label={`${t("plan.override")}: ${ref.districtName(r.district)}, ${ref.tradeName(r.trade)}`}
            onChange={(e) => setEdit(r, Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className={cn(
              "tabular h-8 w-[5.5rem] rounded-md border bg-surface px-2 text-right text-[13px] font-semibold text-ink",
              r.edited ? "border-brand" : "border-line-strong",
            )}
          />
        </span>
      ),
    },
    {
      key: "delta", header: t("plan.colChange"), align: "right", sort: (r) => r.final - r.draft,
      cell: (r) => {
        const d = r.final - r.draft;
        return (
          <span className={cn("font-semibold", d === 0 && "font-normal text-muted")}>
            {signed(d)}
            {r.draft > 0 && d !== 0 && <span className="ml-1.5 text-xs font-normal text-muted">{signedPct((d / r.draft) * 100)}</span>}
          </span>
        );
      },
    },
    { key: "why", header: t("plan.colReason"), cell: (r) => <span className="text-ink-2">{r.edited ? t("plan.overridden") : t(`plan.r_${r.reason}` as Key)}</span> },
    { key: "conf", header: t("common.confidence"), sort: (r) => r.conf, cell: (r) => <Confidence level={r.conf} /> },
  ];

  const exportCsv = () =>
    downloadCsv({
      filename: `kaushal-radar-target-sheet-${state}-FY${fy}`,
      columns: [
        { key: "district", label: "District" }, { key: "trade", label: "Trade" }, { key: "sector", label: "Sector" }, { key: "nco", label: "NCO-2015" },
        { key: "draft", label: "Draft seats" }, { key: "need", label: "Seats needed" }, { key: "final", label: "Recommended seats" },
        { key: "change", label: "Change" }, { key: "why", label: "Why" }, { key: "conf", label: "Confidence" },
      ],
      rows: rows.map((r) => ({
        district: ref.districtName(r.district), trade: ref.trade(r.trade)!.name, sector: ref.trade(r.trade)!.sector, nco: ref.trade(r.trade)!.nco,
        draft: r.draft, need: r.need, final: r.final, change: r.final - r.draft,
        why: r.edited ? "Edited by planner" : t(`plan.r_${r.reason}` as Key), conf: ["low", "medium", "high"][r.conf],
      })),
    });

  const districts = ref.districts.filter((d) => d.state === state);
  const nEdits = Object.keys(overrides).length;

  return (
    <div>
      <PageHeader
        title={t("plan.title")}
        subtitle={t("plan.subtitle", { fy })}
        actions={
          <>
            <Button onClick={exportCsv} disabled={!data}><Download className="h-4 w-4" />{t("plan.exportCsv")}</Button>
            <a
              href={`/api/v1/plan?state=${state}&budget=${mode}&format=xlsx`}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-on-brand hover:bg-brand-hover"
            >
              <FileSpreadsheet className="h-4 w-4" />{t("plan.exportXlsx")}
            </a>
          </>
        }
      />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Select label={t("plan.state")} value={state} onChange={(e) => { setState(e.target.value); setDistrict(""); }}>
          {ref.states.map((x) => <option key={x.id} value={x.id}>{ref.stateName(x.id)}</option>)}
        </Select>
        <Segmented
          label={t("plan.budget")} value={mode} onChange={setMode}
          options={[
            { value: "neutral", label: t("plan.budgetNeutral") }, { value: "plus5", label: t("plan.budgetPlus5") },
            { value: "plus10", label: t("plan.budgetPlus10") }, { value: "free", label: t("plan.budgetFree") },
          ]}
        />
        {summary.scale < 0.999 && (
          <span className="rounded-lg bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-warning-ink" title={t("plan.budgetHelp")}>
            {t("plan.scaled", { n: Math.round(summary.scale * 100) })}
          </span>
        )}
        {nEdits > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setEdits((a) => ({ ...a, [state]: {} }))}>
            <RotateCcw className="h-3.5 w-3.5" />{t("plan.resetEdits")} ({nEdits})
          </Button>
        )}
      </div>

      <div className={cn("space-y-4 transition-opacity duration-200", loading && "opacity-60")} aria-busy={loading}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile Icon={Users} label={t("plan.kDraft")} value={summary.draft} format={compact} hint={t("plan.kDraftHint")} />
          <StatTile Icon={Target} label={t("plan.kRec")} value={summary.final} format={compact}
            hint={`${signed(summary.final - summary.draft, compact)} · ${t("plan.kMovedHint", { up: compact(summary.added), down: compact(summary.cut) })}`} />
          <StatTile Icon={Shuffle} label={t("plan.kMismatch")} value={summary.mismatchAfter * 100} format={(n) => pct(n, 1)}
            hint={<span className="inline-flex flex-wrap items-center gap-x-1.5">{t("plan.before")} {pct(summary.mismatchBefore * 100, 1)} <ArrowRight className="h-3 w-3" /> {pct(summary.mismatchAfter * 100, 1)}</span>} />
          <StatTile tone="demand" label={t("plan.kMatched")} value={summary.matchedAfter} format={compact}
            hint={<span className="inline-flex flex-wrap items-center gap-x-1.5">{t("plan.before")} {compact(summary.matchedBefore)} <ArrowRight className="h-3 w-3" /> {compact(summary.matchedAfter)} · {t("common.of")} {compact(summary.demand)}</span>} />
        </div>

        <Card>
          <CardHeader title={t("plan.byTrade")} subtitle={t("plan.byTradeSub")} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-2.5 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-ink-2 bg-surface" />{t("plan.before")}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" />{t("plan.after")}</span>
          </div>
          <div className="px-5 pb-4 pt-2">
            {data ? (
              <Dumbbell
                beforeLabel={t("plan.before")} afterLabel={t("plan.after")}
                rows={byTrade.map(([id, v]) => ({
                  key: id, label: ref.tradeName(id), before: v.before, after: v.after,
                  display: <>{compact(v.before)} → <b className="text-ink">{compact(v.after)}</b> <span className="text-muted">({signedPct(v.before ? ((v.after - v.before) / v.before) * 100 : 100)})</span></>,
                }))}
              />
            ) : <div className="skeleton h-72" />}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t("plan.rows")}
            subtitle={`${t("rank.showing", { n: int(Math.min(visible.length, 15)), total: int(visible.length) })} · ${t("plan.limits", { up: 40, down: 30 })}`}
            actions={
              <>
                <Select label={t("common.district")} value={district} onChange={(e) => setDistrict(e.target.value)} className="max-w-[11rem]">
                  <option value="">{t("common.allDistricts")}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Select label={t("common.sector")} value={sector} onChange={(e) => setSector(e.target.value)} className="max-w-[12rem]">
                  <option value="">{t("common.allSectors")}</option>
                  {ref.sectors.map((x) => <option key={x.id} value={x.id}>{ref.sectorName(x.id)}</option>)}
                </Select>
                <div className="w-40"><Switch label={t("plan.onlyChanges")} checked={onlyChanges} onChange={setOnlyChanges} /></div>
              </>
            }
          />
          <div className="px-2 pb-3 pt-2">
            {data ? (
              <SortTable rows={visible} cols={cols} rowKey={keyOf} initial={{ key: "delta", dir: "desc" }} pageSize={15} dense />
            ) : (
              <div className="space-y-2 p-3">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-9" />)}</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

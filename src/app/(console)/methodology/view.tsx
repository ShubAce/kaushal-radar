"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Ban } from "lucide-react";
import { ChartCard, LegendItem } from "@/components/charts/base";
import { BarRows } from "@/components/charts/bits";
import { Flow } from "@/components/flow";
import { PageHeader } from "@/components/shell/console-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Reveal } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { int, month } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import { CLASS_ORDER, classFill, CUTS, ratioAt, SCORE_K } from "@/lib/scale";
import type { Method } from "@/lib/types";

const QUIET = "color-mix(in oklab, var(--ink-2) 42%, var(--surface))";
const pc = (v: number, d = 0) => (v * 100).toFixed(d);

function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20">
      <Reveal>
        <h2 id={`${id}-h`} className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {lead && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-ink-2">{lead}</p>}
      </Reveal>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Each source's share of the final estimate, by sector: stacked bars with a gap between segments. */
function Weights({ method }: { method: Method }) {
  const ref = useRefData();
  return (
    <ul className="space-y-1.5">
      {ref.sectors.map((sec, ri) => (
        <li key={sec.id} className="grid grid-cols-[minmax(0,10.5rem)_1fr] items-center gap-3">
          <span className="truncate text-[13px] text-ink">{ref.sectorName(sec.id)}</span>
          <span className="flex h-6 gap-0.5" role="img" aria-label={method.sources.map((s) => `${s.name} ${pc(s.weight[sec.id])}%`).join(", ")}>
            {method.sources.map((s, k) => {
              const w = s.weight[sec.id];
              return (
                <motion.span
                  key={s.id}
                  title={`${s.name}: ${pc(w)}%`}
                  className={cn("flex items-center justify-center overflow-hidden text-[11px] font-semibold tabular", k === 0 && "rounded-l", k === method.sources.length - 1 && "rounded-r")}
                  style={{ background: `var(--series-${k + 1})`, color: `var(--on-series-${k + 1})` }}
                  initial={{ flexGrow: 0 }} whileInView={{ flexGrow: w }} viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.03 * ri, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w >= 0.11 ? `${pc(w)}%` : ""}
                </motion.span>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The score as a function of the demand-to-supply ratio, with the five classes as bands. */
function ScoreCurve() {
  const { t } = useT();
  const W = 520, H = 250, m = { l: 44, r: 16, t: 14, b: 38 };
  const lo = Math.log(0.2), hi = Math.log(5);
  const x = (r: number) => m.l + ((Math.log(r) - lo) / (hi - lo)) * (W - m.l - m.r);
  const y = (s: number) => m.t + (1 - (s + 100) / 200) * (H - m.t - m.b);
  const pts = Array.from({ length: 81 }, (_, i) => Math.exp(lo + ((hi - lo) * i) / 80));
  const path = pts.map((r, i) => `${i ? "L" : "M"}${x(r).toFixed(1)},${y(100 * Math.tanh(SCORE_K * Math.log(r))).toFixed(1)}`).join("");
  const edges = [-100, -CUTS[1], -CUTS[0], CUTS[0], CUTS[1], 100];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("method.scoreChartTitle")} className="w-full max-w-[560px]">
      {CLASS_ORDER.map((c, i) => (
        <g key={c}>
          <rect x={m.l} y={y(edges[i + 1])} width={W - m.l - m.r} height={y(edges[i]) - y(edges[i + 1]) - 2} fill={classFill(c)} opacity={0.5} rx={3} />
          <text x={W - m.r - 8} y={(y(edges[i]) + y(edges[i + 1])) / 2} dy="0.32em" textAnchor="end" className="fill-ink text-[11px] font-medium">{t(`cls.${c}`)}</text>
        </g>
      ))}
      {[-100, -CUTS[1], -CUTS[0], 0, CUTS[0], CUTS[1], 100].map((s) => (
        <text key={s} x={m.l - 8} y={y(s)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[10.5px]">{s > 0 ? `+${s}` : s}</text>
      ))}
      {[0.2, 1 / ratioAt(CUTS[1]), 1 / ratioAt(CUTS[0]), 1, ratioAt(CUTS[0]), ratioAt(CUTS[1]), 5].map((r) => (
        <g key={r}>
          <line x1={x(r)} x2={x(r)} y1={H - m.b} y2={H - m.b + 4} stroke="var(--axis)" />
          <text x={x(r)} y={H - m.b + 16} textAnchor="middle" className="tabular fill-muted text-[10.5px]">{r >= 1 ? `${r.toFixed(r === 1 || r === 5 ? 0 : 2)}×` : `1/${(1 / r).toFixed(r === 0.2 ? 0 : 2)}`}</text>
        </g>
      ))}
      <line x1={x(1)} x2={x(1)} y1={m.t} y2={H - m.b} stroke="var(--axis)" strokeWidth={1} />
      {/* tanh and log differ in the last digit between server and browser; the 0.1px difference is harmless */}
      <motion.path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" suppressHydrationWarning
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: "easeOut" }} />
      <text x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle" className="fill-ink-2 text-[11px] font-medium">{t("method.scoreX")}</text>
    </svg>
  );
}

/** Forecast error, the model beside the baseline, for one level of the hierarchy. */
function Backtest({ title, naive, model, horizons }: { title: string; naive: Record<string, number>; model: Record<string, number>; horizons: number[] }) {
  const { t } = useT();
  const max = Math.max(...horizons.flatMap((h) => [naive[h], model[h]]));
  const top = Math.ceil((max * 100) / 5) * 5;
  const H = 150;
  return (
    <div>
      <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
      <div className="mt-2 flex items-end gap-5" style={{ height: H + 34 }}>
        {horizons.map((h, i) => {
          const cut = Math.round((1 - model[h] / naive[h]) * 100);
          return (
            <div key={h} className="flex flex-1 flex-col items-center">
              <div className="flex items-end gap-1.5" style={{ height: H }}>
                {[[naive[h], QUIET], [model[h], "var(--brand)"]].map(([v, color], k) => (
                  <div key={k} className="flex flex-col items-center justify-end" style={{ height: H }}>
                    <span className="tabular mb-1 text-[11px] font-semibold text-ink">{pc(v as number, 1)}</span>
                    <motion.div
                      className="w-5 rounded-t" style={{ background: color as string }}
                      initial={{ height: 0 }} whileInView={{ height: ((v as number) * 100 / top) * (H - 22) }} viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.06 * i + 0.05 * k, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 w-full border-t border-line pt-1 text-center text-[11px] leading-4 text-muted">
                {t("method.btHorizon", { n: h })}
                <div className="font-medium text-ink-2">{cut >= 0 ? t("method.btLower", { n: cut }) : t("method.btHigher", { n: -cut })}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MethodView({ method }: { method: Method }) {
  const { t, locale } = useT();
  const ref = useRefData();
  const bt = method.backtest;
  const rec = method.recovery;
  const steps: [Key, Key, Record<string, string | number>?][] = [
    ["method.s1", "method.s1d", { n: int(method.quality.ncsSpikesDamped) }], ["method.s2", "method.s2d"], ["method.s3", "method.s3d"],
    ["method.s4", "method.s4d"], ["method.s5", "method.s5d"],
  ];
  const group = (k: "fast" | "stable") => ({
    naive: Object.fromEntries(Object.entries(bt.byGroup[k]).map(([h, v]) => [h, v.naive])),
    model: Object.fromEntries(Object.entries(bt.byGroup[k]).map(([h, v]) => [h, v.model])),
  });
  const bands18 = bt.bands.district[bt.bands.district.length - 1];
  const sizeLabel = (i: number) => {
    const e = bt.bands.sizeEdges;
    return i === 0 ? t("method.bandUnder", { n: e[0] }) : i === e.length ? t("method.bandOver", { n: e[e.length - 1] }) : `${e[i - 1]}–${e[i]}`;
  };

  return (
    <div>
      <PageHeader title={t("method.title")} subtitle={t("method.subtitle")} />

      <div className="space-y-10">
        <Section id="flow" title={t("method.flowTitle")}>
          <Flow />
        </Section>

        <Section id="index" title={t("method.indexTitle")} lead={t("method.indexLead")}>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {steps.map(([a, b, vars], i) => (
              <Reveal key={a} delay={i * 0.05}>
                <li className="h-full rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <div className="text-xs font-semibold text-brand">{t("method.step", { n: i + 1 })}</div>
                  <h3 className="mt-1 text-sm font-semibold text-ink">{t(a)}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-ink-2">{t(b, vars)}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title={t("method.coverageTitle")} subtitle={t("method.coverageSub")}
              table={{
                filename: "source-coverage",
                columns: [{ key: "s", label: t("common.source") }, { key: "mean", label: "Mean %", align: "right" }, { key: "min", label: "Min %", align: "right" }, { key: "max", label: "Max %", align: "right" }],
                rows: method.sources.map((s) => ({ s: s.name, mean: pc(s.coverage.mean, 1), min: pc(s.coverage.min, 1), max: pc(s.coverage.max, 1) })),
              }}
            >
              <BarRows
                max={1}
                rows={method.sources.map((s) => {
                  const byTrade = Object.values(s.coverageByTrade);
                  return {
                    key: s.id, label: t(`src.${s.id}` as Key), value: s.coverage.mean, display: `${pc(s.coverage.mean)}%`, color: QUIET,
                    sub: `${t("method.coverageRange", { min: pc(Math.min(...byTrade)), max: pc(Math.max(...byTrade)) })} · ${int(s.records)} ${t("data.recordsTitle").toLowerCase()}`,
                  };
                })}
              />
            </ChartCard>

            <ChartCard
              title={t("method.weightTitle")} subtitle={t("method.weightSub")}
              legend={method.sources.map((s, k) => <LegendItem key={s.id} kind="box" color={`var(--series-${k + 1})`} label={t(`src.${s.id}` as Key)} />)}
              table={{
                filename: "source-weights",
                columns: [{ key: "sec", label: t("common.sector") }, ...method.sources.map((s) => ({ key: s.id, label: `${s.name} %`, align: "right" as const }))],
                rows: ref.sectors.map((sec) => ({ sec: sec.name, ...Object.fromEntries(method.sources.map((s) => [s.id, pc(s.weight[sec.id], 1)])) })),
              }}
            >
              <Weights method={method} />
            </ChartCard>
          </div>

          <Card>
            <CardHeader title={t("method.tiltTitle")} subtitle={t("method.tiltSub")} />
            <div className="overflow-x-auto px-2 pb-3 pt-2 scroll-thin">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-line px-3 py-2 text-left text-xs font-medium text-muted">{t("common.source")}</th>
                    {ref.sectors.map((s) => <th key={s.id} scope="col" title={ref.sectorName(s.id)} className="border-b border-line px-2 py-2 text-right text-xs font-medium text-muted">{s.id}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {method.sources.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink">{t(`src.${s.id}` as Key)}</th>
                      {ref.sectors.map((sec) => {
                        const v = s.tilt[sec.id];
                        return <td key={sec.id} className={cn("tabular px-2 py-2 text-right", v === 0 ? "text-muted" : "font-semibold text-ink")}>{v === 0 ? "0" : v.toFixed(2)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>

        {(rec || method.placementCheck) && (
        <Section
          id="recovery"
          title={t(rec ? "method.recoveryTitle" : "method.placementTitle")}
          lead={rec ? t("method.recoverySub", { n: int(rec.cells) }) : undefined}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {rec && (
            <Card className="lg:col-span-2">
              <div className="px-5 py-4">
                <BarRows
                  max={Math.max(rec.portalOnly.wape, 0.4)}
                  rows={[
                    { key: "i", label: t("method.recIndex"), sub: t("method.recCorr", { n: rec.index.corr.toFixed(2) }), value: rec.index.wape, display: t("method.recErr", { n: pc(rec.index.wape, 1) }), color: "var(--brand)" },
                    { key: "s", label: t("method.recSimple"), sub: t("method.recCorr", { n: rec.simpleAverage.corr.toFixed(2) }), value: rec.simpleAverage.wape, display: t("method.recErr", { n: pc(rec.simpleAverage.wape, 1) }), color: QUIET },
                    { key: "p", label: t("method.recPortal"), sub: t("method.recCorr", { n: rec.portalOnly.corr.toFixed(2) }), value: rec.portalOnly.wape, display: t("method.recErr", { n: pc(rec.portalOnly.wape, 1) }), color: QUIET },
                  ]}
                />
                <p className="mt-2 text-xs leading-5 text-muted">{t("method.recNote")}</p>
              </div>
            </Card>
            )}
            {method.placementCheck && (
            <Card>
              <div className="px-5 py-4">
                {rec && <h3 className="text-sm font-semibold text-ink">{t("method.placementTitle")}</h3>}
                <p className="mt-1 text-[13px] leading-5 text-ink-2">{t("method.placementSub", { n: int(method.placementCheck.cells) })}</p>
                <div className="mt-3 text-[40px] font-semibold leading-none tracking-tight text-ink">{method.placementCheck.spearman.toFixed(2)}</div>
              </div>
            </Card>
            )}
          </div>
        </Section>
        )}

        <Section id="score" title={t("method.scoreTitle")} lead={t("method.scoreLead")}>
          <Card>
            <div className="grid grid-cols-1 items-center gap-6 px-5 py-5 lg:grid-cols-2">
              <div>
                <code className="block rounded-xl bg-surface-2 px-4 py-3 font-mono text-sm text-ink">{t("method.scoreFormula")}</code>
                <ul className="mt-4 space-y-2">
                  {[...CLASS_ORDER].reverse().map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-[13px]">
                      <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-[4px]" style={{ background: classFill(c) }} />
                      <span><b className="font-semibold text-ink">{t(`cls.${c}`)}</b> <span className="text-ink-2">· {t(`clsHelp.${c}`)}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-medium text-muted">{t("method.scoreChartTitle")}</h3>
                <ScoreCurve />
              </div>
            </div>
          </Card>
        </Section>

        <Section id="forecast" title={t("method.forecastTitle")} lead={t("method.forecastLead")}>
          <Card>
            <ol className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-5 md:grid-cols-2">
              {(["method.fc1", "method.fc2", "method.fc3", "method.fc4", "method.fc5"] as Key[]).map((k, i) => (
                <li key={k} className="flex gap-3 text-[13px] leading-5 text-ink-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">{i + 1}</span>
                  {t(k)}
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader
              title={t("method.backtestTitle")}
              subtitle={t("method.backtestSub", { origins: bt.origins.map((o) => month(o, locale)).join(", ") })}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-2.5">
              <LegendItem kind="box" color={QUIET} label={t("method.btNaive")} />
              <LegendItem kind="box" color="var(--brand)" label={t("method.btModel")} />
            </div>
            <div className="grid grid-cols-1 gap-x-10 gap-y-7 px-5 pb-5 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              <Backtest title={t("method.btTitleLevel", { level: t("method.btNational") })} naive={bt.naive.national} model={bt.model.national} horizons={bt.horizons} />
              <Backtest title={t("method.btTitleLevel", { level: t("method.btState") })} naive={bt.naive.state} model={bt.model.state} horizons={bt.horizons} />
              <Backtest title={t("method.btTitleLevel", { level: t("method.btDistrict") })} naive={bt.naive.district} model={bt.model.district} horizons={bt.horizons} />
              <Backtest title={t("method.btFast")} {...group("fast")} horizons={bt.horizons} />
              <Backtest title={t("method.btStable")} {...group("stable")} horizons={bt.horizons} />
              <p className="self-center rounded-xl bg-surface-2 p-4 text-[13px] leading-5 text-ink-2">{t("method.btTakeaway")}</p>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {bt.leadTest && (
            <Card>
              <div className="flex gap-3 px-5 py-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-critical-soft text-critical-ink"><Ban className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{t("method.rejectedTitle")}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-ink-2">
                    {t("method.rejectedBody", { n: bt.leadTest.flags, a: pc(bt.leadTest.without, 1), b: pc(bt.leadTest.with_signal, 1) })}
                  </p>
                </div>
              </div>
            </Card>
            )}
            <Card>
              <div className="px-5 py-4">
                <h3 className="text-sm font-semibold text-ink">{t("method.bandsTitle")}</h3>
                <p className="mt-1 text-[13px] leading-5 text-ink-2">{t("method.bandsBody")}</p>
                <table className="mt-3 w-full text-[13px]">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th scope="col" className="pb-1 text-left font-medium">{t("method.bandSize")}</th>
                      <th scope="col" className="pb-1 text-right font-medium">{t("method.bandRange")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bands18.map(([lo, hi], i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="tabular py-1.5 text-ink">{sizeLabel(i)}</td>
                        <td className="tabular py-1.5 text-right font-medium text-ink">{pc(lo)}% … +{pc(hi)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </Section>

        <Section id="limits" title={t("method.limitsTitle")}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <ul className="list-disc space-y-2 px-5 py-5 pl-9 text-[13px] leading-5 text-ink-2">
                {(["method.l1", "method.l2", "method.l3", "method.l4", "method.l5"] as Key[]).map((k) => <li key={k}>{t(k)}</li>)}
              </ul>
            </Card>
            <Card>
              <div className="px-5 py-5">
                <h3 className="text-sm font-semibold text-ink">{t("method.alignTitle")}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-ink-2">{t("method.alignBody")}</p>
                <Link href="/data" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                  {t("method.readSources")} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          </div>
        </Section>

        <Section id="params" title={t("method.paramsTitle")}>
          <Card>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
              {([
                [t("method.pScore"), method.params.scoreK],
                [t("method.pCuts"), `±${method.params.classCuts[0]}, ±${method.params.classCuts[1]}`],
                [t("method.pShrink"), method.params.shrinkK],
                [t("method.pUp"), `+${pc(method.params.planMaxUp)}%`],
                [t("method.pDown"), `−${pc(method.params.planMaxDown)}%`],
                [t("method.pBand"), `±${pc(method.params.planBand)}%`],
                ...Object.entries(method.params.funnel).map(([k, f]) => [
                  `${t("method.pFunnel")} · ${k === "ITI" ? t("common.iti") : t("common.stt")}`,
                  t("method.funnelLine", { util: pc(f.util), complete: pc(f.complete), certify: pc(f.certify), entry: pc(f.entry) }),
                ]),
              ] as [string, string | number][]).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="tabular mt-0.5 text-[13px] font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Section>
      </div>
    </div>
  );
}

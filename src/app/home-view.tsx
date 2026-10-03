"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BellRing, Braces, FlaskConical, Languages, LayoutDashboard, Quote, type LucideIcon } from "lucide-react";
import { Flow } from "@/components/flow";
import { Wordmark } from "@/components/shell/logo";
import { AccessMenu, LanguageMenu, ThemeMenu } from "@/components/shell/pref-menus";
import { SeverityBadge } from "@/components/ui/badges";
import { CountUp, Reveal } from "@/components/ui/motion";
import { compact, int, month } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { CLASS_ORDER, classFill, scoreFill } from "@/lib/scale";
import type { Flag, MapIndia, MapState, Meta } from "@/lib/types";

interface Alert { id: string; trade: string; tradeHi: string; place: string; type: Flag["type"]; month: string; district: string }
interface Props {
  meta: Meta; india: MapIndia; stateMaps: MapState[]; scores: Record<string, number>; blips: string[]; alerts: Alert[];
  proof: { index: { err: number; portalErr: number } | null; national: number; fast: number };
}

/** The pilot states drawn from live data, under a slow radar sweep. */
function HeroMap({ india, stateMaps, scores, blips }: Pick<Props, "india" | "stateMaps" | "scores" | "blips">) {
  const { t } = useT();
  const view = useMemo(() => {
    const b = stateMaps.map((s) => s.box);
    const x0 = Math.min(...b.map((v) => v[0])), y0 = Math.min(...b.map((v) => v[1]));
    const x1 = Math.max(...b.map((v) => v[2])), y1 = Math.max(...b.map((v) => v[3]));
    const pad = 26;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }, [stateMaps]);
  const hot = new Set(blips);
  return (
    <div className="relative mx-auto aspect-[0.82] w-full max-w-[520px]">
      <div aria-hidden className="absolute inset-[6%] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 16%, transparent), transparent)" }} />
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[32px]">
        <div
          className="absolute left-1/2 top-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2"
          style={{ background: "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--brand) 20%, transparent) 55deg, transparent 56deg)", animation: "sweep 7s linear infinite" }}
        />
      </div>
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label={t("dash.mapTitle")} className="relative h-full w-full">
        {india.states.filter((s) => !s.pilot).map((s) => (
          <path key={s.id} d={s.d} fill="var(--surface-2)" stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {stateMaps.map((s, si) => (
          <motion.g key={s.state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.25 + si * 0.18 }}>
            {s.districts.map((d) => (
              <path key={d.id} d={d.d} fill={scoreFill(scores[d.id] ?? 0)} stroke="var(--surface)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
            ))}
          </motion.g>
        ))}
        {india.states.filter((s) => s.pilot).map((s) => (
          <path key={s.id} d={s.d} fill="none" stroke="var(--ink-2)" strokeWidth={1.1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ))}
        {stateMaps.flatMap((s) => s.districts).filter((d) => hot.has(d.id)).slice(0, 26).map((d, i) => (
          <g key={d.id} transform={`translate(${d.c[0]} ${d.c[1]})`}>
            <circle r={5} fill="var(--st-critical)" opacity={0.5} style={{ transformBox: "fill-box", transformOrigin: "center", animation: `ping-slow 2.6s cubic-bezier(0,0,0.2,1) ${(i % 7) * 0.35}s infinite` }} />
            <circle r={3} fill="var(--st-critical)" stroke="var(--surface)" strokeWidth={1.2} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export function HomeView(p: Props) {
  const { t, locale } = useT();
  const { meta, proof } = p;
  const stats: [number, (n: number) => string, Key][] = [
    [meta.counts.districts, int, "home.statDistricts"], [meta.counts.trades, int, "home.statTrades"],
    [meta.counts.states, int, "home.statStates"], [meta.counts.records, compact, "home.statRecords"],
  ];
  const outcomes: [LucideIcon, Key, string, string][] = [
    [LayoutDashboard, "home.o1", t("home.o1d", { s: meta.counts.states, t: meta.counts.trades }), "/dashboard"],
    [FlaskConical, "home.o2", t("home.o2d"), "/methodology"],
    [BellRing, "home.o3", t("home.o3d", { n: meta.counts.flags }), "/warnings"],
    [Braces, "home.o4", t("home.o4d"), "/api-docs"],
    [Languages, "home.o5", t("home.o5d"), "/dashboard"],
  ];
  const facts: [Key, Key, Key][] = [["home.p1v", "home.p1", "home.p1s"], ["home.p2v", "home.p2", "home.p2s"], ["home.p3v", "home.p3", "home.p3s"]];

  return (
    <div className="min-h-screen overflow-x-clip">
      <a href="#main" className="skip-link">{t("app.skip")}</a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4 sm:px-6">
          <Link href="/" aria-label={t("app.name")}><Wordmark /></Link>
          <div className="flex-1" />
          <LanguageMenu />
          <AccessMenu />
          <ThemeMenu />
          <Link href="/dashboard" className="ml-1 hidden h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-on-brand transition-colors hover:bg-brand-hover sm:inline-flex">
            {t("home.ctaConsole")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black, transparent)" }} />
          <div className="relative mx-auto grid grid-cols-1 max-w-[1200px] items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-24 lg:pt-20">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-ink-2"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span className="truncate">{t("home.eyebrow")}</span>
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[56px]"
              >
                {t("home.title")}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="mt-5 max-w-xl text-base leading-7 text-ink-2 sm:text-lg"
              >
                {t("home.lead")}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }} className="mt-7 flex flex-wrap gap-3">
                <Link href="/dashboard" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-semibold text-on-brand shadow-card transition-all hover:-translate-y-0.5 hover:bg-brand-hover">
                  {t("home.ctaConsole")} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/methodology" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-2">
                  {t("home.ctaMethod")}
                </Link>
              </motion.div>
              <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }} className="mt-10 grid max-w-lg grid-cols-4 gap-4 border-t border-line pt-6">
                {stats.map(([v, f, k]) => (
                  <div key={k}>
                    <dd className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]"><CountUp value={v} format={f} /></dd>
                    <dt className="mt-0.5 text-xs leading-4 text-muted">{t(k)}</dt>
                  </div>
                ))}
              </motion.dl>
            </div>

            <div className="relative">
              <HeroMap india={p.india} stateMaps={p.stateMaps} scores={p.scores} blips={p.blips} />
              <div className="pointer-events-none absolute inset-0 hidden sm:block">
                {p.alerts.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.55, delay: 1 + i * 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="pointer-events-auto absolute w-[232px]"
                    style={[{ left: "-3%", top: "9%" }, { right: "-4%", top: "44%" }, { left: "2%", bottom: "5%" }][i]}
                  >
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}>
                      <Link href={`/warnings?focus=${a.id}`} className="block rounded-xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur transition-colors hover:border-brand-line">
                        <SeverityBadge severity="critical" />
                        <div className="mt-1.5 truncate text-[13px] font-semibold text-ink">{locale === "hi" ? a.tradeHi : a.trade}</div>
                        <div className="mt-0.5 text-xs leading-[1.4] text-muted">{a.place} · {t(`warn.${a.type}`)} {t("warn.by", { month: month(a.month, locale) })}</div>
                      </Link>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-xs text-ink-2">
                {CLASS_ORDER.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: classFill(c) }} />{t(`cls.${c}`)}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
            <Reveal><h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.problemTitle")}</h2></Reveal>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {facts.map(([v, d, s], i) => (
                <Reveal key={v} delay={i * 0.08}>
                  <div className="h-full rounded-2xl border border-line bg-bg p-5">
                    <div className="text-4xl font-semibold tracking-tight text-ink">{t(v)}</div>
                    <p className="mt-2 text-sm leading-6 text-ink-2">{t(d)}</p>
                    <p className="mt-3 text-xs text-muted">{t(s)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.1}>
              <figure className="mt-6 flex gap-4 rounded-2xl border border-brand-line bg-brand-soft p-5 sm:p-6">
                <Quote aria-hidden className="h-6 w-6 shrink-0 text-brand" />
                <div>
                  <blockquote className="text-base font-medium leading-7 text-ink sm:text-lg">{t("home.quote")}</blockquote>
                  <figcaption className="mt-2 text-[13px] text-ink-2">{t("home.quoteBy")}</figcaption>
                </div>
              </figure>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
          <Reveal><h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.howTitle")}</h2></Reveal>
          <div className="mt-8"><Flow /></div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
            <Reveal><h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.outcomesTitle")}</h2></Reveal>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {outcomes.map(([Icon, k, d, href], i) => (
                <Reveal key={k} delay={i * 0.06}>
                  <Link href={href} className="group flex h-full flex-col rounded-2xl border border-line bg-bg p-4 transition-all hover:-translate-y-0.5 hover:border-brand-line">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="h-[18px] w-[18px]" /></span>
                    <h3 className="mt-3 text-sm font-semibold text-ink">{t(k)}</h3>
                    <p className="mt-1 flex-1 text-[13px] leading-5 text-ink-2">{d}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand">{t("common.open")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
          <Reveal><h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.proofTitle")}</h2></Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {([
              ...(proof.index ? [[proof.index.err, t("home.proof1"), t("home.proof1b", { n: proof.index.portalErr })]] : []),
              [proof.national, t("home.proof2"), ""],
              [proof.fast, t("home.proof3"), ""],
            ] as [number, string, string][]).map(([v, a, b], i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <div className="text-5xl font-semibold tracking-tight text-ink"><CountUp value={v} format={(n) => `${Math.round(n)}%`} /></div>
                  <p className="mt-2 text-sm leading-6 text-ink-2">{a}</p>
                  {b && <p className="mt-1 text-[13px] text-muted">{b}</p>}
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-4 text-[13px] leading-5 text-muted">
            {meta.demo && t("home.proofNote")} <Link href="/methodology" className="font-medium text-brand hover:underline">{t("nav.methodology")}</Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-8 text-[13px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="max-w-2xl">{t("home.footer")}</p>
          <nav className="flex shrink-0 gap-4 font-medium text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">{t("nav.overview")}</Link>
            <Link href="/methodology" className="hover:text-brand">{t("nav.methodology")}</Link>
            <Link href="/data" className="hover:text-brand">{t("nav.data")}</Link>
            <Link href="/api-docs" className="hover:text-brand">{t("nav.api")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

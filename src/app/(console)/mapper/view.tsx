"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Cpu, LoaderCircle, MapPin, ScanText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/console-shell";
import { Badge, ClassChip } from "@/components/ui/badges";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { int, signed } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";

interface Match {
  trade: string; name: string; confidence: number; sector: string; sectorName: string; sectorSkillCouncil: string;
  nco2015Family: string; nco2015FamilyTitle: string; nsqfLevel: number; qualificationPack: string | null;
  courseType: "STT" | "ITI"; durationMonths: number;
  national: { scoreNext: number; demandNext: number; supplyNext: number };
}
interface Result {
  engine: "gemini" | "local"; note?: "no_key" | "fallback"; matches: Match[]; rationale: string; skills: string[];
  place: { district: string; districtName: string; state: string; scoreNext: number; demandNext: number; supplyNext: number; active: boolean } | null;
}

const EXAMPLES = [
  { label: "English", text: "Urgent hiring: SMT line operators for a mobile phone PCB assembly plant in Noida. ITI or 12th pass, soldering knowledge preferred, rotational shifts. Salary Rs 16,000 a month plus PF." },
  { label: "हिन्दी", text: "सोलर पैनल लगाने के लिए टेक्नीशियन चाहिए, झांसी में। आईटीआई पास, वायरिंग का अनुभव जरूरी। वेतन 15,000 रुपये प्रति माह।" },
  { label: "Hinglish", text: "Delivery boys chahiye Pune ke liye. Bike aur driving licence zaroori hai, fresher bhi apply kar sakte hain. Salary 18k plus incentive, courier company." },
  { label: "English", text: "Hospital in Coimbatore requires General Duty Assistants for patient care in wards. GDA certificate, night shift, female candidates preferred. 2 years experience." },
];

function Bar({ value }: { value: number }) {
  return (
    <span className="relative block h-1.5 w-full rounded-full bg-surface-2">
      <motion.span className="absolute inset-y-0 left-0 rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${Math.round(value * 100)}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
    </span>
  );
}

export function MapperView() {
  const { t, locale } = useT();
  const ref = useRefData();
  const [text, setText] = useState(EXAMPLES[0].text);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState(false);

  async function run(input = text) {
    if (input.trim().length < 8) return;
    setBusy(true);
    setErr(false);
    try {
      const r = await fetch("/api/v1/ai/classify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: input, locale }) });
      if (!r.ok) throw new Error();
      setRes(await r.json());
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const best = res?.matches[0];
  return (
    <div>
      <PageHeader title={t("mapper.title")} subtitle={t("mapper.subtitle")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="self-start p-5">
          <label htmlFor="ad" className="sr-only">{t("mapper.placeholder")}</label>
          <textarea
            id="ad" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={t("mapper.placeholder")}
            className="w-full resize-y rounded-xl border border-line-strong bg-surface p-3.5 text-sm leading-6 text-ink outline-none placeholder:text-muted focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">{t("mapper.examples")}</span>
              {EXAMPLES.map((e, i) => (
                <button key={i} type="button" onClick={() => { setText(e.text); run(e.text); }} className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2">
                  {e.label} {i === 3 ? "2" : ""}
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={() => run()} disabled={busy || text.trim().length < 8}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
              {busy ? t("mapper.running") : t("mapper.run")}
            </Button>
          </div>
          {err && <p className="mt-3 rounded-lg bg-critical-soft px-3 py-2 text-[13px] text-critical-ink">{t("ask.error")}</p>}
        </Card>

        <div className="min-h-[18rem]">
          <AnimatePresence mode="wait">
            {!res ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid h-full min-h-[18rem] place-items-center rounded-2xl border border-dashed border-line-strong px-6 text-center text-[13px] text-muted">
                <span><ScanText className="mx-auto mb-2 h-6 w-6" />{t("mapper.run")}</span>
              </motion.div>
            ) : (
              <motion.div key={JSON.stringify(res.matches.map((m) => m.trade)) + res.rationale} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
                <div className={cn("flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs leading-5", res.engine === "gemini" ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-2")}>
                  {res.engine === "gemini" ? <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>
                    <b className="font-semibold">{t("mapper.engine")}: {res.engine === "gemini" ? t("mapper.engineGemini") : t("mapper.engineLocal")}.</b>{" "}
                    {res.note === "no_key" && t("mapper.engineLocalNote")}
                    {res.note === "fallback" && t("mapper.engineFallback")}
                  </span>
                </div>

                {!best ? (
                  <Card className="p-5 text-[13px] text-ink-2">{t("mapper.noMatch")}</Card>
                ) : (
                  <Card className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-muted">{t("mapper.result")}</div>
                        <h2 className="mt-0.5 text-lg font-semibold leading-6 text-ink">{ref.tradeName(best.trade)}</h2>
                        <div className="mt-1 text-[13px] text-ink-2">{ref.sectorName(best.sector)} · {best.sectorSkillCouncil}</div>
                      </div>
                      <Link href={`/trades/${best.trade}`} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                        {t("common.open")} <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted">{t("mapper.confidence")}</span><span className="tabular font-semibold text-ink">{Math.round(best.confidence * 100)}%</span></div>
                      <Bar value={best.confidence} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-xs text-muted">{t("trade.nco")}</dt>
                        <dd className="mt-0.5 text-[13px] font-medium text-ink"><span className="font-mono">{best.nco2015Family}</span> · {best.nco2015FamilyTitle}</dd>
                      </div>
                      <div><dt className="text-xs text-muted">{t("trade.nsqf")}</dt><dd className="mt-0.5 text-[13px] font-medium text-ink">{best.nsqfLevel}</dd></div>
                      <div><dt className="text-xs text-muted">{t("trade.qp")}</dt><dd className="mt-0.5 font-mono text-[13px] font-medium text-ink">{best.qualificationPack ?? <span className="font-sans text-muted">{t("trade.qpNone")}</span>}</dd></div>
                      <div><dt className="text-xs text-muted">{t("trade.type")}</dt><dd className="mt-0.5 text-[13px] font-medium text-ink">{best.courseType === "ITI" ? t("common.iti") : t("common.stt")} · {t("common.months", { n: best.durationMonths })}</dd></div>
                      <div className="col-span-2">
                        <dt className="text-xs text-muted">{t("mapper.balance")} · {t("common.fy", { fy: ref.meta.planFY })}</dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                          <ClassChip score={best.national.scoreNext} />
                          <span className="tabular text-ink-2">{t("common.gap")} {signed(best.national.demandNext - best.national.supplyNext)} · {t("common.allStates")}</span>
                        </dd>
                      </div>
                    </dl>
                    {res.place && (
                      <Link href={`/district/${res.place.district}?trade=${best.trade}`} className="mt-4 flex items-center gap-3 rounded-xl bg-surface-2 p-3 transition-colors hover:bg-surface-3">
                        <MapPin className="h-4 w-4 shrink-0 text-brand" />
                        <span className="min-w-0 flex-1 text-[13px]">
                          <span className="block font-medium text-ink">{t("mapper.location")}: {res.place.districtName}, {ref.stateName(res.place.state)}</span>
                          <span className="tabular block text-xs text-muted">{t("common.demand")} {int(res.place.demandNext)} · {t("common.supply")} {int(res.place.supplyNext)}</span>
                        </span>
                        <ClassChip score={res.place.scoreNext} className="text-xs" />
                      </Link>
                    )}
                    {res.rationale && (
                      <p className="mt-4 text-[13px] leading-5 text-ink-2"><b className="font-semibold text-ink">{t("mapper.why")}:</b> {res.rationale}</p>
                    )}
                    {res.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted">{t("mapper.skills")}</span>
                        {res.skills.map((s) => <Badge key={s}>{s}</Badge>)}
                      </div>
                    )}
                  </Card>
                )}

                {res.matches.length > 1 && (
                  <Card className="p-5">
                    <h3 className="text-xs font-medium text-muted">{t("mapper.others")}</h3>
                    <ul className="mt-2 space-y-2.5">
                      {res.matches.slice(1).map((m) => (
                        <li key={m.trade}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                            <Link href={`/trades/${m.trade}`} className="truncate font-medium text-ink hover:text-brand">{ref.tradeName(m.trade)} <span className="font-mono text-xs font-normal text-muted">NCO {m.nco2015Family}</span></Link>
                            <span className="tabular shrink-0 text-xs text-ink-2">{Math.round(m.confidence * 100)}%</span>
                          </div>
                          <Bar value={m.confidence} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

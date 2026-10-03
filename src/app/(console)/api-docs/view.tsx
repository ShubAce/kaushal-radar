"use client";

import { useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Copy, Download, FileJson, FileSpreadsheet, LoaderCircle, Play } from "lucide-react";
import { PageHeader } from "@/components/shell/console-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { ENDPOINTS, type Endpoint } from "@/lib/endpoints";
import { useT, type Key } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";

function CopyButton({ text }: { text: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); })}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-3"
    >
      {done ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? t("common.copied") : t("common.copy")}
    </button>
  );
}

function EndpointCard({ e, origin, open, onToggle }: { e: Endpoint; origin: string; open: boolean; onToggle: () => void }) {
  const { t } = useT();
  const [input, setInput] = useState(e.example);
  const [out, setOut] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const url = e.method === "GET" ? `${e.path}${input ? `?${input}` : ""}` : e.path;
  const curl = e.method === "GET" ? `curl "${origin}${url}"` : `curl -X POST "${origin}${e.path}" -H "content-type: application/json" -d '${input.replace(/\s*\n\s*/g, " ")}'`;

  async function run() {
    setBusy(true);
    const t0 = performance.now();
    try {
      const res = await fetch(url, e.method === "POST" ? { method: "POST", headers: { "content-type": "application/json" }, body: input } : undefined);
      const text = await res.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch { /* not JSON (CSV export): show as is */ }
      setOut({ status: res.status, ms: Math.round(performance.now() - t0), body: body.length > 6000 ? `${body.slice(0, 6000)}\n…` : body });
    } catch (err) {
      setOut({ status: 0, ms: 0, body: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-2xl border bg-surface shadow-card", open ? "border-brand-line" : "border-line")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left">
        <span className={cn("w-12 shrink-0 rounded-md py-0.5 text-center font-mono text-[11px] font-bold", e.method === "GET" ? "bg-good-soft text-good-ink" : "bg-brand-soft text-brand")}>{e.method}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13px] font-semibold text-ink">{e.path}</span>
          <span className="block truncate text-[13px] text-muted">{t(`api.${e.summaryKey}` as Key)}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="grid grid-cols-1 gap-5 border-t border-line px-4 py-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <h3 className="text-xs font-medium text-muted">{t("api.params")}</h3>
                {e.params.length === 0 ? <p className="mt-1.5 text-[13px] text-muted">–</p> : (
                  <dl className="mt-1.5 space-y-1.5">
                    {e.params.map((p) => (
                      <div key={p.name} className="text-[13px] leading-5">
                        <dt className="inline font-mono font-semibold text-ink">{p.name}{p.required && <span className="text-critical">*</span>}</dt>
                        <dd className="ml-2 inline text-ink-2">{p.values}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              <div className="min-w-0 lg:col-span-3">
                <label className="text-xs font-medium text-muted" htmlFor={`in-${e.id}`}>{e.method === "GET" ? t("api.endpoint") : "JSON"}</label>
                {e.method === "GET" ? (
                  <div className="mt-1.5 flex items-center rounded-lg border border-line-strong bg-surface font-mono text-[13px] focus-within:border-brand">
                    <span className="shrink-0 pl-2.5 text-muted">{e.path}?</span>
                    <input id={`in-${e.id}`} value={input} onChange={(ev) => setInput(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && run()}
                      spellCheck={false} className="h-9 min-w-0 flex-1 bg-transparent pr-2.5 text-ink outline-none" />
                  </div>
                ) : (
                  <textarea id={`in-${e.id}`} value={input} onChange={(ev) => setInput(ev.target.value)} rows={4} spellCheck={false}
                    className="mt-1.5 w-full resize-y rounded-lg border border-line-strong bg-surface p-2.5 font-mono text-[13px] text-ink outline-none focus:border-brand" />
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="primary" size="sm" onClick={run} disabled={busy}>
                    {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}{t("api.tryIt")}
                  </Button>
                  {out && <span className={cn("tabular rounded-md px-1.5 py-0.5 text-xs font-semibold", out.status === 200 ? "bg-good-soft text-good-ink" : "bg-critical-soft text-critical-ink")}>{out.status || "ERR"} · {out.ms} ms</span>}
                </div>
                <div className="mt-3 rounded-xl bg-surface-2">
                  <div className="flex items-center justify-between px-3 pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("api.curl")}</span>
                    <CopyButton text={curl} />
                  </div>
                  <pre className="overflow-x-auto px-3 pb-2.5 font-mono text-xs leading-5 text-ink-2 scroll-thin">{curl}</pre>
                </div>
                {out && (
                  <div className="mt-3 rounded-xl bg-surface-2">
                    <div className="flex items-center justify-between px-3 pt-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("api.response")}</span>
                      <CopyButton text={out.body} />
                    </div>
                    <pre className="max-h-80 overflow-auto px-3 pb-3 font-mono text-xs leading-5 text-ink scroll-thin">{out.body}</pre>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const noSubscription = () => () => {};

export function ApiDocsView() {
  const { t } = useT();
  const ref = useRefData();
  const [open, setOpen] = useState<string | null>("gaps");
  const origin = useSyncExternalStore(noSubscription, () => window.location.origin, () => "");

  const link = "inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2";
  return (
    <div>
      <PageHeader
        title={t("api.title")}
        subtitle={t("api.subtitle")}
        actions={<a href="/api/v1/openapi" target="_blank" rel="noreferrer" className={link}><FileJson className="h-4 w-4" />{t("api.openapi")}</a>}
      />
      <div className="space-y-4">
        <Card>
          <CardHeader title={t("api.exportTitle")} subtitle={`${t("api.baseUrl")}: ${origin}/api/v1`} />
          <div className="flex flex-wrap gap-2 px-5 pb-4 pt-3">
            <a className={link} href="/api/v1/gaps?limit=20000&format=csv"><Download className="h-4 w-4" />{t("api.exportGaps")} (CSV)</a>
            <a className={link} href="/api/v1/flags?limit=5000&format=csv"><Download className="h-4 w-4" />{t("api.exportFlags")} (CSV)</a>
            {ref.states.map((s) => (
              <a key={s.id} className={link} href={`/api/v1/plan?state=${s.id}&format=xlsx`}><FileSpreadsheet className="h-4 w-4" />{t("api.exportPlan", { state: s.name })}</a>
            ))}
          </div>
        </Card>
        <div className="space-y-2.5">
          {ENDPOINTS.map((e) => <EndpointCard key={e.id} e={e} origin={origin} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />)}
        </div>
      </div>
    </div>
  );
}

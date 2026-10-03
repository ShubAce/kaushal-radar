"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, LoaderCircle, Sparkles, X } from "lucide-react";
import { useT, type Key } from "@/lib/i18n";
import { cn } from "@/lib/cn";

interface Figure { label: string; value: string }
interface Msg { role: "user" | "assistant"; text: string; engine?: "gemini" | "local"; figures?: Figure[]; error?: boolean }

const SUGGESTIONS: Key[] = ["ask.s1", "ask.s2", "ask.s3", "ask.s4"];

/** Slide-over assistant. Every answer is grounded in figures fetched from this system's own data. */
export function AskPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, locale }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { answer: string; engine: "gemini" | "local"; figures?: Figure[] };
      setMsgs((m) => [...m, { role: "assistant", text: data.answer, engine: data.engine, figures: data.figures }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: t("ask.error"), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="no-print fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog" aria-modal aria-label={t("ask.title")}
            className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-pop"
            initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <Sparkles className="h-4 w-4 text-brand" />
                  {t("ask.title")}
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">{t("ask.subtitle")}</p>
              </div>
              <button type="button" aria-label={t("nav.close")} onClick={onClose} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 scroll-thin" aria-live="polite">
              {msgs.length === 0 && (
                <ul className="space-y-2">
                  {SUGGESTIONS.map((k) => (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => send(t(k))}
                        className="w-full rounded-xl border border-line px-3.5 py-2.5 text-left text-[13px] leading-5 text-ink-2 transition-colors hover:border-brand-line hover:bg-brand-soft hover:text-ink"
                      >
                        {t(k)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.55]",
                      m.role === "user" ? "bg-brand text-on-brand" : m.error ? "bg-critical-soft text-critical-ink" : "bg-surface-2 text-ink",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.figures && m.figures.length > 0 && (
                      <dl className="mt-2.5 space-y-1 border-t border-line pt-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t("ask.figures")}</dt>
                        {m.figures.map((f, j) => (
                          <dd key={j} className="flex justify-between gap-3 text-xs text-ink-2">
                            <span>{f.label}</span>
                            <span className="tabular font-medium text-ink">{f.value}</span>
                          </dd>
                        ))}
                      </dl>
                    )}
                    {m.engine === "local" && <p className="mt-2 text-[11px] leading-4 text-muted">{t("ask.localNote")}</p>}
                  </div>
                </motion.div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {t("ask.thinking")}
                </div>
              )}
              <div ref={end} />
            </div>

            <form
              className="border-t border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-1.5 focus-within:border-brand">
                <label className="sr-only" htmlFor="ask-input">{t("ask.placeholder")}</label>
                <textarea
                  id="ask-input"
                  ref={box}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder={t("ask.placeholder")}
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-muted"
                />
                <button
                  type="submit"
                  aria-label={t("ask.send")}
                  disabled={!input.trim() || busy}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-on-brand transition-opacity disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </form>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

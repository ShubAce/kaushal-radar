"use client";

import { motion } from "motion/react";
import { ArrowRight, Combine, Database, LineChart, ScanText, Target, type LucideIcon } from "lucide-react";
import { useT, type Key } from "@/lib/i18n";

const STEPS: [LucideIcon, Key, Key][] = [
  [Database, "method.f1", "method.f1d"], [ScanText, "method.f2", "method.f2d"], [Combine, "method.f3", "method.f3d"],
  [LineChart, "method.f4", "method.f4d"], [Target, "method.f5", "method.f5d"],
];

/** The pipeline in five steps, from raw signals to a seat plan. */
export function Flow() {
  const { t } = useT();
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {STEPS.map(([Icon, a, b], i) => (
        <motion.li
          key={a}
          initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.45, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl border border-line bg-surface p-4 shadow-card"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="h-[18px] w-[18px]" /></span>
            <span className="tabular text-xs font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-ink">{t(a)}</h3>
          <p className="mt-1 text-[13px] leading-5 text-ink-2">{t(b)}</p>
          {i < STEPS.length - 1 && (
            <ArrowRight aria-hidden className="absolute -right-[13px] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-bg p-0.5 text-muted lg:block" />
          )}
        </motion.li>
      ))}
    </ol>
  );
}

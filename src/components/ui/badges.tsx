"use client";

import type { ReactNode } from "react";
import { CircleAlert, Eye, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { classFill, classOf } from "@/lib/scale";
import type { ClassKey, Severity } from "@/lib/types";

export function Badge({ children, className, tone = "neutral" }: { children: ReactNode; className?: string; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4",
        tone === "brand" ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Class name with its colour swatch. The text stays in ink; the swatch carries the colour. */
export function ClassChip({ cls, score, className }: { cls?: ClassKey; score?: number; className?: string }) {
  const { t } = useT();
  const c = cls ?? classOf(score ?? 0);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink", className)}>
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: classFill(c) }} />
      {t(`cls.${c}`)}
    </span>
  );
}

const SEV = {
  critical: { Icon: CircleAlert, cls: "bg-critical-soft text-critical-ink" },
  warning: { Icon: TriangleAlert, cls: "bg-warning-soft text-warning-ink" },
  watch: { Icon: Eye, cls: "bg-surface-2 text-ink-2" },
} as const;

/** Severity always carries an icon and a word, never colour alone. */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { t } = useT();
  const { Icon, cls } = SEV[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4", cls, className)}>
      <Icon aria-hidden className="h-3 w-3" />
      {t(`warn.${severity}`)}
    </span>
  );
}

export function Confidence({ level, className }: { level: number; className?: string }) {
  const { t } = useT();
  const word = t(level >= 2 ? "common.high" : level === 1 ? "common.medium" : "common.low");
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)} title={`${t("common.confidence")}: ${word}`}>
      <span aria-hidden className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-2.5 w-1 rounded-full", i <= level ? "bg-ink-2" : "bg-surface-3")} />
        ))}
      </span>
      <span>{word}</span>
    </span>
  );
}

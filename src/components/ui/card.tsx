import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...rest} />;
}

export function CardHeader({
  title, subtitle, actions, className,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    // The title keeps at least 10rem; actions that no longer fit beside it drop to their own line.
    <div className={cn("flex flex-wrap items-start gap-x-3 gap-y-2 px-5 pt-4", className)}>
      <div className="min-w-0 flex-1 basis-40">
        <h2 className="text-[15px] font-semibold leading-6 text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex max-w-full flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

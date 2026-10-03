import { cn } from "@/lib/cn";

/** The mark: a radar scope with one contact. `sweep` adds the rotating beam. */
export function Logo({ className, sweep = false }: { className?: string; sweep?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <g fill="none" stroke="var(--on-brand)" strokeLinecap="round">
        <circle cx="16" cy="16" r="9.5" strokeWidth="1.5" opacity="0.45" />
        <circle cx="16" cy="16" r="5" strokeWidth="1.5" opacity="0.75" />
        <g style={sweep ? { transformOrigin: "16px 16px", animation: "sweep 6s linear infinite" } : undefined}>
          <path d="M16 16 L22.7 9.3" strokeWidth="1.8" />
        </g>
      </g>
      <circle cx="21" cy="19.5" r="1.9" fill="var(--on-brand)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Logo />
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        Kaushal <span className="text-brand">Radar</span>
      </span>
    </span>
  );
}

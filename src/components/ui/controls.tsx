"use client";

import { useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" };

export function Button({ variant = "secondary", size = "md", className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-brand text-on-brand hover:bg-brand-hover",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({
  label, className, active, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
        active && "bg-brand-soft text-brand",
        className,
      )}
      {...rest}
    />
  );
}

export interface Option<T extends string> { value: T; label: ReactNode; title?: string }

/** A small set of mutually exclusive views, with the selection sliding between them. */
export function Segmented<T extends string>({
  value, onChange, options, label, size = "md", className,
}: { value: T; onChange: (v: T) => void; options: Option<T>[]; label: string; size?: "sm" | "md"; className?: string }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full flex-wrap rounded-lg bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-md font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              on ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md border border-line bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Select({
  label, className, children, ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        className="h-9 w-full appearance-none rounded-lg border border-line-strong bg-surface pl-3 pr-8 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
        {...rest}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted" />
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-surface-2"
    >
      <span>{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-surface-3")}>
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 36 }}
          className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow", checked ? "right-0.5" : "left-0.5")}
        />
      </span>
    </button>
  );
}

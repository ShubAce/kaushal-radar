"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";

/** A button that opens a small panel. Closes on outside click and Escape, and hands focus back. */
export function Popover({
  label, icon, children, align = "end", width = 260, text,
}: {
  label: string; icon: ReactNode; children: (close: () => void) => ReactNode;
  align?: "start" | "end"; width?: number; text?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={btn}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
          text ? "px-2.5 text-[13px] font-medium" : "w-9",
          open && "bg-surface-2 text-ink",
        )}
      >
        {icon}
        {text}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ width }}
            className={cn(
              "absolute top-11 z-50 origin-top rounded-xl border border-line bg-surface p-1.5 shadow-pop",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

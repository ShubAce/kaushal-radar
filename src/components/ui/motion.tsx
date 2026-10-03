"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { usePrefs } from "@/lib/prefs";

/** Content that rises into place the first time it scrolls into view. */
export function Reveal({
  children, delay = 0, className, y = 14,
}: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** A number that counts up to its value once, then tracks changes smoothly. */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const inView = useInView(ref, { once: true });
  const osReduced = useReducedMotion();
  const { prefs } = usePrefs();
  const still = osReduced || prefs.motion === "reduced";

  useEffect(() => {
    if (!inView) return;
    if (still) {
      mv.set(value);
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, inView, still, mv, format]);

  // Server and first client render show the final value, so the number is right without JavaScript.
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}

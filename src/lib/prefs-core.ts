// Reader preferences, shared by the server layout (which reads the cookie) and
// the client provider (which writes it).
import type { Locale } from "./types";

export type Theme = "light" | "dark" | "system";
export interface Prefs {
  locale: Locale;
  theme: Theme;
  scale: 1 | 1.125 | 1.25;
  contrast: "normal" | "high";
  motion: "full" | "reduced";
}
export const DEFAULT_PREFS: Prefs = { locale: "en", theme: "system", scale: 1, contrast: "normal", motion: "full" };
export const COOKIE = "kr_prefs";
const LOCALE_IDS: Locale[] = ["en", "hi", "mr", "ta", "gu"];

export function parsePrefs(raw: string | undefined): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const p = JSON.parse(decodeURIComponent(raw)) as Partial<Prefs>;
    return {
      locale: LOCALE_IDS.includes(p.locale as Locale) ? (p.locale as Locale) : "en",
      theme: p.theme === "light" || p.theme === "dark" ? p.theme : "system",
      scale: p.scale === 1.125 || p.scale === 1.25 ? p.scale : 1,
      contrast: p.contrast === "high" ? "high" : "normal",
      motion: p.motion === "reduced" ? "reduced" : "full",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Attributes for <html>; the client provider re-applies the same ones when a preference changes. */
export function htmlAttrs(p: Prefs) {
  return {
    lang: p.locale,
    "data-theme": p.theme === "system" ? undefined : p.theme,
    "data-contrast": p.contrast === "high" ? "high" : undefined,
    "data-motion": p.motion === "reduced" ? "reduced" : undefined,
    style: { fontSize: `${p.scale * 100}%` },
  };
}

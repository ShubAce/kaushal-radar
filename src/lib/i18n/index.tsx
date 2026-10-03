"use client";

// Interface strings in five languages. English is the source of truth; any key a
// translation does not have yet falls back to English rather than showing a blank.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "../types";
import { en } from "./en";
import { hi } from "./hi";
import { mr } from "./mr";
import { ta } from "./ta";
import { gu } from "./gu";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type Key = Leaves<typeof en>;
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };
export type Dict = DeepPartial<typeof en>;

export const LOCALES: { id: Locale; label: string; english: string }[] = [
  { id: "en", label: "English", english: "English" },
  { id: "hi", label: "हिन्दी", english: "Hindi" },
  { id: "mr", label: "मराठी", english: "Marathi" },
  { id: "gu", label: "ગુજરાતી", english: "Gujarati" },
  { id: "ta", label: "தமிழ்", english: "Tamil" },
];

function flatten(obj: object, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[prefix + k] = v;
    else if (v && typeof v === "object") flatten(v, `${prefix}${k}.`, out);
  }
  return out;
}

const FLAT: Record<Locale, Record<string, string>> = {
  en: flatten(en), hi: flatten(hi), mr: flatten(mr), ta: flatten(ta), gu: flatten(gu),
};

export type TFn = (key: Key, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let s = FLAT[locale][key] ?? FLAT.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

const Ctx = createContext<{ locale: Locale; t: TFn }>({ locale: "en", t: (k, v) => translate("en", k, v) });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useCallback<TFn>((key, vars) => translate(locale, key, vars), [locale]);
  const value = useMemo(() => ({ locale, t }), [locale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

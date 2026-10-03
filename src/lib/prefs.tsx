"use client";

// Client side of reader preferences: language, theme, text size, contrast and
// motion. Stored in a cookie so the server renders the right version on the
// first byte (no flash of the wrong theme or language).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { I18nProvider } from "./i18n";
import { COOKIE, DEFAULT_PREFS, type Prefs } from "./prefs-core";

const Ctx = createContext<{ prefs: Prefs; set: (patch: Partial<Prefs>) => void }>({ prefs: DEFAULT_PREFS, set: () => {} });

export function PrefsProvider({ initial, children }: { initial: Prefs; children: ReactNode }) {
  const [prefs, setPrefs] = useState(initial);
  const set = useCallback((patch: Partial<Prefs>) => setPrefs((cur) => ({ ...cur, ...patch })), []);

  useEffect(() => {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; path=/; max-age=31536000; samesite=lax`;
    const el = document.documentElement;
    el.lang = prefs.locale;
    if (prefs.theme === "system") delete el.dataset.theme;
    else el.dataset.theme = prefs.theme;
    if (prefs.contrast === "high") el.dataset.contrast = "high";
    else delete el.dataset.contrast;
    if (prefs.motion === "reduced") el.dataset.motion = "reduced";
    else delete el.dataset.motion;
    el.style.fontSize = `${prefs.scale * 100}%`;
  }, [prefs]);

  const value = useMemo(() => ({ prefs, set }), [prefs, set]);
  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={prefs.motion === "reduced" ? "always" : "user"}>
        <I18nProvider locale={prefs.locale}>{children}</I18nProvider>
      </MotionConfig>
    </Ctx.Provider>
  );
}

export const usePrefs = () => useContext(Ctx);

"use client";

import { Accessibility, Check, Languages, Monitor, Moon, Sun } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { Segmented, Switch } from "@/components/ui/controls";
import { LOCALES, useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Prefs } from "@/lib/prefs-core";
import { cn } from "@/lib/cn";

export function LanguageMenu() {
  const { t } = useT();
  const { prefs, set } = usePrefs();
  const current = LOCALES.find((l) => l.id === prefs.locale)!;
  return (
    <Popover
      label={t("prefs.language")}
      icon={<Languages className="h-[18px] w-[18px]" />}
      text={<span className="hidden sm:inline">{current.label}</span>}
      width={220}
    >
      {(close) => (
        <ul role="listbox" aria-label={t("prefs.language")}>
          {LOCALES.map((l) => {
            const on = l.id === prefs.locale;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  lang={l.id}
                  onClick={() => {
                    set({ locale: l.id });
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2",
                    on ? "font-semibold text-ink" : "text-ink-2",
                  )}
                >
                  <span>
                    {l.label}
                    {l.id !== "en" && <span className="ml-2 text-xs font-normal text-muted">{l.english}</span>}
                  </span>
                  {on && <Check className="h-4 w-4 text-brand" strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}

export function AccessMenu() {
  const { t } = useT();
  const { prefs, set } = usePrefs();
  return (
    <Popover label={t("prefs.accessibility")} icon={<Accessibility className="h-[18px] w-[18px]" />} width={280}>
      {() => (
        <div className="space-y-3 p-1.5">
          <div>
            <div className="mb-1.5 px-1 text-xs font-medium text-muted">{t("prefs.textSize")}</div>
            <Segmented<"1" | "1.125" | "1.25">
              label={t("prefs.textSize")}
              className="w-full [&>button]:flex-1"
              value={String(prefs.scale) as "1" | "1.125" | "1.25"}
              onChange={(v) => set({ scale: Number(v) as Prefs["scale"] })}
              options={[
                { value: "1", label: <span className="text-[13px]">A</span>, title: t("prefs.sizeNormal") },
                { value: "1.125", label: <span className="text-[15px]">A</span>, title: t("prefs.sizeLarge") },
                { value: "1.25", label: <span className="text-[17px]">A</span>, title: t("prefs.sizeLarger") },
              ]}
            />
          </div>
          <div className="border-t border-line pt-1.5">
            <Switch label={t("prefs.contrast")} checked={prefs.contrast === "high"} onChange={(v) => set({ contrast: v ? "high" : "normal" })} />
            <Switch label={t("prefs.motion")} checked={prefs.motion === "reduced"} onChange={(v) => set({ motion: v ? "reduced" : "full" })} />
          </div>
        </div>
      )}
    </Popover>
  );
}

export function ThemeMenu() {
  const { t } = useT();
  const { prefs, set } = usePrefs();
  const Icon = prefs.theme === "dark" ? Moon : prefs.theme === "light" ? Sun : Monitor;
  const items = [
    { id: "light", Icon: Sun, label: t("prefs.light") },
    { id: "dark", Icon: Moon, label: t("prefs.dark") },
    { id: "system", Icon: Monitor, label: t("prefs.system") },
  ] as const;
  return (
    <Popover label={t("prefs.theme")} icon={<Icon className="h-[18px] w-[18px]" />} width={180}>
      {(close) => (
        <ul role="listbox" aria-label={t("prefs.theme")}>
          {items.map(({ id, Icon: I, label }) => {
            const on = prefs.theme === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    set({ theme: id });
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2",
                    on ? "font-semibold text-ink" : "text-ink-2",
                  )}
                >
                  <I className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {on && <Check className="h-4 w-4 text-brand" strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Popover>
  );
}

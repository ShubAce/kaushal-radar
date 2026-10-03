"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BellRing, Braces, Briefcase, Database, FlaskConical, Info, LayoutDashboard, ListOrdered, Menu, ScanText,
  Sparkles, Target, X, type LucideIcon,
} from "lucide-react";
import { Wordmark } from "./logo";
import { AccessMenu, LanguageMenu, ThemeMenu } from "./pref-menus";
import { AskPanel } from "./ask-panel";
import { cn } from "@/lib/cn";
import { month } from "@/lib/format";
import { useT, type Key } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";

interface Item { href: string; key: Key; Icon: LucideIcon; badge?: number }

function useNav(): { group: Key; items: Item[] }[] {
  const { criticalFlags } = useRefData();
  return [
    {
      group: "nav.monitor",
      items: [
        { href: "/dashboard", key: "nav.overview", Icon: LayoutDashboard },
        { href: "/trades", key: "nav.trades", Icon: Briefcase },
        { href: "/rankings", key: "nav.rankings", Icon: ListOrdered },
        { href: "/warnings", key: "nav.warnings", Icon: BellRing, badge: criticalFlags },
      ],
    },
    { group: "nav.plan", items: [{ href: "/planner", key: "nav.planner", Icon: Target }] },
    {
      group: "nav.understand",
      items: [
        { href: "/methodology", key: "nav.methodology", Icon: FlaskConical },
        { href: "/data", key: "nav.data", Icon: Database },
      ],
    },
    {
      group: "nav.tools",
      items: [
        { href: "/mapper", key: "nav.mapper", Icon: ScanText },
        { href: "/api-docs", key: "nav.api", Icon: Braces },
      ],
    },
  ];
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useT();
  const pathname = usePathname();
  const nav = useNav();
  return (
    <nav aria-label={t("nav.menu")} className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scroll-thin">
      {nav.map((g) => (
        <div key={g.group}>
          <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{t(g.group)}</div>
          <ul className="space-y-0.5">
            {g.items.map(({ href, key, Icon, badge }) => {
              const on = pathname === href || pathname.startsWith(`${href}/`) || (href === "/dashboard" && pathname.startsWith("/district"));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                      on ? "text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg bg-brand-soft"
                        transition={{ type: "spring", stiffness: 480, damping: 38 }}
                      />
                    )}
                    <Icon className="relative z-10 h-[18px] w-[18px] shrink-0" strokeWidth={on ? 2.2 : 1.9} />
                    <span className="relative z-10 flex-1 truncate">{t(key)}</span>
                    {!!badge && (
                      <span className="relative z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-critical-soft px-1.5 text-[11px] font-semibold text-critical-ink tabular">
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function DemoNote() {
  const { t } = useT();
  const { meta } = useRefData();
  return (
    <div className="m-3 rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <Info className="h-3.5 w-3.5 text-brand" />
        {t(meta.demo ? "app.demo" : "app.supplied")}
      </div>
      <p className="mt-1 text-xs leading-[1.45] text-muted">{t(meta.demo ? "app.demoLong" : "app.suppliedLong")}</p>
      <Link href="/data" className="mt-1.5 inline-block text-xs font-medium text-brand hover:underline">
        {t(meta.demo ? "app.demoLink" : "app.suppliedLink")}
      </Link>
    </div>
  );
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const { t, locale } = useT();
  const { meta } = useRefData();
  const pathname = usePathname();
  // the page the menu was opened on: navigating anywhere closes it
  const [drawerAt, setDrawerAt] = useState<string | null>(null);
  const drawer = drawerAt === pathname;
  const closeDrawer = () => setDrawerAt(null);
  const [ask, setAsk] = useState(false);

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="skip-link">{t("app.skip")}</a>

      <aside className="no-print sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/" className="flex h-14 items-center px-4" aria-label={`${t("app.name")} · ${t("nav.home")}`}>
          <Wordmark />
        </Link>
        <NavList />
        <DemoNote />
      </aside>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeDrawer}
            />
            <motion.aside
              role="dialog" aria-modal aria-label={t("nav.menu")}
              className="absolute inset-y-0 left-0 flex w-[272px] flex-col border-r border-line bg-surface"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <div className="flex h-14 items-center justify-between px-4">
                <Wordmark />
                <button type="button" aria-label={t("nav.close")} onClick={closeDrawer} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList onNavigate={closeDrawer} />
              <DemoNote />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md sm:px-5">
          <button type="button" aria-label={t("nav.menu")} onClick={() => setDrawerAt(pathname)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="lg:hidden" aria-label={t("app.name")}>
            <Wordmark className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>
          <div className="hidden items-center gap-2 text-[13px] text-muted lg:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-good opacity-60" style={{ animation: "ping-slow 2.4s cubic-bezier(0,0,0.2,1) infinite" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
            </span>
            {t("app.asOf", { month: month(meta.dataAsOf, locale, true) })}
            <span aria-hidden className="text-line-strong">·</span>
            <Link
              href="/data"
              className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold hover:underline", meta.demo ? "bg-warning-soft text-warning-ink" : "bg-brand-soft text-brand")}
            >
              {t(meta.demo ? "app.demo" : "app.supplied")}
            </Link>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setAsk(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-brand-soft px-3 text-[13px] font-medium text-brand transition-colors hover:border-brand"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">{t("app.ask")}</span>
          </button>
          <LanguageMenu />
          <AccessMenu />
          <ThemeMenu />
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <AskPanel open={ask} onClose={() => setAsk(false)} />
    </div>
  );
}

/** Title block at the top of every console screen. */
export function PageHeader({
  title, subtitle, crumbs, actions,
}: { title: ReactNode; subtitle?: ReactNode; crumbs?: { label: string; href?: string }[]; actions?: ReactNode }) {
  return (
    <div className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-[13px] text-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>/</span>}
              {c.href ? <Link href={c.href} className="hover:text-ink hover:underline">{c.label}</Link> : <span className="text-ink-2">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-8 tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

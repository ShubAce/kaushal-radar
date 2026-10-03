"use client";

import Link from "next/link";
import { BalanceMeter } from "@/components/charts/bits";
import { SeverityBadge } from "@/components/ui/badges";
import { month } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useRefData } from "@/lib/ref";
import type { Flag } from "@/lib/types";

/** A compact early-warning row: what, where, how severe and by when. */
export function FlagItem({ flag, href }: { flag: Flag; href?: string }) {
  const { t, locale } = useT();
  const ref = useRefData();
  const when = flag.lead > 0 ? t("warn.by", { month: month(flag.month, locale) }) : t("warn.leadNow");
  return (
    <Link
      href={href ?? `/warnings?focus=${flag.id}`}
      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2"
    >
      <SeverityBadge severity={flag.severity} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{ref.tradeName(flag.trade)}</span>
        <span className="line-clamp-2 block text-xs leading-[1.45] text-muted">
          {ref.geoName(flag.geo)}
          {flag.level === "state" && ` · ${t("warn.stateWide")}`} · {t(`warn.${flag.type}`)} {when}
        </span>
      </span>
      <span className="hidden shrink-0 sm:block">
        <BalanceMeter now={flag.score_now} next={flag.score_next} width={92} showNumbers={false} />
      </span>
    </Link>
  );
}

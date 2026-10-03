import type { NextRequest } from "next/server";
import { csv, envelope, fail, intParam, ok, preflight, publicFlag } from "@/lib/api";
import { flags, isDistrict, isSector, isState, isTrade } from "@/lib/data";

export const OPTIONS = preflight;

/** Early-warning flags, most severe first. */
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const f = {
    state: q.get("state") ?? undefined, district: q.get("district") ?? undefined, sector: q.get("sector") ?? undefined,
    trade: q.get("trade") ?? undefined, severity: q.get("severity") ?? undefined, level: q.get("level") ?? undefined,
  };
  if (f.state && !isState(f.state)) return fail(400, `Unknown state "${f.state}".`);
  if (f.district && !isDistrict(f.district)) return fail(400, `Unknown district "${f.district}".`);
  if (f.sector && !isSector(f.sector)) return fail(400, `Unknown sector "${f.sector}".`);
  if (f.trade && !isTrade(f.trade)) return fail(400, `Unknown trade "${f.trade}".`);
  if (f.severity && !["critical", "warning", "watch"].includes(f.severity)) return fail(400, "severity must be critical, warning or watch.");
  if (f.level && !["district", "state"].includes(f.level)) return fail(400, "level must be district or state.");

  const all = flags(f).map(publicFlag);
  const rows = all.slice(0, intParam(q.get("limit"), 500, 1, 5000));
  if (q.get("format") === "csv") return csv(rows, "kaushal-radar-flags");
  return ok({ meta: envelope({ total: all.length, returned: rows.length }), flags: rows });
}

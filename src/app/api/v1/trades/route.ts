import type { NextRequest } from "next/server";
import { envelope, fail, ok, preflight } from "@/lib/api";
import { isSector, taxonomy } from "@/lib/data";

export const OPTIONS = preflight;

export function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get("sector");
  if (sector && !isSector(sector)) return fail(400, `Unknown sector "${sector}".`);
  const tx = taxonomy();
  return ok({
    meta: envelope(),
    sectors: tx.sectors.map((s) => ({ id: s.id, name: s.name, nameHi: s.hi, sectorSkillCouncil: s.ssc })),
    trades: tx.trades.filter((t) => !sector || t.sector === sector).map((t) => ({
      id: t.id, name: t.name, nameHi: t.hi, sector: t.sector,
      nco2015Family: t.nco, nco2015FamilyTitle: t.ncoTitle, nsqfLevel: t.nsqf, qualificationPack: t.qp,
      courseType: t.kind === "ITI" ? "ITI (Craftsmen Training Scheme)" : "Short-term training",
      durationMonths: t.months, emergingRole: t.emerging, seatToEntrantYield: t.yield_,
    })),
  });
}

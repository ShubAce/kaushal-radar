import { z } from "zod";
import { fail, ok, preflight } from "@/lib/api";
import { askGeminiStructured, hasGemini } from "@/lib/ai/gemini";
import { findEntities, findSkills, matchTrades } from "@/lib/ai/match";
import { cells, geo, taxonomy, tradeRows } from "@/lib/data";
import { classOf } from "@/lib/scale";

export const OPTIONS = preflight;

const LANG: Record<string, string> = { en: "English", hi: "Hindi", mr: "Marathi", ta: "Tamil", gu: "Gujarati" };

const Answer = z.object({
  tradeId: z.string().describe("id of the best matching trade from the list, or the word none"),
  confidence: z.number().describe("0 to 1"),
  alternates: z.array(z.string()).describe("up to two other plausible trade ids, best first"),
  rationale: z.string().describe("one short sentence saying what in the advertisement decided the match"),
  skills: z.array(z.string()).describe("up to six skills or requirements stated in the advertisement"),
  place: z.string().describe("town or district named in the advertisement, written in English letters, or an empty string"),
});

/**
 * Map a job advertisement to an NCO-2015 occupation family and a tracked trade.
 * This is the step that lets raw postings from any portal enter the demand index.
 */
export async function POST(req: Request) {
  let body: { text?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Send JSON: { \"text\": \"...\" }");
  }
  const text = (body.text ?? "").trim().slice(0, 4000);
  if (text.length < 8) return fail(400, "text must contain a job advertisement.");
  const locale = body.locale && body.locale in LANG ? body.locale : "en";

  const tx = taxonomy();
  const byId = new Map(tx.trades.map((t) => [t.id, t]));
  const local = matchTrades(text, 3);
  const place = findEntities(text);
  let engine: "gemini" | "local" = "local";
  let note: "no_key" | "fallback" | undefined = hasGemini() ? undefined : "no_key";
  let ranked = local.map((m) => ({ trade: m.trade, confidence: m.confidence }));
  let rationale = local[0] ? `Matched on: ${local[0].matched.slice(0, 4).join(", ")}` : "";
  let skills = findSkills(text);
  let district = place.district;

  if (hasGemini()) {
    try {
      const list = tx.trades.map((t) => `${t.id} | ${t.name} | NCO ${t.nco} ${t.ncoTitle}`).join("\n");
      const a = await askGeminiStructured(Answer, [
        ["system",
          "You classify Indian job advertisements for a government skilling dashboard. Advertisements may be in English, Hindi, or a mix written in either script. " +
          "Choose the single trade from the list whose work matches the role being hired. If no trade fits, answer none. Never invent an id. " +
          `Write the rationale in ${LANG[locale]}.`],
        ["human", `Trades (id | name | NCO-2015 family):\n${list}\n\nAdvertisement:\n"""${text}"""`],
      ]);
      const ids = [a.tradeId, ...a.alternates].filter((id) => byId.has(id));
      if (ids.length > 0 || a.tradeId === "none") {
        engine = "gemini";
        const c = Math.max(0, Math.min(1, a.confidence));
        ranked = [...new Set(ids)].slice(0, 3).map((trade, i) => ({ trade, confidence: Math.round((i === 0 ? c : c * 0.5 ** i) * 100) / 100 }));
        rationale = a.rationale;
        if (a.skills.length) skills = a.skills.slice(0, 6);
        if (!district && a.place) district = findEntities(a.place).district;
      }
    } catch {
      note = "fallback";
    }
  }

  const national = new Map(tradeRows().map((r) => [r.trade, r]));
  const matches = ranked.map((m) => {
    const t = byId.get(m.trade)!;
    const sector = tx.sectors.find((s) => s.id === t.sector)!;
    const nat = national.get(t.id)!;
    return {
      trade: t.id, name: t.name, nameHi: t.hi, confidence: m.confidence,
      sector: t.sector, sectorName: sector.name, sectorSkillCouncil: sector.ssc,
      nco2015Family: t.nco, nco2015FamilyTitle: t.ncoTitle, nsqfLevel: t.nsqf, qualificationPack: t.qp,
      courseType: t.kind, durationMonths: t.months,
      national: { scoreNext: nat.s1, classNext: classOf(nat.s1), demandNext: nat.dx, supplyNext: nat.sx },
    };
  });

  let local_balance = null;
  if (district && matches[0]) {
    const c = cells({ district, trade: matches[0].trade, all: true })[0];
    const d = geo().districts.find((x) => x.id === district)!;
    local_balance = { district, districtName: d.name, state: d.state, scoreNext: c.s1, classNext: classOf(c.s1), demandNext: c.dx, supplyNext: c.sx, active: c.act === 1 };
  }

  return ok({ engine, note, matches, rationale, skills, place: local_balance }, { headers: { "cache-control": "no-store" } });
}

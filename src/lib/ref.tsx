"use client";

// Reference data every console screen needs: the names behind the ids.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useT } from "./i18n";
import type { DistrictInfo, Locale, Meta, Sector, StateInfo, Trade } from "./types";

// Names that are not in the data files. District and (outside Hindi) trade names stay in English.
const STATE_NAMES: Record<string, Partial<Record<Locale, string>>> = {
  MH: { hi: "महाराष्ट्र", mr: "महाराष्ट्र", gu: "મહારાષ્ટ્ર", ta: "மகாராஷ்டிரா" },
  TN: { hi: "तमिलनाडु", mr: "तमिळनाडू", gu: "તમિલનાડુ", ta: "தமிழ்நாடு" },
  UP: { hi: "उत्तर प्रदेश", mr: "उत्तर प्रदेश", gu: "ઉત્તર પ્રદેશ", ta: "உத்தரப் பிரதேசம்" },
  GJ: { hi: "गुजरात", mr: "गुजरात", gu: "ગુજરાત", ta: "குஜராத்" },
};
const SECTOR_NAMES: Record<string, Partial<Record<Locale, string>>> = {
  ELEC: { mr: "इलेक्ट्रॉनिक्स व हार्डवेअर", gu: "ઇલેક્ટ્રોનિક્સ અને હાર્ડવેર", ta: "மின்னணுவியல் மற்றும் வன்பொருள்" },
  AUTO: { mr: "ऑटोमोटिव्ह व अभियांत्रिकी", gu: "ઓટોમોટિવ અને એન્જિનિયરિંગ", ta: "வாகனம் மற்றும் பொறியியல்" },
  GREEN: { mr: "हरित रोजगार (नवीकरणीय ऊर्जा)", gu: "ગ્રીન જોબ્સ (નવીનીકરણીય ઊર્જા)", ta: "பசுமை வேலைகள் (புதுப்பிக்கத்தக்க ஆற்றல்)" },
  CONS: { mr: "बांधकाम व इमारत सेवा", gu: "બાંધકામ અને બિલ્ડિંગ સેવાઓ", ta: "கட்டுமானம் மற்றும் கட்டிடச் சேவைகள்" },
  TEXT: { mr: "वस्त्रोद्योग व पोशाख", gu: "કાપડ અને વસ્ત્રો", ta: "ஜவுளி மற்றும் ஆடை" },
  IT: { mr: "आयटी-आयटीईएस", gu: "આઇટી-આઇટીઇએસ", ta: "ஐடி-ஐடிஇஎஸ்" },
  RETL: { mr: "किरकोळ विक्री", gu: "રિટેલ", ta: "சில்லறை வணிகம்" },
  HLTH: { mr: "आरोग्यसेवा", gu: "આરોગ્યસંભાળ", ta: "சுகாதாரம்" },
  LOGI: { mr: "लॉजिस्टिक्स", gu: "લોજિસ્ટિક્સ", ta: "தளவாடம்" },
};

export interface RefData {
  meta: Meta;
  states: StateInfo[];
  districts: DistrictInfo[];
  sectors: Sector[];
  trades: Trade[];
  criticalFlags: number;
}

interface RefApi extends RefData {
  state: (id: string) => StateInfo | undefined;
  district: (id: string) => DistrictInfo | undefined;
  sector: (id: string) => Sector | undefined;
  trade: (id: string) => Trade | undefined;
  /** Names in the reader's language where a translation exists, otherwise English. */
  tradeName: (id: string) => string;
  sectorName: (id: string) => string;
  districtName: (id: string) => string;
  stateName: (id: string) => string;
  geoName: (id: string) => string;
}

const Ctx = createContext<RefApi | null>(null);

export function RefProvider({ value, children }: { value: RefData; children: ReactNode }) {
  const { locale } = useT();
  const api = useMemo<RefApi>(() => {
    const st = new Map(value.states.map((x) => [x.id, x]));
    const di = new Map(value.districts.map((x) => [x.id, x]));
    const se = new Map(value.sectors.map((x) => [x.id, x]));
    const tr = new Map(value.trades.map((x) => [x.id, x]));
    const hi = locale === "hi";
    const stateName = (id: string) => STATE_NAMES[id]?.[locale] ?? st.get(id)?.name ?? id;
    return {
      ...value,
      state: (id) => st.get(id),
      district: (id) => di.get(id),
      sector: (id) => se.get(id),
      trade: (id) => tr.get(id),
      tradeName: (id) => (hi ? tr.get(id)?.hi : tr.get(id)?.name) ?? id,
      sectorName: (id) => (hi ? se.get(id)?.hi : SECTOR_NAMES[id]?.[locale] ?? se.get(id)?.name) ?? id,
      districtName: (id) => di.get(id)?.name ?? id,
      stateName,
      geoName: (id) => di.get(id)?.name ?? stateName(id),
    };
  }, [value, locale]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRefData(): RefApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRefData must be used inside the console layout");
  return v;
}

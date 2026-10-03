// Number and date formatting. Indian digit grouping (12,34,567) and lakh /
// crore for large values, since that is how planners read these numbers.
import type { Locale } from "./types";

const group = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

export const int = (n: number) => group.format(Math.round(n));

/** 1,284 / 12.9K / 1.84 L / 51.7 Cr */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a < 1e4) return int(n);
  if (a < 1e5) return `${one.format(n / 1e3)}K`;
  if (a < 1e7) return `${(n / 1e5).toFixed(a < 1e6 ? 2 : 1)} L`;
  return `${(n / 1e7).toFixed(a < 1e8 ? 2 : 1)} Cr`;
}

/** Axis ticks: the same units as `compact`, without padded zeros (7.5 L, not 7.50 L). */
export function axisLabel(n: number): string {
  const a = Math.abs(n);
  const trim = (x: number) => String(parseFloat(x.toFixed(2)));
  if (a < 1e4) return int(n);
  if (a < 1e5) return `${trim(n / 1e3)}K`;
  if (a < 1e7) return `${trim(n / 1e5)} L`;
  return `${trim(n / 1e7)} Cr`;
}

export const signed = (n: number, f: (v: number) => string = int) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : f(0));
export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;
export const signedPct = (n: number, digits = 0) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}%`;

// Month names are spelled out here rather than taken from Intl: the server and
// the browser ship different locale data ("Sep" vs "Sept"), which would make
// the two renders disagree.
const MONTHS: Record<Locale, { short: string[]; long: string[] }> = {
  en: {
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  hi: {
    short: ["जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून", "जुल", "अग", "सित", "अक्टू", "नवं", "दिसं"],
    long: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  },
  mr: {
    short: ["जाने", "फेब्रु", "मार्च", "एप्रि", "मे", "जून", "जुलै", "ऑग", "सप्टें", "ऑक्टो", "नोव्हें", "डिसें"],
    long: ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"],
  },
  gu: {
    short: ["જાન્યુ", "ફેબ્રુ", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઑગ", "સપ્ટે", "ઑક્ટો", "નવે", "ડિસે"],
    long: ["જાન્યુઆરી", "ફેબ્રુઆરી", "માર્ચ", "એપ્રિલ", "મે", "જૂન", "જુલાઈ", "ઑગસ્ટ", "સપ્ટેમ્બર", "ઑક્ટોબર", "નવેમ્બર", "ડિસેમ્બર"],
  },
  ta: {
    short: ["ஜன", "பிப்", "மார்", "ஏப்", "மே", "ஜூன்", "ஜூலை", "ஆக", "செப்", "அக்", "நவ", "டிச"],
    long: ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"],
  },
};

/** "2027-03" -> "Mar 2027" in the reader's language (Latin digits throughout). */
export function month(ym: string, locale: Locale = "en", long = false): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[locale][long ? "long" : "short"][m - 1]} ${y}`;
}

export function monthShort(ym: string, locale: Locale = "en"): string {
  return MONTHS[locale].short[Number(ym.split("-")[1]) - 1];
}

/** Axis ticks from zero: three to five clean steps, with the lowest top that still covers the data. */
export function ticks(max: number): number[] {
  const m = Math.max(max, 1);
  const mag = 10 ** Math.floor(Math.log10(m));
  let best: { top: number; step: number; n: number } | null = null;
  for (const k of [0.1, 1]) {
    for (const base of [1, 2, 2.5, 5, 10]) {
      const step = base * mag * k;
      const n = Math.ceil(m / step - 1e-9);
      if (n < 3 || n > 5) continue;
      const top = n * step;
      if (!best || top < best.top - 1e-9 || (Math.abs(top - best.top) < 1e-9 && n < best.n)) best = { top, step, n };
    }
  }
  const { step, n } = best ?? { step: m / 4, n: 4 };
  return Array.from({ length: n + 1 }, (_, i) => step * i);
}

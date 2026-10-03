import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Noto_Sans_Devanagari, Noto_Sans_Gujarati, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";
import { PrefsProvider } from "@/lib/prefs";
import { COOKIE, htmlAttrs, parsePrefs } from "@/lib/prefs-core";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Indic scripts fall through to these; they load only when a page uses them.
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "500", "600", "700"], preload: false });
const gujr = Noto_Sans_Gujarati({ variable: "--font-gujr", subsets: ["gujarati"], weight: ["400", "500", "600", "700"], preload: false });
const taml = Noto_Sans_Tamil({ variable: "--font-taml", subsets: ["tamil"], weight: ["400", "500", "600", "700"], preload: false });

export const metadata: Metadata = {
  title: { default: "Kaushal Radar", template: "%s · Kaushal Radar" },
  description:
    "Labour market intelligence for skilling planners: one demand index, district-level gap forecasts and seat recommendations for the next training cycle.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e16" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const prefs = parsePrefs((await cookies()).get(COOKIE)?.value);
  return (
    <html
      {...htmlAttrs(prefs)}
      className={`${sans.variable} ${mono.variable} ${deva.variable} ${gujr.variable} ${taml.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <PrefsProvider initial={prefs}>{children}</PrefsProvider>
      </body>
    </html>
  );
}

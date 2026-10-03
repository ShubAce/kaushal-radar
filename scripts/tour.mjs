// Dev helper: page through a URL at a given viewport and save one screenshot per screenful.
//   node scripts/tour.mjs <url> <outPrefix> [width] [height] [light|dark] [locale] [maxShots] [extraPrefsJSON]
import { chromium } from "playwright-core";

const [, , url, prefix, w = "390", h = "844", theme = "light", locale = "en", max = "8", extra = ""] = process.argv;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: theme });
if (locale !== "en" || extra) {
  const prefs = { locale, theme, scale: 1, contrast: "normal", motion: "full", ...(extra ? JSON.parse(extra) : {}) };
  await ctx.addCookies([{ name: "kr_prefs", value: encodeURIComponent(JSON.stringify(prefs)), url: new URL(url).origin }]);
}
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 300)));
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1500);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
let n = 0;
for (let y = 0; y < total && n < +max; y += +h - 80, n++) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${prefix}-${n + 1}.png` });
}
console.log(`saved ${n} shots, page height ${total}`);
await browser.close();

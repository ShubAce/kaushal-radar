// Dev helper: screenshot a page with the system's Edge browser.
//   node scripts/shot.mjs <url> <out.png> [width] [height] [fullPage 1|0] [light|dark] [waitMs]
import { chromium } from "playwright-core";

const [, , url, out, w = "1440", h = "900", full = "1", theme = "light", wait = "1800", locale = "en", extra = ""] = process.argv;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: theme });
if (locale !== "en" || extra) {
  const prefs = { locale, theme, scale: 1, contrast: "normal", motion: "full", ...(extra ? JSON.parse(extra) : {}) };
  await ctx.addCookies([{ name: "kr_prefs", value: encodeURIComponent(JSON.stringify(prefs)), url: new URL(url).origin }]);
}
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text().slice(0, 400)));
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 400)));
const res = await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
console.log("status", res?.status());
await page.waitForTimeout(+wait);
if (full === "1") {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(160); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}
await page.screenshot({ path: out, fullPage: full === "1" });
await browser.close();

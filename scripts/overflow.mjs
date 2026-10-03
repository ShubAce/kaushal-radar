// Dev helper: report what makes a page wider than the viewport.
//   node scripts/overflow.mjs <width> <url> [url...]
import { chromium } from "playwright-core";

const [, , w = "390", ...urls] = process.argv;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: +w, height: 844 }, deviceScaleFactor: 1 });
for (const url of urls) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1200);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    const clipped = (el) => {
      // inside a horizontally scrollable or clipping ancestor: not a page-level overflow
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      if (clipped(el)) continue;
      out.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 70)} right=${Math.round(r.right)} w=${Math.round(r.width)} "${(el.textContent || "").trim().slice(0, 30)}"`);
    }
    return { vw, scrollW: document.documentElement.scrollWidth, out: out.slice(0, 12), n: out.length };
  });
  console.log(`${url}\n  viewport ${res.vw}, page width ${res.scrollW}${res.scrollW > res.vw ? "  <-- OVERFLOW" : ""}, offenders ${res.n}`);
  for (const o of res.out) console.log("   ", o);
  await page.close();
}
await browser.close();

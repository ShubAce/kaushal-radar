// Dev helper: load every screen and report HTTP status, console errors and page errors.
//   node scripts/errs.mjs [baseUrl] [locale]
import { chromium } from "playwright-core";

const [, , base = "http://localhost:3000", locale = "en"] = process.argv;
const paths = [
  "/", "/dashboard", "/dashboard?state=TN", "/dashboard?state=UP&sector=ELEC", "/dashboard?trade=ems-operator",
  "/district/mh-pune", "/district/up-gautam-buddha-nagar?trade=ems-operator", "/trades", "/trades/ems-operator",
  "/trades/jr-software-dev?state=UP", "/rankings", "/warnings", "/planner", "/methodology", "/data", "/mapper", "/api-docs",
];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (locale !== "en") {
  const prefs = { locale, theme: "light", scale: 1, contrast: "normal", motion: "full" };
  await ctx.addCookies([{ name: "kr_prefs", value: encodeURIComponent(JSON.stringify(prefs)), url: base }]);
}
let bad = 0;
for (const p of paths) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 240)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 240)}`));
  let status = 0;
  try {
    const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 90000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(700);
  } catch (e) {
    errors.push(`navigation: ${String(e.message).split("\n")[0]}`);
  }
  const ok = status === 200 && errors.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${status} ${p}${errors.length ? "\n     " + errors.join("\n     ") : ""}`);
  await page.close();
}
console.log(bad ? `${bad} screen(s) with problems` : "all screens clean");
await browser.close();

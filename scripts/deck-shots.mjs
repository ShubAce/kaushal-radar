// Dev helper: high-resolution crops of the prototype for the idea deck.
//   node scripts/deck-shots.mjs <outDir>
import { chromium } from "playwright-core";

const out = process.argv[2];
const base = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1060 }, deviceScaleFactor: 2.5, colorScheme: "light" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 200)));

const open = async (url, wait = 2400) => {
  await page.goto(base + url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(wait);
};
/** The card (rounded-2xl box) that contains a heading starting with `text`. */
const card = (text) => page.locator("div.rounded-2xl", { has: page.locator(`h2:text-is("${text}"), h2:has-text("${text}")`) }).first();
const save = async (name, locator) => {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await locator.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", name);
};

// 1. state dashboard, content area only (no sidebar)
await open("/dashboard?state=TN");
await page.screenshot({ path: `${out}/dash-state.png`, clip: { x: 248, y: 56, width: 1032, height: 1004 } });
console.log("saved dash-state");

// 2. national dashboard, content area
await open("/dashboard");
await page.screenshot({ path: `${out}/dash-national.png`, clip: { x: 248, y: 56, width: 1032, height: 1004 } });
console.log("saved dash-national");

// 3. district forecast card
await open("/district/tn-krishnagiri?trade=ems-operator");
await save("district-forecast", card("Demand and supply"));

// 4. planner: seats by trade
await open("/planner");
await save("planner-seats", card("Seats by trade"));

// 5. warnings timeline
await open("/warnings");
await save("warnings-timeline", card("When thresholds are crossed"));

// 6. job-ad mapper result
await open("/mapper");
await page.getByRole("button", { name: "Map this advertisement" }).click();
await page.waitForTimeout(2400);
await save("mapper-result", page.locator("div.rounded-2xl", { hasText: "Best match" }).first());

// 7. back-test card
await open("/methodology");
await save("backtest", card("Back-test"));

await browser.close();

// Dev helper: click through the interactive flows and save a screenshot of each.
//   node scripts/flows.mjs <outDir>
import { chromium } from "playwright-core";

const out = process.argv[2];
const base = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 300)));
const step = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); } catch (e) { console.log("FAIL", name, "-", String(e.message).split("\n")[0]); }
};

await step("mapper: map the default advertisement", async () => {
  await page.goto(`${base}/mapper`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Map this advertisement" }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/flow-mapper.png` });
});

await step("mapper: Hindi example", async () => {
  await page.getByRole("button", { name: "हिन्दी" }).click();
  await page.getByRole("button", { name: "Map this advertisement" }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/flow-mapper-hi.png` });
});

await step("ask panel: question about a district", async () => {
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask the data" }).click();
  await page.waitForTimeout(600);
  const box = page.getByRole("dialog").locator("textarea, input[type=text]").first();
  await box.fill("Which trades are short in Pune?");
  await box.press("Enter");
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/flow-ask.png` });
});

await step("dashboard: drill into Tamil Nadu from the map", async () => {
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("select").first().selectOption("TN");
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/flow-drill.png` });
});

await step("planner: switch budget and edit a row", async () => {
  await page.goto(`${base}/planner`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByRole("radio", { name: "+5% seats" }).click();
  await page.waitForTimeout(900);
  const input = page.locator("table input[type=number]").first();
  await input.fill("500");
  await input.blur();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/flow-planner.png`, fullPage: true });
});

await step("warnings: expand the first flag", async () => {
  await page.goto(`${base}/warnings`, { waitUntil: "networkidle" });
  await page.locator("button[aria-expanded]").first().click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/flow-warning.png` });
});

await step("api docs: run a request", async () => {
  await page.goto(`${base}/api-docs`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Run request" }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/flow-api.png` });
});

await step("keyboard: tab order starts at the skip link", async () => {
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const seen = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    seen.push(await page.evaluate(() => {
      const el = document.activeElement;
      return `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28)}`;
    }));
  }
  console.log("     tab order:", seen.join(" | "));
});

await browser.close();

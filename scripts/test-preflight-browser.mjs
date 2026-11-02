import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
const { chromium, firefox } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.BASE_URL || "http://127.0.0.1:4173";
const preview = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
    "--outDir",
    process.env.PREVIEW_DIR || "dist",
  ],
  { stdio: "ignore" },
);
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await globalThis.fetch(baseURL)).ok;
    } catch {
      /* Wait for the local server. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "Local preview did not start");
  for (const engine of [chromium, firefox]) {
    const browser = await engine.launch({ headless: true });
    for (const width of [1400, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(baseURL);
      await page.locator("#blank-template").click();
      await page.locator("#data-input").setInputFiles({
        name: "synthetic.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "first_name,last_name\nRECIPIENT_CANARY_A,One\n\nRECIPIENT_CANARY_B,Two\n",
        ),
      });
      await page.locator("#add-field").click();
      await page.locator("#row-selection").fill("2");
      await page.locator("#field-font").selectOption("custom");
      await page.locator("#preflight").click();
      const inspector = page.locator("#preflight-inspector");
      await inspector.waitFor({ state: "visible" });
      assert.match(await inspector.innerText(), /Row 4/);
      assert.doesNotMatch(await inspector.innerText(), /RECIPIENT_CANARY/);
      await page.locator("#generate").click();
      assert.match(await page.locator("#progress").innerText(), /Resolve.*preflight error/);
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#download-preflight").focus();
      await page.keyboard.press("Enter");
      const download = await downloadPromise;
      const reportText = await readFile(await download.path(), "utf8");
      assert.doesNotMatch(reportText, /RECIPIENT_CANARY|synthetic.csv/);
      const report = JSON.parse(reportText);
      assert.equal(report.recordCount, 1);
      assert(report.findings.every((finding) => finding.rowNumber === 4));
      await inspector.getByRole("button", { name: "Inspect row 4 and field" }).first().focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#record-select").inputValue(), "1");
      assert.equal(
        await page.locator("#field-column").evaluate((node) => node === document.activeElement),
        true,
      );
      await page.locator("#field-font").selectOption("helvetica");
      assert.doesNotMatch(await inspector.innerText(), /Attach a local font/);
      await page.locator("#row-selection").fill("all");
      await page.locator("#field-font").selectOption("custom");
      assert.match(await inspector.innerText(), /Row 2/);
      assert.match(await inspector.innerText(), /Row 4/);
      await page.locator("#field-font").selectOption("helvetica");
      await page.locator("#batch-size").fill("1");
      await page.locator("#generate").click();
      await page.locator("#download-part").waitFor({ state: "visible" });
      await page.locator("#cancel-queue").click();
      await page.locator("#generate").waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.querySelector("#generate").disabled);
      assert.match(await page.locator("#progress").innerText(), /cancelled/);
      await page.locator("#generate").click();
      await page.locator("#download-part").waitFor({ state: "visible" });
      const zipPromise = page.waitForEvent("download");
      await page.locator("#download-part").click();
      await zipPromise;
      await page.locator("#download-part").waitFor({ state: "visible" });
      await page.locator("#cancel-queue").click();
      await page.waitForFunction(() => !document.querySelector("#generate").disabled);
      await page.locator("#preflight").click();
      assert.doesNotMatch(await inspector.innerText(), /RECIPIENT_CANARY/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.locator("#clear-session").click();
      assert(await inspector.isHidden());
      assert.deepEqual(errors, []);
      console.log(
        engine.name(),
        width,
        "preflight, value-free download, navigation, edits, repeated queue and cancellation passed",
      );
      await context.close();
    }
    await browser.close();
  }
} finally {
  preview.kill();
}

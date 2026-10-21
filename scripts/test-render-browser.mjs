import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import JSZip from "jszip";
import { PDFDocument, PDFDict, PDFName, rgb } from "pdf-lib";

const { chromium, firefox } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const out = process.env.ACCEPTANCE_DIR || "/tmp/bds-render-acceptance";
await mkdir(out, { recursive: true });
const source = await PDFDocument.create();
for (const dimensions of [
  [600, 400],
  [400, 600],
]) {
  const sheet = source.addPage(dimensions);
  sheet.drawRectangle({
    x: 0,
    y: 0,
    width: dimensions[0],
    height: dimensions[1],
    color: rgb(1, 1, 1),
  });
}
const pdfBytes = Buffer.from(await source.save());
const server = spawn(
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
const base = "http://127.0.0.1:4173";
async function downloadPart(page, format) {
  await page.locator('input[name="format"][value="' + format + '"]').check();
  await page.locator("#generate").click();
  await page.locator("#download-part").waitFor({ state: "visible" });
  const pending = page.waitForEvent("download");
  await page.locator("#download-part").click();
  const download = await pending;
  const bytes = await readFile(await download.path());
  await page.waitForFunction(() => !document.querySelector("#generate").disabled);
  return JSZip.loadAsync(bytes);
}
async function bounds(page, bytes) {
  return page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = "data:image/png;base64," + encoded;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width,
      top = canvas.height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] > 100 && data[i + 1] < 80 && data[i + 2] < 80 && data[i + 3] > 100) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    return {
      width: canvas.width,
      height: canvas.height,
      left,
      top,
      right,
      bottom,
      inkHeight: bottom - top + 1,
    };
  }, Buffer.from(bytes).toString("base64"));
}
// Minimal real OOXML workbook: explicit worksheet selection, blank row, duplicate names.
const workbook = new JSZip();
workbook.file(
  "[Content_Types].xml",
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
);
workbook.file(
  "_rels/.rels",
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
);
workbook.file(
  "xl/workbook.xml",
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Unused" sheetId="1" r:id="rId1"/><sheet name="People" sheetId="2" r:id="rId2"/></sheets></workbook>',
);
workbook.file(
  "xl/_rels/workbook.xml.rels",
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
);
const sheet = (rows) =>
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
  rows +
  "</sheetData></worksheet>";
const cell = (ref, value) => '<c r="' + ref + '" t="inlineStr"><is><t>' + value + "</t></is></c>";
workbook.file(
  "xl/worksheets/sheet1.xml",
  sheet(
    '<row r="1">' + cell("A1", "name") + '</row><row r="2">' + cell("A2", "WRONG_SHEET") + "</row>",
  ),
);
workbook.file(
  "xl/worksheets/sheet2.xml",
  sheet(
    '<row r="1">' +
      cell("A1", "name") +
      cell("B1", "note") +
      '</row><row r="2">' +
      cell("A2", "Ω Synthetic") +
      cell("B2", "First") +
      '</row><row r="4">' +
      cell("A4", "Ω Synthetic") +
      cell("B4", "Second") +
      "</row>",
  ),
);
const xlsxBytes = await workbook.generateAsync({ type: "nodebuffer" });
assert(process.env.TEST_FONT, "Set TEST_FONT to an explicitly licensed local TTF fixture.");
const fontBytes = await readFile(process.env.TEST_FONT);
assert(
  fontBytes.length <= 10 * 1024 * 1024,
  "Font fixture must satisfy the documented 10 MB input limit",
);
console.log(JSON.stringify({ fontFixture: process.env.TEST_FONT, fontBytes: fontBytes.length }));
const results = [];
try {
  let ready = false;
  for (let n = 0; n < 100; n++) {
    try {
      ready = (await globalThis.fetch(base)).ok;
    } catch {
      /* Local startup. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready);
  for (const engine of [chromium, firefox]) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1400, height: 1000 },
        acceptDownloads: true,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page
        .locator("#template-input")
        .setInputFiles({ name: "two-pages.pdf", mimeType: "application/pdf", buffer: pdfBytes });
      await page.locator("#data-input").setInputFiles({
        name: "synthetic.csv",
        mimeType: "text/csv",
        buffer: Buffer.from('name,note\nMMMM,"First line\nSecond line"\n'),
      });
      await page.waitForFunction(() => !document.querySelector("#add-field").disabled);
      await page.locator("#add-field").click();
      await page.locator("#field-size").fill("48");
      await page.locator("#field-color").fill("#c00000");
      await page.locator("#field-x").fill("20");
      await page.locator("#field-y").fill("20");
      await page.locator("#field-height").fill("60");
      await page.locator("#filename-pattern").fill("synthetic");
      const pngZip = await downloadPart(page, "png");
      const png = await pngZip.file("synthetic.png").async("uint8array");
      await writeFile(out + "/" + engine.name() + "-pdf-template.png", png);
      const ink = await bounds(page, png);
      results.push({ engine: engine.name(), case: "PDF template PNG point scale", ...ink });
      await writeFile(out + "/RESULTS.json", JSON.stringify(results, null, 2));
      assert.equal(ink.width, 1200);
      assert.equal(ink.height, 800);
      assert(
        ink.inkHeight >= 60 && ink.inkHeight <= 100,
        "48-point PDF text must rasterize at twice the pixel size on a 2x preview: " +
          JSON.stringify(ink),
      );
      const pdfZip = await downloadPart(page, "pdf");
      const generated = await pdfZip.file("synthetic.pdf").async("uint8array");
      await writeFile(out + "/" + engine.name() + "-two-pages.pdf", generated);
      const document = await PDFDocument.load(generated);
      assert.equal(document.getPageCount(), 2);
      assert.deepEqual(
        document.getPages().map((p) => [p.getWidth(), p.getHeight()]),
        [
          [600, 400],
          [400, 600],
        ],
      );
      await page.locator("#field-column").selectOption("note");
      await page.locator("#field-fit").selectOption("wrap");
      await page.locator("#field-size").fill("24");
      const multiline = await downloadPart(page, "png");
      const multilineBytes = await multiline.file("synthetic.png").async("uint8array");
      const multiInk = await bounds(page, multilineBytes);
      assert(
        multiInk.inkHeight > 65,
        "Explicit newlines must remain separate output lines: " + JSON.stringify(multiInk),
      );
      await writeFile(out + "/" + engine.name() + "-multiline.png", multilineBytes);
      await page.screenshot({ path: out + "/" + engine.name() + "-studio.png", fullPage: true });
      for (const mimeType of ["image/png", "image/jpeg"]) {
        await page.locator("#clear-session").click();
        const encoded = await page.evaluate((type) => {
          const canvas = document.createElement("canvas");
          canvas.width = 600;
          canvas.height = 400;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 600, 400);
          ctx.fillStyle = "#003399";
          ctx.fillRect(0, 0, 600, 10);
          return canvas.toDataURL(type).split(",")[1];
        }, mimeType);
        await page.locator("#template-input").setInputFiles({
          name: mimeType === "image/png" ? "fixture.png" : "fixture.jpg",
          mimeType,
          buffer: Buffer.from(encoded, "base64"),
        });
        await page.locator("#data-input").setInputFiles({
          name: "synthetic.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: xlsxBytes,
        });
        await page.waitForFunction(() => !document.querySelector("#worksheet").disabled);
        await page.locator("#worksheet").selectOption("People");
        await page.waitForFunction(
          () => document.querySelector("#record-select").options.length === 2,
        );
        assert.match(await page.locator("#record-select").textContent(), /Row 2/);
        assert.match(await page.locator("#record-select").textContent(), /Row 4/);
        assert.doesNotMatch(await page.locator("#record-select").textContent(), /WRONG_SHEET/);
        await page.locator("#add-field").click();
        await page
          .locator("#font-input")
          .setInputFiles({ name: "licensed-fixture.ttf", mimeType: "font/ttf", buffer: fontBytes });
        await page
          .waitForFunction(() => document.querySelector("#font-hint").textContent.includes("ready"))
          .catch(async (error) => {
            throw new Error(String(error) + " / " + (await page.locator("#progress").innerText()));
          });
        await page.locator("#field-font").selectOption("custom");
        await page.locator("#field-size").fill("36");
        await page.locator("#field-color").fill("#c00000");
        await page.locator("#filename-pattern").fill("proof");
        assert.match(
          await page
            .locator(".mapped-field")
            .first()
            .evaluate((n) => globalThis.getComputedStyle(n).fontFamily),
          /BDSCustom/,
        );
        const customPdf = await downloadPart(page, "pdf");
        const manifest = JSON.parse(
          await customPdf.file("batch-document-studio-manifest.json").async("string"),
        );
        assert.equal(manifest.recordCount, 2);
        assert.deepEqual(
          manifest.files.map((f) => f.rowNumber),
          [2, 4],
        );
        assert.deepEqual(
          manifest.files.map((f) => f.fileName),
          ["proof.pdf", "proof-2.pdf"],
        );
        const fontPdf = await customPdf.file("proof.pdf").async("uint8array");
        const embedded = await PDFDocument.load(fontPdf);
        assert(
          embedded.context
            .enumerateIndirectObjects()
            .some(
              ([, object]) =>
                object instanceof PDFDict &&
                (object.has(PDFName.of("FontFile2")) || object.has(PDFName.of("FontFile3"))),
            ),
          "Custom PDF font must be embedded",
        );
        assert.deepEqual(
          [embedded.getPage(0).getWidth(), embedded.getPage(0).getHeight()],
          [600, 400],
        );
        const customPng = await downloadPart(page, "png");
        const image = await customPng.file("proof.png").async("uint8array");
        const imageBounds = await bounds(page, image);
        assert.equal(imageBounds.width, 600);
        assert.equal(imageBounds.height, 400);
        assert(imageBounds.inkHeight > 20);
        const suffix = mimeType === "image/png" ? "png" : "jpeg";
        await writeFile(out + "/" + engine.name() + "-" + suffix + "-custom.pdf", fontPdf);
        await writeFile(out + "/" + engine.name() + "-" + suffix + "-custom.png", image);
        await page.locator("#clear-session").click();
        assert.equal(
          await page.evaluate(
            () => [...document.fonts].filter((f) => f.family.startsWith("BDSCustom")).length,
          ),
          0,
        );
        results.push({
          engine: engine.name(),
          case: suffix + " template / real XLSX / embedded TTF / clear",
          passed: true,
        });
      }
      assert.deepEqual(errors, []);
      results.push({
        engine: engine.name(),
        case: "two-page PDF and multiline PNG",
        passed: true,
        ...multiInk,
      });
    } finally {
      await browser.close();
    }
  }
  await writeFile(out + "/RESULTS.json", JSON.stringify({ passed: true, results }, null, 2));
  console.log(JSON.stringify({ passed: true, out, results }));
} finally {
  server.kill();
}

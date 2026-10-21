# Testing

Run from the repository root with Node.js 20 or newer:

```bash
npm ci
npm run format
npm run lint
npm run test
npm run build
npm audit
npm run package
```

The tests cover header normalization, placeholder interpolation, cross-platform filename safety,
deterministic collision handling, mapped-field validation, color conversion, CSV quoting and
newline behavior, spreadsheet-row normalization, recipe safety, value-free preflight evidence,
and archive proof files. The production build type-checks all browser and rendering code.

Manual release smoke check:

1. Load a PNG template and sample records.
2. Add fields for `first_name`, `last_name`, and `award`; drag and restyle them.
3. Preview all three sample records.
4. Generate PDF output and inspect the ZIP manifest and documents.
5. Repeat with PNG output.
6. Load a one-page PDF template and an XLSX file with duplicated filenames; confirm collision suffixes.
7. Clear the session and confirm the proof and inputs reset.
8. Export and re-import a recipe; confirm it contains no recipient, template, or font bytes.
9. Map wrapped and shrink-to-fit fields on separate pages of a multi-page PDF and inspect outputs.
10. Attach a licensed local TTF/OTF, generate a PDF, then clear the session and confirm it is gone.
11. Run preflight with missing and overflowing values; inspect its UI summary, JSON, and CSV proof.

Automated tests do not establish visual print accuracy, legal credential validity, font licensing,
complex-script shaping, mobile precision, or compatibility with every spreadsheet producer.

## Version 1.2.0: reviewed improvements

Add placement guides, keyboard/numeric positioning, duplicate fields and a cancellable selected-record ZIP queue.

The preview toolbar wraps at 390 pixels. Fields support numeric percentages, arrow-key nudging (0.1%, Shift 1%), page-aware edge/center guides and duplication. XLSX worksheet selection and explicit record ranges control exports, with original worksheet row numbers retained in manifests and preflight. ZIP parts render sequentially, await an explicit download before continuing, and cap buffered document bytes at 32 MB per part with 1–50 records per part. Cancellation discards the current undownloaded part and stops subsequent work; previously downloaded parts remain. Inputs, parser memory, a single document render and compression overhead are outside that output-buffer cap. Large parts fail with guidance to select fewer records. Collision-safe names span the queue. Templates, rows and fonts stay local; a blank sample template supports an entirely local walkthrough. Automated PDF/ZIP tests verify numbering, cancellation and limits; desktop/mobile browser QA exercised numeric placement, duplication and queue cancellation. File-scheme launch, physical print accuracy and every XLSX producer are not claimed.

Validation: `npm run check`, `npm audit`, and `npm run package`.

## 1.3.0 - 2026-10-16

Run preflight before generation to review row number, field ID, severity, and a plain-language
explanation. Each finding opens its original worksheet record and mapped field. Findings refresh
after field, font, output-format, and record-selection changes. Download the value-free JSON
report independently, including when errors prevent ZIP creation. Reports contain no recipient
cell values. The live document preview still displays the selected record as before.

Browser acceptance: build the application, install Playwright 1.64.1 and its Chromium/Firefox
browsers in an isolated test environment, then run `node scripts/test-preflight-browser.mjs`.
Set `PLAYWRIGHT_MODULE` to the absolute Playwright index.mjs path when installed outside the
checkout. The script starts a local preview and checks desktop/390px layouts, synthetic recipient
canaries, original worksheet row identity after filtering, keyboard navigation and report download,
blocking errors, field edits, repeated queue runs, cancellation, and clearing the session.

## Rendering regression acceptance

After building, set `TEST_FONT` to a licensed local TTF under the documented 10 MB font limit, then run `node scripts/test-render-browser.mjs` with the same Playwright 1.64.1 setup. The reference Linux run uses the installed Liberation Sans Regular TTF. `ACCEPTANCE_DIR` chooses the isolated evidence directory (default `/tmp/bds-render-acceptance`). It drives the built app in Chromium and Firefox with a synthetic two-page PDF, quoted multiline CSV, a real two-sheet XLSX workbook, PNG/JPEG templates and a local TTF. It downloads actual ZIP outputs, checks natural PDF page sizes, embedded custom fonts, original worksheet row numbers, collision filenames, font clearing and 2× PNG text scale, and retains PNG/PDF outputs plus screenshots. `PREVIEW_DIR` can point to an unpacked release ZIP to verify the installed artifact. Run the existing preflight browser suite as well for cancellation, retry and session clearing. These browser checks do not establish physical printing, color management, every font or spreadsheet producer, or native Safari behavior.

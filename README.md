# Batch Document Studio

Batch Document Studio turns a PDF or image template and a CSV/XLSX spreadsheet into a ZIP of personalized PDF or PNG documents. It runs entirely in the browser: templates, recipient rows, rendered documents, and ZIP contents stay on the device.

Use it for certificates, award cards, event credentials, badges, name tags, or other personalized documents that repeat a visual design while changing text.

## Three-minute path

1. Open the [browser application](https://loganpendragonmultiverse.github.io/batch-document-studio/) or serve the downloaded release ZIP with a local static server.
2. Choose a multi-page PDF, PNG, or JPEG template up to 25 MB.
3. Choose a CSV or XLSX spreadsheet. Select the XLSX worksheet. The first row supplies field names.
4. Add fields, select their spreadsheet columns, choose wrapping or shrink-to-fit, and drag them
   onto any template page.
5. Preview multiple records, choose PDF or PNG, set a filename pattern, and select records and **Build ZIP queue**.

The ZIP contains one file per non-empty spreadsheet row plus a JSON manifest connecting each filename to its original spreadsheet row number.

## What version 1 does

- Reads CSV and explicitly selected XLSX worksheets.
- Preserves duplicate or blank spreadsheet headers by assigning stable unique names.
- Previews each page of PDF templates and full PNG/JPEG templates.
- Maps any spreadsheet column to draggable text fields with size, color, alignment, and width controls.
- Places fields independently across every page of a PDF template.
- Wraps multiline text, shrinks long text to a chosen minimum size, or flags possible clipping.
- Embeds a locally selected TTF or OTF font in generated PDFs when its license permits that use.
- Switches between real recipient rows before generation.
- Produces PDF or PNG documents and resolves filename collisions safely.
- Packages outputs with a small, data-minimized audit manifest.
- Exports and imports reusable project recipes containing layout and export settings but no rows.
- Runs batch preflight and includes a value-free JSON report and CSV proof sheet in every ZIP.
- Uses no account, server upload, analytics, local storage, or telemetry.

## Privacy and security

The production bundle makes no application network requests. All parsing and rendering happens in the browser. The public demo requires a normal page request to GitHub Pages, but uploaded files are not transmitted by the application.

Treat recipient spreadsheets and output ZIPs as sensitive. Batch Document Studio does not encrypt them, delete copies from your downloads folder, verify that you have permission to use a template, or certify that generated documents are legally valid credentials.

Untrusted PDF, image, and spreadsheet files are processed by third-party parsers inside the browser. Keep the browser current and use the documented 25 MB template limit. See [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## Supported platforms

The project is tested as a static application on current desktop Chromium and Firefox behavior through its browser APIs and on Windows, macOS, and Linux through its Node-based test/build matrix. Touch layouts are responsive, but precise field placement is most comfortable with a pointer.

## Limitations

- Custom fonts are user-supplied and are not stored in recipes; reattach the font each session and
  confirm its license permits embedding. Complex-script shaping still depends on the selected font
  and PDF library capabilities.
- PNG output represents the first template page only. Fields mapped to later pages are reported by
  preflight and omitted from PNG output.
- PNG output uses the rendered preview resolution. It is not a print-preflight or color-management system.
- The tool does not email recipients, host QR verification records, sign documents, or persist
  projects automatically. Portable recipes are explicit downloads and exclude templates and rows.
- `.xls`, password-protected spreadsheets, macros, Google Sheets URLs, and multi-sheet selection are not supported.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Quality and release commands:

```bash
npm run check
npm audit
npm run package
```

`npm run package` creates a versioned offline ZIP and SHA-256 file in `release/`.

## Project status and maintenance

Version 1.1.0 is the current complete release. It adds portable recipes, multiline and fit-aware
text, local font embedding, multi-page PDF placement, and value-free batch preflight evidence.
There is no promised roadmap or release cadence. Security reports are handled according to
[SECURITY.md](SECURITY.md); feature ideas can be discussed through GitHub Issues.

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. For usage questions, see [SUPPORT.md](SUPPORT.md). Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE).

## Version 1.2.0: reviewed improvements

Add placement guides, keyboard/numeric positioning, duplicate fields and a cancellable selected-record ZIP queue.

The preview toolbar wraps at 390 pixels. Fields support numeric percentages, arrow-key nudging (0.1%, Shift 1%), page-aware edge/center guides and duplication. XLSX worksheet selection and explicit record ranges control exports, with original worksheet row numbers retained in manifests and preflight. ZIP parts render sequentially, await an explicit download before continuing, and cap buffered document bytes at 32 MB per part with 1–50 records per part. Cancellation discards the current undownloaded part and stops subsequent work; previously downloaded parts remain. Inputs, parser memory, a single document render and compression overhead are outside that output-buffer cap. Large parts fail with guidance to select fewer records. Collision-safe names span the queue. Templates, rows and fonts stay local; a blank sample template supports an entirely local walkthrough. Automated PDF/ZIP tests verify numbering, cancellation and limits; desktop/mobile browser QA exercised numeric placement, duplication and queue cancellation. File-scheme launch, physical print accuracy and every XLSX producer are not claimed.

Validation: `npm run check`, `npm audit`, and `npm run package`.

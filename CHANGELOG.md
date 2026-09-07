# Changelog

## 1.1.0 — 2026-08-10

- Added portable project recipe export/import without template, recipient, or font data.
- Added multiline wrapping, shrink-to-fit, minimum-size, and line-height field controls.
- Added explicit local TTF/OTF loading and embedded custom fonts for PDF output.
- Added page-aware placement across multi-page PDF templates.
- Added value-free batch preflight JSON and CSV proof sheets for missing values, overflow, page,
  format, and font problems.
- Updated PDF.js to the patched 6.2.108 release after the dependency gate identified a high-severity
  advisory in the previously resolved version.

## 1.0.0 — 2026-08-03

- Released local CSV and XLSX recipient parsing.
- Added PDF, PNG, and JPEG template previews with draggable spreadsheet fields.
- Added row previews, field styling, PDF/PNG generation, collision-safe filenames, ZIP packaging, and a data-minimized manifest.
- Added responsive studio UI, explicit privacy boundaries, tests, cross-platform CI, CodeQL, Pages deployment, and release packaging.

## Version 1.2.0: reviewed improvements

Add placement guides, keyboard/numeric positioning, duplicate fields and a cancellable selected-record ZIP queue.

The preview toolbar wraps at 390 pixels. Fields support numeric percentages, arrow-key nudging (0.1%, Shift 1%), page-aware edge/center guides and duplication. XLSX worksheet selection and explicit record ranges control exports, with original worksheet row numbers retained in manifests and preflight. ZIP parts render sequentially, await an explicit download before continuing, and cap buffered document bytes at 32 MB per part with 1–50 records per part. Cancellation discards the current undownloaded part and stops subsequent work; previously downloaded parts remain. Inputs, parser memory, a single document render and compression overhead are outside that output-buffer cap. Large parts fail with guidance to select fewer records. Collision-safe names span the queue. Templates, rows and fonts stay local; a blank sample template supports an entirely local walkthrough. Automated PDF/ZIP tests verify numbering, cancellation and limits; desktop/mobile browser QA exercised numeric placement, duplication and queue cancellation. File-scheme launch, physical print accuracy and every XLSX producer are not claimed.

Validation: `npm run check`, `npm audit`, and `npm run package`.

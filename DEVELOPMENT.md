# Development handoff

## Purpose

Batch Document Studio is a clean-room, browser-only batch document generator. It was created from a generic workflow observation—spreadsheet rows should become personalized documents—not from client code, data, branding, assets, database structures, or credentials.

## Version 1 boundary

The release accepts visual templates and first-sheet CSV/XLSX data, provides page-aware fit-capable
text mappings, previews real rows, and exports collision-safe PDF or PNG files in a ZIP with a
minimal manifest, preflight report, and proof sheet.

The application intentionally excludes accounts, server persistence, email, hosted verification,
template marketplaces, signatures, and automatic project persistence. Version 1.1 supports
user-supplied local fonts and multi-page PDF placement without weakening the browser-only boundary.

## Architecture

- Vite and strict TypeScript provide a static browser bundle.
- `read-excel-file` reads XLSX files; CSV parsing is project-owned and tested.
- PDF.js renders PDF previews.
- pdf-lib creates personalized PDFs.
- Canvas creates PNG output.
- JSZip packages outputs and the manifest.
- Core filename, interpolation, header, and field validation logic is isolated for deterministic tests.
- Recipe files contain only template identity, field layout, and export settings. They never contain
  template bytes, spreadsheet rows, or font bytes.

Files are held only in page memory. The application deliberately has no persistence layer or runtime API endpoint.

## Safety decisions

- Template files are capped at 25 MB before parsing.
- Output names remove path separators, control bytes, reserved Windows device names, and collision ambiguity.
- The ZIP manifest records spreadsheet row numbers and filenames, not complete recipient rows.
- No remote fonts, analytics, CDN scripts, or external runtime dependencies are loaded by the built application.
- Font files are capped at 10 MB, remain in page memory, and require an explicit local selection.
- Preflight and proof evidence records row numbers, field IDs, and finding codes without cell values.
- Generated documents are outputs for human review, not verified credentials or legal attestations.

## Verification

Use the exact commands in [TESTING.md](TESTING.md). Claims in the README must not exceed tested behavior. Release artifacts are built from `dist/` by `scripts/package.mjs` and receive a SHA-256 sidecar.

## Version 1.2.0: reviewed improvements

Add placement guides, keyboard/numeric positioning, duplicate fields and a cancellable selected-record ZIP queue.

The preview toolbar wraps at 390 pixels. Fields support numeric percentages, arrow-key nudging (0.1%, Shift 1%), page-aware edge/center guides and duplication. XLSX worksheet selection and explicit record ranges control exports, with original worksheet row numbers retained in manifests and preflight. ZIP parts render sequentially, await an explicit download before continuing, and cap buffered document bytes at 32 MB per part with 1–50 records per part. Cancellation discards the current undownloaded part and stops subsequent work; previously downloaded parts remain. Inputs, parser memory, a single document render and compression overhead are outside that output-buffer cap. Large parts fail with guidance to select fewer records. Collision-safe names span the queue. Templates, rows and fonts stay local; a blank sample template supports an entirely local walkthrough. Automated PDF/ZIP tests verify numbering, cancellation and limits; desktop/mobile browser QA exercised numeric placement, duplication and queue cancellation. File-scheme launch, physical print accuracy and every XLSX producer are not claimed.

Validation: `npm run check`, `npm audit`, and `npm run package`.

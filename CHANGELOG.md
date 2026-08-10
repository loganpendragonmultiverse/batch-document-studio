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

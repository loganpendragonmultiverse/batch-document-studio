# Development handoff

## Purpose

Batch Document Studio is a clean-room, browser-only batch document generator. It was created from a generic workflow observation—spreadsheet rows should become personalized documents—not from client code, data, branding, assets, database structures, or credentials.

## Version 1 boundary

The release accepts a one-page visual template and first-sheet CSV/XLSX data, provides draggable single-line text mappings, previews real rows, and exports collision-safe PDF or PNG files in a ZIP with a minimal manifest.

The application intentionally excludes accounts, server persistence, email, hosted verification, template marketplaces, signatures, custom fonts, and multi-page field placement. Those exclusions keep the privacy claim and maintenance surface understandable.

## Architecture

- Vite and strict TypeScript provide a static browser bundle.
- `read-excel-file` reads XLSX files; CSV parsing is project-owned and tested.
- PDF.js renders PDF previews.
- pdf-lib creates personalized PDFs.
- Canvas creates PNG output.
- JSZip packages outputs and the manifest.
- Core filename, interpolation, header, and field validation logic is isolated for deterministic tests.

Files are held only in page memory. The application deliberately has no persistence layer or runtime API endpoint.

## Safety decisions

- Template files are capped at 25 MB before parsing.
- Output names remove path separators, control bytes, reserved Windows device names, and collision ambiguity.
- The ZIP manifest records spreadsheet row numbers and filenames, not complete recipient rows.
- No remote fonts, analytics, CDN scripts, or external runtime dependencies are loaded by the built application.
- Generated documents are outputs for human review, not verified credentials or legal attestations.

## Verification

Use the exact commands in [TESTING.md](TESTING.md). Claims in the README must not exceed tested behavior. Release artifacts are built from `dist/` by `scripts/package.mjs` and receive a SHA-256 sidecar.

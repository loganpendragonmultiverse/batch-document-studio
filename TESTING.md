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

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

The tests cover header normalization, placeholder interpolation, cross-platform filename safety, deterministic collision handling, mapped-field validation, color conversion, CSV quoting and newline behavior, and spreadsheet-row normalization. The production build type-checks all browser and rendering code.

Manual release smoke check:

1. Load a PNG template and sample records.
2. Add fields for `first_name`, `last_name`, and `award`; drag and restyle them.
3. Preview all three sample records.
4. Generate PDF output and inspect the ZIP manifest and documents.
5. Repeat with PNG output.
6. Load a one-page PDF template and an XLSX file with duplicated filenames; confirm collision suffixes.
7. Clear the session and confirm the proof and inputs reset.

Automated tests do not establish visual print accuracy, legal credential validity, custom-font behavior, mobile precision, or compatibility with every spreadsheet producer.

import "./styles.css";

import { clamp, createRecipe, preflightBatch, validateFields, validateRecipe } from "./core";
import { downloadBlob, generateArchive } from "./render";
import { readSpreadsheet } from "./spreadsheet";
import { readTemplate } from "./template";
import type {
  Dataset,
  FontAsset,
  OutputFormat,
  TemplateDocument,
  TextAlignment,
  TextField,
  TextFit,
} from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root not found.");

app.innerHTML = `
  <header class="masthead">
    <a class="brand" href="#workspace" aria-label="Batch Document Studio home">
      <span class="brand-mark">B/D</span>
      <span>Batch Document Studio</span>
    </a>
    <div class="privacy-pill"><span></span> Local session · no uploads</div>
  </header>
  <main id="workspace" class="workspace">
    <aside class="rail" aria-label="Project setup">
      <div class="eyebrow">Document run</div>
      <h1>Turn one template into a finished batch.</h1>
      <p class="lede">Map spreadsheet columns onto a PDF or image, preview real records, then export a reviewable ZIP.</p>

      <section class="setup-card" data-ready="false" id="template-card">
        <div class="step-number">01</div>
        <div>
          <h2>Template</h2>
          <p id="template-summary">PDF, PNG, or JPEG · first page</p>
          <label class="file-button">Choose template<input id="template-input" type="file" accept="application/pdf,image/png,image/jpeg" /></label>
        </div>
      </section>

      <section class="setup-card" data-ready="false" id="data-card">
        <div class="step-number">02</div>
        <div>
          <h2>Recipient data</h2>
          <p id="data-summary">CSV or XLSX</p>
          <label class="file-button">Choose spreadsheet<input id="data-input" type="file" accept=".csv,.xlsx" /></label>
          <button class="text-button" id="built-in-records" type="button">Try built-in records</button>
        </div>
      </section>

      <section class="setup-card" data-ready="false" id="fields-card">
        <div class="step-number">03</div>
        <div>
          <h2>Mapped fields</h2>
          <p id="fields-summary">Add data after loading both files</p>
          <button class="file-button" id="add-field" type="button" disabled>Add field</button>
        </div>
      </section>

      <section class="setup-card" id="recipe-card">
        <div class="step-number">04</div>
        <div><h2>Project recipe</h2><p>Portable layout and export settings—never recipient rows</p>
          <button class="text-button" id="export-recipe" type="button">Export recipe</button>
          <label class="text-button recipe-import">Import recipe<input id="recipe-input" type="file" accept="application/json,.json" /></label>
        </div>
      </section>

      <button class="clear-button" id="clear-session" type="button">Clear local session</button>
    </aside>

    <section class="studio" aria-label="Template studio">
      <div class="studio-toolbar">
        <div>
          <div class="eyebrow">Live proof</div>
          <strong id="record-label">Waiting for a template and data</strong>
        </div>
        <label class="record-picker">Preview row
          <select id="record-select" disabled><option>—</option></select>
        </label>
        <label class="record-picker">Template page<select id="page-select" disabled><option>1</option></select></label>
      </div>
      <div class="stage-shell" id="stage-shell">
        <div class="empty-stage" id="empty-stage">
          <div class="empty-glyph">Aa</div>
          <h2>Your template appears here.</h2>
          <p>Nothing leaves this browser. Start with a PDF, PNG, or JPEG up to 25 MB.</p>
        </div>
        <div class="canvas-wrap" id="canvas-wrap" hidden>
          <canvas id="template-canvas"></canvas>
          <div id="field-layer" class="field-layer"></div>
        </div>
      </div>
    </section>

    <aside class="inspector" aria-label="Field and export settings">
      <div class="eyebrow">Field inspector</div>
      <div id="no-field" class="inspector-empty">Select a field on the proof to edit it.</div>
      <form id="field-form" hidden>
        <label>Spreadsheet column<select id="field-column"></select></label>
        <div class="input-pair">
          <label>Font size<input id="field-size" type="number" min="6" max="240" step="1" /></label>
          <label>Color<input id="field-color" type="color" /></label>
        </div>
        <label>Alignment<select id="field-align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label>Field width<input id="field-width" type="range" min="10" max="100" step="1" /></label>
        <label>Field height<input id="field-height" type="range" min="5" max="100" step="1" /></label>
        <label>Text handling<select id="field-fit"><option value="clip">Clip and warn</option><option value="shrink">Shrink to fit</option><option value="wrap">Wrap lines</option></select></label>
        <div class="input-pair"><label>Minimum size<input id="field-min-size" type="number" min="4" max="240" /></label><label>Line height<input id="field-line-height" type="number" min="0.8" max="3" step="0.1" /></label></div>
        <label>Font<select id="field-font"><option value="helvetica">Built-in Helvetica</option><option value="custom">Selected local font</option></select></label>
        <button class="danger-button" id="remove-field" type="button">Remove field</button>
      </form>

      <div class="export-panel">
        <div class="eyebrow">Export batch</div>
        <label>Filename pattern<input id="filename-pattern" value="{first_name}-{last_name}" /></label>
        <p class="hint" id="pattern-hint">Use spreadsheet headers inside braces.</p>
        <label>Optional local font<input id="font-input" type="file" accept=".ttf,.otf,font/ttf,font/otf" /></label>
        <p class="hint" id="font-hint">Font files remain in this page session. Confirm you have embedding rights.</p>
        <fieldset>
          <legend>Output</legend>
          <label class="radio-card"><input type="radio" name="format" value="pdf" checked /><span><strong>PDF</strong><small>One document per row</small></span></label>
          <label class="radio-card"><input type="radio" name="format" value="png" /><span><strong>PNG</strong><small>One image per row</small></span></label>
        </fieldset>
        <button class="preflight-button" id="preflight" type="button" disabled>Run preflight</button>
        <button class="export-button" id="generate" type="button" disabled>Build ZIP</button>
        <div class="progress" id="progress" role="status" aria-live="polite">Load a template and spreadsheet to begin.</div>
      </div>
    </aside>
  </main>
`;

let template: TemplateDocument | null = null;
let dataset: Dataset | null = null;
let fields: TextField[] = [];
let selectedFieldId: string | null = null;
let previewIndex = 0;
let pageIndex = 0;
let customFont: FontAsset | undefined;

const element = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing interface element: ${selector}`);
  return found;
};

const templateInput = element<HTMLInputElement>("#template-input");
const dataInput = element<HTMLInputElement>("#data-input");
const recordSelect = element<HTMLSelectElement>("#record-select");
const pageSelect = element<HTMLSelectElement>("#page-select");
const addFieldButton = element<HTMLButtonElement>("#add-field");
const generateButton = element<HTMLButtonElement>("#generate");
const preflightButton = element<HTMLButtonElement>("#preflight");
const sourceCanvas = element<HTMLCanvasElement>("#template-canvas");
const fieldLayer = element<HTMLDivElement>("#field-layer");
const canvasWrap = element<HTMLDivElement>("#canvas-wrap");

function activeRow(): Record<string, string> {
  return dataset?.rows[previewIndex] ?? {};
}

function setProgress(message: string, isError = false): void {
  const progress = element<HTMLDivElement>("#progress");
  progress.textContent = message;
  progress.classList.toggle("error", isError);
}

function updateReadiness(): void {
  element<HTMLElement>("#template-card").dataset.ready = String(Boolean(template));
  element<HTMLElement>("#data-card").dataset.ready = String(Boolean(dataset));
  element<HTMLElement>("#fields-card").dataset.ready = String(fields.length > 0);
  addFieldButton.disabled = !(template && dataset);
  generateButton.disabled = !(template && dataset && fields.length > 0);
  preflightButton.disabled = generateButton.disabled;
  element<HTMLElement>("#fields-summary").textContent = fields.length
    ? `${fields.length} field${fields.length === 1 ? "" : "s"} on the proof`
    : "Add data after loading both files";
  if (dataset) {
    element<HTMLElement>("#pattern-hint").textContent =
      `Available: ${dataset.headers.map((header) => `{${header}}`).join(", ")}`;
  }
}

function renderTemplate(): void {
  if (!template) return;
  const preview = template.previews[pageIndex] ?? template.preview;
  sourceCanvas.width = preview.width;
  sourceCanvas.height = preview.height;
  sourceCanvas.getContext("2d")?.drawImage(preview, 0, 0);
  sourceCanvas.style.aspectRatio = `${preview.width}/${preview.height}`;
  fieldLayer.style.aspectRatio = sourceCanvas.style.aspectRatio;
  canvasWrap.hidden = false;
  element<HTMLElement>("#empty-stage").hidden = true;
}

function renderRecordPicker(): void {
  recordSelect.replaceChildren();
  if (!dataset) {
    recordSelect.disabled = true;
    return;
  }
  const currentDataset = dataset;
  currentDataset.rows.forEach((row, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    const firstValue = currentDataset.headers.map((header) => row[header]).find(Boolean);
    option.textContent = `Row ${index + 2}${firstValue ? ` · ${firstValue}` : ""}`;
    recordSelect.append(option);
  });
  recordSelect.disabled = false;
  recordSelect.value = String(previewIndex);
  element<HTMLElement>("#record-label").textContent =
    `${currentDataset.rows.length} records · ${currentDataset.headers.length} columns`;
}

function fieldText(field: TextField): string {
  return activeRow()[field.column] || `{${field.column}}`;
}

function renderFields(): void {
  fieldLayer.replaceChildren();
  for (const field of fields.filter((candidate) => candidate.pageIndex === pageIndex)) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "mapped-field";
    node.classList.toggle("selected", field.id === selectedFieldId);
    node.dataset.fieldId = field.id;
    node.textContent = fieldText(field);
    node.style.left = `${field.x * 100}%`;
    node.style.top = `${field.y * 100}%`;
    node.style.width = `${field.width * 100}%`;
    node.style.height = `${field.height * 100}%`;
    node.style.fontSize = `${Math.max(10, field.fontSize * 0.7)}px`;
    node.style.color = field.color;
    node.style.textAlign = field.alignment;
    node.style.whiteSpace = field.fit === "wrap" ? "normal" : "nowrap";
    node.addEventListener("click", () => selectField(field.id));
    node.addEventListener("pointerdown", (event) => beginDrag(event, field.id));
    fieldLayer.append(node);
  }
  updateInspector();
  updateReadiness();
}

function beginDrag(event: PointerEvent, fieldId: string): void {
  event.preventDefault();
  selectField(fieldId);
  const field = fields.find((candidate) => candidate.id === fieldId);
  if (!field) return;
  const bounds = fieldLayer.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const originalX = field.x;
  const originalY = field.y;
  const move = (next: PointerEvent): void => {
    field.x = clamp(originalX + (next.clientX - startX) / bounds.width, 0, 1 - field.width);
    field.y = clamp(originalY + (next.clientY - startY) / bounds.height, 0, 0.96);
    renderFields();
  };
  const end = (): void => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end, { once: true });
}

function selectField(id: string): void {
  selectedFieldId = id;
  renderFields();
}

function selectedField(): TextField | undefined {
  return fields.find((field) => field.id === selectedFieldId);
}

function updateInspector(): void {
  const field = selectedField();
  const form = element<HTMLFormElement>("#field-form");
  element<HTMLElement>("#no-field").hidden = Boolean(field);
  form.hidden = !field;
  if (!field || !dataset) return;
  const column = element<HTMLSelectElement>("#field-column");
  column.replaceChildren(
    ...dataset.headers.map((header) => {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      return option;
    }),
  );
  column.value = field.column;
  element<HTMLInputElement>("#field-size").value = String(field.fontSize);
  element<HTMLInputElement>("#field-color").value = field.color;
  element<HTMLSelectElement>("#field-align").value = field.alignment;
  element<HTMLInputElement>("#field-width").value = String(Math.round(field.width * 100));
  element<HTMLInputElement>("#field-height").value = String(Math.round(field.height * 100));
  element<HTMLSelectElement>("#field-fit").value = field.fit;
  element<HTMLInputElement>("#field-min-size").value = String(field.minFontSize);
  element<HTMLInputElement>("#field-line-height").value = String(field.lineHeight);
  element<HTMLSelectElement>("#field-font").value = field.fontFamily;
}

function addField(): void {
  const header = dataset?.headers[fields.length % (dataset?.headers.length || 1)];
  if (!header) return;
  const field: TextField = {
    id: crypto.randomUUID(),
    column: header,
    x: 0.2,
    y: 0.35 + fields.length * 0.08,
    width: 0.6,
    height: 0.15,
    fontSize: 32,
    color: "#17201a",
    alignment: "center",
    pageIndex,
    fit: "shrink",
    minFontSize: 12,
    lineHeight: 1.2,
    fontFamily: "helvetica",
  };
  fields.push(field);
  selectedFieldId = field.id;
  renderFields();
}

async function handleTemplate(file: File): Promise<void> {
  try {
    setProgress("Reading template…");
    template = await readTemplate(file);
    pageIndex = 0;
    pageSelect.replaceChildren(
      ...template.previews.map((_preview, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `Page ${index + 1}`;
        return option;
      }),
    );
    pageSelect.disabled = template.previews.length <= 1;
    element<HTMLElement>("#template-summary").textContent =
      `${template.name} · ${template.pageSizes.length} page${template.pageSizes.length === 1 ? "" : "s"}`;
    renderTemplate();
    renderFields();
    setProgress("Template ready. Add spreadsheet data and mapped fields.");
  } catch (error) {
    template = null;
    setProgress(error instanceof Error ? error.message : "Template loading failed.", true);
  }
  updateReadiness();
}

async function handleDataset(nextDataset: Dataset): Promise<void> {
  dataset = nextDataset;
  previewIndex = 0;
  element<HTMLElement>("#data-summary").textContent =
    `${dataset.sourceName} · ${dataset.rows.length} records`;
  renderRecordPicker();
  renderFields();
  setProgress("Data ready. Add fields, position them, and build the ZIP.");
}

templateInput.addEventListener("change", () => {
  const file = templateInput.files?.[0];
  if (file) void handleTemplate(file);
});

dataInput.addEventListener("change", () => {
  const file = dataInput.files?.[0];
  if (!file) return;
  void readSpreadsheet(file)
    .then(handleDataset)
    .catch((error: unknown) =>
      setProgress(error instanceof Error ? error.message : "Data loading failed.", true),
    );
});

element<HTMLButtonElement>("#built-in-records").addEventListener("click", () => {
  void handleDataset({
    sourceName: "sample-records.csv",
    headers: ["first_name", "last_name", "award", "date"],
    rows: [
      {
        first_name: "Avery",
        last_name: "Stone",
        award: "Community Leadership",
        date: "August 3, 2026",
      },
      {
        first_name: "Morgan",
        last_name: "Reed",
        award: "Workshop Completion",
        date: "August 3, 2026",
      },
      {
        first_name: "Jordan",
        last_name: "Vale",
        award: "Outstanding Contribution",
        date: "August 3, 2026",
      },
    ],
  });
});

recordSelect.addEventListener("change", () => {
  previewIndex = Number.parseInt(recordSelect.value, 10) || 0;
  renderFields();
});

pageSelect.addEventListener("change", () => {
  pageIndex = Number.parseInt(pageSelect.value, 10) || 0;
  selectedFieldId = fields.find((field) => field.pageIndex === pageIndex)?.id ?? null;
  renderTemplate();
  renderFields();
});

addFieldButton.addEventListener("click", addField);

element<HTMLSelectElement>("#field-column").addEventListener("change", (event) => {
  const field = selectedField();
  if (field) field.column = (event.target as HTMLSelectElement).value;
  renderFields();
});

element<HTMLInputElement>("#field-size").addEventListener("input", (event) => {
  const field = selectedField();
  if (field) field.fontSize = Number((event.target as HTMLInputElement).value);
  renderFields();
});

element<HTMLInputElement>("#field-color").addEventListener("input", (event) => {
  const field = selectedField();
  if (field) field.color = (event.target as HTMLInputElement).value;
  renderFields();
});

element<HTMLSelectElement>("#field-align").addEventListener("change", (event) => {
  const field = selectedField();
  if (field) field.alignment = (event.target as HTMLSelectElement).value as TextAlignment;
  renderFields();
});

element<HTMLInputElement>("#field-width").addEventListener("input", (event) => {
  const field = selectedField();
  if (field) field.width = Number((event.target as HTMLInputElement).value) / 100;
  renderFields();
});

element<HTMLInputElement>("#field-height").addEventListener("input", (event) => {
  const field = selectedField();
  if (field) field.height = Number((event.target as HTMLInputElement).value) / 100;
  renderFields();
});

element<HTMLSelectElement>("#field-fit").addEventListener("change", (event) => {
  const field = selectedField();
  if (field) field.fit = (event.target as HTMLSelectElement).value as TextFit;
  renderFields();
});

element<HTMLInputElement>("#field-min-size").addEventListener("input", (event) => {
  const field = selectedField();
  if (field) field.minFontSize = Number((event.target as HTMLInputElement).value);
});

element<HTMLInputElement>("#field-line-height").addEventListener("input", (event) => {
  const field = selectedField();
  if (field) field.lineHeight = Number((event.target as HTMLInputElement).value);
  renderFields();
});

element<HTMLSelectElement>("#field-font").addEventListener("change", (event) => {
  const field = selectedField();
  if (field)
    field.fontFamily = (event.target as HTMLSelectElement).value as TextField["fontFamily"];
  renderFields();
});

element<HTMLInputElement>("#font-input").addEventListener("change", (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024)
    return setProgress("The font exceeds the 10 MB safety limit.", true);
  void file
    .arrayBuffer()
    .then(async (buffer) => {
      const family = `BDSCustom${Date.now()}`;
      const bytes = new Uint8Array(buffer);
      const face = new FontFace(family, bytes.slice().buffer);
      await face.load();
      document.fonts.add(face);
      customFont = { bytes, name: file.name, family };
      element<HTMLElement>("#font-hint").textContent =
        `${file.name} ready for fields set to Selected local font.`;
      setProgress("Local font loaded. Confirm its license permits embedding.");
    })
    .catch((error: unknown) =>
      setProgress(error instanceof Error ? error.message : "The font could not be loaded.", true),
    );
});

function outputFormat(): OutputFormat {
  return element<HTMLInputElement>('input[name="format"]:checked').value as OutputFormat;
}

function currentPreflight() {
  if (!template || !dataset) throw new Error("Load a template and spreadsheet first.");
  return preflightBatch({
    dataset,
    fields,
    template,
    format: outputFormat(),
    hasCustomFont: Boolean(customFont),
  });
}

preflightButton.addEventListener("click", () => {
  try {
    const report = currentPreflight();
    const errors = report.findings.filter((finding) => finding.severity === "error").length;
    const warnings = report.findings.length - errors;
    setProgress(
      `Preflight complete: ${errors} errors and ${warnings} warnings across ${report.recordCount} records. The ZIP will include the detailed report and proof sheet.`,
      errors > 0,
    );
  } catch (error) {
    setProgress(error instanceof Error ? error.message : "Preflight failed.", true);
  }
});

element<HTMLButtonElement>("#export-recipe").addEventListener("click", () => {
  if (!template) return setProgress("Load the matching template before exporting a recipe.", true);
  const recipe = createRecipe({
    template,
    fields,
    outputFormat: outputFormat(),
    filenamePattern: element<HTMLInputElement>("#filename-pattern").value,
    customFontName: customFont?.name ?? null,
  });
  downloadBlob(
    new Blob([JSON.stringify(recipe, null, 2) + "\n"], { type: "application/json" }),
    "batch-document-studio-recipe.json",
  );
});

element<HTMLInputElement>("#recipe-input").addEventListener("change", (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  void file
    .text()
    .then((text) => {
      if (!template) throw new Error("Load the template before importing its recipe.");
      const recipe = validateRecipe(JSON.parse(text));
      if (
        recipe.template.mimeType !== template.mimeType ||
        recipe.template.pageCount !== template.pageSizes.length
      )
        throw new Error("The recipe does not match this template type and page count.");
      fields = structuredClone(recipe.fields);
      selectedFieldId =
        fields.find((field) => field.pageIndex === pageIndex)?.id ?? fields[0]?.id ?? null;
      element<HTMLInputElement>("#filename-pattern").value = recipe.filenamePattern;
      const formatInput = document.querySelector<HTMLInputElement>(
        `input[name="format"][value="${recipe.outputFormat}"]`,
      );
      if (formatInput) formatInput.checked = true;
      renderFields();
      setProgress(
        recipe.customFontName
          ? `Recipe loaded. Reattach ${recipe.customFontName} before generation.`
          : "Recipe loaded. Recipient data was not included.",
      );
    })
    .catch((error: unknown) =>
      setProgress(error instanceof Error ? error.message : "Recipe import failed.", true),
    );
});

element<HTMLButtonElement>("#remove-field").addEventListener("click", () => {
  fields = fields.filter((field) => field.id !== selectedFieldId);
  selectedFieldId = fields[0]?.id ?? null;
  renderFields();
});

generateButton.addEventListener("click", () => {
  if (!template || !dataset) return;
  const errors = validateFields(fields, dataset.headers);
  if (errors.length) {
    setProgress(errors[0] ?? "Review the mapped fields.", true);
    return;
  }
  const format = outputFormat();
  const preflight = currentPreflight();
  const preflightErrors = preflight.findings.filter((finding) => finding.severity === "error");
  if (preflightErrors.length) {
    setProgress(
      `Resolve ${preflightErrors.length} preflight error${preflightErrors.length === 1 ? "" : "s"} before generation.`,
      true,
    );
    return;
  }
  const filenamePattern =
    element<HTMLInputElement>("#filename-pattern").value.trim() ||
    "document-{first_name}-{last_name}";
  const recordCount = dataset.rows.length;
  generateButton.disabled = true;
  setProgress(`Building ${recordCount} ${format.toUpperCase()} files…`);
  void generateArchive({
    template,
    dataset,
    fields,
    format,
    filenamePattern,
    customFont,
    onProgress: (completed, total) => setProgress(`Rendered ${completed} of ${total} documents…`),
  })
    .then((archive) => {
      downloadBlob(archive, `batch-document-studio-${format}.zip`);
      setProgress(`Finished ${recordCount} documents. The ZIP download is ready.`);
    })
    .catch((error: unknown) =>
      setProgress(error instanceof Error ? error.message : "Batch generation failed.", true),
    )
    .finally(() => updateReadiness());
});

element<HTMLButtonElement>("#clear-session").addEventListener("click", () => {
  template = null;
  dataset = null;
  fields = [];
  selectedFieldId = null;
  previewIndex = 0;
  pageIndex = 0;
  customFont = undefined;
  templateInput.value = "";
  dataInput.value = "";
  pageSelect.replaceChildren(new Option("1", "0"));
  pageSelect.disabled = true;
  element<HTMLInputElement>("#font-input").value = "";
  element<HTMLInputElement>("#recipe-input").value = "";
  canvasWrap.hidden = true;
  element<HTMLElement>("#empty-stage").hidden = false;
  element<HTMLElement>("#template-summary").textContent = "PDF, PNG, or JPEG · first page";
  element<HTMLElement>("#data-summary").textContent = "CSV or XLSX";
  element<HTMLElement>("#record-label").textContent = "Waiting for a template and data";
  renderRecordPicker();
  renderFields();
  setProgress("Local session cleared.");
});

updateReadiness();

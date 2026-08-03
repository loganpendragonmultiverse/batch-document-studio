import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const dist = path.join(root, "dist");
const release = path.join(root, "release");
const archiveName = `batch-document-studio-v${pkg.version}.zip`;
const zip = new JSZip();

async function addDirectory(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await addDirectory(absolute, relative);
    else zip.file(relative, await readFile(absolute), { date: new Date("2026-08-03T00:00:00Z") });
  }
}

await addDirectory(dist);
await mkdir(release, { recursive: true });
const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
await writeFile(path.join(release, archiveName), archive);
const digest = createHash("sha256").update(archive).digest("hex");
await writeFile(path.join(release, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);
console.log(`${archiveName} ${digest}`);

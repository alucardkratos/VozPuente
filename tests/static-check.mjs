import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const html = fs.readFileSync("app.html", "utf8");
const javascript = fs.readFileSync("app.js", "utf8");

const errors = [];
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const uniqueIds = new Set(ids);
const referencedIds = new Set([...javascript.matchAll(/\$\("#([A-Za-z0-9_-]+)"\)/g)].map((match) => match[1]));

for (const id of referencedIds) {
  if (!uniqueIds.has(id)) errors.push(`JavaScript references missing HTML id: ${id}`);
}
for (const id of ids) {
  if (ids.filter((candidate) => candidate === id).length > 1) errors.push(`Duplicate HTML id: ${id}`);
}

const requiredFiles = [
  manifest.background?.service_worker,
  ...Object.values(manifest.icons || {}),
  "app.html",
  "app.css",
  "app.js",
  "ai-worker.bundle.js",
  "Asistente_Voz_Windows.zip",
  "Instalar_e_Iniciar_Piper.bat",
  "README.md",
  "README_EN.md",
  "LICENSE",
  "BUILD_WEEK_SUBMISSION.md",
  "demo/vozpuente-demo-en.mp4",
  "demo/vozpuente-demo-en.srt"
].filter(Boolean);

for (const path of requiredFiles) {
  if (!fs.existsSync(path)) errors.push(`Missing packaged file: ${path}`);
}

const requiredFlowEvidence = [
  "preferredLanguage = translateToSpanish ? \"es\"",
  "normalizeDetectedLanguage",
  "autoReadSpanishAfterImport",
  "previewSelectedVoice",
  "playSynchronizedPreview",
  "downloadWindowsCompanion"
];
for (const marker of requiredFlowEvidence) {
  if (!javascript.includes(marker)) errors.push(`Missing Build Week flow marker: ${marker}`);
}

if (manifest.manifest_version !== 3) errors.push("Manifest V3 is required.");
if (manifest.version !== "3.0.0") errors.push("Expected Build Week version 3.0.0.");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Static checks passed: ${uniqueIds.size} HTML ids, ${referencedIds.size} JS references, ${requiredFiles.length} required files.`);

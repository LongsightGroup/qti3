import { interactionFixtures } from "@qti3/fixtures";
import { defineQtiAssessmentItemPlayer } from "@qti3/player";

defineQtiAssessmentItemPlayer();

const fixtureSelect = document.querySelector<HTMLSelectElement>("#fixture");
const loadFixture = document.querySelector<HTMLButtonElement>("#load-fixture");
const loadXml = document.querySelector<HTMLButtonElement>("#load-xml");
const fileInput = document.querySelector<HTMLInputElement>("#file");
const localFiles = document.querySelector<HTMLSelectElement>("#local-files");
const previousFile = document.querySelector<HTMLButtonElement>("#previous-file");
const nextFile = document.querySelector<HTMLButtonElement>("#next-file");
const fileSummary = document.querySelector<HTMLParagraphElement>("#file-summary");
const xmlInput = document.querySelector<HTMLTextAreaElement>("#xml");
const scorePanel = document.querySelector<HTMLElement>("#score-panel");
const scoreStatus = document.querySelector<HTMLParagraphElement>("#score-status");
const scoreValue = document.querySelector<HTMLElement>("#score-value");
const responseCount = document.querySelector<HTMLElement>("#response-count");
const validationCount = document.querySelector<HTMLElement>("#validation-count");
const scoreDetails = document.querySelector<HTMLPreElement>("#score-details");
const debugScore = document.querySelector<HTMLButtonElement>("#debug-score");
const debugSuspend = document.querySelector<HTMLButtonElement>("#debug-suspend");
const debugEnd = document.querySelector<HTMLButtonElement>("#debug-end");
const debugReset = document.querySelector<HTMLButtonElement>("#debug-reset");
const debugResponses = document.querySelector<HTMLPreElement>("#debug-responses");
const debugOutcomes = document.querySelector<HTMLPreElement>("#debug-outcomes");
const debugTemplateValues = document.querySelector<HTMLPreElement>("#debug-template-values");
const debugCatalogs = document.querySelector<HTMLPreElement>("#debug-catalogs");
const debugStylesheets = document.querySelector<HTMLPreElement>("#debug-stylesheets");
const debugValidation = document.querySelector<HTMLPreElement>("#debug-validation");
const debugDiagnostics = document.querySelector<HTMLPreElement>("#debug-diagnostics");
const debugState = document.querySelector<HTMLPreElement>("#debug-state");
const debugActionLog = document.querySelector<HTMLPreElement>("#debug-action-log");
const events = document.querySelector<HTMLPreElement>("#events");
const player = document.querySelector("qti-assessment-item-player");

if (
  !fixtureSelect ||
  !loadFixture ||
  !loadXml ||
  !fileInput ||
  !localFiles ||
  !previousFile ||
  !nextFile ||
  !fileSummary ||
  !xmlInput ||
  !scorePanel ||
  !scoreStatus ||
  !scoreValue ||
  !responseCount ||
  !validationCount ||
  !scoreDetails ||
  !debugScore ||
  !debugSuspend ||
  !debugEnd ||
  !debugReset ||
  !debugResponses ||
  !debugOutcomes ||
  !debugTemplateValues ||
  !debugCatalogs ||
  !debugStylesheets ||
  !debugValidation ||
  !debugDiagnostics ||
  !debugState ||
  !debugActionLog ||
  !events ||
  !player
) {
  throw new Error("Manual harness failed to initialize.");
}

interface LoadedFile {
  name: string;
  xml: string;
  source: string;
}

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

let loadedFiles: LoadedFile[] = [];
let selectedFileIndex = -1;
let assetUrls = new Map<string, string>();
let latestDiagnostics: unknown[] = [];
let latestValidationMessages: unknown[] = [];
let latestCatalogs: unknown[] = [];
let latestStylesheets: unknown[] = [];
const actionLog: Array<{ time: string; action: string; status?: string; detail?: unknown }> = [];

for (const fixture of interactionFixtures) {
  const option = document.createElement("option");
  option.value = fixture.id;
  option.textContent = `${fixture.interactionType} (${fixture.qtiName})`;
  fixtureSelect.append(option);
}

loadFixture.addEventListener("click", async () => {
  const fixture =
    interactionFixtures.find((item) => item.id === fixtureSelect.value) ?? interactionFixtures[0];
  if (!fixture) return;
  xmlInput.value = fixture.xml;
  await player.loadXml(fixture.xml);
});

loadXml.addEventListener("click", async () => {
  await player.loadXml(xmlInput.value);
});

debugScore.addEventListener("click", () => player.scoreAttempt());
debugSuspend.addEventListener("click", () => player.suspend());
debugEnd.addEventListener("click", () => player.endAttempt());
debugReset.addEventListener("click", () => player.reset());

fileInput.addEventListener("change", async () => {
  await loadLocalFiles(fileInput.files);
});

localFiles.addEventListener("change", async () => {
  selectedFileIndex = Number(localFiles.value);
  await loadSelectedLocalFile();
});

previousFile.addEventListener("click", async () => {
  if (loadedFiles.length === 0) return;
  selectedFileIndex = Math.max(0, selectedFileIndex - 1);
  await loadSelectedLocalFile();
});

nextFile.addEventListener("click", async () => {
  if (loadedFiles.length === 0) return;
  selectedFileIndex = Math.min(loadedFiles.length - 1, selectedFileIndex + 1);
  await loadSelectedLocalFile();
});

for (const eventName of [
  "qti-ready",
  "qti-responsechange",
  "qti-score",
  "qti-statechange",
  "qti-diagnostics",
  "qti-validation",
  "qti-reset",
  "qti-restore",
  "qti-suspend",
  "qti-endattempt",
]) {
  player.addEventListener(eventName, (event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    events.textContent = `${eventName}\n${JSON.stringify(detail, null, 2)}`;
    appendActionLog(eventName, detail);
    if (eventName === "qti-ready") {
      latestDiagnostics = diagnosticsFromDetail(detail);
      latestValidationMessages = [];
      latestCatalogs = catalogsFromDetail(detail);
      latestStylesheets = stylesheetsFromDetail(detail);
      resetScorePanel();
    } else if (eventName === "qti-responsechange") {
      latestValidationMessages = [];
      markScoreStale();
    } else if (eventName === "qti-diagnostics") {
      latestDiagnostics = diagnosticsFromDetail(detail);
    } else if (eventName === "qti-validation") {
      latestValidationMessages = validationMessagesFromDetail(detail);
      renderValidationResult(detail);
    } else if (eventName === "qti-score") {
      latestDiagnostics = scoreResultFromDetail(detail)?.diagnostics ?? [];
      latestValidationMessages = [];
      renderScoreResult(detail);
    }
    renderDebugPanels();
  });
}

loadFixture.click();

function resetScorePanel(): void {
  scorePanel.dataset.status = "idle";
  scoreStatus.textContent = "Not scored yet.";
  scoreValue.textContent = "-";
  responseCount.textContent = "0";
  validationCount.textContent = "0";
  scoreDetails.textContent = "{}";
}

function markScoreStale(): void {
  if (scorePanel.dataset.status === "idle") return;
  scorePanel.dataset.status = "idle";
  scoreStatus.textContent = "Responses changed. Score again to update results.";
}

function renderValidationResult(detail: unknown): void {
  const validationMessages = validationMessagesFromDetail(detail);
  scorePanel.dataset.status = "blocked";
  scoreStatus.textContent =
    validationMessages.length === 1
      ? "Score blocked by 1 validation message."
      : `Score blocked by ${validationMessages.length} validation messages.`;
  scoreValue.textContent = "-";
  responseCount.textContent = String(Object.keys(player.serialize()?.responses ?? {}).length);
  validationCount.textContent = String(validationMessages.length);
  scoreDetails.textContent = JSON.stringify(
    {
      responses: player.serialize()?.responses ?? {},
      validationMessages,
    },
    null,
    2,
  );
}

function renderScoreResult(detail: unknown): void {
  const result = scoreResultFromDetail(detail);
  const state = result?.state ?? player.serialize();
  const outcomes = result?.outcomes ?? state?.outcomes ?? {};
  const responses = state?.responses ?? {};
  const diagnostics = result?.diagnostics ?? [];
  const score = valueFromRecord(outcomes, "SCORE");

  scorePanel.dataset.status = "scored";
  scoreStatus.textContent = "Scored successfully.";
  scoreValue.textContent = formatValue(score);
  responseCount.textContent = String(Object.keys(responses).length);
  validationCount.textContent = String(diagnostics.length);
  scoreDetails.textContent = JSON.stringify({ responses, outcomes, diagnostics }, null, 2);
}

function renderDebugPanels(): void {
  const state = player.serialize();
  debugResponses.textContent = stableJson(state?.responses ?? {});
  debugOutcomes.textContent = stableJson(state?.outcomes ?? {});
  debugTemplateValues.textContent = stableJson(state?.templateValues ?? {});
  debugCatalogs.textContent = stableJson(latestCatalogs);
  debugStylesheets.textContent = stableJson(latestStylesheets);
  debugValidation.textContent = stableJson(latestValidationMessages);
  debugDiagnostics.textContent = stableJson(latestDiagnostics);
  debugState.textContent = stableJson(state ?? {});
  debugActionLog.textContent = stableJson(actionLog);
}

function appendActionLog(action: string, detail: unknown): void {
  const state = player.serialize();
  actionLog.unshift({
    time: new Date().toISOString(),
    action,
    status: state?.status,
    detail: actionLogDetail(detail),
  });
  actionLog.splice(25);
}

function actionLogDetail(detail: unknown): unknown {
  if (!isRecord(detail)) return detail;
  if (isRecord(detail.state)) {
    return {
      itemIdentifier: detail.state.itemIdentifier,
      status: detail.state.status,
      responses: detail.state.responses,
      outcomes: detail.state.outcomes,
      validationMessages: detail.state.validationMessages,
    };
  }
  if (Array.isArray(detail.validationMessages)) {
    return { validationMessages: detail.validationMessages };
  }
  if (Array.isArray(detail.diagnostics)) {
    return { diagnostics: detail.diagnostics };
  }
  return detail;
}

function diagnosticsFromDetail(detail: unknown): unknown[] {
  if (!isRecord(detail)) return [];
  return Array.isArray(detail.diagnostics) ? detail.diagnostics : [];
}

function validationMessagesFromDetail(detail: unknown): unknown[] {
  if (!isRecord(detail)) return [];
  const validationMessages = detail.validationMessages;
  return Array.isArray(validationMessages) ? validationMessages : [];
}

function catalogsFromDetail(detail: unknown): unknown[] {
  if (!isRecord(detail) || !isRecord(detail.item) || !isRecord(detail.item.catalogInfo)) return [];
  const catalogs = detail.item.catalogInfo.catalogs;
  return Array.isArray(catalogs) ? catalogs : [];
}

function stylesheetsFromDetail(detail: unknown): unknown[] {
  if (!isRecord(detail) || !isRecord(detail.item)) return [];
  const stylesheets = detail.item.stylesheets;
  return Array.isArray(stylesheets) ? stylesheets : [];
}

function scoreResultFromDetail(detail: unknown): {
  outcomes?: Record<string, unknown>;
  diagnostics?: unknown[];
  state?: { responses?: Record<string, unknown>; outcomes?: Record<string, unknown> };
} | null {
  if (!isRecord(detail)) return null;
  return {
    outcomes: recordFromValue(detail.outcomes),
    diagnostics: Array.isArray(detail.diagnostics) ? detail.diagnostics : [],
    state: isRecord(detail.state)
      ? {
          responses: recordFromValue(detail.state.responses),
          outcomes: recordFromValue(detail.state.outcomes),
        }
      : undefined,
  };
}

function recordFromValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function valueFromRecord(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadSelectedLocalFile(): Promise<void> {
  const file = loadedFiles[selectedFileIndex];
  if (!file) {
    fileSummary.textContent =
      "No QTI item files loaded. Upload item XML files or a QTI package zip.";
    previousFile.disabled = true;
    nextFile.disabled = true;
    return;
  }

  localFiles.value = String(selectedFileIndex);
  xmlInput.value = file.xml;
  fileSummary.textContent = `${selectedFileIndex + 1} of ${loadedFiles.length}: ${file.name}`;
  previousFile.disabled = selectedFileIndex <= 0;
  nextFile.disabled = selectedFileIndex >= loadedFiles.length - 1;
  await player.loadXml(file.xml, {
    resolveAsset: (url) => resolveLoadedAsset(file.source, url),
  });
}

async function loadLocalFiles(fileList: FileList | null): Promise<void> {
  clearAssetUrls();
  const files = await readXmlFiles(fileList);
  loadedFiles = resolveLoadableItems(files);
  localFiles.replaceChildren(
    ...loadedFiles.map((file, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = file.name;
      return option;
    }),
  );
  selectedFileIndex = loadedFiles.length > 0 ? 0 : -1;
  await loadSelectedLocalFile();
}

async function readXmlFiles(fileList: FileList | null): Promise<LoadedFile[]> {
  const loadedGroups = await Promise.all(
    [...(fileList ?? [])].map(async (file) => {
      if (file.name.endsWith(".zip")) return readZipXmlFiles(file);
      if (!file.name.endsWith(".xml")) return [];
      const source = normalizePath(file.name);
      return {
        name: source,
        source,
        xml: await file.text(),
      } satisfies LoadedFile;
    }),
  );
  return loadedGroups.flat().sort((left, right) => left.name.localeCompare(right.name));
}

async function readZipXmlFiles(file: File): Promise<LoadedFile[]> {
  const entries = await readZipEntries(await file.arrayBuffer());
  for (const entry of entries) {
    if (entry.name.endsWith(".xml")) continue;
    assetUrls.set(
      entry.name,
      URL.createObjectURL(new Blob([entry.bytes], { type: mimeTypeForPath(entry.name) })),
    );
  }
  return entries
    .filter((entry) => entry.name.endsWith(".xml"))
    .map((entry) => ({
      name: entry.name,
      source: entry.name,
      xml: new TextDecoder().decode(entry.bytes),
    }));
}

async function readZipEntries(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) return [];

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const rawName = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = normalizePath(decoder.decode(rawName));
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/")) continue;

    const content = await zipEntryBytes(bytes, view, localHeaderOffset, compressedSize, method);
    if (content) entries.push({ name, bytes: content });
  }

  return entries;
}

function clearAssetUrls(): void {
  for (const url of assetUrls.values()) URL.revokeObjectURL(url);
  assetUrls = new Map();
}

function resolveLoadedAsset(source: string, url: string): string {
  if (!isRelativeAssetUrl(url)) return url;
  const path = resolveRelativePath(source, url);
  return assetUrls.get(path) ?? assetUrls.get(normalizePath(url)) ?? url;
}

function isRelativeAssetUrl(url: string): boolean {
  return (
    !url.startsWith("#") &&
    !url.startsWith("/") &&
    !url.startsWith("data:") &&
    !url.startsWith("blob:") &&
    !url.startsWith("http://") &&
    !url.startsWith("https://")
  );
}

function mimeTypeForPath(path: string): string {
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  if (/\.mp3$/i.test(path)) return "audio/mpeg";
  if (/\.wav$/i.test(path)) return "audio/wav";
  if (/\.mp4$/i.test(path)) return "video/mp4";
  if (/\.webm$/i.test(path)) return "video/webm";
  return "application/octet-stream";
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function zipEntryBytes(
  bytes: Uint8Array,
  view: DataView,
  localHeaderOffset: number,
  compressedSize: number,
  method: number,
): Promise<Uint8Array | undefined> {
  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) return undefined;
  const nameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataOffset = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
  if (method === 0) return compressed;
  if (method !== 8 || typeof DecompressionStream === "undefined") return undefined;

  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function resolveLoadableItems(files: LoadedFile[]): LoadedFile[] {
  const byPath = new Map(files.map((file) => [file.source, file]));
  const itemPaths = new Set<string>();
  const packageOrder: string[] = [];

  for (const file of files) {
    const root = xmlRootName(file.xml);
    if (root === "qti-assessment-item") {
      itemPaths.add(file.source);
      continue;
    }

    const refs =
      root === "qti-assessment-test"
        ? assessmentItemRefs(file.xml, file.source)
        : root === "manifest"
          ? manifestItemResources(file.xml, file.source)
          : [];
    for (const ref of refs) {
      if (byPath.has(ref) && !packageOrder.includes(ref)) packageOrder.push(ref);
    }
  }

  const orderedPaths =
    packageOrder.length > 0
      ? [...packageOrder, ...[...itemPaths].filter((path) => !packageOrder.includes(path))]
      : [...itemPaths].sort((left, right) => left.localeCompare(right));
  return orderedPaths.map((path) => byPath.get(path)).filter((file) => file !== undefined);
}

function xmlRootName(xml: string): string {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  if (parsed.querySelector("parsererror")) return "";
  return parsed.documentElement?.localName ?? "";
}

function assessmentItemRefs(xml: string, source: string): string[] {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const refs = elementsByLocalName(parsed, "qti-assessment-item-ref");
  return refs
    .map((element) => element.getAttribute("href") ?? "")
    .filter(Boolean)
    .map((href) => resolveRelativePath(source, href));
}

function manifestItemResources(xml: string, source: string): string[] {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const refs = elementsByLocalName(parsed, "resource")
    .filter((element) => element.getAttribute("type") === "imsqti_item_xmlv3p0")
    .map((element) => element.getAttribute("href") ?? "")
    .filter(Boolean);
  return refs.map((href) => resolveRelativePath(source, href));
}

function elementsByLocalName(document: Document, localName: string): Element[] {
  return [...document.getElementsByTagName("*")].filter(
    (element) => element.localName === localName,
  );
}

function resolveRelativePath(from: string, href: string): string {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return normalizePath(`${base}${href}`);
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

import {
  detectPackageMediaType,
  parseQtiPackageFromEntries,
  type QtiPackageParseResult,
  type QtiDiagnostic,
} from "@longsightgroup/qti3-core";
import {
  defineQtiAssessmentItemPlayer,
  QtiAssessmentItemPlayer,
  type QtiDiagnosticsEventDetail,
} from "@longsightgroup/qti3-player";
import { resolvePackageAssetUrl } from "./package-assets.js";
import { readBrowserPackageZip } from "./browser-package.js";
import { deletePackage, listPackages, readPackage, savePackage } from "./store.js";

defineQtiAssessmentItemPlayer();
const input = requireElement("#import-package", HTMLInputElement);
const packages = requireElement("#saved-packages", HTMLSelectElement);
const items = requireElement("#package-items", HTMLSelectElement);
const deleteButton = requireElement("#delete-package", HTMLButtonElement);
const status = requireElement("#library-status", HTMLParagraphElement);
const diagnostics = requireElement("#library-diagnostics", HTMLPreElement);
const source = requireElement("#item-source", HTMLPreElement);
let player = requireElement("qti-assessment-item-player", QtiAssessmentItemPlayer);
let current: QtiPackageParseResult | undefined;
let assetUrls = new Map<string, string>();
let messages: readonly QtiDiagnostic[] = [];
let busy = false;

input.addEventListener("change", () => {
  void run(importFile);
});
packages.addEventListener("change", () => {
  void run(() => openPackage(packages.value));
});
items.addEventListener("change", () => {
  void run(renderItem);
});
deleteButton.addEventListener("click", () => {
  void run(removeSelectedPackage, input);
});
void run(async () => {
  if (await refreshList())
    status.textContent =
      packages.options.length > 1
        ? "Select a saved package to reopen it."
        : "No saved packages. Import a QTI ZIP to begin.";
});

async function importFile(): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;
  status.textContent = `Importing ${file.name}…`;
  const extracted = await readBrowserPackageZip(new Uint8Array(await file.arrayBuffer()));
  if (!extracted.ok) {
    showImportFailure(extracted.diagnostics);
    return;
  }
  const imported = parseQtiPackageFromEntries(extracted.entries);
  if (!imported.ok) {
    showImportFailure(imported.diagnostics);
    return;
  }
  const id = crypto.randomUUID();
  const saved = await savePackage({
    id,
    title: imported.title || file.name,
    filename: file.name,
    importedAt: new Date().toISOString(),
    entries: imported.entries,
  });
  if (!saved.ok) {
    status.textContent = saved.message;
    return;
  }
  if (!(await refreshList(id))) return;
  if (await openPackage(id))
    status.textContent = `Saved ${file.name}. Reopened ${questionCount(imported.items.length)} from the database.`;
}

async function refreshList(selected = ""): Promise<boolean> {
  const result = await listPackages();
  if (!result.ok) {
    status.textContent = result.message;
    return false;
  }
  packages.replaceChildren(
    new Option("Select a saved package", ""),
    ...result.value.map((record) => new Option(`${record.title} — ${record.filename}`, record.id)),
  );
  packages.value = selected;
  return true;
}

async function openPackage(id: string): Promise<boolean> {
  clearQuestion();
  if (!id) {
    status.textContent = "Select a saved package to reopen it.";
    return false;
  }
  status.textContent = "Reading saved package…";
  const record = await readPackage(id);
  if (!record.ok) {
    status.textContent = record.message;
    return false;
  }
  if (!record.value) {
    status.textContent = "This package was deleted in another tab.";
    await refreshList();
    return false;
  }
  const imported = parseQtiPackageFromEntries(record.value.entries);
  if (!imported.ok) {
    showImportFailure(imported.diagnostics);
    return false;
  }
  current = imported;
  for (const entry of imported.entries)
    assetUrls.set(
      entry.path,
      URL.createObjectURL(
        new Blob([entry.bytes.slice()], {
          type: detectPackageMediaType(entry.path) ?? "application/octet-stream",
        }),
      ),
    );
  items.replaceChildren(
    ...imported.items.map(
      (item, index) =>
        new Option(`${item.title ?? item.identifier ?? item.href} — ${item.href}`, String(index)),
    ),
  );
  await renderItem();
  status.textContent = `Opened ${record.value.filename} from the database. ${questionCount(imported.items.length)}.`;
  return true;
}

async function renderItem(): Promise<void> {
  const item = current?.items[Number(items.value)];
  if (!current || !item) return;
  messages = current.diagnostics;
  showDiagnostics();
  source.textContent = item.xml;
  resetPlayer();
  player.addEventListener("qti-diagnostics", (event) => {
    // SAFETY: This listener receives the documented player diagnostics event.
    const detail = (event as CustomEvent<QtiDiagnosticsEventDetail>).detail;
    messages = [...messages, ...detail.diagnostics];
    showDiagnostics();
  });
  await player.loadXml(item.xml, {
    resolveAsset: (url) => resolveAsset(item.href, url) ?? "",
    resolveStylesheet: (stylesheet) => {
      const href = resolveAsset(item.href, stylesheet.href);
      return href ? { ...stylesheet, href } : undefined;
    },
  });
}

function resolveAsset(itemPath: string, reference: string): string | undefined {
  const resolved = resolvePackageAssetUrl(itemPath, reference, assetUrls);
  if (resolved) return resolved;
  const message = `Package asset ${JSON.stringify(reference)} referenced by ${itemPath} is unavailable in the saved package.`;
  if (!messages.some((diagnostic) => diagnostic.message === message)) {
    messages = [
      ...messages,
      { code: "library.asset.unresolved", severity: "warning", message, path: itemPath },
    ];
    showDiagnostics();
  }
  return undefined;
}

async function removeSelectedPackage(): Promise<void> {
  if (!packages.value) return;
  const deleted = await deletePackage(packages.value);
  if (!deleted.ok) {
    status.textContent = deleted.message;
    return;
  }
  clearQuestion();
  if (await refreshList()) status.textContent = "Package deleted from this browser.";
}

function clearQuestion(): void {
  current = undefined;
  resetPlayer();
  releaseAssets();
  items.replaceChildren(new Option("Select a question", ""));
  source.textContent = "Select a saved package to inspect its source.";
  messages = [];
  showDiagnostics();
}

function resetPlayer(): void {
  const replacement = document.createElement("qti-assessment-item-player");
  player.replaceWith(replacement);
  player = requireElement("qti-assessment-item-player", QtiAssessmentItemPlayer);
}

function releaseAssets(): void {
  for (const url of assetUrls.values()) URL.revokeObjectURL(url);
  assetUrls = new Map();
}

function showImportFailure(failures: readonly QtiDiagnostic[]): void {
  messages = failures;
  showDiagnostics();
  status.textContent =
    "Package import failed. Nothing was saved. Inspect the diagnostics for details.";
}

function showDiagnostics(): void {
  diagnostics.textContent = messages.length
    ? messages
        .map((diagnostic) => `${diagnostic.severity}: ${diagnostic.code}: ${diagnostic.message}`)
        .join("\n")
    : "No diagnostics.";
}

async function run(action: () => Promise<unknown>, focusAfter?: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  updateControls();
  try {
    await action();
  } catch {
    status.textContent =
      "The operation could not finish. Reopen the library to check its saved packages.";
  } finally {
    busy = false;
    input.value = "";
    updateControls();
    focusAfter?.focus();
  }
}

function updateControls(): void {
  input.disabled = busy;
  packages.disabled = busy;
  items.disabled = busy || !current?.items.length;
  deleteButton.disabled = busy || !packages.value;
}

function requireElement<T extends Element>(selector: string, constructor: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor))
    throw new Error(`Missing required page element: ${selector}`);
  return element;
}

function questionCount(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

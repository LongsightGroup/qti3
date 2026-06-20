import { defineQtiAssessmentItemPlayer } from "@longsightgroup/qti3-player";
import {
  assertionLabel,
  assertSvCaseInDocument,
  type SharedVocabularyProbeResult,
} from "../shared-vocabulary-matrix/browser-probes.js";
import {
  sharedVocabularyManifest,
  type SharedVocabularyManifestEntry,
} from "../shared-vocabulary-matrix/manifest.js";
import type { SharedVocabularyAssertion } from "../shared-vocabulary-matrix/types.js";
import type { PlayerMessageCatalog } from "../../../packages/player/src/player-message-catalog.js";

defineQtiAssessmentItemPlayer();

type GallerySupportLevel = "full" | "stylesheet" | "conditional";

interface GalleryCase {
  entry: SharedVocabularyManifestEntry;
  classFamily: string;
  supportLevel: GallerySupportLevel;
}

const entries: GalleryCase[] = sharedVocabularyManifest
  .filter((entry) => entry.supportLevel !== "pass-through")
  .map((entry) => ({
    entry,
    classFamily: classFamily(entry),
    supportLevel: entry.forcedColors ? "conditional" : entry.supportLevel,
  }));

const moduleUrl = new URL(import.meta.url);
const repoRootUrl = new URL("../../../", moduleUrl);
const fixtureRootUrl = moduleUrl.pathname.includes("/@fs/") ? repoRootUrl : staticSiteRootUrl();
const player = requiredElement<QtiGalleryPlayer>("#player");
const interactionFilter = requiredElement<HTMLSelectElement>("#interaction-filter");
const familyFilter = requiredElement<HTMLSelectElement>("#family-filter");
const supportFilter = requiredElement<HTMLSelectElement>("#support-filter");
const caseSearch = requiredElement<HTMLInputElement>("#case-search");
const caseList = requiredElement<HTMLElement>("#case-list");
const title = requiredElement<HTMLElement>("#case-title");
const description = requiredElement<HTMLElement>("#case-description");
const tags = requiredElement<HTMLElement>("#case-tags");
const classInspector = requiredElement<HTMLElement>("#class-inspector");
const assertionList = requiredElement<HTMLElement>("#assertion-list");
const copyXml = requiredElement<HTMLButtonElement>("#copy-xml");
const copyTest = requiredElement<HTMLButtonElement>("#copy-test");
const copyStatus = requiredElement<HTMLElement>("#copy-status");

let selectedEntry = entryFromUrl() ?? entries[0]?.entry;
let selectedXml = "";

populateFilter(interactionFilter, [
  "all",
  ...unique(entries.map((item) => item.entry.interactionType)),
]);
populateFilter(familyFilter, ["all", ...unique(entries.map((item) => item.classFamily))]);
populateFilter(supportFilter, ["all", "full", "stylesheet", "conditional"]);

for (const control of [interactionFilter, familyFilter, supportFilter, caseSearch]) {
  control.addEventListener("input", () => {
    renderCaseList();
  });
}

copyXml.addEventListener("click", async () => {
  await copyText(selectedXml, "Item XML copied.");
});

copyTest.addEventListener("click", async () => {
  await copyText(
    `shared vocabulary matrix › ${selectedEntry?.id ?? ""}`,
    "Playwright test name copied.",
  );
});

renderCaseList();
void selectCase(selectedEntry?.id, false);

async function selectCase(caseId: string | undefined, pushUrl: boolean): Promise<void> {
  if (!caseId) return;
  const match = entries.find((item) => item.entry.id === caseId);
  if (!match) return;
  selectedEntry = match.entry;
  if (pushUrl) updateUrl(caseId, true);
  await loadSelectedCase();
}

async function loadSelectedCase(): Promise<void> {
  if (!selectedEntry) return;
  selectedXml = await fetchXml(selectedEntry);
  player.messageCatalog = selectedEntry.messageCatalog;
  await player.loadXml(selectedXml);
  await waitForPlayerContent(player);
  updateHeader(selectedEntry);
  renderClassInspector(selectedEntry);
  renderAssertionSkeleton(selectedEntry.assertions);
  const results = await assertSvCaseInDocument(selectedEntry.assertions);
  renderAssertions(results);
}

function renderCaseList(): void {
  const visible = filteredEntries();
  if (!visible.some((item) => item.entry.id === selectedEntry?.id)) {
    const next = visible[0]?.entry ?? entries[0]?.entry;
    if (next && next.id !== selectedEntry?.id) {
      selectedEntry = next;
      updateUrl(next.id, false);
      void loadSelectedCase();
    }
  }

  caseList.replaceChildren(
    ...visible.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "case-button";
      button.dataset.caseId = item.entry.id;
      button.setAttribute("aria-current", String(item.entry.id === selectedEntry?.id));
      button.append(
        textElement("strong", item.entry.id),
        textElement(
          "span",
          `${item.entry.interactionType} · ${item.classFamily} · ${item.supportLevel}`,
          "case-meta",
        ),
      );
      button.addEventListener("click", () => {
        selectedEntry = item.entry;
        updateUrl(item.entry.id, true);
        renderCaseList();
        void loadSelectedCase();
      });
      return button;
    }),
  );

  if (visible.length === 0) {
    caseList.replaceChildren(
      textElement("p", "No matrix cases match these filters.", "empty-state"),
    );
  }
}

function filteredEntries(): GalleryCase[] {
  const query = caseSearch.value.trim().toLowerCase();
  return entries.filter((item) => {
    if (
      interactionFilter.value !== "all" &&
      item.entry.interactionType !== interactionFilter.value
    ) {
      return false;
    }
    if (familyFilter.value !== "all" && item.classFamily !== familyFilter.value) return false;
    if (supportFilter.value !== "all" && item.supportLevel !== supportFilter.value) return false;
    if (!query) return true;
    return [
      item.entry.id,
      item.entry.interactionType,
      item.classFamily,
      item.supportLevel,
      ...classNames(item.entry),
    ].some((value) => value.toLowerCase().includes(query));
  });
}

function updateHeader(entry: SharedVocabularyManifestEntry): void {
  const details = entries.find((item) => item.entry.id === entry.id);
  title.textContent = entry.id;
  description.textContent = entry.fixturePath;
  tags.replaceChildren(
    ...[
      entry.interactionType,
      details?.classFamily ?? "unknown",
      details?.supportLevel ?? entry.supportLevel,
      ...(entry.forcedColors ? ["forced colors"] : []),
    ].map((tag) => textElement("span", tag, "tag")),
  );
}

function renderClassInspector(entry: SharedVocabularyManifestEntry): void {
  const authored = document.createElement("div");
  authored.className = "class-row";
  authored.append(
    textElement("strong", "Authored vocabulary"),
    codeElement(classNames(entry).join(" ") || "(none)"),
  );

  const renderedRows = classPreservationAssertions(entry.assertions).map((assertion) => {
    const element = document.querySelector(assertion.selector);
    const row = document.createElement("div");
    row.className = "class-row";
    row.append(
      textElement("strong", assertion.selector),
      codeElement(element?.getAttribute("class") ?? "(missing)"),
    );
    return row;
  });

  classInspector.replaceChildren(authored, ...renderedRows);
}

function renderAssertionSkeleton(assertions: SharedVocabularyAssertion[]): void {
  assertionList.replaceChildren(
    ...assertions.map((assertion) => {
      const row = document.createElement("div");
      row.className = "assertion-row";
      row.dataset.assertionType = assertion.type;
      row.append(
        textElement("strong", "Running", "status"),
        codeElement(assertionLabel(assertion)),
      );
      return row;
    }),
  );
}

function renderAssertions(results: SharedVocabularyProbeResult[]): void {
  assertionList.replaceChildren(
    ...results.map((result) => {
      const row = document.createElement("div");
      row.className = "assertion-row";
      row.dataset.assertionType = result.assertion.type;
      const statusLabel =
        result.status === "pass" ? "Pass" : result.status === "skip" ? "Skip" : "Fail";
      const status = textElement("strong", statusLabel, `status status-${result.status}`);
      row.append(status, codeElement(result.message));
      return row;
    }),
  );
}

function classPreservationAssertions(
  assertions: SharedVocabularyAssertion[],
): Array<Extract<SharedVocabularyAssertion, { type: "class-preserved" }>> {
  return assertions.filter(
    (assertion): assertion is Extract<SharedVocabularyAssertion, { type: "class-preserved" }> =>
      assertion.type === "class-preserved",
  );
}

async function fetchXml(entry: SharedVocabularyManifestEntry): Promise<string> {
  const response = await fetch(new URL(entry.fixturePath, fixtureRootUrl));
  if (!response.ok) throw new Error(`Unable to load ${entry.fixturePath}.`);
  return response.text();
}

function staticSiteRootUrl(): URL {
  const pageUrl = new URL(location.href);
  const galleryIndex = pageUrl.pathname.indexOf("/sv-gallery");
  if (galleryIndex >= 0) {
    return new URL(pageUrl.pathname.slice(0, galleryIndex + 1), pageUrl.origin);
  }
  return new URL("./", pageUrl);
}

async function copyText(text: string, successMessage: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  copyStatus.textContent = successMessage;
}

function entryFromUrl(): SharedVocabularyManifestEntry | undefined {
  const caseId = new URL(location.href).searchParams.get("case");
  return entries.find((entry) => entry.entry.id === caseId)?.entry;
}

function updateUrl(caseId: string, push: boolean): void {
  const url = new URL(location.href);
  url.searchParams.set("case", caseId);
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}

function classFamily(entry: SharedVocabularyManifestEntry): string {
  for (const className of classNames(entry)) {
    if (className.startsWith("qti-selections-")) return "selections";
    if (className.startsWith("qti-labels-")) return "labels";
    if (
      className.startsWith("qti-layout-") ||
      className.startsWith("qti-orientation-") ||
      className.startsWith("qti-choices-stacking-") ||
      className.startsWith("qti-writing-orientation-")
    ) {
      return "layout";
    }
    if (className.startsWith("qti-choices-")) return "choices-position";
    if (className.startsWith("qti-input-width-")) return "input-width";
    if (className.startsWith("qti-input-control-")) return "input-control";
    if (className === "qti-gap-placement" || className.startsWith("qti-gap-placement-")) {
      return "gap-placement";
    }
    if (
      className === "qti-keyword-emphasis" ||
      className === "qti-visually-hidden" ||
      className === "data-qti-suppress-tts"
    ) {
      return "accessibility";
    }
    if (className.startsWith("qti-match-")) return "match";
    if (className.startsWith("data-qti-media-player-")) return "media";
  }
  if (entry.id.startsWith("content-")) return "content";
  return "other";
}

function classNames(entry: SharedVocabularyManifestEntry): string[] {
  return Array.isArray(entry.className) ? entry.className : [entry.className];
}

function populateFilter(select: HTMLSelectElement, values: string[]): void {
  select.replaceChildren(
    ...values.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "all" ? "All" : value;
      return option;
    }),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].toSorted();
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function codeElement(text: string): HTMLElement {
  return textElement("code", text);
}

function requiredElement(selector: string): HTMLElement {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing gallery element ${selector}.`);
  return element as HTMLElement;
}

interface QtiGalleryPlayer extends HTMLElement {
  loadXml(xml: string): Promise<void>;
  messageCatalog?: PlayerMessageCatalog;
}

async function waitForPlayerContent(host: QtiGalleryPlayer): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (host.querySelector(".qti3-item-body, .qti3-interaction")) return;
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error("Player did not render item content.");
}

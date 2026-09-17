import { readBrowserPackageZip } from "./package-library/browser-package.js";
import {
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "@longsightgroup/qti3-a11y";
import { canonicalFixtures } from "@longsightgroup/qti3-fixtures";
import {
  createDefaultQti3PnpCapabilities,
  createPnpPlayerOptions,
  normalizeQti3Pnp,
  parseQti3PnpXml,
  resolveQti3Pnp,
  type QtiCatalogSupportSummary,
} from "@longsightgroup/qti3-pnp";
import {
  detectPackageMediaType,
  normalizePackagePath,
  parseQtiPackageFromEntries,
  type QtiDiagnostic,
} from "@longsightgroup/qti3-core";
import {
  defineQtiAssessmentItemPlayer,
  type QtiAssessmentItemPlayer,
} from "@longsightgroup/qti3-player";

defineQtiAssessmentItemPlayer();

const fixtureSelect = document.querySelector<HTMLSelectElement>("#fixture");
const loadFixture = document.querySelector<HTMLButtonElement>("#load-fixture");
const previousFixture = document.querySelector<HTMLButtonElement>("#previous-fixture");
const nextFixture = document.querySelector<HTMLButtonElement>("#next-fixture");
const loadXml = document.querySelector<HTMLButtonElement>("#load-xml");
const fileInput = document.querySelector<HTMLInputElement>("#file");
const localFiles = document.querySelector<HTMLSelectElement>("#local-files");
const previousFile = document.querySelector<HTMLButtonElement>("#previous-file");
const nextFile = document.querySelector<HTMLButtonElement>("#next-file");
const fileSummary = document.querySelector<HTMLParagraphElement>("#file-summary");
const xmlInput = document.querySelector<HTMLTextAreaElement>("#xml");
const packageLoader = document.querySelector<HTMLDetailsElement>("#package-loader");
const xmlLoader = document.querySelector<HTMLDetailsElement>("#xml-loader");
const pnpForm = document.querySelector<HTMLFormElement>("#pnp-form");
const pnpXmlInput = document.querySelector<HTMLTextAreaElement>("#pnp-xml");
const resetPnp = document.querySelector<HTMLButtonElement>("#reset-pnp");
const debugPnp = document.querySelector<HTMLPreElement>("#debug-pnp");
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
const debugCompanionMaterials = document.querySelector<HTMLPreElement>(
  "#debug-companion-materials",
);
const debugPackage = document.querySelector<HTMLPreElement>("#debug-package");
const debugValidation = document.querySelector<HTMLPreElement>("#debug-validation");
const debugDiagnostics = document.querySelector<HTMLPreElement>("#debug-diagnostics");
const debugState = document.querySelector<HTMLPreElement>("#debug-state");
const debugActionLog = document.querySelector<HTMLPreElement>("#debug-action-log");
const debugA11yProof = document.querySelector<HTMLElement>("#debug-a11y-proof");
const debugAtScripts = document.querySelector<HTMLElement>("#debug-at-scripts");
const events = document.querySelector<HTMLPreElement>("#events");
const player = document.querySelector(
  "qti-assessment-item-player",
) as QtiAssessmentItemPlayer | null;

if (
  !fixtureSelect ||
  !loadFixture ||
  !previousFixture ||
  !nextFixture ||
  !loadXml ||
  !fileInput ||
  !localFiles ||
  !previousFile ||
  !nextFile ||
  !fileSummary ||
  !xmlInput ||
  !packageLoader ||
  !xmlLoader ||
  !pnpForm ||
  !pnpXmlInput ||
  !resetPnp ||
  !debugPnp ||
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
  !debugCompanionMaterials ||
  !debugPackage ||
  !debugValidation ||
  !debugDiagnostics ||
  !debugState ||
  !debugActionLog ||
  !debugA11yProof ||
  !debugAtScripts ||
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

interface PackageDebugState {
  status: "none" | "loaded" | "empty" | "error";
  message: string;
  xmlFiles: string[];
  assetFiles: string[];
  loadableItems: string[];
  selectedItem?: string;
  selectedIndex?: number;
  diagnostics?: readonly QtiDiagnostic[];
}

let loadedFiles: LoadedFile[] = [];
let selectedFileIndex = -1;
let assetUrls = new Map<string, string>();
let packageAssetPaths: string[] = [];
let latestDiagnostics: unknown[] = [];
let latestValidationMessages: unknown[] = [];
let latestCatalogs: unknown[] = [];
let latestStylesheets: unknown[] = [];
let latestCompanionMaterials: unknown = null;
let latestPackage: PackageDebugState = emptyPackageDebugState();
let latestPnp: unknown = { status: "not-applied" };
let currentInteractionTypes: string[] = [];
const fixtureIds: string[] = [];
const actionLog: Array<{ time: string; action: string; status?: string; detail?: unknown }> = [];
const graphicGapImageChoiceExample = {
  id: "graphic-gap-img-example",
  title: "Graphic gap match image draggers",
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="graphic-gap-img-example" title="Graphic gap match image draggers" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response><qti-value>DraggerA TargetA</qti-value><qti-value>DraggerB TargetB</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-item-body>
    <qti-graphic-gap-match-interaction response-identifier="RESPONSE" max-associations="2">
      <qti-prompt>A museum exhibit team is checking a timeline panel before it goes to print. Place the Civil War marker on the first highlighted period and the Reconstruction marker on the second highlighted period. Leave the later Industrialization marker unused.</qti-prompt>
      <object data="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='300'%20height='160'%20viewBox='0%200%20300%20160'%3E%3Crect%20width='300'%20height='160'%20fill='%23f4f2ea'/%3E%3Crect%20x='36'%20y='44'%20width='92'%20height='64'%20rx='6'%20fill='%232f4858'/%3E%3Crect%20x='172'%20y='44'%20width='92'%20height='64'%20rx='6'%20fill='%238b5d33'/%3E%3Ctext%20x='82'%20y='82'%20text-anchor='middle'%20font-size='16'%20font-family='sans-serif'%20fill='white'%3ETarget%20A%3C/text%3E%3Ctext%20x='218'%20y='82'%20text-anchor='middle'%20font-size='16'%20font-family='sans-serif'%20fill='white'%3ETarget%20B%3C/text%3E%3C/svg%3E" alt="Diagram with two highlighted targets." type="image/svg+xml"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='78'%20height='63'%20viewBox='0%200%2078%2063'%3E%3Crect%20width='78'%20height='63'%20rx='4'%20fill='white'%20stroke='%232f4858'%20stroke-width='3'/%3E%3Ctext%20x='39'%20y='38'%20text-anchor='middle'%20font-size='18'%20font-family='sans-serif'%20fill='%232f4858'%3EA%3C/text%3E%3C/svg%3E" width="78"/>
      </qti-gap-img>
      <qti-gap-img identifier="DraggerB" match-max="1">
        <img alt="Reconstruction marker" height="63" src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='78'%20height='63'%20viewBox='0%200%2078%2063'%3E%3Crect%20width='78'%20height='63'%20rx='4'%20fill='white'%20stroke='%238b5d33'%20stroke-width='3'/%3E%3Ctext%20x='39'%20y='38'%20text-anchor='middle'%20font-size='18'%20font-family='sans-serif'%20fill='%238b5d33'%3EB%3C/text%3E%3C/svg%3E" width="78"/>
      </qti-gap-img>
      <qti-gap-img identifier="DraggerC" match-max="1">
        <img alt="Industrialization marker distractor" height="63" src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='78'%20height='63'%20viewBox='0%200%2078%2063'%3E%3Crect%20width='78'%20height='63'%20rx='4'%20fill='white'%20stroke='%236c757d'%20stroke-width='3'/%3E%3Ctext%20x='39'%20y='38'%20text-anchor='middle'%20font-size='18'%20font-family='sans-serif'%20fill='%236c757d'%3EC%3C/text%3E%3C/svg%3E" width="78"/>
      </qti-gap-img>
      <qti-associable-hotspot identifier="TargetA" shape="rect" coords="36,44,128,108" match-max="1"/>
      <qti-associable-hotspot identifier="TargetB" shape="rect" coords="172,44,264,108" match-max="1"/>
    </qti-graphic-gap-match-interaction>
  </qti-item-body>
</qti-assessment-item>`,
};
const extendedTextPatternMaskExample = {
  id: "extended-text-pattern-mask",
  title: "Extended text pattern mask",
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="extended-text-pattern-mask" title="Extended text pattern mask" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>A lab technician records the pH reading from a calibrated water-quality probe. Enter the value exactly as a decimal, using no more than six total digits or decimal points.</p>
    <qti-extended-text-interaction
      response-identifier="RESPONSE"
      class="qti-height-lines-3"
      expected-length="6"
      format="plain"
      placeholder-text="Example: 7.25"
      pattern-mask="([0-9.]{0,6})"
      data-patternmask-message="Use no more than 6 digits or decimal points"
    />
  </qti-item-body>
</qti-assessment-item>`,
};
const pnpKeywordEmphasisExample = {
  id: "pnp-keyword-emphasis-example",
  title: "PNP keyword emphasis and catalog",
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pnp-keyword-emphasis-example" title="PNP keyword emphasis and catalog" time-dependent="false" xml:lang="en">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE">
      <qti-prompt>The city wants to <span class="qti-keyword-emphasis" data-catalog-idref="pnp-help">mitigate</span> flooding near the playground by planting native grasses and improving drainage. Which option best explains the highlighted word in this context?</qti-prompt>
      <qti-simple-choice identifier="A">Reduce the severity or impact of the flooding problem.</qti-simple-choice>
      <qti-simple-choice identifier="B">Measure the depth of floodwater after every storm.</qti-simple-choice>
      <qti-simple-choice identifier="C">Move the playground to a different neighborhood immediately.</qti-simple-choice>
      <qti-simple-choice identifier="D">Describe the flooding in a more dramatic way.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="pnp-help">
      <qti-card support="linguistic-guidance">
        <qti-card-entry xml:lang="en" default="true">
          <qti-html-content>Mitigate means to make a problem less severe or less harmful.</qti-html-content>
        </qti-card-entry>
      </qti-card>
    </qti-catalog>
  </qti-catalog-info>
</qti-assessment-item>`,
};
const manualExampleFixtures = [
  graphicGapImageChoiceExample,
  extendedTextPatternMaskExample,
  pnpKeywordEmphasisExample,
];
const selectableFixtures = [...canonicalFixtures, ...manualExampleFixtures];
const samplePnpXml = `<access-for-all-pnp identifier="synthetic-candidate">
  <keyword-emphasis/>
  <linguistic-guidance language="en"/>
  <note-taking-on-screen/>
  <ext:longsight-glossary-illustration xmlns:ext="urn:example"/>
</access-for-all-pnp>`;

pnpXmlInput.value = samplePnpXml;

for (const category of ["interaction", "processing", "adaptive", "catalog"] as const) {
  const fixtures = canonicalFixtures.filter((fixture) => fixture.category === category);
  if (fixtures.length === 0) continue;
  const group = document.createElement("optgroup");
  group.label = categoryLabel(category);
  for (const fixture of fixtures) {
    const option = document.createElement("option");
    option.value = fixture.id;
    fixtureIds.push(fixture.id);
    option.textContent =
      fixture.category === "interaction"
        ? `${fixture.interactionType} (${fixture.qtiName})`
        : fixture.title;
    group.append(option);
  }
  fixtureSelect.append(group);
}

const examplesGroup = document.createElement("optgroup");
examplesGroup.label = "Examples";
for (const fixture of manualExampleFixtures) {
  const option = document.createElement("option");
  option.value = fixture.id;
  fixtureIds.push(fixture.id);
  option.textContent = fixture.title;
  examplesGroup.append(option);
}
fixtureSelect.append(examplesGroup);

updateFixtureNavigation();

fixtureSelect.addEventListener("change", () => updateFixtureNavigation());
loadFixture.addEventListener("click", () => loadSelectedFixture());

previousFixture.addEventListener("click", async () => {
  await loadFixtureAtIndex(selectedFixtureIndex() - 1);
});

nextFixture.addEventListener("click", async () => {
  await loadFixtureAtIndex(selectedFixtureIndex() + 1);
});

loadXml.addEventListener("click", async () => {
  xmlLoader.open = true;
  await player.loadXml(xmlInput.value);
});

pnpForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyPnp();
});

resetPnp.addEventListener("click", () => {
  pnpXmlInput.value = samplePnpXml;
  player.keywordEmphasisEnabled = false;
  player.catalogRequestPolicy = undefined;
  latestPnp = { status: "reset" };
  appendActionLog("pnp-reset", latestPnp);
  renderDebugPanels();
});

debugScore.addEventListener("click", () => player.scoreAttempt());
debugSuspend.addEventListener("click", () => player.suspend());
debugEnd.addEventListener("click", () => player.endAttempt());
debugReset.addEventListener("click", () => player.reset());

fileInput.addEventListener("change", async () => {
  packageLoader.open = true;
  await loadLocalFiles(fileInput.files);
});

localFiles.addEventListener("change", async () => {
  packageLoader.open = true;
  selectedFileIndex = Number(localFiles.value);
  await loadSelectedLocalFile();
});

previousFile.addEventListener("click", async () => {
  packageLoader.open = true;
  if (loadedFiles.length === 0) return;
  selectedFileIndex = Math.max(0, selectedFileIndex - 1);
  await loadSelectedLocalFile();
});

nextFile.addEventListener("click", async () => {
  packageLoader.open = true;
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
      latestCompanionMaterials = player.getCompanionMaterialsResolution() ?? null;
      currentInteractionTypes = interactionTypesFromDetail(detail);
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

void loadSelectedFixture();

function categoryLabel(category: (typeof canonicalFixtures)[number]["category"]): string {
  if (category === "processing") return "Processing references";
  if (category === "adaptive") return "Adaptive references";
  if (category === "catalog") return "Catalog references";
  return "Interaction references";
}

async function loadSelectedFixture(): Promise<void> {
  const fixture =
    selectableFixtures.find((item) => item.id === fixtureSelect.value) ?? selectableFixtures[0];
  if (!fixture) return;
  fixtureSelect.value = fixture.id;
  updateFixtureNavigation();
  xmlInput.value = fixture.xml;
  await player.loadXml(fixture.xml);
}

async function loadFixtureAtIndex(index: number): Promise<void> {
  const nextIndex = Math.min(Math.max(index, 0), fixtureIds.length - 1);
  const fixtureId = fixtureIds[nextIndex];
  if (!fixtureId) return;
  fixtureSelect.value = fixtureId;
  await loadSelectedFixture();
}

function selectedFixtureIndex(): number {
  return Math.max(0, fixtureIds.indexOf(fixtureSelect.value));
}

function updateFixtureNavigation(): void {
  const selectedIndex = selectedFixtureIndex();
  previousFixture.disabled = selectedIndex <= 0;
  nextFixture.disabled = selectedIndex >= fixtureIds.length - 1;
}

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
  debugCompanionMaterials.textContent = stableJson(latestCompanionMaterials);
  debugPackage.textContent = stableJson(latestPackage);
  debugPnp.textContent = stableJson(latestPnp);
  debugValidation.textContent = stableJson(latestValidationMessages);
  debugDiagnostics.textContent = stableJson(latestDiagnostics);
  debugState.textContent = stableJson(state ?? {});
  debugActionLog.textContent = stableJson(actionLog);
  renderAccessibilityProof();
}

function applyPnp(): void {
  const parsed = parseQti3PnpXml(pnpXmlInput.value);
  const normalized = normalizeQti3Pnp(parsed);
  const resolution = resolveQti3Pnp(normalized.profile, {
    capabilities: createDefaultQti3PnpCapabilities(),
    qti: { catalogSupports: pnpCatalogSupports(latestCatalogs) },
    activity: { language: "en" },
    policy: { onUnsupportedSupport: "diagnostic" },
  });

  const { playerOptions, hostRequired } = createPnpPlayerOptions(resolution);
  player.keywordEmphasisEnabled = playerOptions.keywordEmphasisEnabled;
  player.catalogRequestPolicy = playerOptions.catalogRequestPolicy;
  latestPnp = {
    status: normalized.ok ? "applied" : "applied-with-diagnostics",
    parsed: {
      ok: parsed.ok,
      diagnostics: parsed.diagnostics,
    },
    normalized: {
      ok: normalized.ok,
      preferences: normalized.profile.preferences,
      diagnostics: normalized.diagnostics,
    },
    resolution,
    appliedPlayerOptions: playerOptions,
    hostRequired,
  };
  appendActionLog("pnp-apply", latestPnp);
  renderDebugPanels();
}

function pnpCatalogSupports(catalogs: unknown[]): QtiCatalogSupportSummary[] {
  const summaries: QtiCatalogSupportSummary[] = [];
  for (const catalog of catalogs) {
    if (!isRecord(catalog) || typeof catalog.id !== "string" || !Array.isArray(catalog.cards)) {
      continue;
    }
    for (const card of catalog.cards) {
      if (!isRecord(card) || typeof card.support !== "string") continue;
      const entries = Array.isArray(card.entries) ? card.entries : [];
      if (entries.length === 0) {
        summaries.push({
          catalogId: catalog.id,
          support: card.support,
          default: true,
          language: typeof card.language === "string" ? card.language : undefined,
        });
        continue;
      }
      for (const entry of entries) {
        if (!isRecord(entry)) continue;
        const summary: QtiCatalogSupportSummary = {
          catalogId: catalog.id,
          support: card.support,
          default: entry.default === true,
        };
        if (typeof entry.language === "string") summary.language = entry.language;
        summaries.push(summary);
      }
    }
  }
  return summaries;
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

function emptyPackageDebugState(): PackageDebugState {
  return {
    status: "none",
    message: "No QTI package loaded.",
    xmlFiles: [],
    assetFiles: [],
    loadableItems: [],
  };
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

function interactionTypesFromDetail(detail: unknown): string[] {
  if (!isRecord(detail) || !isRecord(detail.item) || !Array.isArray(detail.item.interactions)) {
    return [];
  }
  return detail.item.interactions
    .map((interaction) => (isRecord(interaction) ? interaction.type : undefined))
    .filter((type): type is string => typeof type === "string");
}

function renderAccessibilityProof(): void {
  const interactionTypes = [...new Set(currentInteractionTypes)];
  if (interactionTypes.length === 0) {
    debugA11yProof.textContent = "No interaction loaded.";
    debugAtScripts.textContent = "No interaction loaded.";
    return;
  }

  const proofNodes = interactionTypes.map((interactionType) => {
    const proof = accessibilityProofMatrix.find(
      (entry) => entry.interactionType === interactionType,
    );
    if (!proof) {
      const missing = document.createElement("p");
      missing.textContent = `No accessibility proof entry for ${interactionType}.`;
      return missing;
    }

    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = `${interactionType} accessibility contract`;

    const summary = document.createElement("p");
    summary.textContent = `Primary role: ${proof.primaryRole}. Keyboard required: ${
      proof.keyboardRequired ? "yes" : "no"
    }.`;

    section.replaceChildren(
      heading,
      summary,
      proofList("Keyboard model", proof.keyboardModel),
      proofList("Automated evidence", proof.proof.automated),
      proofList("Manual evidence", proof.proof.manual),
    );
    return section;
  });
  debugA11yProof.replaceChildren(...proofNodes);

  const scripts = manualAssistiveTechnologyScripts.filter((script) =>
    script.appliesTo.some((type) => interactionTypes.includes(type)),
  );
  if (scripts.length === 0) {
    debugAtScripts.textContent = `No manual assistive-technology scripts for ${interactionTypes.join(
      ", ",
    )}.`;
    return;
  }
  debugAtScripts.replaceChildren(...scripts.map(renderManualScript));
}

function proofList(label: string, values: string[]): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = label;
  const list = document.createElement("ul");
  list.append(...values.map((value) => listItem(value)));
  section.append(heading, list);
  return section;
}

function renderManualScript(
  script: (typeof manualAssistiveTechnologyScripts)[number],
): HTMLElement {
  const section = document.createElement("section");
  section.className = "at-script";
  const heading = document.createElement("h3");
  heading.textContent = `${script.assistiveTechnology} on ${script.platform} (${script.browser})`;
  section.append(
    heading,
    proofList("Setup", script.setup),
    orderedList("Procedure", script.procedure),
    proofList("Expected results", script.expectedResults),
  );
  return section;
}

function orderedList(label: string, values: string[]): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = label;
  const list = document.createElement("ol");
  list.append(...values.map((value) => listItem(value)));
  section.append(heading, list);
  return section;
}

function listItem(value: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = value;
  return item;
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
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return JSON.stringify(value);
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
    showPackageStatus("No QTI package loaded. Upload a ZIP package.");
    latestPackage =
      latestPackage.status === "none"
        ? emptyPackageDebugState()
        : {
            ...latestPackage,
            selectedItem: undefined,
            selectedIndex: undefined,
          };
    renderDebugPanels();
    return;
  }

  localFiles.value = String(selectedFileIndex);
  xmlInput.value = file.xml;
  fileSummary.textContent = `${selectedFileIndex + 1} of ${loadedFiles.length}: ${file.name}`;
  latestPackage = {
    ...latestPackage,
    selectedItem: file.name,
    selectedIndex: selectedFileIndex,
  };
  previousFile.disabled = selectedFileIndex <= 0;
  nextFile.disabled = selectedFileIndex >= loadedFiles.length - 1;
  await player.loadXml(file.xml, {
    resolveAsset: (url) => resolveLoadedAsset(file.source, url),
    resolveStylesheet: (stylesheet) => {
      const href = resolveLoadedAsset(file.source, stylesheet.href);
      // Demo-only: unchanged href means the asset is outside the uploaded package.
      if (href === stylesheet.href) return undefined;
      return {
        href,
        type: stylesheet.type,
        media: stylesheet.media,
        title: stylesheet.title,
      };
    },
  });
}

async function loadLocalFiles(fileList: FileList | null): Promise<void> {
  clearAssetUrls();
  packageAssetPaths = [];
  const upload = fileList?.[0];
  if (!upload || !upload.name.toLowerCase().endsWith(".zip")) {
    loadedFiles = [];
    localFiles.replaceChildren();
    selectedFileIndex = -1;
    latestPackage = emptyPackageDebugState();
    await loadSelectedLocalFile();
    return;
  }
  let bytes: ArrayBuffer;
  try {
    bytes = await upload.arrayBuffer();
  } catch {
    showPackageFailure([
      {
        code: "package.file.read",
        severity: "error",
        message: "The selected file could not be read.",
      },
    ]);
    return;
  }
  const extracted = await readBrowserPackageZip(new Uint8Array(bytes));
  if (!extracted.ok) {
    showPackageFailure(extracted.diagnostics);
    return;
  }
  const imported = parseQtiPackageFromEntries(extracted.entries);
  if (!imported.ok) {
    showPackageFailure(imported.diagnostics);
    return;
  }
  loadedFiles = imported.items.map((item) => ({
    name: item.href,
    source: item.href,
    xml: item.xml,
  }));
  packageAssetPaths = imported.entries
    .filter((entry) => !entry.path.toLowerCase().endsWith(".xml"))
    .map((entry) => entry.path)
    .toSorted();
  for (const entry of imported.entries) {
    assetUrls.set(
      entry.path,
      URL.createObjectURL(
        new Blob([entry.bytes.slice()], {
          type: detectPackageMediaType(entry.path) ?? "application/octet-stream",
        }),
      ),
    );
  }
  latestPackage = {
    status: loadedFiles.length > 0 ? "loaded" : "empty",
    message:
      loadedFiles.length > 0
        ? `Loaded ${loadedFiles.length} QTI item${loadedFiles.length === 1 ? "" : "s"}.`
        : "No loadable QTI item files were found in the package.",
    xmlFiles: imported.entries
      .filter((entry) => entry.path.toLowerCase().endsWith(".xml"))
      .map((entry) => entry.path),
    diagnostics: imported.diagnostics,
    assetFiles: packageAssetPaths,
    loadableItems: loadedFiles.map((file) => file.source),
  };
  appendActionLog("package-load", latestPackage);
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

function showPackageStatus(message: string): void {
  fileSummary.textContent = message;
  previousFile.disabled = true;
  nextFile.disabled = true;
}

function showPackageFailure(diagnostics: readonly QtiDiagnostic[]): void {
  loadedFiles = [];
  localFiles.replaceChildren();
  selectedFileIndex = -1;
  latestPackage = {
    status: "error",
    message: `Unable to read QTI package: ${diagnostics.map((diagnostic) => diagnostic.message).join(" ")}`,
    xmlFiles: [],
    assetFiles: [],
    loadableItems: [],
    diagnostics,
  };
  showPackageStatus(latestPackage.message);
  appendActionLog("package-error", latestPackage);
  renderDebugPanels();
}

function clearAssetUrls(): void {
  for (const url of assetUrls.values()) URL.revokeObjectURL(url);
  assetUrls = new Map();
}

function resolveLoadedAsset(source: string, url: string): string {
  if (!isRelativeAssetUrl(url)) return url;
  try {
    const base = source.includes("/") ? source.slice(0, source.lastIndexOf("/") + 1) : "";
    const diagnostics: QtiDiagnostic[] = [];
    const path = normalizePackagePath(`${base}${url}`, "asset reference", diagnostics);
    return path ? (assetUrls.get(path) ?? url) : url;
  } catch {
    return url;
  }
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

import {
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "@longsightgroup/qti3-a11y";
import { canonicalFixtures } from "@longsightgroup/qti3-fixtures";
import {
  createDefaultQti3PnpCapabilities,
  normalizeQti3Pnp,
  parseQti3PnpXml,
  resolveQti3Pnp,
  type Qti3PnpResolution,
  type QtiCatalogSupportSummary,
} from "@longsightgroup/qti3-pnp";
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

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

interface PackageDebugState {
  status: "none" | "loaded" | "empty" | "error";
  message: string;
  xmlFiles: string[];
  assetFiles: string[];
  loadableItems: string[];
  selectedItem?: string;
  selectedIndex?: number;
  errors?: string[];
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
      <qti-prompt>Place the image-backed draggers onto the matching highlighted targets.</qti-prompt>
      <object data="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='300'%20height='160'%20viewBox='0%200%20300%20160'%3E%3Crect%20width='300'%20height='160'%20fill='%23f4f2ea'/%3E%3Crect%20x='36'%20y='44'%20width='92'%20height='64'%20rx='6'%20fill='%232f4858'/%3E%3Crect%20x='172'%20y='44'%20width='92'%20height='64'%20rx='6'%20fill='%238b5d33'/%3E%3Ctext%20x='82'%20y='82'%20text-anchor='middle'%20font-size='16'%20font-family='sans-serif'%20fill='white'%3ETarget%20A%3C/text%3E%3Ctext%20x='218'%20y='82'%20text-anchor='middle'%20font-size='16'%20font-family='sans-serif'%20fill='white'%3ETarget%20B%3C/text%3E%3C/svg%3E" alt="Diagram with two highlighted targets." type="image/svg+xml"/>
      <qti-gap-img identifier="DraggerA" match-max="1">
        <img alt="Civil War marker" height="63" src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='78'%20height='63'%20viewBox='0%200%2078%2063'%3E%3Crect%20width='78'%20height='63'%20rx='4'%20fill='white'%20stroke='%232f4858'%20stroke-width='3'/%3E%3Ctext%20x='39'%20y='38'%20text-anchor='middle'%20font-size='18'%20font-family='sans-serif'%20fill='%232f4858'%3EA%3C/text%3E%3C/svg%3E" width="78"/>
      </qti-gap-img>
      <qti-gap-img identifier="DraggerB" match-max="1">
        <img alt="Reconstruction marker" height="63" src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='78'%20height='63'%20viewBox='0%200%2078%2063'%3E%3Crect%20width='78'%20height='63'%20rx='4'%20fill='white'%20stroke='%238b5d33'%20stroke-width='3'/%3E%3Ctext%20x='39'%20y='38'%20text-anchor='middle'%20font-size='18'%20font-family='sans-serif'%20fill='%238b5d33'%3EB%3C/text%3E%3C/svg%3E" width="78"/>
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
    <p>Enter a decimal value using no more than six total digits or decimal points.</p>
    <qti-extended-text-interaction
      response-identifier="RESPONSE"
      class="qti-height-lines-3"
      expected-length="6"
      format="plain"
      placeholder-text="Enter a decimal number..."
      pattern-mask="([0-9.]{0,6})"
      data-patternmask-message="Maximum of 6 digits or decimal points permitted"
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
      <qti-prompt>Choose the statement with the <span class="qti-keyword-emphasis" data-catalog-idref="pnp-help">critical keyword</span>.</qti-prompt>
      <qti-simple-choice identifier="A">The critical keyword is emphasized when host-provided PNP requests it.</qti-simple-choice>
      <qti-simple-choice identifier="B">The player fetches the candidate's PNP profile on its own.</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-catalog-info>
    <qti-catalog id="pnp-help">
      <qti-card support="linguistic-guidance">
        <qti-card-entry xml:lang="en" default="true">
          <qti-html-content>Critical means the word should receive extra attention.</qti-html-content>
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

for (const category of ["interaction", "processing", "adaptive"] as const) {
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

  applyPnpResolution(resolution);
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
    appliedPlayerOptions: {
      keywordEmphasisEnabled: player.keywordEmphasisEnabled,
    },
  };
  appendActionLog("pnp-apply", latestPnp);
  renderDebugPanels();
}

function applyPnpResolution(resolution: Qti3PnpResolution): void {
  player.keywordEmphasisEnabled = resolution.display.keywordEmphasis === true;
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
  let files: LoadedFile[];
  let loadableItems: LoadedFile[];
  try {
    files = await readPackageXmlFiles(fileList);
    loadableItems = resolveLoadableItems(files);
  } catch (error) {
    const message = errorMessage(error);
    loadedFiles = [];
    localFiles.replaceChildren();
    selectedFileIndex = -1;
    latestPackage = {
      status: "error",
      message: `Unable to read QTI package: ${message}`,
      xmlFiles: [],
      assetFiles: [],
      loadableItems: [],
      errors: [message],
    };
    showPackageStatus(latestPackage.message);
    appendActionLog("package-error", latestPackage);
    renderDebugPanels();
    return;
  }
  loadedFiles = loadableItems;
  latestPackage = {
    status: loadedFiles.length > 0 ? "loaded" : "empty",
    message:
      loadedFiles.length > 0
        ? `Loaded ${loadedFiles.length} QTI item${loadedFiles.length === 1 ? "" : "s"}.`
        : "No loadable QTI item files were found in the package.",
    xmlFiles: files.map((file) => file.source),
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

async function readPackageXmlFiles(fileList: FileList | null): Promise<LoadedFile[]> {
  const [file] = [...(fileList ?? [])];
  packageAssetPaths = [];
  if (!file || !file.name.toLowerCase().endsWith(".zip")) return [];
  return (await readZipXmlFiles(file)).sort((left, right) => left.name.localeCompare(right.name));
}

async function readZipXmlFiles(file: File): Promise<LoadedFile[]> {
  const entries = await readZipEntries(await file.arrayBuffer());
  packageAssetPaths = entries
    .filter((entry) => !entry.name.endsWith(".xml"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
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
  if (eocdOffset < 0) throw new Error("No ZIP central directory was found.");

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
    const name = normalizePackagePath(decoder.decode(rawName), "ZIP entry");
    offset += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/")) continue;

    const content = await zipEntryBytes(
      bytes,
      view,
      localHeaderOffset,
      compressedSize,
      method,
      name,
    );
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
  try {
    const path = resolveRelativePath(source, url);
    const direct = normalizePackagePath(url, "asset reference");
    return assetUrls.get(path) ?? assetUrls.get(direct) ?? url;
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
  name: string,
): Promise<Uint8Array | undefined> {
  if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
    throw new Error(`Invalid local header for ${name}.`);
  }
  const nameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataOffset = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
  if (method === 0) return compressed;
  if (method !== 8) throw new Error(`Unsupported ZIP compression method ${method} for ${name}.`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot read deflated ZIP packages.");
  }

  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
      if (byPath.has(ref) && !packageOrder.includes(ref)) {
        packageOrder.push(ref);
      } else if (!byPath.has(ref)) {
        throw new Error(`Package item reference ${ref} was not found.`);
      }
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
    .map((href) => resolvePackageHref(source, href));
}

function manifestItemResources(xml: string, source: string): string[] {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const refs = elementsByLocalName(parsed, "resource")
    .filter((element) => isQtiItemResource(element.getAttribute("type") ?? ""))
    .map((element) => resourceHref(element))
    .filter(Boolean);
  return refs.map((href) => resolvePackageHref(source, href));
}

function isQtiItemResource(type: string): boolean {
  return type.toLowerCase().startsWith("imsqti_item_xmlv3p0");
}

function resourceHref(resource: Element): string {
  const href = resource.getAttribute("href");
  if (href) return href;
  const file = elementsByLocalName(resource, "file").find((element) => {
    return (element.getAttribute("href") ?? "").toLowerCase().endsWith(".xml");
  });
  return file?.getAttribute("href") ?? "";
}

function resolvePackageHref(from: string, href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? "";
  return resolveRelativePath(from, path);
}

function elementsByLocalName(root: Document | Element, localName: string): Element[] {
  return [...root.getElementsByTagName("*")].filter((element) => element.localName === localName);
}

function resolveRelativePath(from: string, href: string): string {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return normalizePackagePath(`${base}${href}`, "package reference");
}

function normalizePackagePath(path: string, context: string): string {
  if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    throw new Error(`${context} ${path} must be a package-relative path.`);
  }
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) {
        throw new Error(`${context} ${path} escapes the package root.`);
      }
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

import { interactionFixtures } from "@qti3/fixtures";
import { defineQtiAssessmentItemPlayer } from "@qti3/player";

defineQtiAssessmentItemPlayer();

const fixtureSelect = document.querySelector<HTMLSelectElement>("#fixture");
const loadFixture = document.querySelector<HTMLButtonElement>("#load-fixture");
const loadXml = document.querySelector<HTMLButtonElement>("#load-xml");
const themeSelect = document.querySelector<HTMLSelectElement>("#theme");
const themeLink = document.querySelector<HTMLLinkElement>("#external-theme");
const themeNote = document.querySelector<HTMLParagraphElement>("#theme-note");
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
const events = document.querySelector<HTMLPreElement>("#events");
const player = document.querySelector("qti-assessment-item-player");

if (
  !fixtureSelect ||
  !loadFixture ||
  !loadXml ||
  !themeSelect ||
  !themeLink ||
  !themeNote ||
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
  !events ||
  !player
) {
  throw new Error("Manual harness failed to initialize.");
}

interface LoadedFile {
  name: string;
  xml: string;
}

interface HarnessTheme {
  id: string;
  label: string;
  href?: string | undefined;
}

const themes: HarnessTheme[] = [
  { id: "reference", label: "Reference / no external CSS" },
  {
    id: "bootstrap",
    label: "Bootstrap 5.3",
    href: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css",
  },
  {
    id: "bootswatch-materia",
    label: "Bootswatch Materia",
    href: "https://cdn.jsdelivr.net/npm/bootswatch@5.3.8/dist/materia/bootstrap.min.css",
  },
  {
    id: "pico",
    label: "Pico 2",
    href: "https://cdn.jsdelivr.net/npm/@picocss/pico@2.1.1/css/pico.min.css",
  },
  {
    id: "bulma",
    label: "Bulma 1.0",
    href: "https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css",
  },
  {
    id: "foundation",
    label: "Foundation 6",
    href: "https://cdn.jsdelivr.net/npm/foundation-sites@6.9.0/dist/css/foundation.min.css",
  },
  {
    id: "water",
    label: "Water.css",
    href: "https://cdn.jsdelivr.net/npm/water.css@2.1.1/out/water.min.css",
  },
];

let loadedFiles: LoadedFile[] = [];
let selectedFileIndex = -1;

for (const fixture of interactionFixtures) {
  const option = document.createElement("option");
  option.value = fixture.id;
  option.textContent = `${fixture.interactionType} (${fixture.qtiName})`;
  fixtureSelect.append(option);
}

for (const theme of themes) {
  const option = document.createElement("option");
  option.value = theme.id;
  option.textContent = theme.label;
  themeSelect.append(option);
}

loadFixture.addEventListener("click", async () => {
  const fixture =
    interactionFixtures.find((item) => item.id === fixtureSelect.value) ?? interactionFixtures[0];
  if (!fixture) return;
  xmlInput.value = fixture.xml;
  await player.loadXml(fixture.xml);
});

themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
});

loadXml.addEventListener("click", async () => {
  await player.loadXml(xmlInput.value);
});

fileInput.addEventListener("change", async () => {
  const files = [...(fileInput.files ?? [])].filter((file) => file.name.endsWith(".xml"));
  loadedFiles = await Promise.all(
    files.map(async (file) => ({
      name: file.webkitRelativePath || file.name,
      xml: await file.text(),
    })),
  );
  loadedFiles.sort((left, right) => left.name.localeCompare(right.name));
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
    if (eventName === "qti-ready") resetScorePanel();
    else if (eventName === "qti-responsechange") markScoreStale();
    else if (eventName === "qti-validation") renderValidationResult(detail);
    else if (eventName === "qti-score") renderScoreResult(detail);
  });
}

loadFixture.click();
applyTheme(themeSelect.value);

function applyTheme(themeId: string): void {
  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
  if (!theme?.href) {
    themeLink.removeAttribute("href");
    themeLink.disabled = true;
    themeNote.textContent = "Reference harness CSS only. No external stylesheet loaded.";
    return;
  }

  themeLink.disabled = false;
  themeLink.href = theme.href;
  themeNote.textContent = `${theme.label} loaded from CDN for harness preview only. Not bundled with @qti3/player.`;
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

function validationMessagesFromDetail(detail: unknown): unknown[] {
  if (!isRecord(detail)) return [];
  const validationMessages = detail.validationMessages;
  return Array.isArray(validationMessages) ? validationMessages : [];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadSelectedLocalFile(): Promise<void> {
  const file = loadedFiles[selectedFileIndex];
  if (!file) {
    fileSummary.textContent = "No local XML files loaded.";
    previousFile.disabled = true;
    nextFile.disabled = true;
    return;
  }

  localFiles.value = String(selectedFileIndex);
  xmlInput.value = file.xml;
  fileSummary.textContent = `${selectedFileIndex + 1} of ${loadedFiles.length}: ${file.name}`;
  previousFile.disabled = selectedFileIndex <= 0;
  nextFile.disabled = selectedFileIndex >= loadedFiles.length - 1;
  await player.loadXml(file.xml);
}

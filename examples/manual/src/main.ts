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
  !events ||
  !player
) {
  throw new Error("Manual harness failed to initialize.");
}

interface LoadedFile {
  name: string;
  xml: string;
}

let loadedFiles: LoadedFile[] = [];
let selectedFileIndex = -1;

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
    events.textContent = `${eventName}\n${JSON.stringify((event as CustomEvent).detail, null, 2)}`;
  });
}

loadFixture.click();

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

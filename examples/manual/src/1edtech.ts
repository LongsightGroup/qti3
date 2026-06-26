import {
  defineQtiAssessmentItemPlayer,
  type QtiAssessmentItemPlayer,
} from "@longsightgroup/qti3-player";

defineQtiAssessmentItemPlayer();

interface ExampleEntry {
  path: string;
  name: string;
  group: string;
  kind: "item" | "test" | "xml";
  identifier?: string;
  title?: string;
}

interface ExampleIndexPayload {
  root: string;
  examples: ExampleEntry[];
  error?: string;
}

const status = requiredElement("#status") as HTMLElement;
const filter = requiredElement("#filter") as HTMLInputElement;
const examplesSelect = requiredElement("#examples") as HTMLSelectElement;
const previous = requiredElement("#previous") as HTMLButtonElement;
const next = requiredElement("#next") as HTMLButtonElement;
const copyOriginal = requiredElement("#copy-original") as HTMLButtonElement;
const meta = requiredElement("#meta") as HTMLElement;
const xmlInput = requiredElement("#xml") as HTMLTextAreaElement;
const reload = requiredElement("#reload") as HTMLButtonElement;
const events = requiredElement("#events") as HTMLPreElement;
const player = requiredElement("qti-assessment-item-player") as QtiAssessmentItemPlayer;

let allExamples: ExampleEntry[] = [];
let visibleExamples: ExampleEntry[] = [];
let selectedIndex = 0;
let currentXml = "";
let currentExample: ExampleEntry | undefined;

void initialize();

async function initialize(): Promise<void> {
  const payload = await fetchJson<ExampleIndexPayload>("/__1edtech/index.json");
  if (payload.error) {
    status.textContent = payload.error;
    meta.textContent = `Configured root: ${payload.root}`;
    previous.disabled = true;
    next.disabled = true;
    return;
  }

  allExamples = payload.examples;
  visibleExamples = allExamples.filter((example) => example.kind === "item");
  renderExamples();
  status.textContent = `${visibleExamples.length} item examples`;
  await loadAt(0);

  filter.addEventListener("input", () => {
    const query = filter.value.trim().toLowerCase();
    visibleExamples = allExamples.filter((example) => {
      if (example.kind !== "item") return false;
      return [example.path, example.identifier, example.title].some((value) =>
        value?.toLowerCase().includes(query),
      );
    });
    renderExamples();
    void loadAt(0);
  });

  examplesSelect.addEventListener("change", () => {
    void loadAt(Number(examplesSelect.value));
  });

  previous.addEventListener("click", () => {
    void loadAt(selectedIndex - 1);
  });

  next.addEventListener("click", () => {
    void loadAt(selectedIndex + 1);
  });

  reload.addEventListener("click", () => {
    void loadXml(xmlInput.value);
  });

  copyOriginal.addEventListener("click", () => {
    void copyXml(currentXml, "Copied original XML");
  });

  player.addEventListener("qti-ready", (event) => {
    appendEvent("qti-ready", (event as CustomEvent).detail);
  });
  player.addEventListener("qti-diagnostics", (event) => {
    appendEvent("qti-diagnostics", (event as CustomEvent).detail);
  });
  player.addEventListener("qti-statechange", (event) => {
    appendEvent("qti-statechange", (event as CustomEvent).detail);
  });
}

async function loadAt(index: number): Promise<void> {
  if (visibleExamples.length === 0) {
    examplesSelect.replaceChildren();
    meta.textContent = "No matching item examples";
    previous.disabled = true;
    next.disabled = true;
    return;
  }

  selectedIndex = Math.max(0, Math.min(index, visibleExamples.length - 1));
  currentExample = visibleExamples[selectedIndex];
  examplesSelect.value = String(selectedIndex);
  currentXml = await fetchText(fileUrl(currentExample.path));
  xmlInput.value = currentXml;
  meta.textContent = JSON.stringify(
    {
      selectedIndex,
      visible: visibleExamples.length,
      example: currentExample,
    },
    null,
    2,
  );
  previous.disabled = selectedIndex <= 0;
  next.disabled = selectedIndex >= visibleExamples.length - 1;
  await loadXml(currentXml);
}

async function loadXml(xml: string): Promise<void> {
  events.textContent = "";
  await player.loadXml(xml, {
    resolveAsset: (url: string) => resolveAssetUrl(currentExample?.path ?? "", url),
  });
}

function renderExamples(): void {
  examplesSelect.replaceChildren(
    ...visibleExamples.map((example, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${example.title || example.identifier || example.name}`;
      return option;
    }),
  );
}

function appendEvent(name: string, detail: unknown): void {
  events.textContent = `${new Date().toLocaleTimeString()} ${name}\n${JSON.stringify(detail, null, 2)}\n\n${events.textContent}`;
}

async function copyXml(xml: string, message: string): Promise<void> {
  await navigator.clipboard.writeText(xml);
  status.textContent = message;
}

function resolveAssetUrl(sourcePath: string, url: string): string {
  if (!sourcePath || url.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const base = sourcePath.split("/").slice(0, -1).join("/");
  return fileUrl(`${base}/${url}`);
}

function fileUrl(path: string): string {
  return `/__1edtech/file/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return await response.text();
}

function requiredElement(selector: string): Element {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

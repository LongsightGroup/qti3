import type { ConversionResult } from "./operations.js";

/** Resolves the page's authored markup; missing elements indicate an implementation defect. */
export function requiredElement<T extends Element>(
  root: ParentNode,
  selector: string,
  constructor: new () => T,
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof constructor))
    throw new Error(`Missing conversion page element: ${selector}`);
  return element;
}

/** Owns result presentation, stale-output clearing, and explicit copy/download actions. */
export class ResultPanel {
  private readonly output: HTMLTextAreaElement;
  private readonly status: HTMLElement;
  private readonly diagnostics: HTMLUListElement;
  private readonly copy: HTMLButtonElement;
  private readonly download: HTMLButtonElement;
  private readonly preview: HTMLButtonElement | null;
  private readonly report: HTMLDetailsElement;
  private readonly reportText: HTMLElement;
  private xml: string | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly filename: () => string,
  ) {
    this.output = requiredElement(root, "[data-output]", HTMLTextAreaElement);
    this.status = requiredElement(root, "[data-status]", HTMLElement);
    this.diagnostics = requiredElement(root, "[data-diagnostics]", HTMLUListElement);
    this.copy = requiredElement(root, "[data-copy]", HTMLButtonElement);
    this.download = requiredElement(root, "[data-download]", HTMLButtonElement);
    this.preview = root.querySelector("[data-preview]");
    this.report = requiredElement(root, "[data-report]", HTMLDetailsElement);
    this.reportText = requiredElement(this.report, "pre", HTMLElement);
    this.copy.addEventListener("click", () => {
      void this.copyXml();
    });
    this.download.addEventListener("click", () => this.downloadXml());
  }

  /** Current successful output, absent after any input change or failed operation. */
  get currentXml(): string | undefined {
    return this.xml;
  }

  /** Clears every action and previous result when inputs change or another operation begins. */
  clear(message = "Input changed. Run again to generate output."): void {
    this.xml = undefined;
    this.output.value = "";
    this.diagnostics.replaceChildren();
    this.report.hidden = true;
    this.reportText.textContent = "";
    this.copy.disabled = true;
    this.download.disabled = true;
    if (this.preview) this.preview.disabled = true;
    this.root.dataset.state = "idle";
    this.status.textContent = message;
  }

  /** Displays typed diagnostics beside output; failures never retain an earlier result. */
  show(result: ConversionResult): void {
    this.clear("");
    const warnings = result.diagnostics.filter((entry) => entry.severity === "warning").length;
    const state = result.ok ? (warnings > 0 ? "warning" : "success") : "error";
    this.root.dataset.state = state;
    this.status.textContent = result.ok
      ? warnings > 0
        ? `Completed with ${warnings} warning${warnings === 1 ? "" : "s"}. Review the diagnostics.`
        : "Completed successfully."
      : "Conversion failed. Review the diagnostics and update the input.";
    for (const entry of result.diagnostics) {
      const item = document.createElement("li");
      const label = document.createElement("strong");
      label.textContent = `${entry.severity}: ${entry.code}`;
      const message = document.createElement("p");
      message.textContent = entry.message;
      item.append(label, message);
      if (entry.path) {
        const path = document.createElement("code");
        path.textContent = entry.path;
        item.append(path);
      }
      this.diagnostics.append(item);
    }
    if (result.ok) {
      this.xml = result.xml;
      this.output.value = result.xml;
      this.copy.disabled = false;
      this.download.disabled = false;
      if (this.preview) this.preview.disabled = false;
      if (result.report) {
        this.reportText.textContent = result.report;
        this.report.hidden = false;
      }
    }
  }

  private async copyXml(): Promise<void> {
    const xml = this.xml;
    if (xml === undefined) return;
    try {
      await navigator.clipboard.writeText(xml);
      if (this.xml === xml) this.status.textContent = "XML copied to clipboard.";
    } catch {
      if (this.xml !== xml) return;
      this.output.focus();
      this.output.select();
      this.status.textContent =
        "Clipboard access is unavailable. The XML is selected; copy it with your keyboard.";
    }
  }

  private downloadXml(): void {
    if (this.xml === undefined) return;
    const url = URL.createObjectURL(
      new Blob([this.xml], { type: "application/xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = this.filename();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

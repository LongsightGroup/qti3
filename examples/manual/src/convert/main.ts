import {
  defineQtiAssessmentItemPlayer,
  QtiAssessmentItemPlayer,
} from "@longsightgroup/qti3-player";
import {
  formText,
  migrateItem,
  transcodeItem,
  writeChoice,
  type ConversionResult,
} from "./operations.js";
import { requiredElement, ResultPanel } from "./result-panel.js";
import { legacySamples, qti3Sample } from "./samples.js";

defineQtiAssessmentItemPlayer();

const previewSection = requiredElement(document, "#preview", HTMLElement);
const player = requiredElement(document, "qti-assessment-item-player", QtiAssessmentItemPlayer);
const previewHeading = requiredElement(document, "#preview-heading", HTMLElement);
const previewStatus = requiredElement(document, "#preview-status", HTMLElement);
let previewOwner: HTMLFormElement | undefined;

function clearPreview(form: HTMLFormElement): void {
  if (previewOwner !== form) return;
  player.clearItem();
  previewSection.hidden = true;
  previewOwner = undefined;
}

function wireConversion(
  id: string,
  operation: (data: FormData) => ConversionResult | Promise<ConversionResult>,
  filename: () => string,
): void {
  const form = requiredElement(document, `#${id}-form`, HTMLFormElement);
  const panel = new ResultPanel(requiredElement(document, `#${id}-result`, HTMLElement), filename);
  const submit = requiredElement(form, '[type="submit"]', HTMLButtonElement);
  let revision = 0;
  form.addEventListener("input", () => {
    revision += 1;
    panel.clear();
    clearPreview(form);
  });
  form.addEventListener(
    "invalid",
    () => {
      panel.clear("Complete the required input fields.");
      clearPreview(form);
    },
    true,
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const currentRevision = ++revision;
    const data = new FormData(form);
    panel.clear("Converting…");
    clearPreview(form);
    submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    // This event boundary owns the async operation and handles rejected package calls.
    void (async () => {
      try {
        const result = await operation(data);
        if (revision === currentRevision) panel.show(result);
      } catch (error: unknown) {
        if (revision === currentRevision)
          panel.show({
            ok: false,
            diagnostics: [
              {
                code: "demo.conversion_failed",
                severity: "error",
                message:
                  error instanceof Error ? error.message : "The conversion could not be completed.",
              },
            ],
          });
      } finally {
        submit.disabled = false;
        form.setAttribute("aria-busy", "false");
      }
    })();
  });
  const previewButton = document.querySelector<HTMLButtonElement>(`#${id}-result [data-preview]`);
  previewButton?.addEventListener("click", () => {
    const xml = panel.currentXml;
    if (!xml) return;
    previewOwner = form;
    previewSection.hidden = false;
    previewStatus.textContent = "Loading the generated QTI 3 item…";
    previewHeading.focus();
    void player
      .loadXml(xml, {
        // Individual-item demos do not fetch package assets or external resources.
        resolveAsset: () => "",
        resolveStylesheet: () => undefined,
        fetchXml: async () => "",
      })
      .then(() => {
        if (previewOwner !== form || panel.currentXml !== xml) return;
        previewStatus.textContent = player.serialize()
          ? "Generated QTI 3 item loaded. Try answering the question."
          : "The player could not load this output. Review its diagnostics below.";
      })
      .catch(() => {
        if (previewOwner === form)
          previewStatus.textContent = "The player could not load this output.";
      });
  });
}

const migrationInput = requiredElement(document, "#migration-xml", HTMLTextAreaElement);
const transcodeInput = requiredElement(document, "#transcode-xml", HTMLTextAreaElement);
migrationInput.value = legacySamples.qti21;
transcodeInput.value = qti3Sample;

wireConversion("write", writeChoice, () => "written-qti3.xml");
wireConversion(
  "migrate",
  (data) => migrateItem(formText(data, "xml")),
  () => "migrated-qti3.xml",
);
wireConversion(
  "transcode",
  (data) => transcodeItem(formText(data, "xml"), formText(data, "profile")),
  () => {
    const value = new FormData(requiredElement(document, "#transcode-form", HTMLFormElement)).get(
      "profile",
    );
    return `transcoded-${typeof value === "string" ? value.split("-")[0] : "item"}.xml`;
  },
);

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-legacy-sample]")) {
  button.addEventListener("click", () => {
    migrationInput.value =
      button.dataset.legacySample === "qti12" ? legacySamples.qti12 : legacySamples.qti21;
    migrationInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
requiredElement(document, "#load-qti3-sample", HTMLButtonElement).addEventListener("click", () => {
  transcodeInput.value = qti3Sample;
  transcodeInput.dispatchEvent(new Event("input", { bubbles: true }));
});
for (const button of document.querySelectorAll<HTMLButtonElement>("button[data-needs-js]"))
  button.disabled = false;

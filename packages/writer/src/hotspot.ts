import { assertQtiIdentifier } from "./identifier.js";
import {
  dedupeNonemptyTrimmed,
  duplicateDiagnostics,
  isNonNegativeInteger,
  isPositiveInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  interactionAttributeList,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3HotspotBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { xmlAttributeList, xmlEscape } from "./xml.js";

export function buildQti3HotspotItem(input: Qti3HotspotBuilderInput): string {
  const diagnostics = validateQti3HotspotItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3HotspotItem(input);
}

export function renderQti3HotspotItem(input: Qti3HotspotBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Hotspot response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const maxChoices = input.maxChoices ?? 1;
  const minChoices = normalizeBound(input.minChoices, 0);
  const cardinality = maxChoices === 1 ? "single" : "multiple";
  const correctResponse = dedupeNonemptyTrimmed(input.correctResponse ?? []).map((value) =>
    assertQtiIdentifier(value, "Hotspot correct identifier"),
  );
  const correctXml = correctResponse.length
    ? `    <qti-correct-response>
${correctResponse.map((value) => `      <qti-value>${xmlEscape(value)}</qti-value>`).join("\n")}
    </qti-correct-response>\n`
    : "";
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="${cardinality}" base-type="identifier">
${correctXml}  </qti-response-declaration>`;
  const longDescription = input.object.longDescription?.trim();
  const longDescriptionId = longDescription ? `longdesc-${input.identifier}` : "";
  const longDescriptionBlock = longDescription
    ? `    <div id="${longDescriptionId}" class="qti-visually-hidden" data-qti-a11y-content-role="long-description">${xmlEscape(longDescription)}</div>\n`
    : "";
  const longDescriptionAttr = longDescriptionId
    ? ` data-qti-aria-describedby="${longDescriptionId}"`
    : "";
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "hotspot",
    classNames: input.classNames,
    extraAttributes: [
      minChoices !== null ? `min-choices="${String(minChoices)}"` : "",
      `max-choices="${String(maxChoices)}"`,
      input.minChoicesMessage?.trim()
        ? `data-min-selections-message="${xmlEscape(input.minChoicesMessage.trim())}"`
        : "",
      input.maxChoicesMessage?.trim()
        ? `data-max-selections-message="${xmlEscape(input.maxChoicesMessage.trim())}"`
        : "",
      longDescriptionAttr.trim(),
    ],
  });
  const objectAttrs = [
    `data="${xmlEscape(input.object.data.trim())}"`,
    `alt="${xmlEscape(input.object.alt?.trim() ?? "")}"`,
    `type="${xmlEscape(input.object.type ?? inferMimeFromSrc(input.object.data) ?? "")}"`,
    input.object.width !== undefined ? `width="${String(input.object.width)}"` : "",
    input.object.height !== undefined ? `height="${String(input.object.height)}"` : "",
  ];
  const choicesXml = input.choices
    .map((choice) => {
      const identifier = xmlEscape(assertQtiIdentifier(choice.identifier, "Hotspot identifier"));
      const coords = choice.coords.trim();
      return `      <qti-hotspot-choice identifier="${identifier}" shape="${choice.shape}" coords="${xmlEscape(coords)}"/>`;
    })
    .join("\n");
  const bodyXml = `${longDescriptionBlock}    <qti-hotspot-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}      <object ${xmlAttributeList(objectAttrs)}/>
${choicesXml}
    </qti-hotspot-interaction>`;
  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: responseProcessingTemplateXml("match_correct"),
  });
}

function normalizeBound(value: number | undefined, min: number): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  const integer = Math.trunc(value);
  if (integer === 0) return null;
  if (integer < min) return min;
  return integer;
}

function inferMimeFromSrc(src: string): string | undefined {
  const path = src.toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg") || path.endsWith(".svgz")) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  return undefined;
}

export function validateQti3HotspotItem(input: Qti3HotspotBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Hotspot response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  if (!input.object.data.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hotspot_object_data",
        "object.data",
        "Hotspot object data is required.",
      ),
    );
  }
  if (!input.object.alt?.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hotspot_object_alt",
        "object.alt",
        "Hotspot object alt text is required.",
      ),
    );
  }
  if (input.object.type !== undefined && !input.object.type.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hotspot_object_type",
        "object.type",
        "Hotspot object type must not be empty when provided.",
      ),
    );
  }
  if (
    input.object.type === undefined &&
    input.object.data.trim() &&
    !inferMimeFromSrc(input.object.data)
  ) {
    diagnostics.push(
      writerDiagnostic(
        "unknown_hotspot_object_type",
        "object.type",
        "Hotspot object type is required when it cannot be inferred from the image path.",
        input.object.data,
      ),
    );
  }
  if (input.object.width !== undefined && !isPositiveInteger(input.object.width)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_object_width",
        "object.width",
        "Hotspot object width must be a positive integer when provided.",
        input.object.width,
      ),
    );
  }
  if (input.object.height !== undefined && !isPositiveInteger(input.object.height)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_object_height",
        "object.height",
        "Hotspot object height must be a positive integer when provided.",
        input.object.height,
      ),
    );
  }
  if (!input.choices.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_hotspot_choices",
        "choices",
        "Hotspot items must include at least one choice.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.choices.map((choice) => choice.identifier),
      "choices",
      "Hotspot identifier",
    ),
  );
  for (const [index, choice] of input.choices.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `choices.${index}.identifier`,
      "Hotspot identifier",
      choice.identifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
    if (!choice.coords.trim()) {
      diagnostics.push(
        writerDiagnostic(
          "missing_hotspot_coords",
          `choices.${index}.coords`,
          `Hotspot "${choice.identifier}" must have coordinates.`,
        ),
      );
    }
  }

  const maxChoices = input.maxChoices ?? 1;
  if (!isPositiveInteger(maxChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_max_choices",
        "maxChoices",
        "Hotspot maxChoices must be a positive integer.",
        input.maxChoices,
      ),
    );
  }
  if (input.minChoices !== undefined && !isNonNegativeInteger(input.minChoices)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_min_choices",
        "minChoices",
        "Hotspot minChoices must be a non-negative integer.",
        input.minChoices,
      ),
    );
  }
  if (
    input.minChoices !== undefined &&
    Number.isFinite(input.minChoices) &&
    Number.isFinite(maxChoices) &&
    input.minChoices > maxChoices
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_choice_bounds",
        "minChoices",
        "Minimum choices must be less than or equal to maximum choices.",
        { minChoices: input.minChoices, maxChoices },
      ),
    );
  }

  const choiceIdentifiers = new Set(input.choices.map((choice) => choice.identifier.trim()));
  const correctResponse = input.correctResponse ?? [];
  diagnostics.push(
    ...duplicateDiagnostics(
      correctResponse,
      "correctResponse",
      "Hotspot correct response identifier",
    ),
  );
  const dedupedCorrectResponse = dedupeNonemptyTrimmed(correctResponse);
  if (maxChoices === 1 && dedupedCorrectResponse.length > 1) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_hotspot_correct_response_count",
        "correctResponse",
        "Single-response hotspot items can only have one correct selection.",
        dedupedCorrectResponse,
      ),
    );
  }
  for (const [index, identifier] of dedupedCorrectResponse.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `correctResponse.${index}`,
      "Hotspot correct response identifier",
      identifier,
    );
    if (identifierDiagnostic) {
      diagnostics.push(identifierDiagnostic);
      continue;
    }
    if (!choiceIdentifiers.has(identifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_hotspot_reference",
          `correctResponse.${index}`,
          `Hotspot correct response references unknown choice "${identifier}".`,
          identifier,
        ),
      );
    }
  }
  return diagnostics;
}

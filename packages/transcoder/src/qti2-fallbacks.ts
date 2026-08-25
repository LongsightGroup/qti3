import type {
  QtiAssessmentItem,
  QtiChoice,
  QtiInteraction,
  QtiObjectAsset,
  QtiResponseDeclaration,
  QtiValue,
} from "@longsightgroup/qti3-core";

import type { Qti2InteractionPolicy } from "./profiles.js";
import { serializeQti2Content } from "./qti2-content.js";
import {
  mappingsIncludeManualFallback,
  type Qti2MappedInteraction,
} from "./qti2-mapped-interaction.js";
import type { Qti2Revision } from "./qti2-processing-dialect.js";
import { accessibleChoiceLabel } from "./rich-content-html.js";
import { serializeObject } from "./qti2-wire.js";
import type { QtiTranscodeDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

/** Apply a profile fallback when policy requires rewriting the native QTI 2 interaction. */
export function tryPolicyFallback(
  interaction: QtiInteraction,
  index: number,
  revision: Qti2Revision,
  policy: Qti2InteractionPolicy | undefined,
): Qti2MappedInteraction | undefined {
  if (!policy) {
    return undefined;
  }

  const path = `/itemBody/interactions/${String(index)}`;
  switch (policy.transformation) {
    case "native":
      return undefined;
    case "extended-text-fallback":
      return interaction.type === "extendedText"
        ? undefined
        : manualExtendedTextFallback(interaction, revision, path, policy);
    case "text-entry-fallback":
      return interaction.type === "textEntry"
        ? undefined
        : textEntryFallback(interaction, path, policy);
    default: {
      const unexpected: never = policy;
      throw new Error(`Unsupported QTI 2 interaction policy: ${JSON.stringify(unexpected)}`);
    }
  }
}

/** Rewrite a response declaration when a fallback changed its wire shape. */
export function serializeFallbackResponseDeclaration(
  declaration: QtiResponseDeclaration,
  mapping: Qti2MappedInteraction | undefined,
): string | undefined {
  if (mapping?.kind === "extended-text-fallback") {
    return serializeManualResponseDeclaration(declaration.identifier);
  }
  if (mapping?.kind === "text-entry-fallback") {
    return serializeTextEntryResponseDeclaration(declaration, mapping.responseValueMap);
  }
  return undefined;
}

/** Omit response processing, recording the supplied diagnostic when processing was present. */
export function omitResponseProcessing(
  item: QtiAssessmentItem,
  diagnostics: QtiTranscodeDiagnostic[],
  diagnostic: { readonly code: string; readonly message: string },
): string {
  if (item.responseProcessing) {
    diagnostics.push({
      ...diagnostic,
      severity: "warning",
      path: "/responseProcessing",
    });
  }
  return "";
}

const MANUAL_FALLBACK_PROCESSING_DIAGNOSTIC = {
  code: "profile.qti21.manual_fallback.response_processing_omitted",
  message:
    "Removed automatic response processing because this item includes a manual written-response fallback.",
} as const;

/** Resolve response-processing XML after interaction fallbacks have been mapped. */
export function resolveFallbackResponseProcessing(
  item: QtiAssessmentItem,
  mappings: readonly Qti2MappedInteraction[],
  diagnostics: QtiTranscodeDiagnostic[],
  profileOmit: { readonly code: string; readonly message: string } | undefined,
  serializeNative: () => string,
): string {
  if (mappingsIncludeManualFallback(mappings)) {
    return omitResponseProcessing(item, diagnostics, MANUAL_FALLBACK_PROCESSING_DIAGNOSTIC);
  }
  if (profileOmit) {
    return omitResponseProcessing(item, diagnostics, profileOmit);
  }
  return serializeNative();
}

function textEntryFallback(
  interaction: QtiInteraction,
  path: string,
  policy: Qti2InteractionPolicy,
): Qti2MappedInteraction {
  const diagnostics = policyDiagnostic(policy, path);
  const responseIdentifier = interaction.responseIdentifier
    ? ` responseIdentifier="${escapeXmlAttribute(interaction.responseIdentifier)}"`
    : "";
  const sourceOptions = interaction.choices.map(choiceAccessibleText).filter(Boolean).join("; ");
  return {
    kind: "text-entry-fallback",
    source: interaction.type,
    emitted: "textEntryInteraction",
    xml: `<textEntryInteraction${responseIdentifier}></textEntryInteraction>${
      sourceOptions ? ` <span>Source options: ${escapeXmlText(sourceOptions)}</span>` : ""
    }`,
    diagnostics,
    responseValueMap: Object.fromEntries(
      interaction.choices.map((choice) => [choice.identifier, choiceAccessibleText(choice)]),
    ),
  };
}

function manualExtendedTextFallback(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  path: string,
  policy: Qti2InteractionPolicy,
): Qti2MappedInteraction {
  const diagnostics = policyDiagnostic(policy, path);
  const responseIdentifier = interaction.responseIdentifier
    ? ` responseIdentifier="${escapeXmlAttribute(interaction.responseIdentifier)}"`
    : "";
  return {
    kind: "extended-text-fallback",
    source: interaction.type,
    emitted: "extendedTextInteraction",
    xml: `<extendedTextInteraction${responseIdentifier}><prompt>${manualFallbackPrompt(
      interaction,
      revision,
      diagnostics,
    )}</prompt></extendedTextInteraction>`,
    diagnostics,
    scoring: "manual",
  };
}

function manualFallbackPrompt(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): string {
  const prompt =
    interaction.promptContent && interaction.promptContent.length > 0
      ? serializeQti2Content(interaction.promptContent, [], revision, diagnostics)
      : interaction.prompt
        ? `<p>${escapeXmlText(interaction.prompt)}</p>`
        : "";
  const choices =
    interaction.choices.length > 0
      ? `<div><p>Source options:</p><ul>${interaction.choices
          .map((choice) => `<li>${serializeChoiceContent(choice, revision, diagnostics)}</li>`)
          .join("")}</ul></div>`
      : "";
  const objects = [interaction.object, interaction.positionObjectStage]
    .filter((object): object is QtiObjectAsset => object !== undefined)
    .map(serializeObject)
    .join("");
  const custom = interaction.customInteraction ?? interaction.portableCustom;
  const customContent =
    custom?.interactionMarkup && custom.interactionMarkup.length > 0
      ? serializeQti2Content(custom.interactionMarkup, [], revision, diagnostics)
      : "";
  const sourceText = interactionSourceText(interaction);
  const context = sourceText.length > 0 ? `<p>${escapeXmlText(sourceText)}</p>` : "";
  return prompt || choices || objects || customContent || context
    ? `${prompt}${choices}${objects}${customContent}${context}`
    : "<p>Enter your response.</p>";
}

function serializeChoiceContent(
  choice: QtiChoice,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): string {
  return choice.content && choice.content.length > 0
    ? serializeQti2Content(choice.content, [], revision, diagnostics)
    : choice.asset
      ? `${serializeObject(choice.asset)}${choice.text ? `<p>${escapeXmlText(choice.text)}</p>` : ""}`
      : escapeXmlText(choiceAccessibleText(choice));
}

function choiceAccessibleText(choice: QtiChoice): string {
  return accessibleChoiceLabel(choice) ?? choice.identifier;
}

function interactionSourceText(interaction: QtiInteraction): string {
  return [
    interaction.object?.text,
    ...(interaction.hottextSegments ?? []).map((segment) => segment.text),
    ...(interaction.gapMatchSegments ?? []).map((segment) =>
      segment.kind === "text" ? segment.text : "[response]",
    ),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim();
}

function policyDiagnostic(policy: Qti2InteractionPolicy, path: string): QtiTranscodeDiagnostic[] {
  return policy.diagnostic
    ? [
        {
          ...policy.diagnostic,
          severity: "warning",
          path,
        },
      ]
    : [];
}

function serializeManualResponseDeclaration(identifier: string): string {
  return `<responseDeclaration identifier="${escapeXmlAttribute(identifier)}" cardinality="single" baseType="string"></responseDeclaration>`;
}

function serializeTextEntryResponseDeclaration(
  declaration: QtiResponseDeclaration,
  responseValueMap: Readonly<Record<string, string>>,
): string {
  const correct =
    declaration.correctResponse === null
      ? ""
      : `<correctResponse>${values(declaration.correctResponse)
          .map((value) => responseValueMap[String(value)] ?? String(value))
          .map((value) => `<value>${escapeXmlText(value)}</value>`)
          .join("")}</correctResponse>`;
  return `<responseDeclaration identifier="${escapeXmlAttribute(declaration.identifier)}" cardinality="single" baseType="string">${correct}</responseDeclaration>`;
}

function values(value: QtiValue): readonly (string | number | boolean)[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(values);
  return value === null ? [] : [value];
}

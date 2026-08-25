import {
  serializeResponseProcessing,
  type QtiAssessmentItem,
  type QtiInteraction,
  type QtiInteractionType,
  type QtiResponseDeclaration,
  type QtiValue,
} from "@longsightgroup/qti3-core";

import {
  resolveFallbackResponseProcessing,
  serializeFallbackResponseDeclaration,
  tryPolicyFallback,
} from "./qti2-fallbacks.js";
import { serializeQti2Choice, serializeQti2Content } from "./qti2-content.js";
import type { Qti2MappedInteraction } from "./qti2-mapped-interaction.js";
import { mapTypedProcessingXml, type Qti2Revision } from "./qti2-processing-dialect.js";
import type { Qti2InteractionPolicy } from "./profiles.js";
import { attributes, semanticAttributes, serializeObject } from "./qti2-wire.js";
import type { QtiTranscodeDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export type { Qti2Revision } from "./qti2-processing-dialect.js";
export type { Qti2MappedInteraction } from "./qti2-mapped-interaction.js";

export interface Qti2WriteResult {
  readonly xml: string;
  readonly mappings: readonly Qti2MappedInteraction[];
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
  readonly responseProcessingEmitted: boolean;
}

export type Qti2ResponseProcessingPolicy =
  | { readonly mode: "preserve" }
  | {
      readonly mode: "omit";
      readonly diagnostic: {
        readonly code: string;
        readonly message: string;
      };
    };

export interface Qti2WritePolicy {
  readonly interactionPolicies: Readonly<Record<QtiInteractionType, Qti2InteractionPolicy>>;
  readonly responseProcessing?: Qti2ResponseProcessingPolicy;
}

/**
 * Serialize the parsed semantic item. Interaction fallbacks are applied at the mapping
 * boundary; this writer stays a wire serializer plus content projection.
 */
export function writeSemanticQti2Item(
  item: QtiAssessmentItem,
  revision: Qti2Revision,
  policy: Qti2WritePolicy,
): Qti2WriteResult {
  const diagnostics: QtiTranscodeDiagnostic[] = [];
  const mappings = item.interactions.map((interaction, index) => {
    const interactionPolicy = policy.interactionPolicies[interaction.type];
    return (
      tryPolicyFallback(interaction, index, revision, interactionPolicy) ??
      INTERACTION_MAPPERS[interaction.type](
        interaction,
        revision,
        `/itemBody/interactions/${String(index)}`,
      )
    );
  });
  diagnostics.push(...mappings.flatMap((mapping) => mapping.diagnostics));

  const declarationByIdentifier = new Map(
    item.interactions.flatMap((interaction, index) =>
      interaction.responseIdentifier
        ? [[interaction.responseIdentifier, mappings[index]] as const]
        : [],
    ),
  );
  const declarations = [
    ...item.responseDeclarations.map((declaration) => {
      const fallbackXml = serializeFallbackResponseDeclaration(
        declaration,
        declarationByIdentifier.get(declaration.identifier),
      );
      return fallbackXml ?? serializeResponseDeclaration(declaration);
    }),
    ...item.outcomeDeclarations.map((declaration) =>
      serializeVariableDeclaration("outcomeDeclaration", declaration),
    ),
    ...item.templateDeclarations.map((declaration) =>
      serializeVariableDeclaration("templateDeclaration", declaration),
    ),
  ].join("\n  ");
  const stylesheets = item.stylesheets
    .map(
      (stylesheet) =>
        `<stylesheet${attributes({
          href: stylesheet.href,
          type: stylesheet.type,
          media: stylesheet.media,
          title: stylesheet.title,
        })}></stylesheet>`,
    )
    .join("\n  ");
  const body = serializeQti2Content(item.body, mappings, revision, diagnostics);
  const processing = resolveFallbackResponseProcessing(
    item,
    mappings,
    diagnostics,
    policy.responseProcessing?.mode === "omit" ? policy.responseProcessing.diagnostic : undefined,
    () => serializeProcessing(item, revision, diagnostics),
  );
  const rootAttributes = attributes({
    identifier: item.identifier,
    title: item.title ?? item.identifier,
    adaptive: String(item.adaptive),
    timeDependent: String(item.timeDependent ?? false),
    "xml:lang": item.language,
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="${revision.namespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${escapeXmlAttribute(revision.schemaLocation)}"${rootAttributes}>
  ${declarations}
  ${stylesheets}
  <itemBody${semanticAttributes(item.itemBodyAttributes, revision, diagnostics, "/itemBody")}>${body}</itemBody>
  ${processing}
</assessmentItem>`.replace(/^[\t ]+$/gm, "");

  return {
    xml,
    mappings,
    diagnostics,
    responseProcessingEmitted: processing.length > 0,
  };
}

type InteractionMapper = (
  interaction: QtiInteraction,
  revision: Qti2Revision,
  path: string,
) => Qti2MappedInteraction;

const INTERACTION_MAPPERS: Readonly<Record<QtiInteractionType, InteractionMapper>> = {
  associate: mapped("associateInteraction", associationChoices),
  choice: mapped("choiceInteraction", simpleChoices),
  custom: customInteraction,
  drawing: mapped("drawingInteraction", objectOnly),
  endAttempt: mapped("endAttemptInteraction", emptyBody),
  extendedText: mapped("extendedTextInteraction", emptyBody),
  gapMatch: mapped("gapMatchInteraction", gapMatchBody),
  graphicAssociate: mapped("graphicAssociateInteraction", graphicAssociationBody),
  graphicGapMatch: graphicGapMatchInteraction,
  graphicOrder: mapped("graphicOrderInteraction", hotspotBody),
  hotspot: mapped("hotspotInteraction", hotspotBody),
  hottext: mapped("hottextInteraction", hottextBody),
  inlineChoice: mapped("inlineChoiceInteraction", inlineChoices),
  match: mapped("matchInteraction", matchBody),
  media: mapped("mediaInteraction", objectOnly),
  order: mapped("orderInteraction", simpleChoices),
  portableCustom: customInteraction,
  positionObject: mapped("positionObjectInteraction", objectOnly),
  selectPoint: mapped("selectPointInteraction", objectOnly),
  slider: mapped("sliderInteraction", emptyBody),
  textEntry: mapped("textEntryInteraction", emptyBody),
  upload: mapped("uploadInteraction", emptyBody),
};

function mapped(
  emitted: string,
  body: (
    interaction: QtiInteraction,
    revision: Qti2Revision,
    diagnostics: QtiTranscodeDiagnostic[],
    path: string,
  ) => string,
): InteractionMapper {
  return (interaction, revision, path) => {
    const diagnostics: QtiTranscodeDiagnostic[] = [];
    const admitsPrompt =
      interaction.type !== "positionObject" &&
      interaction.type !== "custom" &&
      interaction.type !== "portableCustom";
    const prompt =
      admitsPrompt && interaction.promptContent && interaction.promptContent.length > 0
        ? `<prompt>${serializeQti2Content(interaction.promptContent, [], revision, diagnostics)}</prompt>`
        : admitsPrompt && interaction.prompt
          ? `<prompt>${escapeXmlText(interaction.prompt)}</prompt>`
          : "";
    const interactionAttributes = semanticAttributes(
      interaction.attributes,
      revision,
      diagnostics,
      path,
      new Set([
        "response-identifier",
        ...(interaction.type === "graphicGapMatch" ? ["max-associations", "min-associations"] : []),
      ]),
    );
    const responseIdentifier = interaction.responseIdentifier
      ? ` responseIdentifier="${escapeXmlAttribute(interaction.responseIdentifier)}"`
      : "";
    return {
      kind: "native",
      source: interaction.type,
      emitted,
      xml:
        interaction.type === "endAttempt"
          ? `<p><${emitted}${responseIdentifier}${interactionAttributes}>${body(
              interaction,
              revision,
              diagnostics,
              path,
            )}</${emitted}></p>`
          : `<${emitted}${responseIdentifier}${interactionAttributes}>${prompt}${body(
              interaction,
              revision,
              diagnostics,
              path,
            )}</${emitted}>`,
      diagnostics,
    };
  };
}

function customInteraction(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  path: string,
): Qti2MappedInteraction {
  const definition = interaction.portableCustom ?? interaction.customInteraction;
  const diagnostics: QtiTranscodeDiagnostic[] = [
    {
      code:
        interaction.type === "portableCustom"
          ? "profile.qti2.portable_custom.preserved"
          : "profile.qti2.custom.preserved",
      severity: "info",
      message:
        "Preserved custom interaction configuration and markup in a foreign-namespace payload.",
      path,
    },
  ];
  const payload = JSON.stringify({
    sourceType: interaction.type,
    customInteractionTypeIdentifier: interaction.portableCustom?.customInteractionTypeIdentifier,
    module: interaction.portableCustom?.module,
    modules: interaction.portableCustom?.interactionModules
      ? {
          primaryConfiguration: interaction.portableCustom.interactionModules.primaryConfiguration,
          secondaryConfiguration:
            interaction.portableCustom.interactionModules.secondaryConfiguration,
          modules: interaction.portableCustom.interactionModules.modules.map((module) => ({
            id: module.id,
            primaryPath: module.primaryPath,
            fallbackPath: module.fallbackPath,
            attributes: module.attributes,
          })),
          attributes: interaction.portableCustom.interactionModules.attributes,
        }
      : undefined,
    templateVariables: interaction.portableCustom?.templateVariables.map((binding) => ({
      identifier: binding.identifier,
      variableIdentifier: binding.variableIdentifier,
      kind: binding.kind,
      attributes: binding.attributes,
    })),
    contextVariables: interaction.portableCustom?.contextVariables.map((binding) => ({
      identifier: binding.identifier,
      variableIdentifier: binding.variableIdentifier,
      kind: binding.kind,
      attributes: binding.attributes,
    })),
    stylesheets: interaction.portableCustom?.stylesheets,
    dataAttributes: definition?.dataAttributes,
    attributes: definition?.attributes,
    markup: definition?.interactionMarkupRaw,
  });
  const responseIdentifier = interaction.responseIdentifier
    ? ` responseIdentifier="${escapeXmlAttribute(interaction.responseIdentifier)}"`
    : "";
  const source = `<qti3t:source xmlns:qti3t="urn:longsightgroup:qti3-transcoder:custom:v1" encoding="application/json">${escapeXmlText(payload)}</qti3t:source>`;
  void revision;
  return {
    kind: "native",
    source: interaction.type,
    emitted: "customInteraction",
    xml: `<customInteraction${responseIdentifier}>${source}</customInteraction>`,
    diagnostics,
  };
}

function emptyBody(): string {
  return "";
}

function objectOnly(interaction: QtiInteraction): string {
  return interaction.object ? serializeObject(interaction.object) : "";
}

function simpleChoices(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  return interaction.choices
    .filter((choice) => choice.role === "simpleChoice")
    .map((choice, index) =>
      serializeQti2Choice(
        choice,
        "simpleChoice",
        revision,
        diagnostics,
        `${path}/choices/${index}`,
      ),
    )
    .join("");
}

function associationChoices(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  return interaction.choices
    .filter((choice) => choice.role === "associableChoice")
    .map((choice, index) =>
      serializeQti2Choice(
        choice,
        "simpleAssociableChoice",
        revision,
        diagnostics,
        `${path}/choices/${index}`,
      ),
    )
    .join("");
}

function matchBody(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const source = interaction.choices.filter((choice) => choice.role === "matchSource");
  const target = interaction.choices.filter((choice) => choice.role === "matchTarget");
  return [source, target]
    .map(
      (set) =>
        `<simpleMatchSet>${set
          .map((choice, index) =>
            serializeQti2Choice(
              choice,
              "simpleAssociableChoice",
              revision,
              diagnostics,
              `${path}/choices/${index}`,
            ),
          )
          .join("")}</simpleMatchSet>`,
    )
    .join("");
}

function inlineChoices(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  return interaction.choices
    .filter((choice) => choice.role === "inlineChoice")
    .map((choice, index) =>
      serializeQti2Choice(
        choice,
        "inlineChoice",
        revision,
        diagnostics,
        `${path}/choices/${index}`,
      ),
    )
    .join("");
}

function hottextBody(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  return `<p>${(interaction.hottextSegments ?? [])
    .map((segment) =>
      segment.kind === "text"
        ? escapeXmlText(segment.text)
        : `<hottext identifier="${escapeXmlAttribute(segment.identifier)}"${semanticAttributes(
            segment.attributes,
            revision,
            diagnostics,
            `${path}/hottext/${segment.identifier}`,
            new Set(["identifier"]),
          )}>${escapeXmlText(segment.text)}</hottext>`,
    )
    .join("")}</p>`;
}

function gapMatchBody(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const choices = interaction.choices
    .filter((choice) => choice.role === "gapChoice")
    .map((choice, index) =>
      choice.asset
        ? `<gapImg identifier="${escapeXmlAttribute(choice.identifier)}"${semanticAttributes(
            choice.attributes,
            revision,
            diagnostics,
            `${path}/choices/${index}`,
            new Set(["identifier"]),
          )}>${serializeObject(choice.asset)}</gapImg>`
        : serializeQti2Choice(choice, "gapText", revision, diagnostics, `${path}/choices/${index}`),
    )
    .join("");
  const content = (interaction.gapMatchSegments ?? [])
    .map((segment) =>
      segment.kind === "text"
        ? escapeXmlText(segment.text)
        : `<gap identifier="${escapeXmlAttribute(segment.identifier)}"${semanticAttributes(
            segment.attributes,
            revision,
            diagnostics,
            `${path}/gaps/${segment.identifier}`,
            new Set(["identifier"]),
          )}></gap>`,
    )
    .join("");
  return `${choices}<p>${content}</p>`;
}

function hotspotBody(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const object = interaction.object ? serializeObject(interaction.object) : "";
  return `${object}${interaction.choices
    .filter((choice) => choice.role === "hotspot")
    .map(
      (choice, index) =>
        `<hotspotChoice identifier="${escapeXmlAttribute(choice.identifier)}"${semanticAttributes(
          choice.attributes,
          revision,
          diagnostics,
          `${path}/choices/${index}`,
          new Set(["identifier"]),
        )}></hotspotChoice>`,
    )
    .join("")}`;
}

function graphicAssociationBody(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const object = interaction.object ? serializeObject(interaction.object) : "";
  return `${object}${interaction.choices
    .filter((choice) => choice.role === "hotspot")
    .map(
      (choice, index) =>
        `<associableHotspot identifier="${escapeXmlAttribute(choice.identifier)}"${semanticAttributes(
          choice.attributes,
          revision,
          diagnostics,
          `${path}/choices/${index}`,
          new Set(["identifier"]),
        )}></associableHotspot>`,
    )
    .join("")}`;
}

function graphicGapMatchInteraction(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  path: string,
): Qti2MappedInteraction {
  const diagnostics: QtiTranscodeDiagnostic[] = [];
  const requiresTextualFallback =
    interaction.choices.some((choice) => choice.role === "gapChoice" && !choice.asset) ||
    (interaction.gapMatchSegments ?? []).some((segment) => segment.kind === "gap");
  const emitted = requiresTextualFallback ? "gapMatchInteraction" : "graphicGapMatchInteraction";
  if (requiresTextualFallback) {
    diagnostics.push({
      code: "profile.qti2.graphic_gap_match.textual_fallback",
      severity: "warning",
      message:
        "Mapped graphic gap-match content without complete image geometry to a textual gap-match interaction.",
      path,
    });
  }
  const prompt =
    interaction.promptContent && interaction.promptContent.length > 0
      ? `<prompt>${serializeQti2Content(interaction.promptContent, [], revision, diagnostics)}</prompt>`
      : interaction.prompt
        ? `<prompt>${escapeXmlText(interaction.prompt)}</prompt>`
        : "";
  const interactionAttributes = semanticAttributes(
    interaction.attributes,
    revision,
    diagnostics,
    path,
    new Set(["response-identifier", "max-associations", "min-associations"]),
  );
  const responseIdentifier = interaction.responseIdentifier
    ? ` responseIdentifier="${escapeXmlAttribute(interaction.responseIdentifier)}"`
    : "";
  return {
    kind: "native",
    source: interaction.type,
    emitted,
    xml: `<${emitted}${responseIdentifier}${interactionAttributes}>${prompt}${
      requiresTextualFallback
        ? textualGraphicGapFallbackBody(interaction, revision, diagnostics, path)
        : graphicGapMatchBody(interaction, revision, diagnostics, path)
    }</${emitted}>`,
    diagnostics,
  };
}

function graphicGapMatchBody(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const object = interaction.object ? serializeObject(interaction.object) : "";
  const choices = interaction.choices
    .filter((choice) => choice.role === "gapChoice")
    .map((choice, index) => {
      const choiceAttributes = semanticAttributes(
        choice.attributes,
        revision,
        diagnostics,
        `${path}/choices/${index}`,
        new Set(["identifier"]),
      );
      return choice.asset
        ? `<gapImg identifier="${escapeXmlAttribute(choice.identifier)}"${choiceAttributes}>${serializeObject(choice.asset)}</gapImg>`
        : "";
    })
    .join("");
  const targets = interaction.choices
    .filter((choice) => choice.role === "hotspot")
    .map(
      (choice, index) =>
        `<associableHotspot identifier="${escapeXmlAttribute(choice.identifier)}"${semanticAttributes(
          choice.attributes,
          revision,
          diagnostics,
          `${path}/targets/${index}`,
          new Set(["identifier"]),
        )}></associableHotspot>`,
    )
    .join("");
  return `${object}${choices}${targets}`;
}

function textualGraphicGapFallbackBody(
  interaction: QtiInteraction,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const choices = interaction.choices
    .filter((choice) => choice.role === "gapChoice")
    .map((choice, index) =>
      choice.asset
        ? `<gapImg identifier="${escapeXmlAttribute(choice.identifier)}"${semanticAttributes(
            choice.attributes,
            revision,
            diagnostics,
            `${path}/choices/${index}`,
            new Set(["identifier"]),
          )}>${serializeObject(choice.asset)}</gapImg>`
        : serializeQti2Choice(choice, "gapText", revision, diagnostics, `${path}/choices/${index}`),
    )
    .join("");
  const segments = interaction.gapMatchSegments ?? [];
  const content =
    segments.length > 0
      ? segments
          .map((segment) =>
            segment.kind === "text"
              ? escapeXmlText(segment.text)
              : `<gap identifier="${escapeXmlAttribute(segment.identifier)}"${semanticAttributes(
                  segment.attributes,
                  revision,
                  diagnostics,
                  `${path}/gaps/${segment.identifier}`,
                  new Set(["identifier"]),
                )}></gap>`,
          )
          .join("")
      : interaction.choices
          .filter((choice) => choice.role === "hotspot")
          .map(
            (choice) =>
              `${escapeXmlText(choice.text)} <gap identifier="${escapeXmlAttribute(choice.identifier)}"></gap>`,
          )
          .join(" ");
  const contextObject = interaction.object
    ? `<div>${serializeObject(interaction.object)}</div>`
    : "";
  return `${choices}${contextObject}<p>${content}</p>`;
}

function serializeResponseDeclaration(declaration: QtiResponseDeclaration): string {
  const correct =
    declaration.correctResponse === null
      ? ""
      : `<correctResponse>${values(declaration.correctResponse)
          .map((value) => `<value>${escapeXmlText(String(value))}</value>`)
          .join("")}</correctResponse>`;
  const mapping = declaration.mapping
    ? `<mapping defaultValue="${String(declaration.mapping.defaultValue)}">${declaration.mapping.entries
        .map(
          (entry) =>
            `<mapEntry mapKey="${escapeXmlAttribute(entry.mapKey ?? "")}" mappedValue="${String(entry.mappedValue)}"></mapEntry>`,
        )
        .join("")}</mapping>`
    : "";
  const areaMapping = declaration.areaMapping
    ? `<areaMapping defaultValue="${String(declaration.areaMapping.defaultValue)}">${declaration.areaMapping.entries
        .map(
          (entry) =>
            `<areaMapEntry shape="${entry.shape}" coords="${entry.coords.join(",")}" mappedValue="${String(entry.mappedValue)}"></areaMapEntry>`,
        )
        .join("")}</areaMapping>`
    : "";
  return `<responseDeclaration${variableAttributes(declaration)}>${correct}${mapping}${areaMapping}</responseDeclaration>`;
}

function serializeVariableDeclaration(
  element: "outcomeDeclaration" | "templateDeclaration",
  declaration: {
    readonly identifier: string;
    readonly cardinality: string;
    readonly baseType?: string | undefined;
    readonly defaultValue: QtiValue;
  },
): string {
  const defaults =
    declaration.defaultValue === null
      ? ""
      : `<defaultValue>${values(declaration.defaultValue)
          .map((value) => `<value>${escapeXmlText(String(value))}</value>`)
          .join("")}</defaultValue>`;
  return `<${element}${variableAttributes(declaration)}>${defaults}</${element}>`;
}

function variableAttributes(declaration: {
  readonly identifier: string;
  readonly cardinality: string;
  readonly baseType?: string | undefined;
}): string {
  return attributes({
    identifier: declaration.identifier,
    cardinality: declaration.cardinality,
    baseType: declaration.baseType,
  });
}

function values(value: QtiValue): readonly (string | number | boolean)[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(values);
  return value === null ? [] : [value];
}

function serializeProcessing(
  item: QtiAssessmentItem,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): string {
  if (!item.responseProcessing) return "";
  const serialized = serializeResponseProcessing(item.responseProcessing);
  diagnostics.push(
    ...serialized.diagnostics.map((diagnostic) => ({
      code: `target.processing.${diagnostic.code}`,
      severity: diagnostic.severity,
      message: diagnostic.message,
      path: diagnostic.path,
    })),
  );
  if (!serialized.ok || !serialized.xml) return "";
  return mapTypedProcessingXml(serialized.xml, revision);
}

import {
  serializeResponseProcessing,
  type QtiAssessmentItem,
  type QtiChoice,
  type QtiContentNode,
  type QtiInteraction,
  type QtiInteractionType,
  type QtiObjectAsset,
  type QtiResponseDeclaration,
  type QtiValue,
} from "@longsightgroup/qti3-core";

import type { QtiTranscodeDiagnostic } from "./types.js";
import { mapTypedProcessingXml, type Qti2Revision } from "./qti2-processing-dialect.js";
import { escapeXml } from "./xml.js";

export type { Qti2Revision } from "./qti2-processing-dialect.js";

export interface Qti2MappedInteraction {
  readonly source: QtiInteractionType;
  readonly emitted: string;
  readonly xml: string;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

export interface Qti2WriteResult {
  readonly xml: string;
  readonly mappings: readonly Qti2MappedInteraction[];
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
  readonly responseProcessingEmitted: boolean;
}

/**
 * Serialize the parsed semantic item. This deliberately does not inspect or rename
 * the source XML tree: interaction mapping is selected from the typed registry.
 */
export function writeSemanticQti2Item(
  item: QtiAssessmentItem,
  revision: Qti2Revision,
): Qti2WriteResult {
  const diagnostics: QtiTranscodeDiagnostic[] = [];
  const mappings = item.interactions.map((interaction, index) =>
    mapInteraction(interaction, index, revision),
  );
  diagnostics.push(...mappings.flatMap((mapping) => mapping.diagnostics));

  const declarations = [
    ...item.responseDeclarations.map(serializeResponseDeclaration),
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
  const body = serializeContent(item.body, mappings, revision, diagnostics);
  const processing = serializeProcessing(item, revision, diagnostics);
  const rootAttributes = attributes({
    identifier: item.identifier,
    title: item.title ?? item.identifier,
    adaptive: String(item.adaptive),
    timeDependent: String(item.timeDependent ?? false),
    "xml:lang": item.language,
  });

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="${revision.namespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${escapeXml(revision.schemaLocation)}"${rootAttributes}>
  ${declarations}
  ${stylesheets}
  <itemBody${semanticAttributes(item.itemBodyAttributes, revision, diagnostics, "/itemBody")}>${body}</itemBody>
  ${processing}
</assessmentItem>`,
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

function mapInteraction(
  interaction: QtiInteraction,
  index: number,
  revision: Qti2Revision,
): Qti2MappedInteraction {
  return INTERACTION_MAPPERS[interaction.type](
    interaction,
    revision,
    `/itemBody/interactions/${String(index)}`,
  );
}

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
        ? `<prompt>${serializeContent(interaction.promptContent, [], revision, diagnostics)}</prompt>`
        : admitsPrompt && interaction.prompt
          ? `<prompt>${escapeXml(interaction.prompt)}</prompt>`
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
      ? ` responseIdentifier="${escapeXml(interaction.responseIdentifier)}"`
      : "";
    return {
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
    ? ` responseIdentifier="${escapeXml(interaction.responseIdentifier)}"`
    : "";
  const source = `<qti3t:source xmlns:qti3t="urn:longsightgroup:qti3-transcoder:custom:v1" encoding="application/json">${escapeXml(payload)}</qti3t:source>`;
  void revision;
  return {
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
      serializeChoice(choice, "simpleChoice", revision, diagnostics, `${path}/choices/${index}`),
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
      serializeChoice(
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
            serializeChoice(
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
      serializeChoice(choice, "inlineChoice", revision, diagnostics, `${path}/choices/${index}`),
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
        ? escapeXml(segment.text)
        : `<hottext identifier="${escapeXml(segment.identifier)}"${semanticAttributes(
            segment.attributes,
            revision,
            diagnostics,
            `${path}/hottext/${segment.identifier}`,
            new Set(["identifier"]),
          )}>${escapeXml(segment.text)}</hottext>`,
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
        ? `<gapImg identifier="${escapeXml(choice.identifier)}"${semanticAttributes(
            choice.attributes,
            revision,
            diagnostics,
            `${path}/choices/${index}`,
            new Set(["identifier"]),
          )}>${serializeObject(choice.asset)}</gapImg>`
        : serializeChoice(choice, "gapText", revision, diagnostics, `${path}/choices/${index}`),
    )
    .join("");
  const content = (interaction.gapMatchSegments ?? [])
    .map((segment) =>
      segment.kind === "text"
        ? escapeXml(segment.text)
        : `<gap identifier="${escapeXml(segment.identifier)}"${semanticAttributes(
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
        `<hotspotChoice identifier="${escapeXml(choice.identifier)}"${semanticAttributes(
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
        `<associableHotspot identifier="${escapeXml(choice.identifier)}"${semanticAttributes(
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
      ? `<prompt>${serializeContent(interaction.promptContent, [], revision, diagnostics)}</prompt>`
      : interaction.prompt
        ? `<prompt>${escapeXml(interaction.prompt)}</prompt>`
        : "";
  const interactionAttributes = semanticAttributes(
    interaction.attributes,
    revision,
    diagnostics,
    path,
    new Set(["response-identifier", "max-associations", "min-associations"]),
  );
  const responseIdentifier = interaction.responseIdentifier
    ? ` responseIdentifier="${escapeXml(interaction.responseIdentifier)}"`
    : "";
  return {
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
        ? `<gapImg identifier="${escapeXml(choice.identifier)}"${choiceAttributes}>${serializeObject(choice.asset)}</gapImg>`
        : "";
    })
    .join("");
  const targets = interaction.choices
    .filter((choice) => choice.role === "hotspot")
    .map(
      (choice, index) =>
        `<associableHotspot identifier="${escapeXml(choice.identifier)}"${semanticAttributes(
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
        ? `<gapImg identifier="${escapeXml(choice.identifier)}"${semanticAttributes(
            choice.attributes,
            revision,
            diagnostics,
            `${path}/choices/${index}`,
            new Set(["identifier"]),
          )}>${serializeObject(choice.asset)}</gapImg>`
        : serializeChoice(choice, "gapText", revision, diagnostics, `${path}/choices/${index}`),
    )
    .join("");
  const segments = interaction.gapMatchSegments ?? [];
  const content =
    segments.length > 0
      ? segments
          .map((segment) =>
            segment.kind === "text"
              ? escapeXml(segment.text)
              : `<gap identifier="${escapeXml(segment.identifier)}"${semanticAttributes(
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
              `${escapeXml(choice.text)} <gap identifier="${escapeXml(choice.identifier)}"></gap>`,
          )
          .join(" ");
  const contextObject = interaction.object
    ? `<div>${serializeObject(interaction.object)}</div>`
    : "";
  return `${choices}${contextObject}<p>${content}</p>`;
}

function serializeChoice(
  choice: QtiChoice,
  element: string,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
): string {
  const content =
    choice.content && choice.content.length > 0
      ? serializeContent(choice.content, [], revision, [])
      : escapeXml(choice.text);
  return `<${element} identifier="${escapeXml(choice.identifier)}"${semanticAttributes(
    choice.attributes,
    revision,
    diagnostics,
    path,
    new Set(["identifier"]),
  )}>${content}</${element}>`;
}

function serializeObject(object: QtiObjectAsset): string {
  const sources = object.sources
    .map((source) => `<source${attributes({ src: source.src, type: source.type })}></source>`)
    .join("");
  const tracks = object.tracks
    .map(
      (track) =>
        `<track${attributes({
          kind: track.kind,
          src: track.src,
          srclang: track.srclang,
          label: track.label,
          default: track.default ? "default" : undefined,
        })}></track>`,
    )
    .join("");
  return `<object${attributes({
    data: object.data,
    type: object.type,
    width: object.width,
    height: object.height,
  })}>${sources}${tracks}${escapeXml(object.text)}</object>`;
}

function serializeContent(
  nodes: readonly QtiContentNode[],
  mappings: readonly Qti2MappedInteraction[],
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeXml(node.text);
        case "interaction":
          return mappings[node.interactionIndex]?.xml ?? "";
        case "printedVariable":
          return `<printedVariable identifier="${escapeXml(node.identifier)}"${attributes({
            format: node.format,
          })}></printedVariable>`;
        case "feedback":
          return `<feedback${node.feedbackType === "block" ? "Block" : "Inline"} identifier="${escapeXml(
            node.identifier,
          )}" outcomeIdentifier="${escapeXml(node.outcomeIdentifier)}" showHide="${node.showHide}">${serializeContent(
            node.children,
            mappings,
            revision,
            diagnostics,
          )}</feedback${node.feedbackType === "block" ? "Block" : "Inline"}>`;
        case "element": {
          const name = contentElementName(node.qtiName);
          return `<${name}${semanticAttributes(
            node.attributes,
            revision,
            diagnostics,
            `/itemBody/${name}`,
          )}>${serializeContent(node.children, mappings, revision, diagnostics)}</${name}>`;
        }
      }
      throw new Error(`Unreachable QTI content node: ${JSON.stringify(node)}`);
    })
    .join("");
}

function contentElementName(name: string): string {
  const qti = name.startsWith("qti-") ? name.slice(4) : name;
  return qti.replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
}

function serializeResponseDeclaration(declaration: QtiResponseDeclaration): string {
  const correct =
    declaration.correctResponse === null
      ? ""
      : `<correctResponse>${values(declaration.correctResponse)
          .map((value) => `<value>${escapeXml(String(value))}</value>`)
          .join("")}</correctResponse>`;
  const mapping = declaration.mapping
    ? `<mapping defaultValue="${String(declaration.mapping.defaultValue)}">${declaration.mapping.entries
        .map(
          (entry) =>
            `<mapEntry mapKey="${escapeXml(entry.mapKey ?? "")}" mappedValue="${String(entry.mappedValue)}"></mapEntry>`,
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
          .map((value) => `<value>${escapeXml(String(value))}</value>`)
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

function semanticAttributes(
  source: Readonly<Record<string, string>> | undefined,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
  omitted: ReadonlySet<string> = new Set(),
): string {
  if (!source) return "";
  const target: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (omitted.has(name) || name === "xmlns" || name.startsWith("xmlns:")) continue;
    if (name === "aria-label" && revision.target === "qti21") {
      target.label = value;
      diagnostics.push({
        code: "profile.qti21.attribute.aria_label_normalized",
        severity: "info",
        message: "Mapped aria-label to the QTI 2.1 label attribute.",
        path,
      });
      continue;
    }
    if ((name.startsWith("aria-") || name.startsWith("data-")) && revision.target === "qti21") {
      diagnostics.push({
        code: "profile.qti21.attribute.semantic_not_representable",
        severity: "warning",
        message: `QTI 2.1 cannot carry ${name}="${value}"; visible prompt and label content is preserved.`,
        path,
      });
      continue;
    }
    target[targetAttributeName(name, revision)] = value;
  }
  return attributes(target);
}

function targetAttributeName(name: string, revision: Qti2Revision): string {
  if (revision.target === "qti22" && (name.startsWith("aria-") || name.startsWith("data-"))) {
    return name;
  }
  return name.replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
}

function attributes(source: Readonly<Record<string, string | undefined>>): string {
  const entries = Object.entries(source).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return entries.length === 0
    ? ""
    : ` ${entries.map(([name, value]) => `${name}="${escapeXml(value)}"`).join(" ")}`;
}

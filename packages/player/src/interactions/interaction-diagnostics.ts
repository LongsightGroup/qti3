import type {
  QtiAssessmentItem,
  QtiContentNode,
  QtiDiagnostic,
  QtiInteraction,
  QtiObjectAsset,
  QtiSourceLocation,
} from "@longsightgroup/qti3-core";
import { parseAuthoredAssetUrl } from "../asset-url-policy.js";
import { contentElementName } from "../content/content-dom.js";
import { interactionChoices, objectIsImage } from "../interaction-support.js";
import { sourceChoices, targetChoices } from "./shared.js";
import { isInlineFlowInteraction } from "./interaction-inline-embedding.js";
import { isInteractionSupported } from "./interaction-registry.js";

function diagnosticPath(interaction: QtiInteraction): string | undefined {
  return interaction.responseIdentifier ?? undefined;
}

export function interactionMissingChoiceDiagnostics(interaction: QtiInteraction): QtiDiagnostic[] {
  if (!interactionRequiresChoices(interaction) || interactionHasRequiredChoices(interaction)) {
    return [];
  }
  const path = diagnosticPath(interaction);
  return [
    {
      code: "interaction.choices.missing",
      severity: "error",
      message: `No choices are defined for the ${interaction.type} interaction${path ? ` (${path})` : ""}.`,
      path,
    },
  ];
}

export function interactionUnsupportedDiagnostics(interaction: QtiInteraction): QtiDiagnostic[] {
  if (isInteractionSupported(interaction)) return [];
  const path = diagnosticPath(interaction);
  const message =
    interaction.registryStatus === "deprecated"
      ? path
        ? `Interaction "${interaction.qtiName}" (${path}) is deprecated and is not supported by this player.`
        : `Interaction "${interaction.qtiName}" is deprecated and is not supported by this player.`
      : interaction.registryStatus === "unsupported"
        ? path
          ? `Interaction "${interaction.qtiName}" (${path}) is not in the QTI support registry and is not supported by this player.`
          : `Interaction "${interaction.qtiName}" is not in the QTI support registry and is not supported by this player.`
        : path
          ? `Interaction type "${interaction.type}" (${path}) is not supported.`
          : `Interaction type "${interaction.type}" is not supported.`;
  return [
    {
      code: "interaction.unsupported",
      severity: "error",
      message,
      path,
    },
  ];
}

export function collectInteractionRenderDiagnostics(
  interactions: QtiInteraction[],
): QtiDiagnostic[] {
  return interactions.flatMap((interaction) => [
    ...interactionUnsupportedDiagnostics(interaction),
    ...interactionMissingChoiceDiagnostics(interaction),
    ...interactionAssetUrlDiagnostics(interaction),
  ]);
}

/** Report authored interaction assets that cannot be assigned to their intended DOM sinks. */
export function interactionAssetUrlDiagnostics(interaction: QtiInteraction): QtiDiagnostic[] {
  const diagnostics: QtiDiagnostic[] = [];
  if (interaction.object) {
    diagnostics.push(...objectAssetUrlDiagnostics(interaction, interaction.object, "object"));
  }
  if (interaction.positionObjectStage && interaction.positionObjectStage !== interaction.object) {
    diagnostics.push(
      ...objectAssetUrlDiagnostics(interaction, interaction.positionObjectStage, "stage object"),
    );
  }
  for (const choice of interaction.choices) {
    if (!choice.asset?.data) continue;
    if (parseAuthoredAssetUrl(choice.asset.data, "image")) continue;
    diagnostics.push(
      unsafeAssetUrlDiagnostic(
        interaction,
        `choice "${choice.identifier}" image`,
        choice.asset.source ?? choice.source,
      ),
    );
  }
  return diagnostics;
}

function objectAssetUrlDiagnostics(
  interaction: QtiInteraction,
  object: QtiObjectAsset,
  label: string,
): QtiDiagnostic[] {
  const diagnostics: QtiDiagnostic[] = [];
  const dataContext =
    interaction.type === "media" && mediaObjectType(object)
      ? "media"
      : objectIsImage(object)
        ? "image"
        : "navigation";
  if (object.data && !parseAuthoredAssetUrl(object.data, dataContext)) {
    diagnostics.push(unsafeAssetUrlDiagnostic(interaction, label, object.source));
  }
  const sourceContext =
    interaction.type === "media" && mediaObjectType(object) ? "media" : "navigation";
  for (const source of object.sources) {
    if (!source.src || parseAuthoredAssetUrl(source.src, sourceContext)) continue;
    diagnostics.push(unsafeAssetUrlDiagnostic(interaction, `${label} source`, source.source));
  }
  for (const track of object.tracks) {
    if (!track.src || parseAuthoredAssetUrl(track.src, "track")) continue;
    diagnostics.push(unsafeAssetUrlDiagnostic(interaction, `${label} track`, track.source));
  }
  return diagnostics;
}

function mediaObjectType(object: QtiObjectAsset): "audio" | "video" | undefined {
  const types = [object.type, ...object.sources.map((source) => source.type)].filter(
    (value): value is string => Boolean(value),
  );
  if (types.some((value) => value.startsWith("audio/"))) return "audio";
  if (types.some((value) => value.startsWith("video/"))) return "video";
  return undefined;
}

function unsafeAssetUrlDiagnostic(
  interaction: QtiInteraction,
  assetLabel: string,
  source: QtiSourceLocation | undefined,
): QtiDiagnostic {
  const path = diagnosticPath(interaction);
  return {
    code: "interaction.asset.url.unsafe",
    severity: "error",
    message: `Unsafe ${assetLabel} URL was omitted from the ${interaction.type} interaction${path ? ` (${path})` : ""}.`,
    path,
    source,
  };
}

export function interactionEmbeddedDiagnostics(interaction: QtiInteraction): QtiDiagnostic[] {
  if (isInlineFlowInteraction(interaction)) return [];
  const path = diagnosticPath(interaction);
  return [
    {
      code: "interaction.embed.unsupported",
      severity: "error",
      message: path
        ? `Interaction type "${interaction.type}" (${path}) cannot be embedded inline in item body.`
        : `Interaction type "${interaction.type}" cannot be embedded inline in item body.`,
      path,
    },
  ];
}

export function collectEmbeddedInteractionDiagnostics(item: QtiAssessmentItem): QtiDiagnostic[] {
  const embeddedIndices = findEmbeddedInteractionIndices(item.body);
  return embeddedIndices.flatMap((index) => {
    const interaction = item.interactions[index];
    return interaction ? interactionEmbeddedDiagnostics(interaction) : [];
  });
}

function findEmbeddedInteractionIndices(nodes: QtiContentNode[]): number[] {
  return nodes.flatMap((node) => findEmbeddedInteractionIndicesInContext(node, false));
}

function findEmbeddedInteractionIndicesInContext(
  node: QtiContentNode,
  insideInlineFlow: boolean,
): number[] {
  if (node.kind === "interaction") {
    return insideInlineFlow ? [node.interactionIndex] : [];
  }
  if ("children" in node) {
    const childInsideInlineFlow = insideInlineFlow || isInlineFlowContainer(node);
    return node.children.flatMap((child) =>
      findEmbeddedInteractionIndicesInContext(child, childInsideInlineFlow),
    );
  }
  return [];
}

function isInlineFlowContainer(node: QtiContentNode): boolean {
  if (node.kind !== "element") return false;
  if (node.qtiName === "qti-template-inline") return true;
  if (node.qtiName === "p") return true;
  const tag = contentElementName(node.qtiName);
  if (!tag) return false;
  return new Set(["span", "label", "a", "em", "strong", "b", "i", "sub", "sup", "small"]).has(tag);
}

function interactionRequiresChoices(interaction: QtiInteraction): boolean {
  switch (interaction.type) {
    case "choice":
    case "order":
    case "graphicOrder":
    case "hotspot":
    case "hottext":
    case "inlineChoice":
    case "match":
    case "associate":
    case "gapMatch":
    case "graphicGapMatch":
    case "graphicAssociate":
      return true;
    case "custom":
    case "drawing":
    case "endAttempt":
    case "extendedText":
    case "media":
    case "portableCustom":
    case "positionObject":
    case "selectPoint":
    case "slider":
    case "textEntry":
    case "upload":
      return false;
  }
  return false;
}

function interactionHasRequiredChoices(interaction: QtiInteraction): boolean {
  switch (interaction.type) {
    case "choice":
    case "inlineChoice":
      return interactionChoices(interaction).length > 0;
    case "order":
      return interactionChoices(interaction).some((choice) => choice.role !== "gap");
    case "graphicOrder":
    case "hotspot":
    case "graphicAssociate":
      return interactionChoices(interaction).some((choice) => choice.role === "hotspot");
    case "hottext":
      return (
        Boolean(interaction.hottextSegments?.length) || interactionChoices(interaction).length > 0
      );
    case "match":
    case "associate":
      return sourceChoices(interaction).length > 0 && targetChoices(interaction).length > 0;
    case "gapMatch":
      return sourceChoices(interaction).length > 0 && targetChoices(interaction).length > 0;
    case "graphicGapMatch":
      if (interaction.object && interaction.choices.some((choice) => choice.role === "hotspot")) {
        return (
          sourceChoices(interaction).length > 0 &&
          targetChoices(interaction).filter((choice) => choice.role === "hotspot").length > 0
        );
      }
      return sourceChoices(interaction).length > 0 && targetChoices(interaction).length > 0;
    case "custom":
    case "drawing":
    case "endAttempt":
    case "extendedText":
    case "media":
    case "portableCustom":
    case "positionObject":
    case "selectPoint":
    case "slider":
    case "textEntry":
    case "upload":
      return true;
  }
  return true;
}

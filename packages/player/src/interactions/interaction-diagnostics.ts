import type {
  QtiAssessmentItem,
  QtiContentNode,
  QtiDiagnostic,
  QtiInteraction,
} from "@longsightgroup/qti3-core";
import { contentElementName } from "../content/content-dom.js";
import { interactionChoices } from "../interaction-support.js";
import { sourceChoices, targetChoices } from "./shared.js";
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
  return [
    {
      code: "interaction.unsupported",
      severity: "error",
      message: path
        ? `Interaction type "${interaction.type}" (${path}) is not supported.`
        : `Interaction type "${interaction.type}" is not supported.`,
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
  ]);
}

const embeddableInteractionTypes = new Set<QtiInteraction["type"]>(["inlineChoice", "textEntry"]);

export function interactionEmbeddedDiagnostics(interaction: QtiInteraction): QtiDiagnostic[] {
  if (embeddableInteractionTypes.has(interaction.type)) return [];
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
    default:
      return false;
  }
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
    default:
      return true;
  }
}

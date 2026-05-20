import { interactionNameToType } from "./support.js";
import type {
  QtiAssessmentItem,
  QtiCardinality,
  QtiChoice,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiOutcomeDeclaration,
  QtiParseResult,
  QtiResponseDeclaration,
  QtiValue,
} from "./types.js";
import { childElements, descendants, parseXmlTree, textContent, type XmlNode } from "./xml.js";

export function parseQtiXml(xml: string): QtiParseResult {
  const diagnostics: QtiDiagnostic[] = [];
  const tree = parseXmlTree(xml);

  for (const error of tree.errors) {
    diagnostics.push({
      code: "xml.parse",
      severity: "error",
      message: error.message,
    });
  }

  if (!tree.root) {
    diagnostics.push({
      code: "xml.empty",
      severity: "error",
      message: "No XML root element was found.",
    });
    return { ok: false, diagnostics };
  }

  const itemNode = tree.root.localName === "qti-assessment-item" ? tree.root : undefined;
  if (!itemNode) {
    diagnostics.push({
      code: "qti.root",
      severity: "error",
      message: `Expected qti-assessment-item root, found ${tree.root.localName}.`,
    });
    return { ok: false, diagnostics };
  }

  const item = parseAssessmentItem(itemNode, diagnostics);
  const document: QtiDocument = { item, diagnostics };
  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    document,
    diagnostics,
  };
}

function parseAssessmentItem(node: XmlNode, diagnostics: QtiDiagnostic[]): QtiAssessmentItem {
  const identifier = node.attributes.identifier ?? "ITEM";
  const responseDeclarations = childElements(node, "qti-response-declaration").map(
    parseResponseDeclaration,
  );
  const outcomeDeclarations = childElements(node, "qti-outcome-declaration").map(
    parseOutcomeDeclaration,
  );
  const interactions = descendants(node, (child) => interactionNameToType.has(child.localName)).map(
    (interactionNode) => parseInteraction(interactionNode, diagnostics),
  );

  for (const interaction of interactions) {
    if (
      !interaction.responseIdentifier &&
      interaction.type !== "endAttempt" &&
      interaction.type !== "media"
    ) {
      diagnostics.push({
        code: "interaction.responseIdentifier",
        severity: "error",
        message: `${interaction.qtiName} is missing response-identifier.`,
      });
    }
  }

  return {
    identifier,
    title: node.attributes.title,
    responseDeclarations,
    outcomeDeclarations,
    interactions,
    bodyText: textContent(node),
  };
}

function parseResponseDeclaration(node: XmlNode): QtiResponseDeclaration {
  const cardinality = parseCardinality(node.attributes.cardinality);
  return {
    kind: "response",
    identifier: node.attributes.identifier ?? "RESPONSE",
    cardinality,
    baseType: node.attributes["base-type"] as QtiResponseDeclaration["baseType"],
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0]),
    correctResponse: normalizeValueForCardinality(
      parseVariableValue(childElements(node, "qti-correct-response")[0]),
      cardinality,
    ),
    mapping: parseMapping(childElements(node, "qti-mapping")[0]),
  };
}

function parseOutcomeDeclaration(node: XmlNode): QtiOutcomeDeclaration {
  return {
    kind: "outcome",
    identifier: node.attributes.identifier ?? "SCORE",
    cardinality: parseCardinality(node.attributes.cardinality),
    baseType: node.attributes["base-type"] as QtiOutcomeDeclaration["baseType"],
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0]),
  };
}

function parseInteraction(node: XmlNode, diagnostics: QtiDiagnostic[]): QtiInteraction {
  const interactionType = interactionNameToType.get(node.localName);
  if (!interactionType) {
    diagnostics.push({
      code: "interaction.unsupported",
      severity: "warning",
      message: `${node.localName} is not currently in the support registry.`,
    });
  }

  return {
    type: interactionType ?? "custom",
    qtiName: node.localName,
    responseIdentifier: node.attributes["response-identifier"],
    prompt: textContent(childElements(node, "qti-prompt")[0] ?? node),
    choices: parseChoices(node),
    attributes: node.attributes,
    text: textContent(node),
  };
}

function parseChoices(node: XmlNode): QtiChoice[] {
  const choiceNames = new Set([
    "qti-simple-choice",
    "qti-simple-associable-choice",
    "qti-inline-choice",
    "qti-gap-text",
    "qti-gap-img",
    "qti-hottext",
    "qti-hotspot-choice",
    "qti-associable-hotspot",
    "qti-gap",
  ]);

  return descendants(node, (child) => choiceNames.has(child.localName)).map((choice, index) => ({
    identifier: choice.attributes.identifier ?? `choice-${index + 1}`,
    text: textContent(choice) || choice.attributes.identifier || `Choice ${index + 1}`,
  }));
}

function parseVariableValue(node: XmlNode | undefined): QtiValue {
  if (!node) return null;
  const values = childElements(node, "qti-value").map((valueNode) => textContent(valueNode));
  if (values.length === 0) {
    const text = textContent(node);
    return text.length > 0 ? text : null;
  }
  if (values.length === 1) return values[0] ?? null;
  return values;
}

function parseMapping(node: XmlNode | undefined): Record<string, number> | undefined {
  if (!node) return undefined;
  const entries = childElements(node, "qti-map-entry");
  const mapping: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.attributes["map-key"];
    const value = entry.attributes["mapped-value"];
    if (key && value !== undefined) mapping[key] = Number(value);
  }
  return mapping;
}

function parseCardinality(value: string | undefined): QtiCardinality {
  if (value === "multiple" || value === "ordered" || value === "record") return value;
  return "single";
}

function normalizeValueForCardinality(value: QtiValue, cardinality: QtiCardinality): QtiValue {
  if (
    (cardinality === "multiple" || cardinality === "ordered") &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return [String(value)];
  }
  return value;
}

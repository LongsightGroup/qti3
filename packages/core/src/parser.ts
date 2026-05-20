import { getInteractionSupport, interactionNameToType } from "./support.js";
import type {
  QtiAssessmentItem,
  QtiCardinality,
  QtiChoice,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiOutcomeDeclaration,
  QtiParseResult,
  QtiProcessingExpression,
  QtiResponseCondition,
  QtiResponseDeclaration,
  QtiResponseProcessing,
  QtiSetOutcomeValue,
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
  const responseDeclarationMap = new Map(
    responseDeclarations.map((declaration) => [declaration.identifier, declaration]),
  );
  const outcomeDeclarations = childElements(node, "qti-outcome-declaration").map(
    parseOutcomeDeclaration,
  );
  const responseProcessing = parseResponseProcessing(
    childElements(node, "qti-response-processing")[0],
  );
  const interactions = descendants(node, (child) => interactionNameToType.has(child.localName)).map(
    (interactionNode) => parseInteraction(interactionNode, diagnostics, responseDeclarationMap),
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
    responseProcessing,
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
    areaMapping: parseAreaMapping(childElements(node, "qti-area-mapping")[0]),
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

function parseInteraction(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  responseDeclarationMap: Map<string, QtiResponseDeclaration>,
): QtiInteraction {
  const interactionType = interactionNameToType.get(node.localName);
  const responseIdentifier = node.attributes["response-identifier"];
  const responseDeclaration = responseIdentifier
    ? responseDeclarationMap.get(responseIdentifier)
    : undefined;
  if (!interactionType) {
    diagnostics.push({
      code: "interaction.unsupported",
      severity: "warning",
      message: `${node.localName} is not currently in the support registry.`,
    });
  }
  const support = getInteractionSupport(node.localName);
  if (support?.support === "deprecated") {
    diagnostics.push({
      code: "interaction.deprecated",
      severity: "warning",
      message: `${node.localName} is deprecated. ${support.notes ?? ""}`.trim(),
    });
  }

  return {
    type: interactionType ?? "custom",
    qtiName: node.localName,
    responseIdentifier,
    responseCardinality: responseDeclaration?.cardinality,
    responseBaseType: responseDeclaration?.baseType,
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

function parseAreaMapping(
  node: XmlNode | undefined,
): QtiResponseDeclaration["areaMapping"] | undefined {
  if (!node) return undefined;
  return {
    defaultValue: Number(node.attributes["default-value"] ?? 0),
    entries: childElements(node, "qti-area-map-entry").map((entry) => ({
      shape: parseShape(entry.attributes.shape),
      coords: (entry.attributes.coords ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value)),
      mappedValue: Number(entry.attributes["mapped-value"] ?? 0),
    })),
  };
}

function parseShape(
  shape: string | undefined,
): NonNullable<QtiResponseDeclaration["areaMapping"]>["entries"][number]["shape"] {
  if (shape === "circle" || shape === "rect" || shape === "poly") return shape;
  return "default";
}

function parseResponseProcessing(node: XmlNode | undefined): QtiResponseProcessing | undefined {
  if (!node) return undefined;
  return {
    template: node.attributes.template,
    conditions: childElements(node, "qti-response-condition").map(parseResponseCondition),
  };
}

function parseResponseCondition(node: XmlNode): QtiResponseCondition {
  const responseIf = childElements(node, "qti-response-if")[0];
  const responseElse = childElements(node, "qti-response-else")[0];
  return {
    ifExpression: responseIf ? parseFirstExpression(responseIf) : undefined,
    thenRules: responseIf ? parseSetOutcomeValues(responseIf) : [],
    elseRules: responseElse ? parseSetOutcomeValues(responseElse) : [],
  };
}

function parseSetOutcomeValues(node: XmlNode): QtiSetOutcomeValue[] {
  return childElements(node, "qti-set-outcome-value").map((setNode) => ({
    identifier: setNode.attributes.identifier ?? "SCORE",
    expression: parseFirstExpression(setNode) ?? { type: "baseValue", value: null },
  }));
}

function parseFirstExpression(node: XmlNode): QtiProcessingExpression | undefined {
  for (const child of node.children) {
    const expression = parseExpression(child);
    if (expression) return expression;
  }
  return undefined;
}

function parseExpression(node: XmlNode): QtiProcessingExpression | undefined {
  if (node.localName === "qti-base-value") {
    return {
      type: "baseValue",
      value: coerceValue(textContent(node), node.attributes["base-type"]),
    };
  }

  if (node.localName === "qti-is-null") {
    const variable = childElements(node, "qti-variable")[0];
    return { type: "isNull", identifier: variable?.attributes.identifier ?? "RESPONSE" };
  }

  if (node.localName === "qti-map-response") {
    return { type: "mapResponse", identifier: node.attributes.identifier ?? "RESPONSE" };
  }

  if (node.localName === "qti-match") {
    const variable = childElements(node, "qti-variable")[0];
    const correct = childElements(node, "qti-correct")[0];
    if (variable?.attributes.identifier && correct?.attributes.identifier) {
      return { type: "matchCorrect", identifier: variable.attributes.identifier };
    }
  }

  return undefined;
}

function coerceValue(value: string, baseType: string | undefined): QtiValue {
  if (baseType === "integer") return Number.parseInt(value, 10);
  if (baseType === "float") return Number.parseFloat(value);
  if (baseType === "boolean") return value === "true";
  return value;
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

import { getInteractionSupport, interactionNameToType } from "./support.js";
import type {
  QtiAssessmentItem,
  QtiCardinality,
  QtiChoice,
  QtiChoiceRole,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiModalFeedback,
  QtiObjectAsset,
  QtiOutcomeDeclaration,
  QtiParseResult,
  QtiProcessingExpression,
  QtiResponseCondition,
  QtiResponseDeclaration,
  QtiResponseProcessing,
  QtiSetOutcomeValue,
  QtiTemplateDeclaration,
  QtiTemplateProcessing,
  QtiTemplateRule,
  QtiValue,
} from "./types.js";
import { validateAssessmentItem } from "./validation.js";
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
      path: tree.root.source.path,
      source: tree.root.source,
    });
    return { ok: false, diagnostics };
  }

  const item = parseAssessmentItem(itemNode, diagnostics);
  const document: QtiDocument = { item, diagnostics };
  const validation = validateAssessmentItem(document);
  diagnostics.push(...validation.diagnostics);
  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    document,
    diagnostics,
  };
}

function parseAssessmentItem(node: XmlNode, diagnostics: QtiDiagnostic[]): QtiAssessmentItem {
  const identifier = node.attributes.identifier ?? "";
  const responseDeclarations = childElements(node, "qti-response-declaration").map(
    parseResponseDeclaration,
  );
  const responseDeclarationMap = new Map(
    responseDeclarations.map((declaration) => [declaration.identifier, declaration]),
  );
  const outcomeDeclarations = childElements(node, "qti-outcome-declaration").map(
    parseOutcomeDeclaration,
  );
  const templateDeclarations = childElements(node, "qti-template-declaration").map(
    parseTemplateDeclaration,
  );
  const templateProcessing = parseTemplateProcessing(
    childElements(node, "qti-template-processing")[0],
  );
  const responseProcessing = parseResponseProcessing(
    childElements(node, "qti-response-processing")[0],
  );
  const modalFeedback = childElements(node, "qti-modal-feedback").map(parseModalFeedback);
  const interactions = descendants(node, (child) => interactionNameToType.has(child.localName)).map(
    (interactionNode) => parseInteraction(interactionNode, diagnostics, responseDeclarationMap),
  );
  const itemBody = childElements(node, "qti-item-body")[0];
  const prompt = itemBody ? childElements(itemBody, "qti-prompt")[0] : undefined;

  return {
    identifier,
    title: node.attributes.title,
    prompt: prompt ? textContent(prompt) : undefined,
    responseDeclarations,
    outcomeDeclarations,
    templateDeclarations,
    templateProcessing,
    responseProcessing,
    interactions,
    modalFeedback,
    bodyText: textContent(node),
    source: node.source,
  };
}

function parseModalFeedback(node: XmlNode): QtiModalFeedback {
  const showHide = node.attributes["show-hide"] === "hide" ? "hide" : "show";
  return {
    identifier: node.attributes.identifier ?? "",
    outcomeIdentifier: node.attributes["outcome-identifier"] ?? "",
    showHide,
    text: textContent(node),
    source: node.source,
  };
}

function parseResponseDeclaration(node: XmlNode): QtiResponseDeclaration {
  const cardinality = parseCardinality(node.attributes.cardinality);
  return {
    kind: "response",
    identifier: node.attributes.identifier ?? "",
    cardinality,
    baseType: node.attributes["base-type"] as QtiResponseDeclaration["baseType"],
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0]),
    correctResponse: normalizeValueForCardinality(
      parseVariableValue(childElements(node, "qti-correct-response")[0]),
      cardinality,
    ),
    mapping: parseMapping(childElements(node, "qti-mapping")[0]),
    areaMapping: parseAreaMapping(childElements(node, "qti-area-mapping")[0]),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseOutcomeDeclaration(node: XmlNode): QtiOutcomeDeclaration {
  return {
    kind: "outcome",
    identifier: node.attributes.identifier ?? "",
    cardinality: parseCardinality(node.attributes.cardinality),
    baseType: node.attributes["base-type"] as QtiOutcomeDeclaration["baseType"],
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0]),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseTemplateDeclaration(node: XmlNode): QtiTemplateDeclaration {
  return {
    kind: "template",
    identifier: node.attributes.identifier ?? "",
    cardinality: parseCardinality(node.attributes.cardinality),
    baseType: node.attributes["base-type"] as QtiTemplateDeclaration["baseType"],
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0]),
    attributes: node.attributes,
    source: node.source,
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
  const prompt = childElements(node, "qti-prompt")[0];
  if (!interactionType) {
    diagnostics.push({
      code: "interaction.unsupported",
      severity: "warning",
      message: `${node.localName} is not currently in the support registry.`,
      path: node.source.path,
      source: node.source,
    });
  }
  const support = getInteractionSupport(node.localName);
  if (support?.support === "deprecated") {
    diagnostics.push({
      code: "interaction.deprecated",
      severity: "warning",
      message: `${node.localName} is deprecated. ${support.notes ?? ""}`.trim(),
      path: node.source.path,
      source: node.source,
    });
  }

  return {
    type: interactionType ?? "custom",
    qtiName: node.localName,
    responseIdentifier,
    responseCardinality: responseDeclaration?.cardinality,
    responseBaseType: responseDeclaration?.baseType,
    prompt: prompt ? textContent(prompt) : undefined,
    object: parseObjectAsset(descendants(node, (child) => child.localName === "object")[0]),
    choices: parseChoices(node),
    childElements: childElements(node).map((child) => ({
      qtiName: child.localName,
      source: child.source,
    })),
    attributes: node.attributes,
    text: textContent(node),
    source: node.source,
  };
}

function parseObjectAsset(node: XmlNode | undefined): QtiObjectAsset | undefined {
  if (!node) return undefined;
  return {
    data: node.attributes.data,
    type: node.attributes.type,
    width: node.attributes.width,
    height: node.attributes.height,
    text: textContent(node),
    attributes: node.attributes,
    source: node.source,
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

  return descendants(node, (child) => choiceNames.has(child.localName)).map((choice, index) => {
    const identifier = choice.attributes.identifier ?? "";
    return {
      identifier,
      text: textContent(choice) || identifier || `Choice ${index + 1}`,
      role: choiceRole(choice),
      qtiName: choice.localName,
      attributes: choice.attributes,
      source: choice.source,
    };
  });
}

function choiceRole(node: XmlNode): QtiChoiceRole {
  if (node.localName === "qti-simple-choice") return "simpleChoice";
  if (node.localName === "qti-inline-choice") return "inlineChoice";
  if (node.localName === "qti-gap-text" || node.localName === "qti-gap-img") return "gapChoice";
  if (node.localName === "qti-gap") return "gap";
  if (node.localName === "qti-hottext") return "hottext";
  if (node.localName === "qti-hotspot-choice" || node.localName === "qti-associable-hotspot") {
    return "hotspot";
  }
  if (node.localName === "qti-simple-associable-choice") {
    const matchSet = node.parent?.localName === "qti-simple-match-set" ? node.parent : undefined;
    const interaction = nearestInteraction(node);
    if (matchSet && interaction?.localName === "qti-match-interaction") {
      return matchSetIndex(matchSet) === 0 ? "matchSource" : "matchTarget";
    }
    return "associableChoice";
  }
  return "simpleChoice";
}

function nearestInteraction(node: XmlNode): XmlNode | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (interactionNameToType.has(parent.localName)) return parent;
  }
  return undefined;
}

function matchSetIndex(node: XmlNode): number {
  const siblings =
    node.parent?.children.filter((sibling) => sibling.localName === "qti-simple-match-set") ?? [];
  return siblings.indexOf(node);
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

function parseTemplateProcessing(node: XmlNode | undefined): QtiTemplateProcessing | undefined {
  if (!node) return undefined;
  return {
    rules: childElements(node)
      .map(parseTemplateRule)
      .filter((rule): rule is QtiTemplateRule => rule !== undefined),
  };
}

function parseTemplateRule(node: XmlNode): QtiTemplateRule | undefined {
  if (node.localName === "qti-set-template-value") {
    return {
      type: "setTemplateValue",
      identifier: node.attributes.identifier ?? "TEMPLATE",
      expression: parseFirstExpression(node) ?? { type: "baseValue", value: null },
    };
  }

  if (node.localName === "qti-set-correct-response") {
    return {
      type: "setCorrectResponse",
      identifier: node.attributes.identifier ?? "RESPONSE",
      expression: parseFirstExpression(node) ?? { type: "baseValue", value: null },
    };
  }

  return undefined;
}

function parseResponseCondition(node: XmlNode): QtiResponseCondition {
  const responseIf = childElements(node, "qti-response-if")[0];
  const responseElse = childElements(node, "qti-response-else")[0];
  return {
    ifExpression: responseIf ? parseFirstExpression(responseIf) : undefined,
    thenRules: responseIf ? parseSetOutcomeValues(responseIf) : [],
    elseIfs: childElements(node, "qti-response-else-if").map((branch) => ({
      expression: parseFirstExpression(branch),
      rules: parseSetOutcomeValues(branch),
    })),
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

  if (node.localName === "qti-variable") {
    return { type: "variable", identifier: node.attributes.identifier ?? "RESPONSE" };
  }

  if (node.localName === "qti-random-integer") {
    return {
      type: "randomInteger",
      min: Number(node.attributes.min ?? 0),
      max: Number(node.attributes.max ?? 0),
      step: Number(node.attributes.step ?? 1),
    };
  }

  if (node.localName === "qti-random") {
    const multiple = childElements(node, "qti-multiple")[0];
    return {
      type: "random",
      values: childElements(multiple ?? node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
    };
  }

  if (node.localName === "qti-sum") {
    return {
      type: "sum",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
    };
  }

  if (node.localName === "qti-product") {
    return {
      type: "product",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
    };
  }

  if (node.localName === "qti-subtract") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "subtract", left, right };
  }

  if (node.localName === "qti-and") {
    return {
      type: "and",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
    };
  }

  if (node.localName === "qti-or") {
    return {
      type: "or",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
    };
  }

  if (node.localName === "qti-not") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "not", expression };
  }

  if (node.localName === "qti-equal") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) return { type: "equal", left, right };
  }

  if (node.localName === "qti-string-match") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "stringMatch",
        left,
        right,
        caseSensitive: node.attributes["case-sensitive"] !== "false",
        substring: node.attributes.substring === "true",
      };
    }
  }

  if (node.localName === "qti-member") {
    const [value, collection] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (value && collection) return { type: "member", value, collection };
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

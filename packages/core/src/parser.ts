import { getInteractionSupport, interactionNameToType, processingSupport } from "./support.js";
import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiCatalogCard,
  QtiCatalogCardEntry,
  QtiCatalogFileHref,
  QtiCatalogHtmlContent,
  QtiCatalogInfo,
  QtiCatalogReference,
  QtiCardinality,
  QtiChoice,
  QtiChoiceRole,
  QtiContentNode,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiInteractionType,
  QtiLookupOutcomeValue,
  QtiLookupTable,
  QtiMediaSource,
  QtiModalFeedback,
  QtiObjectAsset,
  QtiOutcomeDeclaration,
  QtiParseResult,
  QtiProcessingExpression,
  QtiPortableCustomDefinition,
  QtiPortableCustomInteractionModule,
  QtiPortableCustomInteractionModules,
  QtiPortableCustomVariableBinding,
  QtiRecordValue,
  QtiResponseCondition,
  QtiResponseDeclaration,
  QtiResponseProcessing,
  QtiResponseRule,
  QtiSetOutcomeValue,
  QtiScalarValue,
  QtiStylesheet,
  QtiTemplateDeclaration,
  QtiTemplateProcessing,
  QtiTemplateRule,
  QtiValue,
} from "./types.js";
import { validateAssessmentItem } from "./validation.js";
import { childElements, descendants, parseXmlTree, textContent, type XmlNode } from "./xml.js";

const qtiAssessmentItemNamespace = "http://www.imsglobal.org/xsd/imsqtiasi_v3p0";
const supportedProcessingNames = new Set(processingSupport.map((entry) => entry.qtiName));
const processingContainerNames = new Set(["qti-template-processing", "qti-response-processing"]);
const responseProcessingForbiddenNames = new Set([
  "qti-number-correct",
  "qti-number-incorrect",
  "qti-number-presented",
  "qti-number-responded",
  "qti-number-selected",
  "qti-outcome-minimum",
  "qti-outcome-maximum",
  "qti-test-variables",
]);

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

  const itemNode =
    tree.root.localName === "qti-assessment-item" && tree.root.uri === qtiAssessmentItemNamespace
      ? tree.root
      : undefined;
  if (!itemNode) {
    diagnostics.push({
      code: "qti.root",
      severity: "error",
      message:
        tree.root.localName === "qti-assessment-item"
          ? `Expected qti-assessment-item in namespace ${qtiAssessmentItemNamespace}, found ${tree.root.uri ?? "(none)"}.`
          : `Expected qti-assessment-item root, found ${tree.root.localName}.`,
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
  diagnoseProcessingElements(childElements(node, "qti-template-processing")[0], diagnostics);
  diagnoseProcessingElements(childElements(node, "qti-response-processing")[0], diagnostics);
  const itemBody = childElements(node, "qti-item-body")[0];
  const interactions: QtiInteraction[] = [];
  const body = itemBody
    ? parseContentChildren(itemBody, diagnostics, responseDeclarationMap, interactions)
    : [];
  if (!itemBody) {
    interactions.push(
      ...descendants(node, isInteractionElement).map((interactionNode) =>
        parseInteraction(interactionNode, diagnostics, responseDeclarationMap),
      ),
    );
  }
  const modalFeedback = childElements(node, "qti-modal-feedback").map(parseModalFeedback);
  const catalogInfo = parseCatalogInfo(childElements(node, "qti-catalog-info")[0]);
  const catalogReferences = itemBody ? parseCatalogReferences(itemBody) : [];
  const stylesheets = childElements(node, "qti-stylesheet").map(parseStylesheet);
  const prompt = itemBody ? childElements(itemBody, "qti-prompt")[0] : undefined;

  return {
    identifier,
    title: node.attributes.title,
    language: node.attributes["xml:lang"] ?? node.attributes.lang,
    adaptive: parseXmlBoolean(node.attributes.adaptive) === true,
    timeDependent: parseXmlBoolean(node.attributes["time-dependent"]),
    attributes: node.attributes,
    prompt: prompt ? textContent(prompt) : undefined,
    itemBodySource: itemBody?.source,
    responseDeclarations,
    outcomeDeclarations,
    templateDeclarations,
    templateProcessing,
    responseProcessing,
    interactions,
    modalFeedback,
    catalogInfo,
    catalogReferences,
    stylesheets,
    body,
    bodyText: textContent(node),
    source: node.source,
  };
}

function diagnoseProcessingElements(
  processingNode: XmlNode | undefined,
  diagnostics: QtiDiagnostic[],
): void {
  if (!processingNode) return;
  for (const node of [processingNode, ...descendants(processingNode, () => true)]) {
    if (!node.localName.startsWith("qti-")) continue;
    if (
      processingNode.localName === "qti-response-processing" &&
      responseProcessingForbiddenNames.has(node.localName)
    ) {
      diagnostics.push({
        code: "processing.response.forbidden",
        severity: "error",
        message: `${node.localName} must not be used in qti-response-processing.`,
        path: node.source.path,
        source: node.source,
      });
      continue;
    }
    if (
      processingContainerNames.has(node.localName) ||
      supportedProcessingNames.has(node.localName)
    ) {
      continue;
    }
    diagnostics.push({
      code: "processing.unsupported",
      severity: "error",
      message: `${node.localName} is not currently supported as a QTI processing element.`,
      path: node.source.path,
      source: node.source,
    });
  }
}

function parseStylesheet(node: XmlNode): QtiStylesheet {
  return {
    href: node.attributes.href ?? "",
    type: node.attributes.type,
    media: node.attributes.media,
    title: node.attributes.title,
    attributes: node.attributes,
    source: node.source,
  };
}

function parseCatalogReferences(node: XmlNode): QtiCatalogReference[] {
  const references = [
    ...(node.attributes["data-catalog-idref"] ? [node] : []),
    ...descendants(node, (child) => Boolean(child.attributes["data-catalog-idref"])),
  ];
  return references.map((reference) => ({
    idref: reference.attributes["data-catalog-idref"] ?? "",
    source: reference.source,
  }));
}

function isInteractionElement(node: XmlNode): boolean {
  return interactionNameToType.has(node.localName) || /^qti-.+-interaction$/.test(node.localName);
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

function parseContentChildren(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  responseDeclarationMap: Map<string, QtiResponseDeclaration>,
  interactions: QtiInteraction[],
): QtiContentNode[] {
  const content: QtiContentNode[] = [];
  for (const entry of node.content) {
    if (typeof entry === "string") {
      if (entry.length > 0) content.push({ kind: "text", text: entry, source: node.source });
      continue;
    }
    const parsed = parseContentNode(entry, diagnostics, responseDeclarationMap, interactions);
    if (parsed) content.push(parsed);
  }
  return content;
}

function parseContentNode(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  responseDeclarationMap: Map<string, QtiResponseDeclaration>,
  interactions: QtiInteraction[],
): QtiContentNode | undefined {
  if (isInteractionElement(node)) {
    const interaction = parseInteraction(node, diagnostics, responseDeclarationMap);
    const interactionIndex = interactions.push(interaction) - 1;
    return {
      kind: "interaction",
      interactionIndex,
      qtiName: node.localName,
      responseIdentifier: interaction.responseIdentifier,
      source: node.source,
    };
  }

  if (node.localName === "qti-printed-variable") {
    return {
      kind: "printedVariable",
      identifier: node.attributes.identifier ?? "",
      format: node.attributes.format,
      attributes: node.attributes,
      source: node.source,
    };
  }

  if (node.localName === "qti-feedback-block" || node.localName === "qti-feedback-inline") {
    return {
      kind: "feedback",
      feedbackType: node.localName === "qti-feedback-block" ? "block" : "inline",
      identifier: node.attributes.identifier ?? "",
      outcomeIdentifier: node.attributes["outcome-identifier"] ?? "",
      showHide: node.attributes["show-hide"] === "hide" ? "hide" : "show",
      attributes: node.attributes,
      children: parseContentChildren(node, diagnostics, responseDeclarationMap, interactions),
      source: node.source,
    };
  }

  return {
    kind: "element",
    qtiName: node.localName,
    attributes: node.attributes,
    children: parseContentChildren(node, diagnostics, responseDeclarationMap, interactions),
    source: node.source,
  };
}

function parseCatalogInfo(node: XmlNode | undefined): QtiCatalogInfo | undefined {
  if (!node) return undefined;
  return {
    catalogs: childElements(node, "qti-catalog").map((catalog) => ({
      id: catalog.attributes.id ?? "",
      attributes: catalog.attributes,
      cards: childElements(catalog, "qti-card").map(parseCatalogCard),
      source: catalog.source,
    })),
    source: node.source,
  };
}

function parseCatalogCard(node: XmlNode): QtiCatalogCard {
  return {
    support: node.attributes.support ?? "",
    htmlContent: parseCatalogHtmlContent(childElements(node, "qti-html-content")[0]),
    fileHrefs: childElements(node, "qti-file-href").map(parseCatalogFileHref),
    entries: childElements(node, "qti-card-entry").map(parseCatalogCardEntry),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseCatalogCardEntry(node: XmlNode): QtiCatalogCardEntry {
  return {
    language: node.attributes["xml:lang"] ?? node.attributes.lang,
    default: node.attributes.default === "true",
    htmlContent: parseCatalogHtmlContent(childElements(node, "qti-html-content")[0]),
    fileHrefs: childElements(node, "qti-file-href").map(parseCatalogFileHref),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseCatalogHtmlContent(node: XmlNode | undefined): QtiCatalogHtmlContent | undefined {
  if (!node) return undefined;
  return {
    text: textContent(node),
    children: parseCatalogHtmlChildren(node),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseCatalogHtmlChildren(node: XmlNode): QtiContentNode[] {
  const content: QtiContentNode[] = [];
  for (const entry of node.content) {
    if (typeof entry === "string") {
      if (entry.length > 0) content.push({ kind: "text", text: entry, source: node.source });
      continue;
    }
    content.push({
      kind: "element",
      qtiName: entry.localName,
      attributes: entry.attributes,
      children: parseCatalogHtmlChildren(entry),
      source: entry.source,
    });
  }
  return content;
}

function parseCatalogFileHref(node: XmlNode): QtiCatalogFileHref {
  return {
    href: textContent(node).trim(),
    mimeType: node.attributes["mime-type"],
    attributes: node.attributes,
    source: node.source,
  };
}

function parseResponseDeclaration(node: XmlNode): QtiResponseDeclaration {
  const cardinality = parseCardinality(node.attributes.cardinality);
  const baseType = node.attributes["base-type"] as QtiResponseDeclaration["baseType"];
  return {
    kind: "response",
    identifier: node.attributes.identifier ?? "",
    cardinality,
    baseType,
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0], baseType),
    correctResponse: normalizeValueForCardinality(
      parseVariableValue(childElements(node, "qti-correct-response")[0], baseType),
      cardinality,
    ),
    mapping: parseMapping(childElements(node, "qti-mapping")[0]),
    areaMapping: parseAreaMapping(childElements(node, "qti-area-mapping")[0]),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseOutcomeDeclaration(node: XmlNode): QtiOutcomeDeclaration {
  const baseType = node.attributes["base-type"] as QtiOutcomeDeclaration["baseType"];
  return {
    kind: "outcome",
    identifier: node.attributes.identifier ?? "",
    cardinality: parseCardinality(node.attributes.cardinality),
    baseType,
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0], baseType),
    lookupTable: parseLookupTable(node, baseType),
    attributes: node.attributes,
    source: node.source,
  };
}

function parseTemplateDeclaration(node: XmlNode): QtiTemplateDeclaration {
  const baseType = node.attributes["base-type"] as QtiTemplateDeclaration["baseType"];
  return {
    kind: "template",
    identifier: node.attributes.identifier ?? "",
    cardinality: parseCardinality(node.attributes.cardinality),
    baseType,
    defaultValue: parseVariableValue(childElements(node, "qti-default-value")[0], baseType),
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

  const objectNode =
    interactionType === "positionObject"
      ? positionObjectInteractionObject(node)
      : interactionType === "media"
        ? mediaInteractionObject(node)
        : interactionType === "drawing"
          ? drawingInteractionObject(node)
          : descendants(
              node,
              (child) => child.localName === "object" || child.localName === "img",
            )[0];

  return {
    type: interactionType ?? "custom",
    qtiName: node.localName,
    responseIdentifier,
    responseCardinality: responseDeclaration?.cardinality,
    responseBaseType: responseDeclaration?.baseType,
    prompt: prompt ? textContent(prompt) : undefined,
    promptAttributes: prompt?.attributes,
    promptSource: prompt?.source,
    contextText: inlineInteractionContext(node, interactionType),
    object: parseObjectAsset(objectNode),
    positionObjectStage:
      interactionType === "positionObject"
        ? parseObjectAsset(positionObjectStageObject(node))
        : undefined,
    portableCustom:
      interactionType === "portableCustom"
        ? parsePortableCustomDefinition(node, diagnostics)
        : undefined,
    choices: parseChoices(node),
    hottextSegments: interactionType === "hottext" ? parseHottextSegments(node) : undefined,
    gapMatchSegments:
      interactionType === "gapMatch" || interactionType === "graphicGapMatch"
        ? parseGapMatchSegments(node)
        : undefined,
    childElements: childElements(node).map((child) => ({
      qtiName: child.localName,
      source: child.source,
    })),
    attributes: node.attributes,
    text: textContent(node),
    source: node.source,
  };
}

function parsePortableCustomDefinition(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiPortableCustomDefinition {
  const markup = firstChildElement(node, "qti-interaction-markup", diagnostics);
  const modules = firstChildElement(node, "qti-interaction-modules", diagnostics);
  return {
    responseIdentifier: node.attributes["response-identifier"],
    customInteractionTypeIdentifier: node.attributes["custom-interaction-type-identifier"],
    module: node.attributes.module,
    interactionModules: modules ? parsePortableCustomInteractionModules(modules) : undefined,
    interactionMarkup: markup ? parsePortableCustomMarkupChildren(markup, diagnostics) : [],
    interactionMarkupRaw: markup ? serializeXmlContent(markup) : undefined,
    templateVariables: childElements(node, "qti-template-variable").map((variable) =>
      parsePortableCustomVariableBinding(variable, "template"),
    ),
    contextVariables: childElements(node, "qti-context-variable").map((variable) =>
      parsePortableCustomVariableBinding(variable, "context"),
    ),
    stylesheets: childElements(node, "qti-stylesheet").map(parseStylesheet),
    catalogInfo: parseCatalogInfo(childElements(node, "qti-catalog-info")[0]),
    dataAttributes: Object.fromEntries(
      Object.entries(node.attributes).filter(([name]) => name.startsWith("data-")),
    ),
    attributes: node.attributes,
    source: node.source,
  };
}

function firstChildElement(
  node: XmlNode,
  name: string,
  diagnostics: QtiDiagnostic[],
): XmlNode | undefined {
  const matches = childElements(node, name);
  if (matches.length > 1) {
    diagnostics.push({
      code: "interaction.portableCustom.child.duplicate",
      severity: "error",
      message: `${node.localName} allows at most one ${name} child.`,
      path: matches[1]?.source?.path ?? node.source?.path,
      source: matches[1]?.source ?? node.source,
    });
  }
  return matches[0];
}

function parsePortableCustomMarkupChildren(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiContentNode[] {
  const content: QtiContentNode[] = [];
  for (const entry of node.content) {
    if (typeof entry === "string") {
      if (entry.length > 0) content.push({ kind: "text", text: entry, source: node.source });
      continue;
    }
    content.push(parsePortableCustomMarkupNode(entry, diagnostics));
  }
  return content;
}

function parsePortableCustomMarkupNode(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
): QtiContentNode {
  if (isInteractionElement(node)) {
    diagnostics.push({
      code: "interaction.portableCustom.markupInteraction",
      severity: "error",
      message: `qti-interaction-markup must not contain nested QTI interaction ${node.localName}.`,
      path: node.source?.path,
      source: node.source,
    });
  }

  if (node.localName === "qti-printed-variable") {
    return {
      kind: "printedVariable",
      identifier: node.attributes.identifier ?? "",
      format: node.attributes.format,
      attributes: node.attributes,
      source: node.source,
    };
  }

  if (node.localName === "qti-feedback-block" || node.localName === "qti-feedback-inline") {
    return {
      kind: "feedback",
      feedbackType: node.localName === "qti-feedback-block" ? "block" : "inline",
      identifier: node.attributes.identifier ?? "",
      outcomeIdentifier: node.attributes["outcome-identifier"] ?? "",
      showHide: node.attributes["show-hide"] === "hide" ? "hide" : "show",
      attributes: node.attributes,
      children: parsePortableCustomMarkupChildren(node, diagnostics),
      source: node.source,
    };
  }

  return {
    kind: "element",
    qtiName: node.localName,
    attributes: node.attributes,
    children: parsePortableCustomMarkupChildren(node, diagnostics),
    source: node.source,
  };
}

function parsePortableCustomInteractionModules(node: XmlNode): QtiPortableCustomInteractionModules {
  return {
    primaryConfiguration: node.attributes["primary-configuration"],
    secondaryConfiguration:
      node.attributes["secondary-configuration"] ?? node.attributes["fallback-configuration"],
    modules: childElements(node, "qti-interaction-module").map(
      parsePortableCustomInteractionModule,
    ),
    attributes: node.attributes,
    source: node.source,
  };
}

function parsePortableCustomInteractionModule(node: XmlNode): QtiPortableCustomInteractionModule {
  return {
    id: node.attributes.id,
    primaryPath: node.attributes["primary-path"],
    fallbackPath: node.attributes["fallback-path"],
    attributes: node.attributes,
    source: node.source,
  };
}

function parsePortableCustomVariableBinding(
  node: XmlNode,
  kind: QtiPortableCustomVariableBinding["kind"],
): QtiPortableCustomVariableBinding {
  return {
    kind,
    identifier: node.attributes.identifier ?? node.attributes["template-identifier"],
    variableIdentifier: node.attributes["variable-identifier"],
    attributes: node.attributes,
    source: node.source,
  };
}

function serializeXmlContent(node: XmlNode): string {
  return node.content
    .map((entry) => (typeof entry === "string" ? escapeXmlText(entry) : serializeXmlNode(entry)))
    .join("");
}

function serializeXmlNode(node: XmlNode): string {
  const attributes = Object.entries(node.attributes)
    .map(([name, value]) => ` ${name}="${escapeXmlAttribute(value)}"`)
    .join("");
  if (node.content.length === 0) return `<${node.name}${attributes}/>`;
  return `<${node.name}${attributes}>${serializeXmlContent(node)}</${node.name}>`;
}

function escapeXmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replaceAll('"', "&quot;");
}

function positionObjectInteractionObject(node: XmlNode): XmlNode | undefined {
  return childElements(node).find(
    (child) => child.localName === "object" || child.localName === "img",
  );
}

function mediaInteractionObject(node: XmlNode): XmlNode | undefined {
  return childElements(node).find(
    (child) =>
      child.localName === "audio" ||
      child.localName === "video" ||
      child.localName === "object" ||
      child.localName === "img",
  );
}

function drawingInteractionObject(node: XmlNode): XmlNode | undefined {
  return childElements(node).find(
    (child) =>
      child.localName === "object" || child.localName === "img" || child.localName === "picture",
  );
}

function positionObjectStageObject(node: XmlNode): XmlNode | undefined {
  const ancestorStage = nearestAncestor(node, "qti-position-object-stage");
  const stage = ancestorStage ?? childElements(node, "qti-position-object-stage")[0];
  if (!stage) return undefined;
  return childElements(stage).find(
    (child) => child.localName === "object" || child.localName === "img",
  );
}

function nearestAncestor(node: XmlNode, localName: string): XmlNode | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.localName === localName) return parent;
  }
  return undefined;
}

function parseHottextSegments(node: XmlNode): QtiInteraction["hottextSegments"] {
  const segments: NonNullable<QtiInteraction["hottextSegments"]> = [];

  const visit = (entry: string | XmlNode): void => {
    if (typeof entry === "string") {
      const text = entry.replace(/\s+/g, " ");
      if (text.trim().length > 0) segments.push({ kind: "text", text });
      return;
    }

    if (entry.localName === "qti-prompt") return;

    if (entry.localName === "qti-hottext") {
      segments.push({
        kind: "hottext",
        identifier: entry.attributes.identifier ?? "",
        text: textContent(entry),
        attributes: entry.attributes,
        source: entry.source,
      });
      return;
    }

    for (const child of entry.content) visit(child);
    if (entry.localName === "p" || entry.localName === "div") {
      segments.push({ kind: "text", text: " " });
    }
  };

  for (const entry of node.content) visit(entry);
  return segments;
}

function parseGapMatchSegments(node: XmlNode): QtiInteraction["gapMatchSegments"] {
  const segments: NonNullable<QtiInteraction["gapMatchSegments"]> = [];

  const visit = (entry: string | XmlNode): void => {
    if (typeof entry === "string") {
      const text = entry.replace(/\s+/g, " ");
      if (text.trim().length > 0) segments.push({ kind: "text", text });
      return;
    }

    if (entry.localName === "qti-prompt") return;
    if (entry.localName === "qti-gap-text" || entry.localName === "qti-gap-img") return;
    if (entry.localName === "object" || entry.localName === "img") return;

    if (entry.localName === "qti-gap") {
      segments.push({
        kind: "gap",
        identifier: entry.attributes.identifier ?? "",
        attributes: entry.attributes,
        source: entry.source,
      });
      return;
    }

    for (const child of entry.content) visit(child);
    if (entry.localName === "p" || entry.localName === "div") {
      segments.push({ kind: "text", text: " " });
    }
  };

  for (const entry of node.content) visit(entry);
  return segments;
}

function inlineInteractionContext(
  node: XmlNode,
  interactionType: QtiInteractionType | undefined,
): string | undefined {
  if (interactionType !== "inlineChoice" && interactionType !== "textEntry") return undefined;
  const parent = node.parent;
  if (!parent) return undefined;
  return normalizeInlineContext(parent.text) ?? normalizeInlineContext(textContent(parent));
}

function normalizeInlineContext(value: string): string | undefined {
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseObjectAsset(node: XmlNode | undefined): QtiObjectAsset | undefined {
  if (!node) return undefined;
  const pictureImage = node.localName === "picture" ? childElements(node, "img")[0] : undefined;
  const data = node.attributes.data ?? node.attributes.src ?? pictureImage?.attributes.src;
  const sources = parseMediaSources(node);
  const tracks = parseMediaTracks(node);
  const inferredSvgDimensions = inlineSvgDimensions(data);
  return {
    data,
    type:
      node.attributes.type ??
      pictureImage?.attributes.type ??
      assetTypeFromData(data) ??
      firstSourceType(sources),
    width: node.attributes.width ?? pictureImage?.attributes.width ?? inferredSvgDimensions?.width,
    height:
      node.attributes.height ?? pictureImage?.attributes.height ?? inferredSvgDimensions?.height,
    sources,
    tracks,
    text: textContent(node) || node.attributes.alt || pictureImage?.attributes.alt || "",
    attributes: node.attributes,
    source: node.source,
  };
}

function inlineSvgDimensions(
  data: string | undefined,
): { width: string; height: string } | undefined {
  const svgText = decodeInlineSvgData(data);
  if (!svgText) return undefined;
  const tree = parseXmlTree(svgText);
  const svg = tree.root;
  if (!svg || svg.localName !== "svg") return undefined;

  const width = svgLength(svg.attributes.width);
  const height = svgLength(svg.attributes.height);
  if (width !== undefined && height !== undefined) {
    return { width: formatDimension(width), height: formatDimension(height) };
  }

  const viewBox = svgViewBoxDimensions(svg.attributes.viewBox);
  if (!viewBox) return undefined;
  const inferredWidth = width ?? viewBox.width;
  const inferredHeight = height ?? viewBox.height;
  if (inferredWidth <= 0 || inferredHeight <= 0) return undefined;
  return { width: formatDimension(inferredWidth), height: formatDimension(inferredHeight) };
}

function decodeInlineSvgData(data: string | undefined): string | undefined {
  if (!data) return undefined;
  const comma = data.indexOf(",");
  if (comma < 0) return undefined;
  const metadata = data.slice(0, comma);
  if (!/^data:image\/svg\+xml(?:[;,]|$)/i.test(metadata)) return undefined;
  const payload = data.slice(comma + 1);
  if (/;base64(?:[;,]|$)/i.test(metadata)) return decodeBase64Ascii(payload);
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function decodeBase64Ascii(value: string): string | undefined {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const cleaned = value.replace(/\s+/g, "").replace(/=+$/, "");
  let bits = 0;
  let buffer = 0;
  let output = "";
  for (const char of cleaned) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) return undefined;
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits < 8) continue;
    bits -= 8;
    output += String.fromCharCode((buffer >> bits) & 0xff);
  }
  return output;
}

function svgLength(value: string | undefined): number | undefined {
  if (!value || value.trim().endsWith("%")) return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)(?:px)?$/i);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function svgViewBoxDimensions(
  value: string | undefined,
): { width: number; height: number } | undefined {
  const parts = value
    ?.trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  const width = parts[2];
  const height = parts[3];
  if (width === undefined || height === undefined || width <= 0 || height <= 0) return undefined;
  return { width, height };
}

function formatDimension(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function parseMediaSources(node: XmlNode): QtiMediaSource[] {
  return childElements(node, "source").map((source) => {
    const src = source.attributes.src ?? firstSrcsetCandidate(source.attributes.srcset);
    return {
      src,
      type: source.attributes.type ?? assetTypeFromData(src),
      attributes: source.attributes,
      source: source.source,
    };
  });
}

function parseMediaTracks(node: XmlNode): QtiObjectAsset["tracks"] {
  return childElements(node, "track").map((track) => ({
    kind: track.attributes.kind,
    src: track.attributes.src,
    srclang: track.attributes.srclang,
    label: track.attributes.label,
    default: track.attributes.default !== undefined,
    attributes: track.attributes,
    source: track.source,
  }));
}

function firstSourceType(sources: QtiMediaSource[]): string | undefined {
  const explicitType = sources.find((source) => source.type)?.type;
  if (explicitType) return explicitType;
  return sources.find((source) => source.src)?.src
    ? assetTypeFromData(sources.find((source) => source.src)?.src)
    : undefined;
}

function firstSrcsetCandidate(srcset: string | undefined): string | undefined {
  return srcset
    ?.split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .find((candidate) => candidate && candidate.length > 0);
}

function assetTypeFromData(data: string | undefined): string | undefined {
  if (!data) return undefined;
  if (data.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (data.startsWith("data:image/")) return "image/*";
  if (data.startsWith("data:audio/")) return "audio/*";
  if (data.startsWith("data:video/")) return "video/*";
  if (/\.(svg|png|jpg|jpeg|gif|webp)(?:[?#].*)?$/i.test(data)) return "image/*";
  if (/\.(aac|flac|m4a|mp3|oga|ogg|opus|wav)(?:[?#].*)?$/i.test(data)) return "audio/*";
  if (/\.(m4v|mov|mp4|ogv|webm)(?:[?#].*)?$/i.test(data)) return "video/*";
  return undefined;
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

function parseVariableValue(
  node: XmlNode | undefined,
  baseType: QtiBaseType | undefined,
): QtiValue {
  if (!node) return null;
  const valueNodes = childElements(node, "qti-value");
  const entries = valueNodes.map((valueNode) => ({
    fieldIdentifier: valueNode.attributes["field-identifier"],
    value: coerceValue(textContent(valueNode), valueNode.attributes["base-type"] ?? baseType),
  }));
  const recordEntries = entries.filter(
    (entry): entry is { fieldIdentifier: string; value: QtiScalarValue } =>
      Boolean(entry.fieldIdentifier),
  );
  if (recordEntries.length > 0) {
    return Object.fromEntries(recordEntries.map((entry) => [entry.fieldIdentifier, entry.value]));
  }
  if (entries.length === 0) {
    const text = textContent(node);
    return text.length > 0 ? coerceValue(text, baseType) : null;
  }
  if (entries.length === 1) return entries[0]?.value ?? null;
  return entries.map((entry) => entry.value);
}

function parseMapping(node: XmlNode | undefined): QtiResponseDeclaration["mapping"] | undefined {
  if (!node) return undefined;
  return {
    defaultValue: Number(node.attributes["default-value"] ?? 0),
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-map-entry").map((entry) => ({
      mapKey: entry.attributes["map-key"],
      mappedValue: Number(entry.attributes["mapped-value"] ?? 0),
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseAreaMapping(
  node: XmlNode | undefined,
): QtiResponseDeclaration["areaMapping"] | undefined {
  if (!node) return undefined;
  return {
    defaultValue: Number(node.attributes["default-value"] ?? 0),
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-area-map-entry").map((entry) => ({
      shape: parseShape(entry.attributes.shape),
      coords: parseCoords(entry.attributes.coords),
      mappedValue: Number(entry.attributes["mapped-value"] ?? 0),
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseLookupTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
): QtiLookupTable | undefined {
  const matchTable = childElements(node, "qti-match-table")[0];
  if (matchTable) return parseMatchTable(matchTable, baseType);
  const interpolationTable = childElements(node, "qti-interpolation-table")[0];
  if (interpolationTable) return parseInterpolationTable(interpolationTable, baseType);
  return undefined;
}

function parseMatchTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
): QtiLookupTable {
  return {
    type: "match",
    defaultValue: parseLookupValue(node.attributes["default-value"], baseType),
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-match-table-entry").map((entry) => ({
      sourceValue: Number(entry.attributes["source-value"]),
      targetValue: parseLookupValue(entry.attributes["target-value"], baseType),
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseInterpolationTable(
  node: XmlNode,
  baseType: QtiOutcomeDeclaration["baseType"],
): QtiLookupTable {
  return {
    type: "interpolation",
    defaultValue: parseLookupValue(node.attributes["default-value"], baseType),
    attributes: node.attributes,
    source: node.source,
    entries: childElements(node, "qti-interpolation-table-entry").map((entry) => ({
      sourceValue: Number(entry.attributes["source-value"]),
      targetValue: parseLookupValue(entry.attributes["target-value"], baseType),
      includeBoundary: entry.attributes["include-boundary"] !== "false",
      attributes: entry.attributes,
      source: entry.source,
    })),
  };
}

function parseLookupValue(value: string | undefined, baseType: string | undefined): QtiValue {
  return value === undefined ? null : coerceValue(value, baseType);
}

function parseShape(
  shape: string | undefined,
): NonNullable<QtiResponseDeclaration["areaMapping"]>["entries"][number]["shape"] {
  if (shape === "circle" || shape === "rect" || shape === "poly") return shape;
  return "default";
}

function parseCoords(value: string | undefined): number[] {
  return (value ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
}

function parseResponseProcessing(node: XmlNode | undefined): QtiResponseProcessing | undefined {
  if (!node) return undefined;
  return {
    template: node.attributes.template,
    rules: parseResponseRules(node),
    conditions: responseConditionsFromChildren(node),
  };
}

function parseTemplateProcessing(node: XmlNode | undefined): QtiTemplateProcessing | undefined {
  if (!node) return undefined;
  return {
    rules: parseTemplateRules(node),
  };
}

function parseTemplateRules(node: XmlNode): QtiTemplateRule[] {
  return childElements(node)
    .map(parseTemplateRule)
    .filter((rule): rule is QtiTemplateRule => rule !== undefined);
}

function parseTemplateRule(node: XmlNode): QtiTemplateRule | undefined {
  if (node.localName === "qti-set-template-value") {
    return {
      type: "setTemplateValue",
      identifier: node.attributes.identifier ?? "",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  if (node.localName === "qti-set-default-value") {
    return {
      type: "setDefaultValue",
      identifier: node.attributes.identifier ?? "",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  if (node.localName === "qti-set-correct-response") {
    return {
      type: "setCorrectResponse",
      identifier: node.attributes.identifier ?? "",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  if (node.localName === "qti-template-condition") {
    const templateIf = childElements(node, "qti-template-if")[0];
    const templateElse = childElements(node, "qti-template-else")[0];
    return {
      type: "templateCondition",
      ifExpression: templateIf ? parseFirstExpression(templateIf) : undefined,
      thenRules: templateIf ? parseTemplateRules(templateIf) : [],
      elseIfs: childElements(node, "qti-template-else-if").map((branch) => ({
        expression: parseFirstExpression(branch),
        rules: parseTemplateRules(branch),
      })),
      elseRules: templateElse ? parseTemplateRules(templateElse) : [],
      source: node.source,
    };
  }

  if (node.localName === "qti-exit-template") {
    return {
      type: "exitTemplate",
      source: node.source,
    };
  }

  if (node.localName === "qti-template-constraint") {
    return {
      type: "templateConstraint",
      expression: parseFirstExpression(node) ?? {
        type: "baseValue",
        value: null,
        source: node.source,
      },
      source: node.source,
    };
  }

  return undefined;
}

function responseConditionsFromChildren(node: XmlNode): QtiResponseCondition[] {
  return childElements(node).flatMap((child) => {
    if (child.localName === "qti-response-condition") return [parseResponseCondition(child)];
    if (child.localName === "qti-response-processing-fragment") {
      return responseConditionsFromChildren(child);
    }
    return [];
  });
}

function parseResponseCondition(node: XmlNode): QtiResponseCondition {
  const responseIf = childElements(node, "qti-response-if")[0];
  const responseElse = childElements(node, "qti-response-else")[0];
  return {
    ifExpression: responseIf ? parseFirstExpression(responseIf) : undefined,
    thenRules: responseIf ? parseResponseRules(responseIf) : [],
    elseIfs: childElements(node, "qti-response-else-if").map((branch) => ({
      expression: parseFirstExpression(branch),
      rules: parseResponseRules(branch),
    })),
    elseRules: responseElse ? parseResponseRules(responseElse) : [],
  };
}

function parseResponseRules(node: XmlNode): QtiResponseRule[] {
  return childElements(node)
    .map(parseResponseRule)
    .filter((rule): rule is QtiResponseRule => rule !== undefined);
}

function parseResponseRule(node: XmlNode): QtiResponseRule | undefined {
  if (node.localName === "qti-response-condition") {
    return {
      type: "responseCondition",
      condition: parseResponseCondition(node),
      source: node.source,
    };
  }
  if (node.localName === "qti-set-outcome-value") return parseSetOutcomeValue(node);
  if (node.localName === "qti-lookup-outcome-value") return parseLookupOutcomeValue(node);
  if (node.localName === "qti-exit-response") {
    return { type: "exitResponse", source: node.source };
  }
  if (node.localName === "qti-response-processing-fragment") {
    return {
      type: "responseProcessingFragment",
      rules: parseResponseRules(node),
      source: node.source,
    };
  }
  return undefined;
}

function parseLookupOutcomeValue(node: XmlNode): QtiLookupOutcomeValue {
  return {
    type: "lookupOutcomeValue",
    identifier: node.attributes.identifier ?? "",
    expression: parseFirstExpression(node) ?? {
      type: "baseValue",
      value: null,
      source: node.source,
    },
    source: node.source,
  };
}

function parseSetOutcomeValue(setNode: XmlNode): QtiSetOutcomeValue {
  return {
    type: "setOutcomeValue",
    identifier: setNode.attributes.identifier ?? "",
    expression: parseFirstExpression(setNode) ?? {
      type: "baseValue",
      value: null,
      source: setNode.source,
    },
    source: setNode.source,
  };
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
    const rawValue = textContent(node);
    return {
      type: "baseValue",
      value: coerceValue(rawValue, node.attributes["base-type"]),
      rawValue,
      baseType: node.attributes["base-type"],
      source: node.source,
    };
  }

  if (node.localName === "qti-null") {
    return { type: "null", source: node.source };
  }

  if (node.localName === "qti-is-null") {
    const variable = childElements(node, "qti-variable")[0];
    return {
      type: "isNull",
      identifier: variable?.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-map-response") {
    return {
      type: "mapResponse",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-map-response-point") {
    return {
      type: "mapResponsePoint",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-correct") {
    return {
      type: "correct",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-default") {
    return {
      type: "default",
      identifier: node.attributes.identifier ?? "",
      source: node.source,
    };
  }

  if (node.localName === "qti-variable") {
    return { type: "variable", identifier: node.attributes.identifier ?? "", source: node.source };
  }

  if (node.localName === "qti-random-integer") {
    return {
      type: "randomInteger",
      min: Number(node.attributes.min ?? 0),
      max: Number(node.attributes.max ?? 0),
      step: Number(node.attributes.step ?? 1),
      attributes: node.attributes,
      source: node.source,
    };
  }

  if (node.localName === "qti-random-float") {
    return {
      type: "randomFloat",
      min: Number(node.attributes.min ?? 0),
      max: Number(node.attributes.max ?? 0),
      attributes: node.attributes,
      source: node.source,
    };
  }

  if (node.localName === "qti-random") {
    const multiple = childElements(node, "qti-multiple")[0];
    return {
      type: "random",
      values: childElements(multiple ?? node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-multiple") {
    return {
      type: "multiple",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-ordered") {
    return {
      type: "ordered",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-index") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return { type: "index", expression, n: node.attributes.n ?? "", source: node.source };
    }
  }

  if (node.localName === "qti-container-size") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "containerSize", expression, source: node.source };
  }

  if (node.localName === "qti-sum") {
    return {
      type: "sum",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-product") {
    return {
      type: "product",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-min") {
    return {
      type: "min",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-max") {
    return {
      type: "max",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-subtract") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "subtract", left, right, source: node.source };
  }

  if (node.localName === "qti-divide") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "divide", left, right, source: node.source };
  }

  if (node.localName === "qti-power") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "power", left, right, source: node.source };
  }

  if (node.localName === "qti-integer-divide") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "integerDivide", left, right, source: node.source };
  }

  if (node.localName === "qti-integer-modulus") {
    const expressions = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const [left, right] = expressions;
    if (left && right) return { type: "integerModulus", left, right, source: node.source };
  }

  if (node.localName === "qti-round") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "round", expression, source: node.source };
  }

  if (node.localName === "qti-round-to") {
    const expression = parseFirstExpression(node);
    const roundingMode = node.attributes["rounding-mode"];
    const figures = Number(node.attributes.figures ?? 0);
    if (
      expression &&
      (roundingMode === "decimalPlaces" || roundingMode === "significantFigures") &&
      Number.isInteger(figures) &&
      (roundingMode === "decimalPlaces" ? figures >= 0 : figures > 0)
    ) {
      return { type: "roundTo", expression, roundingMode, figures, source: node.source };
    }
  }

  if (node.localName === "qti-truncate") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "truncate", expression, source: node.source };
  }

  if (node.localName === "qti-integer-to-float") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "integerToFloat", expression, source: node.source };
  }

  if (node.localName === "qti-and") {
    return {
      type: "and",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-any-n") {
    return {
      type: "anyN",
      min: node.attributes.min ?? "",
      max: node.attributes.max ?? "",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-or") {
    return {
      type: "or",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-not") {
    const expression = parseFirstExpression(node);
    if (expression) return { type: "not", expression, source: node.source };
  }

  if (node.localName === "qti-equal") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) return { type: "equal", left, right, source: node.source };
  }

  if (node.localName === "qti-equal-rounded") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    const roundingMode = node.attributes["rounding-mode"] ?? "";
    const figures = Number(node.attributes.figures ?? 0);
    if (left && right) {
      return { type: "equalRounded", left, right, roundingMode, figures, source: node.source };
    }
  }

  const numericCompareOperator = numericCompareOperatorFor(node.localName);
  if (numericCompareOperator) {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "numericCompare",
        operator: numericCompareOperator,
        left,
        right,
        source: node.source,
      };
    }
  }

  const durationCompareOperator = durationCompareOperatorFor(node.localName);
  if (durationCompareOperator) {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "durationCompare",
        operator: durationCompareOperator,
        left,
        right,
        source: node.source,
      };
    }
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
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-substring") {
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) {
      return {
        type: "substring",
        left,
        right,
        caseSensitive: node.attributes["case-sensitive"] !== "false",
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-pattern-match") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "patternMatch",
        expression,
        pattern: node.attributes.pattern ?? "",
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-field-value") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "fieldValue",
        fieldIdentifier: node.attributes["field-identifier"] ?? "",
        expression,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-member") {
    const [value, collection] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (value && collection) return { type: "member", value, collection, source: node.source };
  }

  if (node.localName === "qti-delete") {
    const [value, collection] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (value && collection) return { type: "delete", value, collection, source: node.source };
  }

  if (node.localName === "qti-contains") {
    const [collection, values] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (collection && values) return { type: "contains", collection, values, source: node.source };
  }

  if (node.localName === "qti-gcd" || node.localName === "qti-lcm") {
    return {
      type: node.localName === "qti-gcd" ? "gcd" : "lcm",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-inside") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "inside",
        expression,
        shape: parseShape(node.attributes.shape),
        coords: parseCoords(node.attributes.coords),
        attributes: node.attributes,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-math-constant") {
    return { type: "mathConstant", name: node.attributes.name ?? "", source: node.source };
  }

  if (node.localName === "qti-math-operator") {
    return {
      type: "mathOperator",
      name: node.attributes.name ?? "",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-repeat") {
    return {
      type: "repeat",
      numberRepeats: node.attributes["number-repeats"] ?? "",
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-stats-operator") {
    const expression = parseFirstExpression(node);
    if (expression) {
      return {
        type: "statsOperator",
        name: node.attributes.name ?? "",
        expression,
        source: node.source,
      };
    }
  }

  if (node.localName === "qti-custom-operator") {
    return {
      type: "customOperator",
      definition: node.attributes.definition,
      className: node.attributes.class,
      attributes: node.attributes,
      expressions: childElements(node)
        .map(parseExpression)
        .filter((expression): expression is QtiProcessingExpression => expression !== undefined),
      source: node.source,
    };
  }

  if (node.localName === "qti-match") {
    const variable = childElements(node, "qti-variable")[0];
    const correct = childElements(node, "qti-correct")[0];
    if (variable && correct) {
      return {
        type: "matchCorrect",
        identifier: variable?.attributes.identifier ?? "",
        correctIdentifier: correct?.attributes.identifier ?? "",
        source: node.source,
      };
    }
    const [left, right] = childElements(node)
      .map(parseExpression)
      .filter((expression): expression is QtiProcessingExpression => expression !== undefined);
    if (left && right) return { type: "match", left, right, source: node.source };
  }

  return undefined;
}

function numericCompareOperatorFor(localName: string): "lt" | "lte" | "gt" | "gte" | undefined {
  if (localName === "qti-lt") return "lt";
  if (localName === "qti-lte") return "lte";
  if (localName === "qti-gt") return "gt";
  if (localName === "qti-gte") return "gte";
  return undefined;
}

function durationCompareOperatorFor(localName: string): "lt" | "gte" | undefined {
  if (localName === "qti-duration-lt") return "lt";
  if (localName === "qti-duration-gte") return "gte";
  return undefined;
}

function coerceValue(value: string, baseType: string | undefined): QtiScalarValue {
  if (baseType === "integer") return Number.parseInt(value, 10);
  if (baseType === "float") return Number.parseFloat(value);
  if (baseType === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return value;
}

function parseCardinality(value: string | undefined): QtiCardinality {
  if (value === "multiple" || value === "ordered" || value === "record") return value;
  return "single";
}

function parseXmlBoolean(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

function normalizeValueForCardinality(value: QtiValue, cardinality: QtiCardinality): QtiValue {
  if (
    (cardinality === "multiple" || cardinality === "ordered") &&
    value !== null &&
    !Array.isArray(value) &&
    !isRecordValue(value)
  ) {
    return [value];
  }
  return value;
}

function isRecordValue(value: QtiValue): value is QtiRecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

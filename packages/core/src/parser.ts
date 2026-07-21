import { appendContentTextNode, flatTextFromContent } from "./content-text.js";
import {
  parseOutcomeDeclaration,
  parseResponseDeclaration,
  parseTemplateDeclaration,
} from "./parser-declarations.js";
import {
  firstChildElement,
  parseCatalogInfo,
  parseCatalogReferences,
  parseCompanionMaterialsInfo,
  parseModalFeedback,
  parseStylesheet,
} from "./parser-item-metadata.js";
import { parseXmlBoolean } from "./parser-values.js";
import { parseInteractionCustomPayload } from "./parser-custom-interactions.js";
import { parseResponseProcessing, parseTemplateProcessing } from "./parser-processing.js";
import {
  interactionNameToType,
  interactionRegistryDiagnostics,
  interactionRegistryStatus,
  processingSupport,
} from "./support.js";
import type {
  QtiAssessmentItem,
  QtiChoice,
  QtiChoiceRole,
  QtiContentNode,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiInteractionType,
  QtiMediaSource,
  QtiObjectAsset,
  QtiParseResult,
  QtiResponseDeclaration,
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

  if (tree.errors.length > 0) {
    return { ok: false, diagnostics };
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
  const catalogInfoNode = firstChildElement(
    node,
    "qti-catalog-info",
    diagnostics,
    "item.child.duplicate",
  );
  const catalogInfo = parseCatalogInfo(catalogInfoNode);
  const companionMaterials = parseCompanionMaterialsInfo(
    firstChildElement(node, "qti-companion-materials-info", diagnostics, "item.child.duplicate"),
    diagnostics,
  );
  const catalogReferences = [
    ...(itemBody ? parseCatalogReferences(itemBody, identifier) : []),
    ...(catalogInfoNode ? parseCatalogReferences(catalogInfoNode, identifier) : []),
  ];
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
    itemBodyAttributes: itemBody?.attributes,
    itemBodySource: itemBody?.source,
    responseDeclarations,
    outcomeDeclarations,
    templateDeclarations,
    templateProcessing,
    responseProcessing,
    interactions,
    modalFeedback,
    catalogInfo,
    companionMaterials,
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

function isInteractionElement(node: XmlNode): boolean {
  return interactionNameToType.has(node.localName) || /^qti-.+-interaction$/.test(node.localName);
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
      appendContentTextNode(content, entry, node.source);
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
  const registryStatus = interactionRegistryStatus(node.localName);
  diagnostics.push(...interactionRegistryDiagnostics(node.localName, node.source));

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

  const promptContent = prompt
    ? parseContentChildren(prompt, diagnostics, responseDeclarationMap, [])
    : undefined;

  return {
    type: interactionType ?? "custom",
    registryStatus,
    qtiName: node.localName,
    responseIdentifier,
    responseCardinality: responseDeclaration?.cardinality,
    responseBaseType: responseDeclaration?.baseType,
    prompt: promptContent
      ? flatTextFromContent(promptContent, { excludeAnnotations: true }) || undefined
      : prompt
        ? textContent(prompt)
        : undefined,
    promptContent: promptContent && promptContent.length > 0 ? promptContent : undefined,
    promptAttributes: prompt?.attributes,
    promptSource: prompt?.source,
    contextText: inlineInteractionContext(node, interactionType),
    object: parseObjectAsset(objectNode),
    positionObjectStage:
      interactionType === "positionObject"
        ? parseObjectAsset(positionObjectStageObject(node))
        : undefined,
    ...parseInteractionCustomPayload(node, interactionType, diagnostics, isInteractionElement),
    choices: parseChoices(node, diagnostics, responseDeclarationMap),
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

function parseChoices(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  responseDeclarationMap: Map<string, QtiResponseDeclaration>,
): QtiChoice[] {
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
    const asset = parseChoiceAsset(choice);
    const content = parseContentChildren(choice, diagnostics, responseDeclarationMap, []);
    const flatChoiceText =
      content.length > 0
        ? flatTextFromContent(content, { excludeAnnotations: true })
        : textContent(choice);
    return {
      identifier,
      text:
        flatChoiceText ||
        choice.attributes["object-label"] ||
        asset?.text ||
        identifier ||
        `Choice ${index + 1}`,
      content: content.length > 0 ? content : undefined,
      asset,
      role: choiceRole(choice),
      qtiName: choice.localName,
      attributes: choice.attributes,
      source: choice.source,
    };
  });
}

function parseChoiceAsset(choice: XmlNode): QtiObjectAsset | undefined {
  if (choice.localName !== "qti-gap-img") return undefined;
  const assetNode = childElements(choice).find(
    (child) =>
      child.localName === "img" || child.localName === "object" || child.localName === "picture",
  );
  return parseObjectAsset(assetNode);
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

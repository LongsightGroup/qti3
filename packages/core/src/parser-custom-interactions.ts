import { appendContentTextNode } from "./content-text.js";
import { firstChildElement, parseCatalogInfo, parseStylesheet } from "./parser-item-metadata.js";
import type {
  QtiContentNode,
  QtiCustomInteractionDefinition,
  QtiDiagnostic,
  QtiInteractionMarkupDefinition,
  QtiInteractionType,
  QtiPortableCustomDefinition,
  QtiPortableCustomInteractionModule,
  QtiPortableCustomInteractionModules,
  QtiPortableCustomVariableBinding,
} from "./types.js";
import { childElements, type XmlNode } from "./xml.js";

export type QtiInteractionElementPredicate = (node: XmlNode) => boolean;

type CustomMarkupParseOptions = {
  nestedInteractionCode: string;
  contextName: string;
  skipChild?: (node: XmlNode) => boolean;
};

type SerializeXmlContentOptions = {
  excludeLocalNames?: readonly string[];
};

const LEGACY_CUSTOM_PROMPT_LOCAL_NAME = "qti-prompt";
const legacyCustomSerializeOptions: SerializeXmlContentOptions = {
  excludeLocalNames: [LEGACY_CUSTOM_PROMPT_LOCAL_NAME],
};

const legacyCustomMarkupOptions: CustomMarkupParseOptions = {
  nestedInteractionCode: "interaction.custom.markupInteraction",
  contextName: "qti-custom-interaction markup",
  skipChild: (child) => child.localName === LEGACY_CUSTOM_PROMPT_LOCAL_NAME,
};

const portableCustomMarkupOptions: CustomMarkupParseOptions = {
  nestedInteractionCode: "interaction.portableCustom.markupInteraction",
  contextName: "qti-interaction-markup",
};

export function parseInteractionCustomPayload(
  node: XmlNode,
  interactionType: QtiInteractionType | undefined,
  diagnostics: QtiDiagnostic[],
  isInteractionElement: QtiInteractionElementPredicate,
): {
  customInteraction?: QtiCustomInteractionDefinition;
  portableCustom?: QtiPortableCustomDefinition;
} {
  if (node.localName === "qti-custom-interaction") {
    return {
      customInteraction: parseCustomInteractionDefinition(node, diagnostics, isInteractionElement),
    };
  }
  if (interactionType === "portableCustom") {
    return {
      portableCustom: parsePortableCustomDefinition(node, diagnostics, isInteractionElement),
    };
  }
  return {};
}

function parseCustomInteractionDefinition(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  isInteractionElement: QtiInteractionElementPredicate,
): QtiCustomInteractionDefinition {
  return parseInteractionMarkupDefinition(
    node,
    diagnostics,
    isInteractionElement,
    legacyCustomMarkupOptions,
    legacyCustomSerializeOptions,
  );
}

function parsePortableCustomDefinition(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  isInteractionElement: QtiInteractionElementPredicate,
): QtiPortableCustomDefinition {
  const markup = firstChildElement(
    node,
    "qti-interaction-markup",
    diagnostics,
    "interaction.portableCustom.child.duplicate",
  );
  const modules = firstChildElement(
    node,
    "qti-interaction-modules",
    diagnostics,
    "interaction.portableCustom.child.duplicate",
  );
  return {
    ...parseInteractionMarkupShell(
      markup,
      node,
      diagnostics,
      isInteractionElement,
      portableCustomMarkupOptions,
    ),
    customInteractionTypeIdentifier: node.attributes["custom-interaction-type-identifier"],
    module: node.attributes.module,
    interactionModules: modules ? parsePortableCustomInteractionModules(modules) : undefined,
    templateVariables: childElements(node, "qti-template-variable").map((variable) =>
      parsePortableCustomVariableBinding(variable, "template"),
    ),
    contextVariables: childElements(node, "qti-context-variable").map((variable) =>
      parsePortableCustomVariableBinding(variable, "context"),
    ),
    stylesheets: childElements(node, "qti-stylesheet").map(parseStylesheet),
    catalogInfo: parseCatalogInfo(
      firstChildElement(
        node,
        "qti-catalog-info",
        diagnostics,
        "interaction.portableCustom.child.duplicate",
      ),
    ),
  };
}

function parseInteractionMarkupDefinition(
  markupNode: XmlNode,
  diagnostics: QtiDiagnostic[],
  isInteractionElement: QtiInteractionElementPredicate,
  markupOptions: CustomMarkupParseOptions,
  serializeOptions?: SerializeXmlContentOptions,
): QtiInteractionMarkupDefinition {
  const interactionMarkup = parseCustomMarkupChildren(
    markupNode,
    diagnostics,
    isInteractionElement,
    markupOptions,
  );
  const interactionMarkupRaw = serializeXmlContentOrUndefined(markupNode, serializeOptions);
  return {
    responseIdentifier: markupNode.attributes["response-identifier"],
    interactionMarkup,
    interactionMarkupRaw,
    dataAttributes: parseInteractionDataAttributes(markupNode),
    attributes: markupNode.attributes,
    source: markupNode.source,
  };
}

function parseInteractionMarkupShell(
  markupNode: XmlNode | undefined,
  attributeNode: XmlNode,
  diagnostics: QtiDiagnostic[],
  isInteractionElement: QtiInteractionElementPredicate,
  markupOptions: CustomMarkupParseOptions,
): QtiInteractionMarkupDefinition {
  if (!markupNode) {
    return {
      responseIdentifier: attributeNode.attributes["response-identifier"],
      interactionMarkup: [],
      dataAttributes: parseInteractionDataAttributes(attributeNode),
      attributes: attributeNode.attributes,
      source: attributeNode.source,
    };
  }
  return {
    ...parseInteractionMarkupDefinition(
      markupNode,
      diagnostics,
      isInteractionElement,
      markupOptions,
    ),
    responseIdentifier: attributeNode.attributes["response-identifier"],
    dataAttributes: parseInteractionDataAttributes(attributeNode),
    attributes: attributeNode.attributes,
    source: attributeNode.source,
  };
}

function parseInteractionDataAttributes(node: XmlNode): Record<string, string> {
  return Object.fromEntries(
    Object.entries(node.attributes).filter(([name]) => name.startsWith("data-")),
  );
}

function parseCustomMarkupChildren(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  isInteractionElement: QtiInteractionElementPredicate,
  options: CustomMarkupParseOptions,
): QtiContentNode[] {
  const content: QtiContentNode[] = [];
  for (const entry of node.content) {
    if (typeof entry === "string") {
      appendContentTextNode(content, entry, node.source);
      continue;
    }
    if (options.skipChild?.(entry)) continue;
    content.push(parseCustomMarkupNode(entry, diagnostics, isInteractionElement, options));
  }
  return content;
}

function parseCustomMarkupNode(
  node: XmlNode,
  diagnostics: QtiDiagnostic[],
  isInteractionElement: QtiInteractionElementPredicate,
  options: CustomMarkupParseOptions,
): QtiContentNode {
  if (isInteractionElement(node)) {
    diagnostics.push({
      code: options.nestedInteractionCode,
      severity: "error",
      message: `${options.contextName} must not contain nested QTI interaction ${node.localName}.`,
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
      children: parseCustomMarkupChildren(node, diagnostics, isInteractionElement, options),
      source: node.source,
    };
  }

  return {
    kind: "element",
    qtiName: node.localName,
    attributes: node.attributes,
    children: parseCustomMarkupChildren(node, diagnostics, isInteractionElement, options),
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

function serializeXmlContentOrUndefined(
  node: XmlNode,
  options?: SerializeXmlContentOptions,
): string | undefined {
  const content = serializeXmlContent(node, options);
  return content.trim().length > 0 ? content : undefined;
}

function serializeXmlContent(node: XmlNode, options?: SerializeXmlContentOptions): string {
  const exclude = options?.excludeLocalNames ? new Set(options.excludeLocalNames) : undefined;
  return node.content
    .filter((entry) => typeof entry === "string" || !exclude?.has(entry.localName))
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

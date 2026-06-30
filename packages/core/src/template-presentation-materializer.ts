import {
  applySourceRangeEdits,
  parseDeliveryXml,
  sourceRangeFor,
  type SourceRangeEdit,
} from "./delivery-redaction.js";
import type { QtiDiagnostic, QtiValue } from "./types.js";
import { qtiValueToString } from "./value-format.js";
import { descendants, escapeXmlText, type XmlNode } from "./xml.js";

interface TemplateBlockBinding {
  readonly templateIdentifier: string;
  readonly identifier: string;
  readonly value: QtiValue;
}

export interface QtiTemplatePresentationVariables {
  readonly outcomes: Record<string, QtiValue>;
  readonly templateValues: Record<string, QtiValue>;
  readonly responses?: Record<string, QtiValue> | undefined;
}

export function materializeTemplatePresentation(
  xml: string,
  variables: QtiTemplatePresentationVariables,
): { ok: true; xml: string } | { ok: false; diagnostics: QtiDiagnostic[] } {
  const parsed = parseDeliveryXml(xml);
  if (!parsed.root) return { ok: true, xml };

  const diagnostics: QtiDiagnostic[] = [];
  const edits: SourceRangeEdit[] = [];
  const nodes = [parsed.root, ...descendants(parsed.root, () => true)];

  for (const node of nodes) {
    if (isInsideTemplateContentNode(node)) continue;

    if (node.localName === "qti-printed-variable") {
      const edit = printedVariableEdit(node, variables, diagnostics);
      if (edit) edits.push(edit);
      continue;
    }

    if (node.localName === "qti-template-block" || node.localName === "qti-template-inline") {
      const edit = templateContentEdit(xml, node, variables, diagnostics);
      if (edit) edits.push(edit);
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }

  return { ok: true, xml: applySourceRangeEdits(xml, edits) };
}

function printedVariableEdit(
  node: XmlNode,
  variables: QtiTemplatePresentationVariables,
  diagnostics: QtiDiagnostic[],
): SourceRangeEdit | undefined {
  const text = resolvePrintedVariableText(node, variables, diagnostics);
  if (text === undefined) return undefined;

  const range = sourceRangeFor(node)[0];
  if (!range) {
    diagnostics.push(unsupportedTemplateMaterializationDiagnostic(node));
    return undefined;
  }

  return { ...range, text };
}

function templateContentEdit(
  xml: string,
  node: XmlNode,
  variables: QtiTemplatePresentationVariables,
  diagnostics: QtiDiagnostic[],
): SourceRangeEdit | undefined {
  const binding = resolveTemplateBlockBinding(node, variables.templateValues, diagnostics);
  if (!binding) return undefined;

  const range = sourceRangeFor(node)[0];
  if (!range) {
    diagnostics.push(unsupportedTemplateMaterializationDiagnostic(node));
    return undefined;
  }

  return {
    ...range,
    text: isTemplateContentVisible(node, binding.value)
      ? materializedContentXml(xml, node, variables, diagnostics)
      : "",
  };
}

function resolvePrintedVariableText(
  node: XmlNode,
  variables: QtiTemplatePresentationVariables,
  diagnostics: QtiDiagnostic[],
): string | undefined {
  const identifier = node.attributes.identifier;
  if (!identifier) {
    diagnostics.push(unsupportedTemplateMaterializationDiagnostic(node));
    return undefined;
  }

  const value = resolvePresentationVariable(identifier, variables);
  if (value === undefined) {
    diagnostics.push(unsupportedTemplateMaterializationDiagnostic(node));
    return undefined;
  }

  return escapeXmlText(qtiValueToString(value));
}

function resolvePresentationVariable(
  identifier: string,
  variables: QtiTemplatePresentationVariables,
): QtiValue | undefined {
  return (
    variables.outcomes[identifier] ??
    variables.templateValues[identifier] ??
    variables.responses?.[identifier]
  );
}

function resolveTemplateBlockBinding(
  node: XmlNode,
  templateValues: Record<string, QtiValue>,
  diagnostics: QtiDiagnostic[],
): TemplateBlockBinding | undefined {
  const templateIdentifier = node.attributes["template-identifier"];
  const identifier = node.attributes.identifier;
  if (!templateIdentifier || !identifier || templateValues[templateIdentifier] === undefined) {
    diagnostics.push(unsupportedTemplateMaterializationDiagnostic(node));
    return undefined;
  }

  return { templateIdentifier, identifier, value: templateValues[templateIdentifier] };
}

function materializedContentXml(
  xml: string,
  node: XmlNode,
  variables: QtiTemplatePresentationVariables,
  diagnostics: QtiDiagnostic[],
): string {
  return node.content
    .map((child) => {
      if (typeof child === "string") return escapeXmlText(child);
      if (child.localName === "qti-printed-variable") {
        return resolvePrintedVariableText(child, variables, diagnostics) ?? "";
      }
      if (child.localName === "qti-template-block" || child.localName === "qti-template-inline") {
        return materializedNestedTemplateContentXml(xml, child, variables, diagnostics);
      }
      return materializedElementXml(xml, child, variables, diagnostics);
    })
    .join("");
}

function materializedNestedTemplateContentXml(
  xml: string,
  node: XmlNode,
  variables: QtiTemplatePresentationVariables,
  diagnostics: QtiDiagnostic[],
): string {
  const binding = resolveTemplateBlockBinding(node, variables.templateValues, diagnostics);
  if (!binding) return "";

  return isTemplateContentVisible(node, binding.value)
    ? materializedContentXml(xml, node, variables, diagnostics)
    : "";
}

function isTemplateContentVisible(node: XmlNode, value: QtiValue): boolean {
  const identifier = node.attributes.identifier;
  const hasIdentifier = Array.isArray(value)
    ? value.map(String).includes(identifier ?? "")
    : qtiValueToString(value) === identifier;
  return node.attributes["show-hide"] === "hide" ? !hasIdentifier : hasIdentifier;
}

function materializedElementXml(
  xml: string,
  node: XmlNode,
  variables: QtiTemplatePresentationVariables,
  diagnostics: QtiDiagnostic[],
): string {
  if (node.sourceRange.endOffset === undefined || node.endSource === undefined) {
    diagnostics.push(unsupportedTemplateMaterializationDiagnostic(node));
    return "";
  }

  const startTag = xml.slice(node.sourceRange.startOffset, node.sourceRange.startTagEndOffset + 1);
  const endTag = xml.slice(node.endSource.offset, node.sourceRange.endOffset);
  return `${startTag}${materializedContentXml(xml, node, variables, diagnostics)}${endTag}`;
}

function isInsideTemplateContentNode(node: XmlNode): boolean {
  let parent = node.parent;
  while (parent) {
    if (parent.localName === "qti-template-block" || parent.localName === "qti-template-inline") {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function unsupportedTemplateMaterializationDiagnostic(node: XmlNode): QtiDiagnostic {
  return {
    code: "adaptiveTurn.materialization.unsupported",
    severity: "error",
    message: `${node.name} could not be materialized from authoritative template state.`,
    path: node.source.path,
    source: node.source,
  };
}

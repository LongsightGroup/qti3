import type { QtiInteractionType, QtiSharedVocabularyState } from "@longsightgroup/qti3-core";

import { sharedVocabularyXmlAttributes } from "./shared-vocabulary.js";
import type { Qti3TrustedXmlFragment } from "./types.js";
import { xmlAttributeList } from "./xml.js";

export const DEFAULT_RESPONSE_IDENTIFIER = "RESPONSE";

export function resolveResponseIdentifier(responseIdentifier?: string): string {
  return responseIdentifier?.trim() || DEFAULT_RESPONSE_IDENTIFIER;
}

export function optionalBodySection(bodyHtml?: Qti3TrustedXmlFragment): string {
  return bodyHtml?.trim() ? `    ${bodyHtml}\n` : "";
}

export function optionalPromptSection(promptHtml?: Qti3TrustedXmlFragment): string {
  return promptHtml?.trim() ? `      <qti-prompt>${promptHtml}</qti-prompt>\n` : "";
}

export function booleanAttribute(name: string, value: boolean): string {
  return `${name}="${value ? "true" : "false"}"`;
}

export function optionalBooleanAttribute(name: string, value: boolean | undefined): string {
  return value === undefined ? "" : booleanAttribute(name, value);
}

export interface InteractionShellInput {
  readonly sharedVocabulary?: QtiSharedVocabularyState | undefined;
  readonly interactionType: QtiInteractionType;
  readonly classNames?: readonly string[] | undefined;
  readonly responseIdentifier: string;
  readonly extraAttributes?: readonly string[];
}

export function interactionAttributeList(input: InteractionShellInput): string {
  return xmlAttributeList([
    `response-identifier="${input.responseIdentifier}"`,
    sharedVocabularyXmlAttributes(
      input.sharedVocabulary,
      input.interactionType,
      input.classNames ?? [],
    ).trim(),
    ...(input.extraAttributes ?? []),
  ]);
}

export function wrapInteractionBody(
  interactionTag: string,
  attributeList: string,
  promptSection: string,
  innerXml: string,
  bodySection = "",
): string {
  return `${bodySection}    <${interactionTag} ${attributeList}>
${promptSection}${innerXml}
    </${interactionTag}>`;
}

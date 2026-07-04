import { assertQtiIdentifier } from "./identifier.js";
import { isNonNegativeInteger, validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import type { Qti3TrustedXmlFragment, Qti3WriterDiagnostic } from "./types.js";
import { xmlEscape } from "./xml.js";

export interface Qti3AssociableChoiceLike {
  readonly identifier: string;
  readonly text?: string | undefined;
  readonly contentHtml?: Qti3TrustedXmlFragment | undefined;
  readonly matchMax?: number | undefined;
  readonly fixed?: boolean | undefined;
}

export interface AssociableChoiceRenderOptions {
  readonly identifierLabel: string;
  readonly indent?: string | undefined;
}

export interface AssociableChoiceValidationOptions {
  readonly identifierLabel: string;
  readonly emptyCode: string;
  readonly matchMaxCode: string;
  readonly requireContent: boolean;
}

export function associableChoiceXml(
  choice: Qti3AssociableChoiceLike,
  options: AssociableChoiceRenderOptions,
): string {
  const identifier = xmlEscape(assertQtiIdentifier(choice.identifier, options.identifierLabel));
  const matchMax = choice.matchMax ?? 1;
  const fixedAttr = choice.fixed ? ' fixed="true"' : "";
  const body = choice.contentHtml?.trim() ? choice.contentHtml : xmlEscape(choice.text ?? "");
  return `${options.indent ?? ""}<qti-simple-associable-choice identifier="${identifier}" match-max="${String(matchMax)}"${fixedAttr}>${body}</qti-simple-associable-choice>`;
}

export function validateAssociableChoice(
  choice: Qti3AssociableChoiceLike,
  path: string,
  diagnostics: Qti3WriterDiagnostic[],
  options: AssociableChoiceValidationOptions,
): void {
  const identifierDiagnostic = validateQtiIdentifier(
    `${path}.identifier`,
    options.identifierLabel,
    choice.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (options.requireContent && !choice.contentHtml?.trim() && !(choice.text ?? "").trim()) {
    diagnostics.push(
      writerDiagnostic(
        options.emptyCode,
        path,
        `${options.identifierLabel} "${choice.identifier}" must include text or contentHtml.`,
        choice.identifier,
      ),
    );
  }
  if (choice.matchMax !== undefined && !isNonNegativeInteger(choice.matchMax)) {
    diagnostics.push(
      writerDiagnostic(
        options.matchMaxCode,
        `${path}.matchMax`,
        `${options.identifierLabel} matchMax must be a non-negative integer.`,
        choice.matchMax,
      ),
    );
  }
}

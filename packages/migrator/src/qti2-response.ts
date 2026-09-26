import { diagnostic } from "./diagnostics.js";
import type { Qti2Context } from "./qti2-context.js";
import { normalizeIdentifier } from "./text.js";
import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  textOf,
  type XmlElement,
} from "./xml.js";

export function responseValues(declaration: XmlElement | undefined): string[] {
  if (!declaration) return [];
  const correct = findDescendantByLocalName(declaration, "correctresponse");
  return findAllDescendantsByLocalName(correct, "value")
    .map((value) =>
      attr(declaration, "baseType") === "string" ? (value.textContent ?? "") : textOf(value),
    )
    .filter(Boolean);
}

export function pairValues(
  declaration: XmlElement | undefined,
): { sourceIdentifier: string; targetIdentifier: string }[] {
  return responseValues(declaration)
    .map((value) => {
      const [sourceIdentifier = "", targetIdentifier = ""] = value.split(/\s+/);
      return {
        sourceIdentifier: normalizeIdentifier(sourceIdentifier),
        targetIdentifier: normalizeIdentifier(targetIdentifier),
      };
    })
    .filter((pair) => pair.sourceIdentifier && pair.targetIdentifier);
}

export function orderedIdentifierValues(declaration: XmlElement | undefined): string[] {
  return responseValues(declaration)
    .flatMap((value) => value.split(/\s+/))
    .map((value) => normalizeIdentifier(value))
    .filter(Boolean);
}

export function hasMapping(declaration: XmlElement | undefined): boolean {
  return Boolean(findDescendantByLocalName(declaration, "mapping"));
}

/** Writer models that require a key must not invent one, even under safe repair. */
export function requireAnswerKey(context: Qti2Context, values: readonly string[]): boolean {
  if (values.length) return true;
  (context.blocked ??= []).push(
    diagnostic(
      "qti2_correct_response_not_preserved",
      "error",
      "The source has no usable correct response, but this authoring model requires one.",
      { path: context.path, sourceFormat: context.sourceFormat },
    ),
  );
  return false;
}

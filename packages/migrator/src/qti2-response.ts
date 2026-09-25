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

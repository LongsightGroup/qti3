import { diagnostic } from "./diagnostics.js";
import type { Qti2Context } from "./qti2-context.js";
import {
  qti3TrustedXmlFragment,
  type Qti3AssociateChoice,
  type Qti3AuthoringChoice,
  type Qti3GapMatchChoice,
  type Qti3GraphicGapChoice,
  type Qti3MatchChoice,
} from "@longsightgroup/qti3-writer";
import { normalizeIdentifier } from "./text.js";
import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  localName,
  serializeChildren,
  textOf,
  toNumber,
  type XmlElement,
} from "./xml.js";

export function simpleChoices(root: XmlElement): Qti3AuthoringChoice[] {
  return findAllDescendantsByLocalName(root, "simplechoice").map((choice, index) => ({
    identifier: normalizeIdentifier(attr(choice, "identifier"), `CHOICE_${index + 1}`),
    contentHtml: trusted(serializeChildren(choice)),
    text: textOf(choice) || undefined,
    fixed: attr(choice, "fixed") === "true",
  }));
}

export function associableChoices(
  root: XmlElement | undefined,
  prefix: string,
): (Qti3MatchChoice | Qti3AssociateChoice)[] {
  if (!root) return [];
  return findAllDescendantsByLocalName(root, "simpleassociablechoice").map((choice, index) => ({
    identifier: normalizeIdentifier(attr(choice, "identifier"), `${prefix}_${index + 1}`),
    contentHtml: trusted(serializeChildren(choice)),
    text: textOf(choice) || undefined,
    fixed: attr(choice, "fixed") === "true",
    matchMax: toNumber(attr(choice, "matchMax")),
  }));
}

export function gapChoice(
  choice: XmlElement,
  index: number,
  context: Qti2Context,
): Qti3GapMatchChoice {
  rejectGapFixed(choice, context);
  if (localName(choice) === "gapimg") {
    const object = findDescendantByLocalName(choice, "object");
    return {
      identifier: normalizeIdentifier(attr(choice, "identifier"), `G${index + 1}`),
      kind: "image",
      object: {
        data: attr(object, "data") ?? "",
        alt: attr(object, "alt") ?? attr(object, "label") ?? "Image",
        type: attr(object, "type") ?? undefined,
      },
      matchMax: toNumber(attr(choice, "matchMax")),
    };
  }
  return {
    identifier: normalizeIdentifier(attr(choice, "identifier"), `G${index + 1}`),
    kind: "text",
    contentHtml: trusted(serializeChildren(choice)),
    text: textOf(choice) || undefined,
    matchMax: toNumber(attr(choice, "matchMax")),
  };
}

export function graphicGapChoice(
  choice: XmlElement,
  index: number,
  context: Qti2Context,
): Qti3GraphicGapChoice {
  rejectGapFixed(choice, context);
  if (localName(choice) === "gapimg") {
    const object = findDescendantByLocalName(choice, "object");
    return {
      identifier: normalizeIdentifier(attr(choice, "identifier"), `G${index + 1}`),
      kind: "image",
      object: {
        data: attr(object, "data") ?? "",
        alt: attr(object, "alt") ?? attr(object, "label") ?? "Image",
        type: attr(object, "type") ?? undefined,
      },
      matchMax: toNumber(attr(choice, "matchMax")),
    };
  }
  return {
    identifier: normalizeIdentifier(attr(choice, "identifier"), `G${index + 1}`),
    kind: "text",
    contentHtml: trusted(serializeChildren(choice)),
    text: textOf(choice) || undefined,
    matchMax: toNumber(attr(choice, "matchMax")),
  };
}

function trusted(html: string): ReturnType<typeof qti3TrustedXmlFragment> {
  return qti3TrustedXmlFragment(html.trim() || "<p></p>");
}

function rejectGapFixed(choice: XmlElement, context: Qti2Context): void {
  if (attr(choice, "fixed") === null) return;
  context.blocked = [
    ...(context.blocked ?? []),
    diagnostic(
      "qti2_gap_fixed_unsupported",
      "error",
      "QTI 3 gap choices do not define fixed; migration cannot preserve this attribute.",
      { path: context.path, sourceFormat: context.sourceFormat },
    ),
  ];
}

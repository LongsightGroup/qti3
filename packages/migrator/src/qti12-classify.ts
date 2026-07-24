import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { diagnostic } from "./diagnostics.js";
import { normalizeIdentifier } from "./text.js";
import type { QtiMigrationDiagnostic } from "./types.js";
import {
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  textOf,
  type XmlElement,
} from "./xml.js";

export type Qti12ItemClassification =
  | { readonly kind: "essay" }
  | { readonly kind: "hotspot"; readonly hotspotResponse: XmlElement }
  | { readonly kind: "associate"; readonly associateResponse: XmlElement }
  | { readonly kind: "canvasMatch"; readonly choiceResponses: readonly XmlElement[] }
  | { readonly kind: "choice"; readonly choiceResponse: XmlElement }
  | { readonly kind: "textEntry"; readonly fibResponse: XmlElement }
  | { readonly kind: "upload" }
  | { readonly kind: "unsupported" };

const SCORABLE_RESPONSE_NAMES = [
  "response_lid",
  "response_str",
  "response_num",
  "response_grp",
  "response_xy",
] as const;

export function classifyQti12Item(item: XmlElement): Qti12ItemClassification {
  const responseLids = findAllDescendantsByLocalName(item, "response_lid");
  const responseStrs = findAllDescendantsByLocalName(item, "response_str");
  const responseNums = findAllDescendantsByLocalName(item, "response_num");
  const responseGrps = findAllDescendantsByLocalName(item, "response_grp");
  const responseXys = findAllDescendantsByLocalName(item, "response_xy");
  const canvasQuestionType = qti12MetadataField(item, "question_type");
  const sakaiItemType = qti12MetadataField(item, "qmd_itemtype")?.toLowerCase();

  if (sakaiItemType === "essay") return { kind: "essay" };

  const hotspotResponse = [...responseLids, ...responseXys].find((response) =>
    findDescendantByLocalName(response, "render_hotspot"),
  );
  if (hotspotResponse) return { kind: "hotspot", hotspotResponse };

  const groupedChoice = responseGrps.find((response) =>
    findDescendantByLocalName(response, "render_choice"),
  );
  if (groupedChoice) return { kind: "associate", associateResponse: groupedChoice };

  const choiceResponses = responseLids.filter((response) =>
    findDescendantByLocalName(response, "render_choice"),
  );
  if (choiceResponses.length > 1) {
    return { kind: "canvasMatch", choiceResponses };
  }
  if (choiceResponses[0]) return { kind: "choice", choiceResponse: choiceResponses[0] };

  const fibResponse = [...responseLids, ...responseStrs, ...responseNums].find((response) =>
    findDescendantByLocalName(response, "render_fib"),
  );
  if (fibResponse) return { kind: "textEntry", fibResponse };

  if (canvasQuestionType === "file_upload_question") return { kind: "upload" };

  if (!hasScorableResponse(item) && findDescendantByLocalName(item, "presentation")) {
    return { kind: "essay" };
  }

  return { kind: "unsupported" };
}

function hasScorableResponse(item: XmlElement): boolean {
  return SCORABLE_RESPONSE_NAMES.some(
    (name) => findAllDescendantsByLocalName(item, name).length > 0,
  );
}

export function qti12MetadataField(item: XmlElement, label: string): string | undefined {
  const fields = findAllDescendantsByLocalName(item, "qtimetadatafield");
  const field = fields.find(
    (candidate) => textOf(findDescendantByLocalName(candidate, "fieldlabel")).trim() === label,
  );
  const entry = field ? findDescendantByLocalName(field, "fieldentry") : null;
  return entry ? textOf(entry).trim() : undefined;
}

export function qti12ResponseIdentifiers(sourceResponseIdentifier: string): {
  readonly source: string;
  readonly target: "RESPONSE";
} {
  return {
    source: normalizeIdentifier(sourceResponseIdentifier, "RESPONSE"),
    target: "RESPONSE",
  };
}

export function directTextOf(element: XmlElement): string {
  const values: string[] = [];
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (child.nodeType === 3 || child.nodeType === 4) {
      values.push(child.textContent ?? "");
    }
  }
  return values.join("").trim();
}

export function qti12AreaToShape(value: string | null): "circle" | "rect" | "poly" {
  const normalized = value?.toLowerCase();
  if (normalized === "ellipse") return "circle";
  if (normalized === "bounded") return "poly";
  return "rect";
}

export function inferImageDimensions(coords: readonly string[]): { width: number; height: number } {
  let maxX = 1;
  let maxY = 1;
  for (const entry of coords) {
    const values = entry
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    for (let index = 0; index < values.length; index += 2) {
      maxX = Math.max(maxX, values[index] ?? 1);
      maxY = Math.max(maxY, values[index + 1] ?? 1);
    }
  }
  return { width: Math.ceil(maxX), height: Math.ceil(maxY) };
}

export function unsupportedQti12Item(path: string): {
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  return {
    diagnostics: [
      diagnostic("qti12_interaction_unsupported", "error", "Unsupported QTI 1.2 interaction.", {
        path,
        sourceFormat: "qti12",
      }),
    ],
  };
}

export function uploadAuthoringItem(
  identifier: string,
  title: string,
  bodyHtml: Qti3AuthoringItem["bodyHtml"],
): Qti3AuthoringItem {
  return {
    interactionType: "upload",
    identifier,
    title,
    bodyHtml,
    responseIdentifier: "RESPONSE",
  };
}

export function essayAuthoringItem(
  identifier: string,
  title: string,
  bodyHtml: Qti3AuthoringItem["bodyHtml"],
): Qti3AuthoringItem {
  return {
    interactionType: "extendedText",
    identifier,
    title,
    bodyHtml,
    responseIdentifier: "RESPONSE",
    responseBaseType: "string",
    responseCardinality: "single",
    expectedLines: 8,
  };
}

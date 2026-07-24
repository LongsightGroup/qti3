import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { assertNever } from "@longsightgroup/qti3-core";

import { correctEntries, presentationBodyHtml } from "./qti12-body.js";
import {
  classifyQti12Item,
  essayAuthoringItem,
  unsupportedQti12Item,
  uploadAuthoringItem,
} from "./qti12-classify.js";
import {
  mapQti12Associate,
  mapQti12CanvasMatch,
  mapQti12Choice,
  mapQti12Hotspot,
  mapQti12TextEntry,
} from "./qti12-mappers.js";
import { diagnostic } from "./diagnostics.js";
import { normalizeIdentifier } from "./text.js";
import type { QtiMigrationDiagnostic, ResolvedQtiMigrationOptions } from "./types.js";
import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  localName,
  parseXml,
  type XmlElement,
} from "./xml.js";

export function migrateQti12Xml(
  xml: string,
  path: string,
  options: ResolvedQtiMigrationOptions,
): readonly {
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
}[] {
  const doc = parseXml(xml, path);
  const root = doc.documentElement;
  const itemElements =
    localName(root) === "item" ? [root] : findAllDescendantsByLocalName(root, "item");
  if (!itemElements.length) {
    return [
      {
        diagnostics: [
          diagnostic("qti12_item_missing", "error", "No QTI 1.2 item elements found.", {
            path,
            sourceFormat: "qti12",
          }),
        ],
      },
    ];
  }
  return itemElements.map((item, index) => migrateQti12ItemElement(item, index, path, options));
}

function migrateQti12ItemElement(
  item: XmlElement,
  index: number,
  path: string,
  options: ResolvedQtiMigrationOptions,
): {
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const identifier = normalizeIdentifier(attr(item, "ident"), `ITEM_${index + 1}`);
  const title = attr(item, "title")?.trim() || `Item ${index + 1}`;
  const presentation = findDescendantByLocalName(item, "presentation");
  const bodyHtml = presentationBodyHtml(presentation);
  const correct = correctEntries(item);
  const classification = classifyQti12Item(item);

  switch (classification.kind) {
    case "essay":
      return { authoringItem: essayAuthoringItem(identifier, title, bodyHtml), diagnostics: [] };
    case "hotspot":
      return mapQti12Hotspot(
        identifier,
        title,
        classification.hotspotResponse,
        presentation,
        bodyHtml,
        correct,
        options,
        path,
      );
    case "associate":
      return mapQti12Associate(
        identifier,
        title,
        classification.associateResponse,
        bodyHtml,
        correct,
        options,
        path,
      );
    case "canvasMatch":
      return mapQti12CanvasMatch(
        identifier,
        title,
        classification.choiceResponses,
        bodyHtml,
        correct,
        options,
        path,
      );
    case "choice":
      return mapQti12Choice(
        identifier,
        title,
        classification.choiceResponse,
        bodyHtml,
        correct,
        options,
        path,
      );
    case "textEntry":
      return mapQti12TextEntry(
        identifier,
        title,
        classification.fibResponse,
        presentation,
        correct,
        options,
        path,
      );
    case "upload":
      return {
        authoringItem: uploadAuthoringItem(identifier, title, bodyHtml),
        diagnostics: [],
      };
    case "unsupported":
      return unsupportedQti12Item(path);
    default:
      return assertNever(classification);
  }
}

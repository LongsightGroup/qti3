import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { assertNever } from "@longsightgroup/qti3-core";

import { prepareQti12Scoring } from "./qti12-scoring.js";
import { prepareQti12Content } from "./qti12-body.js";
import { qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";
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
  const classification = classifyQti12Item(item);
  const responseCount = [
    "response_lid",
    "response_str",
    "response_num",
    "response_grp",
    "response_xy",
  ].reduce((count, name) => count + findAllDescendantsByLocalName(item, name).length, 0);
  if (
    responseCount > 1 &&
    (classification.kind !== "canvasMatch" ||
      responseCount !== classification.choiceResponses.length)
  ) {
    return {
      diagnostics: [
        diagnostic(
          "qti12_composite_responses_unsupported",
          "error",
          "This QTI 1.2 mapper cannot preserve multiple response interactions and their scoring conditions.",
          { path, sourceFormat: "qti12" },
        ),
      ],
    };
  }
  const scoring = prepareQti12Scoring(item, path, classification.kind);
  if (!scoring.ok) return { diagnostics: scoring.diagnostics };
  const correct = scoring.correct;
  const prepared = prepareQti12Content(item, path);
  if (!prepared.ok) return { diagnostics: prepared.diagnostics };
  const content = prepared.content;
  const bodyHtml = qti3TrustedXmlFragment(
    presentation ? content.materialHtml(presentation) : "<p></p>",
  );

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
        content,
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
        content,
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
        content,
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
        content,
        identifier,
        title,
        classification.fibResponse,
        presentation,
        correct,
        scoring.caseSensitive,
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

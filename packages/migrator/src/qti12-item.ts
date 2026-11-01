import type { PendingMigrationItem } from "./item-finalize.js";
import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { assertNever } from "@longsightgroup/qti3-core";

import { prepareQti12Scoring } from "./qti12-scoring.js";
import { prepareQti12Content } from "./qti12-body.js";
import { qti3TrustedXmlFragment } from "@longsightgroup/qti3-writer";
import {
  classifyQti12Item,
  qti12MetadataField,
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
  childElements,
  textOf,
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
): readonly PendingMigrationItem[] {
  const doc = parseXml(xml, path);
  const root = doc.documentElement;
  const itemElements =
    localName(root) === "item" ? [root] : findAllDescendantsByLocalName(root, "item");
  if (!itemElements.length) {
    return [
      {
        identifier: "ITEM_1",
        title: "Imported Item",
        diagnostics: [
          diagnostic("qti12_item_missing", "error", "No QTI 1.2 item elements found.", {
            path,
            sourceFormat: "qti12",
          }),
        ],
      },
    ];
  }
  const sourceGroups = findAllDescendantsByLocalName(root, "section").flatMap((section, index) => {
    const ordering = childElements(section).find(
      (child) => localName(child) === "selection_ordering",
    );
    if (!ordering) return [];
    return [
      {
        identifier: attr(section, "ident") ?? `GROUP_${index + 1}`,
        title: attr(section, "title")?.trim() || `Group ${index + 1}`,
        selectionNumber: textOf(findDescendantByLocalName(ordering, "selection_number")).trim(),
        pointsPerItem: textOf(findDescendantByLocalName(ordering, "points_per_item")).trim(),
        sourceBankRef: textOf(findDescendantByLocalName(ordering, "sourcebank_ref")).trim(),
        itemIdentifiers: findAllDescendantsByLocalName(section, "item").map((item) =>
          normalizeIdentifier(attr(item, "ident"), `ITEM_${itemElements.indexOf(item) + 1}`),
        ),
      },
    ];
  });
  return itemElements.map((item, index) => {
    const identifier = normalizeIdentifier(attr(item, "ident"), `ITEM_${index + 1}`);
    const title = attr(item, "title")?.trim() || `Item ${index + 1}`;
    const migrated = migrateQti12ItemElement(item, identifier, title, path, options);
    return {
      identifier,
      title,
      ...migrated,
      qti12SourceGroups: index === 0 ? sourceGroups : undefined,
    };
  });
}

function migrateQti12ItemElement(
  item: XmlElement,
  identifier: string,
  title: string,
  path: string,
  options: ResolvedQtiMigrationOptions,
): {
  standaloneHtml?: string | undefined;
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
} {
  if (
    qti12MetadataField(item, "question_type") === "text_only_question" &&
    qti12MetadataField(item, "passage") === "true"
  ) {
    const points = qti12MetadataField(item, "points_possible");
    const hasResponse = [
      "response_lid",
      "response_str",
      "response_num",
      "response_grp",
      "response_xy",
      "resprocessing",
    ].some((name) => findAllDescendantsByLocalName(item, name).length > 0);
    if (hasResponse || (points !== undefined && points.trim() !== "0"))
      return {
        diagnostics: [
          diagnostic(
            "qti12_response_processing_unsupported",
            "error",
            "A text-only passage cannot declare responses, scoring or nonzero points.",
            { path, sourceFormat: "qti12" },
          ),
        ],
      };
    const prepared = prepareQti12Content(item, path);
    if (!prepared.ok) return { diagnostics: prepared.diagnostics };
    const presentation = findDescendantByLocalName(item, "presentation");
    return {
      standaloneHtml: presentation ? prepared.content.materialHtml(presentation) : "<p></p>",
      diagnostics: [],
    };
  }
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
  const mapped = mapScoredQti12Item(
    item,
    identifier,
    title,
    path,
    options,
    classification,
    scoring,
  );
  return { ...mapped, diagnostics: [...mapped.diagnostics, ...(scoring.diagnostics ?? [])] };
}

function mapScoredQti12Item(
  item: XmlElement,
  identifier: string,
  title: string,
  path: string,
  options: ResolvedQtiMigrationOptions,
  classification: ReturnType<typeof classifyQti12Item>,
  scoring: Extract<ReturnType<typeof prepareQti12Scoring>, { readonly ok: true }>,
): {
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const presentation = findDescendantByLocalName(item, "presentation");
  const correct = scoring.correct;
  const prepared = prepareQti12Content(item, path);
  if (!prepared.ok) return { diagnostics: prepared.diagnostics };
  const content = prepared.content;
  const bodyHtml = qti3TrustedXmlFragment(
    presentation ? content.materialHtml(presentation) : "<p></p>",
  );

  switch (classification.kind) {
    case "essay":
      return {
        authoringItem: essayAuthoringItem(
          identifier,
          title,
          bodyHtml,
          scoring.maximumScore === undefined
            ? undefined
            : qti3TrustedXmlFragment(
                `<p>Manual grading. Source maximum: ${scoring.maximumScore} points.</p>`,
              ),
        ),
        diagnostics: [],
      };
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
        scoring.maximumScore,
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
        authoringItem: uploadAuthoringItem(
          identifier,
          title,
          bodyHtml,
          scoring.maximumScore === undefined
            ? undefined
            : qti3TrustedXmlFragment(
                `<p>Manual grading. Source maximum: ${scoring.maximumScore} points.</p>`,
              ),
        ),
        diagnostics: [],
      };
    case "unsupported":
      return unsupportedQti12Item(path);
    default:
      return assertNever(classification);
  }
}

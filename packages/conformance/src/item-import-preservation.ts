import {
  parseQtiPackageXmlTree,
  type QtiContentNode,
  type QtiDiagnostic,
  type QtiDocument,
  type QtiPackageXmlNode,
} from "@longsightgroup/qti3-core";
import { certificationDiagnostic } from "./certification-package.js";

/** One comparison between authored data and the returned import model. */
export interface QtiImportObservation {
  readonly field: string;
  readonly expected: string | readonly string[] | null;
  readonly actual: string | readonly string[] | null;
  readonly ok: boolean;
}

/** Compare Basic item data at the public import boundary, retaining actual and expected values. */
export function compareImportedItem(
  xml: string,
  document: QtiDocument,
): {
  readonly observations: readonly QtiImportObservation[];
  readonly diagnostics: readonly QtiDiagnostic[];
} {
  const source = parseQtiPackageXmlTree(xml);
  if (!source.root || source.errors.length > 0) {
    return {
      observations: [],
      diagnostics: [
        certificationDiagnostic(
          "certification.evidence.sourceXml",
          "Cannot establish authored expectations from invalid XML.",
        ),
      ],
    };
  }
  const nodes = flattenXml(source.root);
  const observations: QtiImportObservation[] = [];
  function compare(
    field: string,
    expected: string | readonly string[] | undefined,
    actual: string | readonly string[] | undefined,
  ): void {
    observations.push({
      field,
      expected: expected ?? null,
      actual: actual ?? null,
      ok: JSON.stringify(expected) === JSON.stringify(actual),
    });
  }
  compare("item.identifier", source.root.attributes.identifier, document.item.identifier);
  compare("item.title", source.root.attributes.title, document.item.title);
  const authoredInteractions = nodes.filter((node) =>
    [
      "qti-choice-interaction",
      "qti-extended-text-interaction",
      "qti-text-entry-interaction",
    ].includes(node.localName),
  );
  compare(
    "interactions.count",
    String(authoredInteractions.length),
    String(document.item.interactions.length),
  );
  for (const [index, authored] of authoredInteractions.entries()) {
    const imported = document.item.interactions[index];
    const prefix = `interactions[${index}]`;
    compare(`${prefix}.qtiName`, authored.localName, imported?.qtiName);
    compare(
      `${prefix}.responseIdentifier`,
      authored.attributes["response-identifier"],
      imported?.responseIdentifier,
    );
    for (const [name, value] of Object.entries(authored.attributes)) {
      compare(`${prefix}.attributes.${name}`, value, imported?.attributes[name]);
    }
    const declaration = nodes.find(
      (node) =>
        node.localName === "qti-response-declaration" &&
        node.attributes.identifier === authored.attributes["response-identifier"],
    );
    const importedDeclaration = document.item.responseDeclarations.find(
      (entry) => entry.identifier === authored.attributes["response-identifier"],
    );
    compare(
      `${prefix}.response.cardinality`,
      declaration?.attributes.cardinality,
      importedDeclaration?.cardinality,
    );
    compare(
      `${prefix}.response.baseType`,
      declaration?.attributes["base-type"],
      importedDeclaration?.baseType,
    );
    if (imported && "responseCardinality" in imported)
      compare(
        `${prefix}.responseCardinality`,
        declaration?.attributes.cardinality,
        imported.responseCardinality,
      );
    if (authored.localName === "qti-choice-interaction") {
      const choices = authored.children.filter((node) => node.localName === "qti-simple-choice");
      compare(
        `${prefix}.choices.identifiers`,
        choices.map((choice) => choice.attributes.identifier ?? ""),
        imported && "choices" in imported
          ? imported.choices.map((choice) => choice.identifier)
          : undefined,
      );
    }
  }
  const authoredImages = nodes.filter((node) => node.localName === "img");
  const importedImages = contentElements(document.item.body).filter(
    (node) => node.qtiName === "img",
  );
  compare("images.count", String(authoredImages.length), String(importedImages.length));
  for (const [index, authored] of authoredImages.entries()) {
    compare(`images[${index}].src`, authored.attributes.src, importedImages[index]?.attributes.src);
    compare(`images[${index}].alt`, authored.attributes.alt, importedImages[index]?.attributes.alt);
  }
  const processing = source.root.children.find(
    (node) => node.localName === "qti-response-processing",
  );
  compare(
    "responseProcessing.template",
    processing?.attributes.template,
    document.item.responseProcessing?.template,
  );
  return {
    observations,
    diagnostics: observations
      .filter((entry) => !entry.ok)
      .map((entry) =>
        certificationDiagnostic(
          "certification.evidence.valueMismatch",
          `${entry.field}: expected ${JSON.stringify(entry.expected)}, received ${JSON.stringify(entry.actual)}.`,
        ),
      ),
  };
}

function flattenXml(node: QtiPackageXmlNode): QtiPackageXmlNode[] {
  return [node, ...node.children.flatMap(flattenXml)];
}

function contentElements(
  nodes: readonly QtiContentNode[],
): Extract<QtiContentNode, { kind: "element" }>[] {
  return nodes.flatMap((node) =>
    node.kind === "element" ? [node, ...contentElements(node.children)] : [],
  );
}

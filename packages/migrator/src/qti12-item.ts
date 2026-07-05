import {
  qti3TrustedXmlFragment,
  type Qti3AuthoringChoice,
  type Qti3AuthoringItem,
} from "@longsightgroup/qti3-writer";
import { diagnostic } from "./diagnostics.js";
import { escapeText, normalizeIdentifier } from "./text.js";
import type { QtiMigrationDiagnostic } from "./types.js";
import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  localName,
  parseXml,
  serializeChildren,
  textOf,
  type XmlElement,
} from "./xml.js";

export function migrateQti12Xml(
  xml: string,
  path: string,
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
  return itemElements.map((item, index) => migrateQti12ItemElement(item, index, path));
}

function migrateQti12ItemElement(
  item: XmlElement,
  index: number,
  path: string,
): {
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const identifier = normalizeIdentifier(attr(item, "ident"), `ITEM_${index + 1}`);
  const title = attr(item, "title")?.trim() || `Item ${index + 1}`;
  const presentation = findDescendantByLocalName(item, "presentation");
  const bodyHtml = qti3TrustedXmlFragment(presentation ? materialHtml(presentation) : "<p></p>");
  const responseLids = findAllDescendantsByLocalName(item, "response_lid");
  const responseStrs = findAllDescendantsByLocalName(item, "response_str");
  const responseNums = findAllDescendantsByLocalName(item, "response_num");
  const responseGrps = findAllDescendantsByLocalName(item, "response_grp");
  const correct = correctEntries(item);
  const itemType = (attr(item, "title") ?? "").toLowerCase();

  if (itemType.includes("essay")) {
    return {
      authoringItem: {
        interactionType: "extendedText",
        identifier,
        title,
        bodyHtml,
        responseIdentifier: "RESPONSE",
        responseBaseType: "string",
        responseCardinality: "single",
        expectedLines: 8,
      },
      diagnostics: [],
    };
  }

  const hotspotResponse = responseLids.find((response) =>
    findDescendantByLocalName(response, "render_hotspot"),
  );
  if (hotspotResponse) {
    return {
      authoringItem: mapQti12Hotspot(identifier, title, hotspotResponse, bodyHtml, correct),
      diagnostics: [],
    };
  }

  const groupedChoice = responseGrps.find((response) =>
    findDescendantByLocalName(response, "render_choice"),
  );
  if (groupedChoice) {
    return {
      authoringItem: mapQti12Associate(identifier, title, groupedChoice, bodyHtml, correct),
      diagnostics: [],
    };
  }

  const choiceResponse = responseLids.find((response) =>
    findDescendantByLocalName(response, "render_choice"),
  );
  if (choiceResponse) {
    return {
      authoringItem: mapQti12Choice(identifier, title, choiceResponse, bodyHtml, correct),
      diagnostics: [],
    };
  }

  const fibResponse = [...responseLids, ...responseStrs, ...responseNums].find((response) =>
    findDescendantByLocalName(response, "render_fib"),
  );
  if (fibResponse) {
    return {
      authoringItem: mapQti12TextEntry(identifier, title, fibResponse, presentation, correct),
      diagnostics: [],
    };
  }

  return {
    diagnostics: [
      diagnostic("qti12_interaction_unsupported", "error", "Unsupported QTI 1.2 interaction.", {
        path,
        sourceFormat: "qti12",
      }),
    ],
  };
}

function mapQti12Choice(
  identifier: string,
  title: string,
  response: XmlElement,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
): Qti3AuthoringItem {
  const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const choices = responseChoices(response, "CHOICE");
  const correctResponse = (correct.get(responseIdentifier) ?? [])
    .map((value) => normalizeIdentifier(value))
    .filter((value) => choices.some((choice) => choice.identifier === value));
  const isMultiple =
    (attr(response, "rcardinality") ?? "").toLowerCase() === "multiple" ||
    correctResponse.length > 1;
  return {
    interactionType: "choice",
    identifier,
    title,
    bodyHtml,
    responseIdentifier,
    responseCardinality: isMultiple ? "multiple" : "single",
    choices,
    correctResponse: correctResponse.length
      ? correctResponse
      : choices.slice(0, 1).map((choice) => choice.identifier),
    maxChoices: isMultiple ? undefined : 1,
  };
}

function mapQti12Associate(
  identifier: string,
  title: string,
  response: XmlElement,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
): Qti3AuthoringItem {
  const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const choices = responseChoices(response, "CHOICE").map((choice) => ({ ...choice, matchMax: 2 }));
  const pairs = (correct.get(responseIdentifier) ?? [])
    .map((entry) => {
      const [sourceIdentifier = "", targetIdentifier = ""] = entry.split(/\s+/);
      return {
        sourceIdentifier: normalizeIdentifier(sourceIdentifier),
        targetIdentifier: normalizeIdentifier(targetIdentifier),
      };
    })
    .filter((pair) => pair.sourceIdentifier && pair.targetIdentifier);
  return {
    interactionType: "associate",
    identifier,
    title,
    bodyHtml,
    responseIdentifier,
    choices,
    correctResponse: pairs.length
      ? pairs
      : choices.length >= 2
        ? [{ sourceIdentifier: choices[0]!.identifier, targetIdentifier: choices[1]!.identifier }]
        : [],
  };
}

function mapQti12TextEntry(
  identifier: string,
  title: string,
  response: XmlElement,
  presentation: XmlElement | null,
  correct: ReadonlyMap<string, string[]>,
): Qti3AuthoringItem {
  const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const values = correct.get(responseIdentifier) ?? [];
  return {
    interactionType: "textEntry",
    identifier,
    title,
    bodyHtml: qti3TrustedXmlFragment(
      `${presentation ? materialHtml(presentation) : "<p></p>"}<p><qti-text-entry-interaction response-identifier="${escapeText(responseIdentifier)}"/></p>`,
    ),
    responses: [
      {
        responseIdentifier,
        answers: values.length
          ? values.map((value) => ({ value, score: 1, caseSensitive: false }))
          : [{ value: "", score: 1, caseSensitive: false }],
      },
    ],
  };
}

function mapQti12Hotspot(
  identifier: string,
  title: string,
  response: XmlElement,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
): Qti3AuthoringItem {
  const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const labels = findAllDescendantsByLocalName(response, "response_label");
  const choices = labels.map((label, index) => ({
    identifier: normalizeIdentifier(attr(label, "ident"), `H${index + 1}`),
    shape: qti12AreaToShape(attr(label, "rarea")),
    coords: attr(label, "coords") ?? attr(label, "xy") ?? "0,0,1,1",
  }));
  const dimensions = inferImageDimensions(choices.map((choice) => choice.coords));
  const correctResponse = (correct.get(responseIdentifier) ?? []).map((value) =>
    normalizeIdentifier(value),
  );
  return {
    interactionType: "hotspot",
    identifier,
    title,
    bodyHtml,
    responseIdentifier,
    object: { data: "image.png", alt: "Image", width: dimensions.width, height: dimensions.height },
    choices,
    correctResponse: correctResponse.length
      ? correctResponse
      : choices.slice(0, 1).map((choice) => choice.identifier),
    maxChoices: 1,
  };
}

function responseChoices(response: XmlElement, prefix: string): Qti3AuthoringChoice[] {
  return findAllDescendantsByLocalName(response, "response_label").map((label, index) => ({
    identifier: normalizeIdentifier(attr(label, "ident"), `${prefix}_${index + 1}`),
    contentHtml: qti3TrustedXmlFragment(materialHtml(label)),
    text: textOf(label) || undefined,
  }));
}

function materialHtml(root: XmlElement): string {
  const materials = findAllDescendantsByLocalName(root, "material");
  if (!materials.length) return serializeChildren(root).trim() || "<p></p>";
  return materials
    .map((material) => {
      const mattext = findDescendantByLocalName(material, "mattext");
      if (mattext) return `<p>${serializeChildren(mattext) || escapeText(textOf(mattext))}</p>`;
      const matimage = findDescendantByLocalName(material, "matimage");
      if (matimage) {
        const src = attr(matimage, "uri") ?? "";
        return `<p><img src="${escapeText(src)}"/></p>`;
      }
      return `<p>${escapeText(textOf(material))}</p>`;
    })
    .join("\n");
}

function correctEntries(item: XmlElement): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const condition of findAllDescendantsByLocalName(item, "respcondition")) {
    const varequal = findAllDescendantsByLocalName(condition, "varequal");
    for (const value of varequal) {
      const responseIdentifier = normalizeIdentifier(attr(value, "respident"), "RESPONSE");
      const values = out.get(responseIdentifier) ?? [];
      values.push(textOf(value));
      out.set(responseIdentifier, values);
    }
  }
  for (const response of findAllDescendantsByLocalName(item, "response_lid")) {
    const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
    if (out.has(responseIdentifier)) continue;
    const labels = childElements(
      findDescendantByLocalName(response, "render_choice") ?? response,
    ).filter((child) => localName(child) === "response_label");
    const correct = labels.find((label) => attr(label, "rshuffle") === "No");
    if (correct) out.set(responseIdentifier, [attr(correct, "ident") ?? ""]);
  }
  return out;
}

function qti12AreaToShape(value: string | null): "circle" | "rect" | "poly" {
  const normalized = value?.toLowerCase();
  if (normalized === "ellipse") return "circle";
  if (normalized === "bounded") return "poly";
  return "rect";
}

function inferImageDimensions(coords: readonly string[]): { width: number; height: number } {
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

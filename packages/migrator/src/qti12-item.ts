import {
  qti3TrustedXmlFragment,
  type Qti3AuthoringChoice,
  type Qti3AuthoringItem,
} from "@longsightgroup/qti3-writer";
import { diagnostic } from "./diagnostics.js";
import { escapeText, normalizeIdentifier } from "./text.js";
import type { QtiMigrationDiagnostic, ResolvedQtiMigrationOptions } from "./types.js";
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
      ...mapQti12Hotspot(identifier, title, hotspotResponse, bodyHtml, correct, options),
    };
  }

  const groupedChoice = responseGrps.find((response) =>
    findDescendantByLocalName(response, "render_choice"),
  );
  if (groupedChoice) {
    return {
      ...mapQti12Associate(identifier, title, groupedChoice, bodyHtml, correct, options),
    };
  }

  const choiceResponse = responseLids.find((response) =>
    findDescendantByLocalName(response, "render_choice"),
  );
  if (choiceResponse) {
    return {
      ...mapQti12Choice(identifier, title, choiceResponse, bodyHtml, correct, options),
    };
  }

  const fibResponse = [...responseLids, ...responseStrs, ...responseNums].find((response) =>
    findDescendantByLocalName(response, "render_fib"),
  );
  if (fibResponse) {
    return {
      ...mapQti12TextEntry(identifier, title, fibResponse, presentation, correct, options),
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
  options: ResolvedQtiMigrationOptions,
): {
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const choices = responseChoices(response, "CHOICE");
  const rawCorrect = correct.get(responseIdentifier) ?? [];
  const correctResponse = (correct.get(responseIdentifier) ?? [])
    .map((value) => normalizeIdentifier(value))
    .filter((value) => choices.some((choice) => choice.identifier === value));
  const repair = repairOrError({
    needed: !correctResponse.length,
    options,
    code: "qti12_choice_correct_response_missing",
    message: "QTI 1.2 choice response has no valid correct response.",
    repairMessage: rawCorrect.length
      ? "QTI 1.2 choice correct response referenced unknown labels; using the first declared choice."
      : "QTI 1.2 choice response did not declare a correct response; using the first declared choice.",
  });
  if (repair.blocked) return { diagnostics: repair.diagnostics };
  const isMultiple =
    (attr(response, "rcardinality") ?? "").toLowerCase() === "multiple" ||
    correctResponse.length > 1;
  return {
    authoringItem: {
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
    },
    diagnostics: repair.diagnostics,
  };
}

function mapQti12Associate(
  identifier: string,
  title: string,
  response: XmlElement,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
): {
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
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
  const repair = repairOrError({
    needed: !pairs.length,
    options,
    code: "qti12_associate_correct_response_missing",
    message: "QTI 1.2 associate response has no valid correct pair.",
    repairMessage:
      "QTI 1.2 associate response did not declare a valid pair; using the first two choices.",
  });
  if (repair.blocked) return { diagnostics: repair.diagnostics };
  return {
    authoringItem: {
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
    },
    diagnostics: repair.diagnostics,
  };
}

function mapQti12TextEntry(
  identifier: string,
  title: string,
  response: XmlElement,
  presentation: XmlElement | null,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
): {
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const responseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const values = correct.get(responseIdentifier) ?? [];
  const repair = repairOrError({
    needed: !values.length,
    options,
    code: "qti12_text_entry_correct_response_missing",
    message: "QTI 1.2 text entry response has no correct text value.",
    repairMessage:
      "QTI 1.2 text entry response did not declare a correct value; using an empty answer.",
  });
  if (repair.blocked) return { diagnostics: repair.diagnostics };
  return {
    authoringItem: {
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
    },
    diagnostics: repair.diagnostics,
  };
}

function mapQti12Hotspot(
  identifier: string,
  title: string,
  response: XmlElement,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
): {
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
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
  const correctRepair = repairOrError({
    needed: !correctResponse.length,
    options,
    code: "qti12_hotspot_correct_response_missing",
    message: "QTI 1.2 hotspot response has no correct hotspot identifier.",
    repairMessage:
      "QTI 1.2 hotspot response did not declare a correct hotspot; using the first hotspot.",
  });
  if (correctRepair.blocked) return { diagnostics: correctRepair.diagnostics };
  const imageRepair = repairOrError({
    needed: true,
    options,
    code: "qti12_hotspot_image_missing",
    message: "QTI 1.2 hotspot migration could not identify the source image.",
    repairMessage:
      "QTI 1.2 hotspot source image was not identified; using review placeholder image.png.",
  });
  if (imageRepair.blocked) return { diagnostics: imageRepair.diagnostics };
  return {
    authoringItem: {
      interactionType: "hotspot",
      identifier,
      title,
      bodyHtml,
      responseIdentifier,
      object: {
        data: "image.png",
        alt: "Image",
        width: dimensions.width,
        height: dimensions.height,
      },
      choices,
      correctResponse: correctResponse.length
        ? correctResponse
        : choices.slice(0, 1).map((choice) => choice.identifier),
      maxChoices: 1,
    },
    diagnostics: [...correctRepair.diagnostics, ...imageRepair.diagnostics],
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

function repairOrError(input: {
  readonly needed: boolean;
  readonly options: ResolvedQtiMigrationOptions;
  readonly code: string;
  readonly message: string;
  readonly repairMessage: string;
}): { readonly blocked: boolean; readonly diagnostics: readonly QtiMigrationDiagnostic[] } {
  if (!input.needed) return { blocked: false, diagnostics: [] };
  if (input.options.repairPolicy === "safe") {
    return {
      blocked: false,
      diagnostics: [diagnostic(`${input.code}_repaired`, "warning", input.repairMessage)],
    };
  }
  return {
    blocked: true,
    diagnostics: [diagnostic(input.code, "error", input.message)],
  };
}

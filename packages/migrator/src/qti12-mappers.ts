import {
  qti3TrustedXmlFragment,
  type Qti3AuthoringChoice,
  type Qti3AuthoringItem,
  type Qti3MatchChoice,
} from "@longsightgroup/qti3-writer";

import { materialHtml } from "./qti12-body.js";
import {
  directTextOf,
  inferImageDimensions,
  qti12AreaToShape,
  qti12ResponseIdentifiers,
} from "./qti12-classify.js";
import { applyRepairPolicy, isRepairBlocked, repairDiagnostics } from "./repair-policy.js";
import { escapeText, normalizeIdentifier } from "./text.js";
import type { QtiMigrationDiagnostic, ResolvedQtiMigrationOptions } from "./types.js";
import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  textOf,
  toNumber,
  type XmlElement,
} from "./xml.js";

export interface Qti12MapperResult {
  readonly authoringItem?: Qti3AuthoringItem | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
}

export function mapQti12CanvasMatch(
  identifier: string,
  title: string,
  responses: readonly XmlElement[],
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
  path: string,
): Qti12MapperResult {
  const sources: Qti3MatchChoice[] = responses.map((response, index) => {
    const responseIdentifier = normalizeIdentifier(attr(response, "ident"), `SOURCE_${index + 1}`);
    const material = findDescendantByLocalName(response, "material");
    return {
      identifier: responseIdentifier,
      contentHtml: qti3TrustedXmlFragment(material ? materialHtml(material) : responseIdentifier),
      text: textOf(material) || responseIdentifier,
      matchMax: 1,
    };
  });
  const targets = canvasMatchTargets(responses);
  const targetIdentifiers = new Set(targets.map((target) => target.identifier));
  const correctResponse = sources.flatMap((source) => {
    const targetIdentifier = (correct.get(source.identifier) ?? [])
      .map((entry) => normalizeIdentifier(entry))
      .find((entry) => targetIdentifiers.has(entry));
    return targetIdentifier ? [{ sourceIdentifier: source.identifier, targetIdentifier }] : [];
  });
  const repair = applyRepairPolicy({
    needed: correctResponse.length === 0,
    context: { options, path, sourceFormat: "qti12" },
    code: "qti12_canvas_match_correct_response_incomplete",
    message: "Canvas QTI 1.2 matching item has no valid correct pairs.",
    repairMessage:
      "Canvas QTI 1.2 matching item has no valid correct pairs; migrating an empty answer key for review.",
  });
  if (isRepairBlocked(repair)) return { diagnostics: repair.diagnostics };
  return {
    authoringItem: {
      interactionType: "match",
      identifier,
      title,
      bodyHtml,
      responseIdentifier: "RESPONSE",
      sources,
      targets,
      correctResponse,
      shuffle: false,
    },
    diagnostics: repairDiagnostics(repair),
  };
}

export function mapQti12Choice(
  identifier: string,
  title: string,
  response: XmlElement,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
  path: string,
): Qti12MapperResult {
  const sourceResponseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const { source, target: responseIdentifier } = qti12ResponseIdentifiers(sourceResponseIdentifier);
  const choices = responseChoices(response, "CHOICE");
  const rawCorrect = correct.get(source) ?? [];
  const correctResponse = rawCorrect
    .map((value) => normalizeIdentifier(value))
    .filter((value) => choices.some((choice) => choice.identifier === value));
  const repair = applyRepairPolicy({
    needed: !correctResponse.length,
    context: { options, path, sourceFormat: "qti12" },
    code: "qti12_choice_correct_response_missing",
    message: "QTI 1.2 choice response has no valid correct response.",
    repairMessage: rawCorrect.length
      ? "QTI 1.2 choice correct response referenced unknown labels; using the first declared choice."
      : "QTI 1.2 choice response did not declare a correct response; using the first declared choice.",
  });
  if (isRepairBlocked(repair)) return { diagnostics: repair.diagnostics };
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
    diagnostics: repairDiagnostics(repair),
  };
}

export function mapQti12Associate(
  identifier: string,
  title: string,
  response: XmlElement,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
  path: string,
): Qti12MapperResult {
  const sourceResponseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const { source, target: responseIdentifier } = qti12ResponseIdentifiers(sourceResponseIdentifier);
  const choices = responseChoices(response, "CHOICE").map((choice) => ({ ...choice, matchMax: 2 }));
  const pairs = (correct.get(source) ?? [])
    .map((entry) => {
      const [sourceIdentifier = "", targetIdentifier = ""] = entry.split(/\s+/);
      return {
        sourceIdentifier: normalizeIdentifier(sourceIdentifier),
        targetIdentifier: normalizeIdentifier(targetIdentifier),
      };
    })
    .filter((pair) => pair.sourceIdentifier && pair.targetIdentifier);
  const repair = applyRepairPolicy({
    needed: !pairs.length,
    context: { options, path, sourceFormat: "qti12" },
    code: "qti12_associate_correct_response_missing",
    message: "QTI 1.2 associate response has no valid correct pair.",
    repairMessage:
      "QTI 1.2 associate response did not declare a valid pair; using the first two choices.",
  });
  if (isRepairBlocked(repair)) return { diagnostics: repair.diagnostics };
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
    diagnostics: repairDiagnostics(repair),
  };
}

export function mapQti12TextEntry(
  identifier: string,
  title: string,
  response: XmlElement,
  presentation: XmlElement | null,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
  path: string,
): Qti12MapperResult {
  const sourceResponseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const { source, target: responseIdentifier } = qti12ResponseIdentifiers(sourceResponseIdentifier);
  const renderFib = findDescendantByLocalName(response, "render_fib");
  const rows = toNumber(attr(renderFib, "rows"));
  if (rows !== undefined && rows > 1) {
    return {
      authoringItem: {
        interactionType: "extendedText",
        identifier,
        title,
        bodyHtml: qti3TrustedXmlFragment(presentation ? materialHtml(presentation) : "<p></p>"),
        responseIdentifier,
        responseBaseType: "string",
        responseCardinality: "single",
        expectedLines: rows,
      },
      diagnostics: [],
    };
  }
  const values = correct.get(source) ?? [];
  const repair = applyRepairPolicy({
    needed: !values.length,
    context: { options, path, sourceFormat: "qti12" },
    code: "qti12_text_entry_correct_response_missing",
    message: "QTI 1.2 text entry response has no correct text value.",
    repairMessage:
      "QTI 1.2 text entry response did not declare a correct value; using an empty answer.",
  });
  if (isRepairBlocked(repair)) return { diagnostics: repair.diagnostics };
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
    diagnostics: repairDiagnostics(repair),
  };
}

export function mapQti12Hotspot(
  identifier: string,
  title: string,
  response: XmlElement,
  presentation: XmlElement | null,
  bodyHtml: ReturnType<typeof qti3TrustedXmlFragment>,
  correct: ReadonlyMap<string, string[]>,
  options: ResolvedQtiMigrationOptions,
  path: string,
): Qti12MapperResult {
  const sourceResponseIdentifier = normalizeIdentifier(attr(response, "ident"), "RESPONSE");
  const { source, target: responseIdentifier } = qti12ResponseIdentifiers(sourceResponseIdentifier);
  const labels = findAllDescendantsByLocalName(response, "response_label");
  const choices = labels.map((label, index) => ({
    identifier: normalizeIdentifier(attr(label, "ident"), `H${index + 1}`),
    shape: qti12AreaToShape(attr(label, "rarea")),
    coords: attr(label, "coords") ?? attr(label, "xy") ?? (directTextOf(label) || "0,0,1,1"),
    hotspotLabel: hotspotLabel(label),
  }));
  const dimensions = inferImageDimensions(choices.map((choice) => choice.coords));
  const image = presentation ? findDescendantByLocalName(presentation, "matimage") : null;
  const correctResponse = (correct.get(source) ?? []).map((value) => normalizeIdentifier(value));
  const correctRepair = applyRepairPolicy({
    needed: !correctResponse.length,
    context: { options, path, sourceFormat: "qti12" },
    code: "qti12_hotspot_correct_response_missing",
    message: "QTI 1.2 hotspot response has no correct hotspot identifier.",
    repairMessage:
      "QTI 1.2 hotspot response did not declare a correct hotspot; using the first hotspot.",
  });
  if (isRepairBlocked(correctRepair)) return { diagnostics: correctRepair.diagnostics };
  const imageRepair = applyRepairPolicy({
    needed: !image,
    context: { options, path, sourceFormat: "qti12" },
    code: "qti12_hotspot_image_missing",
    message: "QTI 1.2 hotspot migration could not identify the source image.",
    repairMessage:
      "QTI 1.2 hotspot source image was not identified; using review placeholder image.png.",
  });
  if (isRepairBlocked(imageRepair)) return { diagnostics: imageRepair.diagnostics };
  const object = qti12ImageObject(image, dimensions);
  const diagnostics = [...repairDiagnostics(correctRepair), ...repairDiagnostics(imageRepair)];
  if (attr(response, "rcardinality")?.toLowerCase() === "ordered") {
    return {
      authoringItem: {
        interactionType: "graphicOrder",
        identifier,
        title,
        bodyHtml,
        responseIdentifier,
        object,
        hotspots: choices,
        correctOrder: correctResponse.length
          ? correctResponse
          : choices.map((choice) => choice.identifier),
        maxChoices: choices.length,
      },
      diagnostics,
    };
  }
  return {
    authoringItem: {
      interactionType: "hotspot",
      identifier,
      title,
      bodyHtml,
      responseIdentifier,
      object,
      choices,
      correctResponse: correctResponse.length
        ? correctResponse
        : choices.slice(0, 1).map((choice) => choice.identifier),
      maxChoices: attr(response, "rcardinality")?.toLowerCase() === "multiple" ? choices.length : 1,
    },
    diagnostics,
  };
}

function canvasMatchTargets(responses: readonly XmlElement[]): Qti3MatchChoice[] {
  const targets: Qti3MatchChoice[] = [];
  const seen = new Set<string>();
  for (const response of responses) {
    const renderChoice = findDescendantByLocalName(response, "render_choice");
    const labels = renderChoice
      ? findAllDescendantsByLocalName(renderChoice, "response_label")
      : [];
    for (const [index, label] of labels.entries()) {
      const identifier = normalizeIdentifier(attr(label, "ident"), `TARGET_${index + 1}`);
      if (seen.has(identifier)) continue;
      seen.add(identifier);
      targets.push({
        identifier,
        contentHtml: qti3TrustedXmlFragment(materialHtml(label)),
        text: textOf(label) || identifier,
        matchMax: 1,
      });
    }
  }
  return targets;
}

function responseChoices(response: XmlElement, prefix: string): Qti3AuthoringChoice[] {
  return findAllDescendantsByLocalName(response, "response_label").map((label, index) => ({
    identifier: normalizeIdentifier(attr(label, "ident"), `${prefix}_${index + 1}`),
    contentHtml: qti3TrustedXmlFragment(materialHtml(label)),
    text: textOf(label) || undefined,
  }));
}

function hotspotLabel(label: XmlElement): string | undefined {
  const explicit = attr(label, "label")?.trim();
  if (explicit) return explicit;
  const material = findDescendantByLocalName(label, "material");
  const text = material ? textOf(material).trim() : "";
  return text || undefined;
}

function qti12ImageObject(
  image: XmlElement | null,
  dimensions: { readonly width: number; readonly height: number },
) {
  return {
    data: attr(image, "uri") ?? "image.png",
    type: attr(image, "imagtype") ?? undefined,
    alt: attr(image, "label") ?? "Image",
    width: toNumber(attr(image, "width")) ?? dimensions.width,
    height: toNumber(attr(image, "height")) ?? dimensions.height,
  };
}

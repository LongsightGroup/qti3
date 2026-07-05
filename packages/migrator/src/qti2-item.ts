import {
  qti3TrustedXmlFragment,
  type Qti3AuthoringChoice,
  type Qti3AuthoringItem,
  type Qti3AssociateChoice,
  type Qti3GapMatchChoice,
  type Qti3GraphicGapChoice,
  type Qti3GraphicGapTarget,
  type Qti3HottextChoice,
  type Qti3InlineChoiceSlot,
  type Qti3MatchChoice,
  type Qti3TextEntryResponse,
} from "@longsightgroup/qti3-writer";
import { diagnostic } from "./diagnostics.js";
import { escapeText, normalizeIdentifier, stripTags } from "./text.js";
import type { QtiMigrationDiagnostic, QtiMigrationSourceFormat } from "./types.js";
import {
  attr,
  findAllDescendantsByAnyLocalName,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  localName,
  parseXml,
  serializeChildren,
  serializeNode,
  textOf,
  toNumber,
  type XmlElement,
} from "./xml.js";

export function migrateQti2ItemXml(
  xml: string,
  path: string,
  sourceFormat: QtiMigrationSourceFormat,
): {
  authoringItem?: Qti3AuthoringItem | undefined;
  diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const diagnostics: QtiMigrationDiagnostic[] = [];
  const doc = parseXml(xml, path);
  const root = doc.documentElement;
  if (localName(root) !== "assessmentitem") {
    return {
      diagnostics: [
        diagnostic("qti2_item_root", "error", "Expected QTI 2.x assessmentItem root.", {
          path,
          sourceFormat,
        }),
      ],
    };
  }
  const body = findDescendantByLocalName(root, "itembody");
  if (!body) {
    return {
      diagnostics: [
        diagnostic("qti2_item_body_missing", "error", "QTI 2.x item is missing itemBody.", {
          path,
          sourceFormat,
        }),
      ],
    };
  }
  const responseDecls = findAllDescendantsByLocalName(root, "responsedeclaration");
  const responseDeclMap = new Map<string, XmlElement>();
  for (const declaration of responseDecls) {
    const identifier = attr(declaration, "identifier");
    if (identifier) responseDeclMap.set(identifier, declaration);
  }
  const context: Qti2Context = {
    identifier: normalizeIdentifier(attr(root, "identifier"), "ITEM"),
    title: attr(root, "title")?.trim() || "Imported Item",
    body,
    responseDecls,
    responseDeclMap,
    sourceFormat,
    path,
  };
  const interaction = firstSupportedInteraction(body);
  if (!interaction) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_interaction_unsupported",
          "error",
          "No supported QTI 2.x interaction found.",
          {
            path,
            sourceFormat,
          },
        ),
      ],
    };
  }
  const mapper = qti2Mappers[localName(interaction)];
  if (!mapper) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_interaction_unsupported",
          "error",
          `Unsupported QTI 2.x interaction ${localName(interaction)}.`,
          { path, sourceFormat },
        ),
      ],
    };
  }
  return { authoringItem: mapper(interaction, context), diagnostics };
}

interface Qti2Context {
  readonly identifier: string;
  readonly title: string;
  readonly body: XmlElement;
  readonly responseDecls: readonly XmlElement[];
  readonly responseDeclMap: ReadonlyMap<string, XmlElement>;
  readonly sourceFormat: QtiMigrationSourceFormat;
  readonly path: string;
}

type Qti2Mapper = (interaction: XmlElement, context: Qti2Context) => Qti3AuthoringItem;

const qti2Mappers: Record<string, Qti2Mapper | undefined> = {
  choiceinteraction: mapChoice,
  orderinteraction: mapOrder,
  matchinteraction: mapMatch,
  associateinteraction: mapAssociate,
  textentryinteraction: mapTextEntry,
  extendedtextinteraction: mapExtendedText,
  inlinechoiceinteraction: mapInlineChoice,
  hottextinteraction: mapHottext,
  gapmatchinteraction: mapGapMatch,
  hotspotinteraction: mapHotspot,
  graphicorderinteraction: mapGraphicOrder,
  graphicassociateinteraction: mapGraphicAssociate,
  graphicgapmatchinteraction: mapGraphicGapMatch,
};

const supportedInteractionNames = new Set(Object.keys(qti2Mappers));

function firstSupportedInteraction(root: XmlElement): XmlElement | undefined {
  const matches = findAllDescendantsByAnyLocalName(root, [...supportedInteractionNames]);
  return matches[0];
}

function mapChoice(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  const cardinality = (attr(declaration, "cardinality") ?? "").toLowerCase();
  const maxChoices = toNumber(attr(interaction, "maxChoices"));
  const choices = simpleChoices(interaction);
  const correctValues = orderedIdentifierValues(declaration);
  if (cardinality === "ordered") {
    return {
      interactionType: "order",
      identifier: context.identifier,
      title: context.title,
      bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
      responseIdentifier,
      choices,
      correctOrder: correctValues.length
        ? correctValues
        : choices.map((choice) => choice.identifier),
      shuffle: attr(interaction, "shuffle") === "true",
      minChoices: toNumber(attr(interaction, "minChoices")),
      maxChoices,
    };
  }
  const choiceCardinality =
    cardinality === "multiple" || (maxChoices ?? 0) > 1 ? "multiple" : "single";
  const correctResponse = correctValues.filter((value) =>
    choices.some((choice) => choice.identifier === value),
  );
  return {
    interactionType: "choice",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
    responseIdentifier,
    responseCardinality: choiceCardinality,
    choices,
    correctResponse: correctResponse.length
      ? correctResponse
      : choices.slice(0, 1).map((choice) => choice.identifier),
    shuffle: attr(interaction, "shuffle") === "true",
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: choiceCardinality === "single" ? 1 : maxChoices,
    scoring: hasMapping(declaration) ? "map_response" : "match_correct",
  };
}

function mapOrder(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const choices = simpleChoices(interaction);
  const correctOrder = orderedIdentifierValues(context.responseDeclMap.get(responseIdentifier));
  return {
    interactionType: "order",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
    responseIdentifier,
    choices,
    correctOrder: correctOrder.length ? correctOrder : choices.map((choice) => choice.identifier),
    shuffle: attr(interaction, "shuffle") === "true",
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: toNumber(attr(interaction, "maxChoices")),
  };
}

function mapMatch(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const sets = findAllDescendantsByLocalName(interaction, "simplematchset");
  return {
    interactionType: "match",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
    responseIdentifier,
    sources: associableChoices(sets[0], "SOURCE"),
    targets: associableChoices(sets[1], "TARGET"),
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    shuffle: attr(interaction, "shuffle") === "true",
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
  };
}

function mapAssociate(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  return {
    interactionType: "associate",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
    responseIdentifier,
    choices: associableChoices(interaction, "CHOICE"),
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    shuffle: attr(interaction, "shuffle") === "true",
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
    scoring: hasMapping(context.responseDeclMap.get(responseIdentifier))
      ? "map_response"
      : "match_correct",
  };
}

function mapTextEntry(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const interactions = findAllDescendantsByLocalName(context.body, "textentryinteraction");
  const responses = interactions.map((entry, index): Qti3TextEntryResponse => {
    const responseIdentifier = responseIdentifierFor(entry, `RESPONSE_${index + 1}`);
    return {
      responseIdentifier,
      answers: textEntryAnswers(context.responseDeclMap.get(responseIdentifier)),
    };
  });
  return {
    interactionType: "textEntry",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithTextEntryPlaceholders(context.body, interactions)),
    responses,
  };
}

function mapExtendedText(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  return {
    interactionType: "extendedText",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
    responseIdentifier,
    expectedLength: toNumber(attr(interaction, "expectedLength")),
    expectedLines: toNumber(attr(interaction, "expectedLines")),
    minStrings: toNumber(attr(interaction, "minStrings")),
    maxStrings: toNumber(attr(interaction, "maxStrings")),
    placeholderText: attr(interaction, "placeholderText") ?? undefined,
    format: extendedTextFormat(attr(interaction, "format")),
    responseBaseType: baseType(attr(declaration, "baseType") ?? attr(declaration, "base-type")),
    responseCardinality: responseCardinality(attr(declaration, "cardinality")),
  };
}

function mapInlineChoice(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const interactions = findAllDescendantsByLocalName(context.body, "inlinechoiceinteraction");
  const slots = interactions.map((entry, index): Qti3InlineChoiceSlot => {
    const responseIdentifier = responseIdentifierFor(entry, `RESPONSE_${index + 1}`);
    const declaration = context.responseDeclMap.get(responseIdentifier);
    const correctResponse = values(declaration)[0];
    return {
      responseIdentifier,
      shuffle: attr(entry, "shuffle") === "true",
      required: attr(entry, "required") === "true",
      options: findAllDescendantsByLocalName(entry, "inlinechoice").map((choice, choiceIndex) => ({
        identifier: normalizeIdentifier(attr(choice, "identifier"), `CHOICE_${choiceIndex + 1}`),
        contentHtml: trusted(serializeChildren(choice)),
        text: textOf(choice) || undefined,
        fixed: attr(choice, "fixed") === "true",
      })),
      correctResponse: correctResponse ? normalizeIdentifier(correctResponse) : undefined,
    };
  });
  return {
    interactionType: "inlineChoice",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithInlineChoicePlaceholders(context.body, interactions)),
    slots,
    scoring: "all_or_nothing",
  };
}

function mapHottext(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const hottexts = findAllDescendantsByLocalName(interaction, "hottext");
  const choices = hottexts.map(
    (hottext, index): Qti3HottextChoice => ({
      identifier: normalizeIdentifier(attr(hottext, "identifier"), `H${index + 1}`),
      contentHtml: trusted(serializeChildren(hottext)),
      text: textOf(hottext) || undefined,
    }),
  );
  return {
    interactionType: "hottext",
    identifier: context.identifier,
    title: context.title,
    promptHtml: prompt(interaction),
    bodyHtml: trusted(bodyWithHottextPlaceholders(interaction, hottexts)),
    responseIdentifier,
    choices,
    correctResponse: values(context.responseDeclMap.get(responseIdentifier)).map((value) =>
      normalizeIdentifier(value),
    ),
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: toNumber(attr(interaction, "maxChoices")),
  };
}

function mapGapMatch(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const choices: Qti3GapMatchChoice[] = findAllDescendantsByAnyLocalName(interaction, [
    "gaptext",
    "gapimg",
  ]).map((choice, index) => gapChoice(choice, index));
  const targets = findAllDescendantsByLocalName(interaction, "gap").map((gap, index) => ({
    identifier: normalizeIdentifier(attr(gap, "identifier"), `GAP_${index + 1}`),
  }));
  return {
    interactionType: "gapMatch",
    identifier: context.identifier,
    title: context.title,
    promptHtml: prompt(interaction),
    bodyHtml: trusted(bodyWithGapPlaceholders(interaction)),
    responseIdentifier,
    choices,
    targets,
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    shuffle: attr(interaction, "shuffle") === "true",
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
    scoring: hasMapping(context.responseDeclMap.get(responseIdentifier))
      ? "map_response"
      : "match_correct",
  };
}

function mapHotspot(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const object = findDescendantByLocalName(interaction, "object");
  const choices = findAllDescendantsByLocalName(interaction, "hotspotchoice").map(
    (choice, index) => ({
      identifier: normalizeIdentifier(attr(choice, "identifier"), `H${index + 1}`),
      shape: hotspotShape(attr(choice, "shape")),
      coords: attr(choice, "coords") ?? "",
    }),
  );
  return {
    interactionType: "hotspot",
    identifier: context.identifier,
    title: context.title,
    promptHtml: prompt(interaction),
    responseIdentifier,
    object: graphicObject(
      object,
      choices.map((choice) => choice.coords),
    ),
    choices,
    correctResponse: values(context.responseDeclMap.get(responseIdentifier)).map((value) =>
      normalizeIdentifier(value),
    ),
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: toNumber(attr(interaction, "maxChoices")),
  };
}

function mapGraphicOrder(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const object = findDescendantByLocalName(interaction, "object");
  const hotspots = findAllDescendantsByLocalName(interaction, "hotspotchoice").map(
    (hotspot, index) => ({
      identifier: normalizeIdentifier(attr(hotspot, "identifier"), `H${index + 1}`),
      shape: hotspotShape(attr(hotspot, "shape")),
      coords: attr(hotspot, "coords") ?? "",
      hotspotLabel: attr(hotspot, "hotspotLabel") ?? attr(hotspot, "hotspot-label") ?? undefined,
    }),
  );
  return {
    interactionType: "graphicOrder",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
    promptHtml: prompt(interaction),
    responseIdentifier,
    object: graphicObject(
      object,
      hotspots.map((hotspot) => hotspot.coords),
    ),
    hotspots,
    correctOrder: orderedIdentifierValues(context.responseDeclMap.get(responseIdentifier)),
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: toNumber(attr(interaction, "maxChoices")),
  };
}

function mapGraphicAssociate(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const object = findDescendantByLocalName(interaction, "object");
  const hotspots = findAllDescendantsByLocalName(interaction, "associablehotspot").map(
    (hotspot, index) => ({
      identifier: normalizeIdentifier(attr(hotspot, "identifier"), `H${index + 1}`),
      shape: hotspotShape(attr(hotspot, "shape")),
      coords: attr(hotspot, "coords") ?? "",
      matchMax: toNumber(attr(hotspot, "matchMax")),
    }),
  );
  return {
    interactionType: "graphicAssociate",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: trusted(bodyWithoutInteraction(context.body, interaction)),
    promptHtml: prompt(interaction),
    responseIdentifier,
    object: graphicObject(
      object,
      hotspots.map((hotspot) => hotspot.coords),
    ),
    hotspots,
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
    scoring: hasMapping(context.responseDeclMap.get(responseIdentifier))
      ? "map_response"
      : "match_correct",
  };
}

function mapGraphicGapMatch(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const object = findDescendantByLocalName(interaction, "object");
  const choices = findAllDescendantsByAnyLocalName(interaction, ["gaptext", "gapimg"]).map(
    (choice, index): Qti3GraphicGapChoice => graphicGapChoice(choice, index),
  );
  const targets: Qti3GraphicGapTarget[] = findAllDescendantsByLocalName(
    interaction,
    "associablehotspot",
  ).map((target, index) => ({
    targetType: "hotspot",
    identifier: normalizeIdentifier(attr(target, "identifier"), `T${index + 1}`),
    shape: hotspotShape(attr(target, "shape")),
    coords: attr(target, "coords") ?? "",
    matchMax: toNumber(attr(target, "matchMax")),
  }));
  const targetCoords = targets.flatMap((target) =>
    target.targetType === "inlineGap" ? [] : [target.coords],
  );
  return {
    interactionType: "graphicGapMatch",
    identifier: context.identifier,
    title: context.title,
    promptHtml: prompt(interaction),
    responseIdentifier,
    object: graphicObject(object, targetCoords),
    choices,
    targets,
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
    scoring: hasMapping(context.responseDeclMap.get(responseIdentifier))
      ? "map_response"
      : "match_correct",
  };
}

function simpleChoices(root: XmlElement): Qti3AuthoringChoice[] {
  return findAllDescendantsByLocalName(root, "simplechoice").map((choice, index) => ({
    identifier: normalizeIdentifier(attr(choice, "identifier"), `CHOICE_${index + 1}`),
    contentHtml: trusted(serializeChildren(choice)),
    text: textOf(choice) || undefined,
    fixed: attr(choice, "fixed") === "true",
  }));
}

function associableChoices(
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

function gapChoice(choice: XmlElement, index: number): Qti3GapMatchChoice {
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
      fixed: attr(choice, "fixed") === "true",
    };
  }
  return {
    identifier: normalizeIdentifier(attr(choice, "identifier"), `G${index + 1}`),
    kind: "text",
    contentHtml: trusted(serializeChildren(choice)),
    text: textOf(choice) || undefined,
    matchMax: toNumber(attr(choice, "matchMax")),
    fixed: attr(choice, "fixed") === "true",
  };
}

function graphicGapChoice(choice: XmlElement, index: number): Qti3GraphicGapChoice {
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
      fixed: attr(choice, "fixed") === "true",
    };
  }
  return {
    identifier: normalizeIdentifier(attr(choice, "identifier"), `G${index + 1}`),
    kind: "text",
    contentHtml: trusted(serializeChildren(choice)),
    text: textOf(choice) || undefined,
    matchMax: toNumber(attr(choice, "matchMax")),
    fixed: attr(choice, "fixed") === "true",
  };
}

function graphicObject(object: XmlElement | null, coords: readonly string[]) {
  const dimensions = inferImageDimensions(coords);
  return {
    data: attr(object, "data") ?? "",
    alt: attr(object, "alt") ?? attr(object, "label") ?? "Image",
    type: attr(object, "type") ?? undefined,
    width: toNumber(attr(object, "width")) ?? dimensions.width,
    height: toNumber(attr(object, "height")) ?? dimensions.height,
  };
}

function inferImageDimensions(coords: readonly string[]): { width: number; height: number } {
  let maxX = 1;
  let maxY = 1;
  for (const entry of coords) {
    const coordinateValues = entry
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    for (let index = 0; index < coordinateValues.length; index += 2) {
      maxX = Math.max(maxX, coordinateValues[index] ?? 1);
      maxY = Math.max(maxY, coordinateValues[index + 1] ?? 1);
    }
  }
  return { width: Math.ceil(maxX), height: Math.ceil(maxY) };
}

function responseIdentifierFor(interaction: XmlElement, fallback = "RESPONSE"): string {
  return normalizeIdentifier(
    attr(interaction, "responseIdentifier") ?? attr(interaction, "response-identifier"),
    fallback,
  );
}

function values(declaration: XmlElement | undefined): string[] {
  if (!declaration) return [];
  const correct = findDescendantByLocalName(declaration, "correctresponse");
  const source = correct ?? declaration;
  return findAllDescendantsByLocalName(source, "value")
    .map((value) => textOf(value))
    .filter(Boolean);
}

function pairValues(
  declaration: XmlElement | undefined,
): { sourceIdentifier: string; targetIdentifier: string }[] {
  return values(declaration)
    .map((value) => {
      const [sourceIdentifier = "", targetIdentifier = ""] = value.split(/\s+/);
      return {
        sourceIdentifier: normalizeIdentifier(sourceIdentifier),
        targetIdentifier: normalizeIdentifier(targetIdentifier),
      };
    })
    .filter((pair) => pair.sourceIdentifier && pair.targetIdentifier);
}

function orderedIdentifierValues(declaration: XmlElement | undefined): string[] {
  return values(declaration)
    .flatMap((value) => value.split(/\s+/))
    .map((value) => normalizeIdentifier(value))
    .filter(Boolean);
}

function textEntryAnswers(declaration: XmlElement | undefined) {
  const correctValues = values(declaration);
  if (!correctValues.length) return [{ value: "", score: 1, caseSensitive: false }];
  return correctValues.map((value) => ({ value, score: 1, caseSensitive: false }));
}

function hasMapping(declaration: XmlElement | undefined): boolean {
  return Boolean(findDescendantByLocalName(declaration, "mapping"));
}

function prompt(interaction: XmlElement): ReturnType<typeof qti3TrustedXmlFragment> | undefined {
  const promptElement = findDescendantByLocalName(interaction, "prompt");
  const html = promptElement ? serializeChildren(promptElement).trim() : "";
  return html ? trusted(html) : undefined;
}

function bodyWithoutInteraction(
  body: XmlElement,
  interaction: XmlElement,
): ReturnType<typeof qti3TrustedXmlFragment> {
  const bodyHtml = serializeChildren(body);
  const withoutInteraction = replaceSerializedNode(bodyHtml, interaction, "").trim();
  return trusted(withoutInteraction || "<p></p>");
}

function bodyWithInlineChoicePlaceholders(
  body: XmlElement,
  interactions: readonly XmlElement[],
): ReturnType<typeof qti3TrustedXmlFragment> {
  let html = serializeChildren(body);
  for (let index = 0; index < interactions.length; index += 1) {
    const interaction = interactions[index];
    if (!interaction) continue;
    const responseIdentifier = responseIdentifierFor(interaction, `RESPONSE_${index + 1}`);
    html = replaceSerializedNode(
      html,
      interaction,
      `<qti-inline-choice-interaction response-identifier="${escapeText(responseIdentifier)}"/>`,
    );
  }
  return trusted(html);
}

function bodyWithTextEntryPlaceholders(
  body: XmlElement,
  interactions: readonly XmlElement[],
): ReturnType<typeof qti3TrustedXmlFragment> {
  let html = serializeChildren(body);
  for (let index = 0; index < interactions.length; index += 1) {
    const interaction = interactions[index];
    if (!interaction) continue;
    const responseIdentifier = responseIdentifierFor(interaction, `RESPONSE_${index + 1}`);
    html = replaceSerializedNode(
      html,
      interaction,
      `<qti-text-entry-interaction response-identifier="${escapeText(responseIdentifier)}"/>`,
    );
  }
  return trusted(html);
}

function bodyWithHottextPlaceholders(
  interaction: XmlElement,
  hottexts: readonly XmlElement[],
): ReturnType<typeof qti3TrustedXmlFragment> {
  let html = serializeChildren(interaction);
  for (let index = 0; index < hottexts.length; index += 1) {
    const hottext = hottexts[index];
    if (!hottext) continue;
    const identifier = normalizeIdentifier(attr(hottext, "identifier"), `H${index + 1}`);
    html = replaceSerializedNode(
      html,
      hottext,
      `<qti-hottext identifier="${escapeText(identifier)}"/>`,
    );
  }
  return trusted(html || "<p></p>");
}

function bodyWithGapPlaceholders(
  interaction: XmlElement,
): ReturnType<typeof qti3TrustedXmlFragment> {
  let html = serializeChildren(interaction);
  for (const choice of findAllDescendantsByAnyLocalName(interaction, ["gaptext", "gapimg"])) {
    html = replaceSerializedNode(html, choice, "");
  }
  for (const gap of findAllDescendantsByLocalName(interaction, "gap")) {
    const identifier = normalizeIdentifier(attr(gap, "identifier"), "GAP");
    html = replaceSerializedNode(html, gap, `<qti-gap identifier="${escapeText(identifier)}"/>`);
  }
  return trusted(html || "<p></p>");
}

function replaceSerializedNode(source: string, node: XmlElement, replacement: string): string {
  const serialized = serializeNode(node);
  const withoutDefaultNamespace = serialized.replace(/\s+xmlns="[^"]*"/, "");
  const withoutPrefixedNamespace = withoutDefaultNamespace.replace(
    /\s+xmlns:[A-Za-z0-9_-]+="[^"]*"/g,
    "",
  );
  for (const candidate of [serialized, withoutDefaultNamespace, withoutPrefixedNamespace]) {
    if (source.includes(candidate)) return source.replace(candidate, replacement);
  }
  return source;
}

function trusted(html: string): ReturnType<typeof qti3TrustedXmlFragment> {
  return qti3TrustedXmlFragment(html.trim() || "<p></p>");
}

function baseType(value: string | null): "string" | "integer" | "float" {
  const normalized = value?.toLowerCase();
  return normalized === "integer" || normalized === "float" ? normalized : "string";
}

function responseCardinality(value: string | null): "single" | "multiple" | "ordered" {
  const normalized = value?.toLowerCase();
  return normalized === "multiple" || normalized === "ordered" ? normalized : "single";
}

function extendedTextFormat(value: string | null): "plain" | "preformatted" | "xhtml" {
  return value === "preformatted" || value === "xhtml" ? value : "plain";
}

function hotspotShape(value: string | null): "circle" | "rect" | "poly" {
  return value === "circle" || value === "poly" ? value : "rect";
}

export function itemTitleFromXml(xml: string): string {
  const doc = parseXml(xml, "item-title");
  const root = doc.documentElement;
  return (
    attr(root, "title")?.trim() ||
    stripTags(serializeChildren(root)).slice(0, 40) ||
    "Imported Item"
  );
}

import {
  type Qti3AuthoringItem,
  type Qti3GapMatchChoice,
  type Qti3GraphicGapChoice,
  type Qti3GraphicGapTarget,
  type Qti3HottextChoice,
  type Qti3InlineChoiceSlot,
  type Qti3TextEntryResponse,
} from "@longsightgroup/qti3-writer";
import {
  bodyWithGapPlaceholders,
  bodyWithHottextPlaceholders,
  bodyWithInlineChoicePlaceholders,
  bodyWithoutInteraction,
  bodyWithTextEntryPlaceholders,
  collectInteractionElements,
  prompt,
  trusted,
} from "./qti2-body.js";
import { associableChoices, gapChoice, graphicGapChoice, simpleChoices } from "./qti2-choices.js";
import { graphicObject, hotspotShape } from "./qti2-graphic.js";
import {
  hasMapping,
  orderedIdentifierValues,
  pairValues,
  responseValues,
} from "./qti2-response.js";
import { diagnostic } from "./diagnostics.js";
import { normalizeIdentifier, stripTags } from "./text.js";
import type {
  QtiMigrationDiagnostic,
  QtiMigrationSourceFormat,
  ResolvedQtiMigrationOptions,
} from "./types.js";
import {
  attr,
  findAllDescendantsByAnyLocalName,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  localName,
  parseXml,
  serializeChildren,
  textOf,
  toNumber,
  type XmlElement,
} from "./xml.js";

export function migrateQti2ItemXml(
  xml: string,
  path: string,
  sourceFormat: QtiMigrationSourceFormat,
  options: ResolvedQtiMigrationOptions,
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
    options,
    diagnostics,
  };
  const interactionCheck = supportedInteractionForItem(body, sourceFormat, path);
  if (interactionCheck.diagnostics.length) {
    return { diagnostics: interactionCheck.diagnostics };
  }
  const interaction = interactionCheck.interaction;
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
  try {
    return { authoringItem: mapper(interaction, context), diagnostics };
  } catch (error) {
    if (error instanceof Qti2MigrationBlocked) {
      return { diagnostics: error.diagnostics };
    }
    throw error;
  }
}

interface Qti2Context {
  readonly identifier: string;
  readonly title: string;
  readonly body: XmlElement;
  readonly responseDecls: readonly XmlElement[];
  readonly responseDeclMap: ReadonlyMap<string, XmlElement>;
  readonly sourceFormat: QtiMigrationSourceFormat;
  readonly path: string;
  readonly options: ResolvedQtiMigrationOptions;
  readonly diagnostics: QtiMigrationDiagnostic[];
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

function supportedInteractionForItem(
  root: XmlElement,
  sourceFormat: QtiMigrationSourceFormat,
  path: string,
): {
  readonly interaction?: XmlElement | undefined;
  readonly diagnostics: readonly QtiMigrationDiagnostic[];
} {
  const interactions = collectInteractionElements(root);
  const unsupported = interactions.filter(
    (interaction) => !supportedInteractionNames.has(localName(interaction)),
  );
  if (unsupported.length) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_interaction_unsupported",
          "error",
          `Unsupported QTI 2.x interaction ${localName(unsupported[0])}.`,
          { path, sourceFormat },
        ),
      ],
    };
  }
  const supported = interactions.filter((interaction) =>
    supportedInteractionNames.has(localName(interaction)),
  );
  const supportedNames = new Set(supported.map((interaction) => localName(interaction)));
  const supportsMultipleSlots =
    supportedNames.size === 1 &&
    (supportedNames.has("inlinechoiceinteraction") || supportedNames.has("textentryinteraction"));
  if (supported.length > 1 && !supportsMultipleSlots) {
    return {
      diagnostics: [
        diagnostic(
          "qti2_composite_interactions_unsupported",
          "error",
          "QTI 2.x item contains multiple interactions; partial migration is not allowed.",
          { path, sourceFormat },
        ),
      ],
    };
  }
  return { interaction: supported[0], diagnostics: [] };
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
      bodyHtml: bodyWithoutInteraction(context.body, interaction),
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
  repairOrError({
    needed: !correctResponse.length,
    context,
    code: "qti2_choice_correct_response_missing",
    message: "QTI 2.x choice interaction has no valid correct response.",
    repairMessage:
      "QTI 2.x choice response was missing or invalid; using the first declared choice.",
  });
  return {
    interactionType: "choice",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
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
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
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
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
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
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
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
      answers: textEntryAnswers(context.responseDeclMap.get(responseIdentifier), context),
    };
  });
  return {
    interactionType: "textEntry",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: bodyWithTextEntryPlaceholders(context.body, interactions, responseIdentifierFor),
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
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
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
    const correctResponse = responseValues(declaration)[0];
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
    bodyHtml: bodyWithInlineChoicePlaceholders(context.body, interactions, responseIdentifierFor),
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
    bodyHtml: bodyWithHottextPlaceholders(interaction, hottexts),
    responseIdentifier,
    choices,
    correctResponse: responseValues(context.responseDeclMap.get(responseIdentifier)).map((value) =>
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
    bodyHtml: bodyWithGapPlaceholders(interaction),
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
    correctResponse: responseValues(context.responseDeclMap.get(responseIdentifier)).map((value) =>
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
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
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
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
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

function responseIdentifierFor(interaction: XmlElement, fallback = "RESPONSE"): string {
  return normalizeIdentifier(
    attr(interaction, "responseIdentifier") ?? attr(interaction, "response-identifier"),
    fallback,
  );
}

function textEntryAnswers(declaration: XmlElement | undefined, context: Qti2Context) {
  const correctValues = responseValues(declaration);
  repairOrError({
    needed: !correctValues.length,
    context,
    code: "qti2_text_entry_correct_response_missing",
    message: "QTI 2.x text entry interaction has no correct text value.",
    repairMessage:
      "QTI 2.x text entry response did not declare a correct value; using an empty answer.",
  });
  if (!correctValues.length) return [{ value: "", score: 1, caseSensitive: false }];
  return correctValues.map((value) => ({ value, score: 1, caseSensitive: false }));
}

function repairOrError(input: {
  readonly needed: boolean;
  readonly context: Qti2Context;
  readonly code: string;
  readonly message: string;
  readonly repairMessage: string;
}): void {
  if (!input.needed) return;
  if (input.context.options.repairPolicy === "safe") {
    input.context.diagnostics.push(
      diagnostic(`${input.code}_repaired`, "warning", input.repairMessage, {
        path: input.context.path,
        sourceFormat: input.context.sourceFormat,
      }),
    );
    return;
  }
  throw new Qti2MigrationBlocked([
    diagnostic(input.code, "error", input.message, {
      path: input.context.path,
      sourceFormat: input.context.sourceFormat,
    }),
  ]);
}

class Qti2MigrationBlocked extends Error {
  constructor(readonly diagnostics: readonly QtiMigrationDiagnostic[]) {
    super("QTI 2.x migration blocked by strict policy.");
  }
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

export function itemTitleFromXml(xml: string): string {
  const doc = parseXml(xml, "item-title");
  const root = doc.documentElement;
  return (
    attr(root, "title")?.trim() ||
    stripTags(serializeChildren(root)).slice(0, 40) ||
    "Imported Item"
  );
}

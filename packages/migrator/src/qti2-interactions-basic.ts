import type {
  Qti3AuthoringItem,
  Qti3GapMatchChoice,
  Qti3HottextChoice,
  Qti3InlineChoiceSlot,
  Qti3TextEntryResponse,
} from "@longsightgroup/qti3-writer";

import {
  bodyWithGapPlaceholders,
  bodyWithHottextPlaceholders,
  bodyWithInlineChoicePlaceholders,
  bodyWithTextEntryPlaceholders,
  interactionPresentation,
  trusted,
} from "./qti2-body.js";
import { associableChoices, gapChoice, simpleChoices } from "./qti2-choices.js";
import {
  type Qti2Context,
  responseIdentifierFor,
  baseType,
  extendedTextFormat,
  responseCardinality,
} from "./qti2-context.js";
import { applyRepairPolicy, blockMigrationOnRepair } from "./repair-policy.js";
import {
  hasMapping,
  orderedIdentifierValues,
  pairValues,
  responseValues,
} from "./qti2-response.js";
import { normalizeIdentifier } from "./text.js";
import { xmlBooleanAttribute } from "./xml-boolean.js";
import {
  attr,
  findAllDescendantsByAnyLocalName,
  findAllDescendantsByLocalName,
  serializeChildren,
  textOf,
  toNumber,
  type XmlElement,
} from "./xml.js";

export function mapChoice(
  interaction: XmlElement,
  context: Qti2Context,
): Qti3AuthoringItem | undefined {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  const cardinality = (attr(declaration, "cardinality") ?? "").toLowerCase();
  const maxChoices = toNumber(attr(interaction, "maxChoices"));
  const choices = simpleChoices(interaction);
  const correctValues = orderedIdentifierValues(declaration);
  const presentation = interactionPresentation(interaction, context.body, "separate");
  if (cardinality === "ordered") {
    return {
      interactionType: "order",
      identifier: context.identifier,
      title: context.title,
      ...presentation,
      responseIdentifier,
      choices,
      correctOrder: correctValues.length
        ? correctValues
        : choices.map((choice) => choice.identifier),
      shuffle: xmlBooleanAttribute(attr(interaction, "shuffle")),
      minChoices: toNumber(attr(interaction, "minChoices")),
      maxChoices,
    };
  }
  const choiceCardinality =
    cardinality === "multiple" || (maxChoices ?? 0) > 1 ? "multiple" : "single";
  const correctResponse = correctValues.filter((value) =>
    choices.some((choice) => choice.identifier === value),
  );
  const repair = applyRepairPolicy({
    needed: !correctResponse.length,
    context,
    code: "qti2_choice_correct_response_missing",
    message: "QTI 2.x choice interaction has no valid correct response.",
    repairMessage:
      "QTI 2.x choice response was missing or invalid; using the first declared choice.",
  });
  if (blockMigrationOnRepair(context, repair)) return undefined;
  return {
    interactionType: "choice",
    identifier: context.identifier,
    title: context.title,
    ...presentation,
    responseIdentifier,
    responseCardinality: choiceCardinality,
    choices,
    correctResponse: correctResponse.length
      ? correctResponse
      : choices.slice(0, 1).map((choice) => choice.identifier),
    shuffle: xmlBooleanAttribute(attr(interaction, "shuffle")),
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: choiceCardinality === "single" ? 1 : maxChoices,
    scoring: hasMapping(declaration) ? "map_response" : "match_correct",
  };
}

export function mapOrder(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const choices = simpleChoices(interaction);
  const correctOrder = orderedIdentifierValues(context.responseDeclMap.get(responseIdentifier));
  return {
    interactionType: "order",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier,
    choices,
    correctOrder: correctOrder.length ? correctOrder : choices.map((choice) => choice.identifier),
    shuffle: xmlBooleanAttribute(attr(interaction, "shuffle")),
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: toNumber(attr(interaction, "maxChoices")),
  };
}

export function mapMatch(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const sets = findAllDescendantsByLocalName(interaction, "simplematchset");
  return {
    interactionType: "match",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier,
    sources: associableChoices(sets[0], "SOURCE"),
    targets: associableChoices(sets[1], "TARGET"),
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    shuffle: xmlBooleanAttribute(attr(interaction, "shuffle")),
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
  };
}

export function mapAssociate(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  return {
    interactionType: "associate",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier,
    choices: associableChoices(interaction, "CHOICE"),
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    shuffle: xmlBooleanAttribute(attr(interaction, "shuffle")),
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
    scoring: hasMapping(context.responseDeclMap.get(responseIdentifier))
      ? "map_response"
      : "match_correct",
  };
}

export function mapTextEntryItem(context: Qti2Context): Qti3AuthoringItem | undefined {
  const interactions = findAllDescendantsByLocalName(context.body, "textentryinteraction");
  const responses = interactions.map((entry, index): Qti3TextEntryResponse => {
    const responseIdentifier = responseIdentifierFor(entry, `RESPONSE_${index + 1}`);
    return {
      responseIdentifier,
      answers: textEntryAnswers(context.responseDeclMap.get(responseIdentifier), context),
    };
  });
  if (context.blocked) return undefined;
  return {
    interactionType: "textEntry",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: bodyWithTextEntryPlaceholders(context.body, interactions, responseIdentifierFor),
    responses,
  };
}

export function mapExtendedText(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  return {
    interactionType: "extendedText",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
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

export function mapInlineChoiceItem(context: Qti2Context): Qti3AuthoringItem {
  const interactions = findAllDescendantsByLocalName(context.body, "inlinechoiceinteraction");
  const slots = interactions.map((entry, index): Qti3InlineChoiceSlot => {
    const responseIdentifier = responseIdentifierFor(entry, `RESPONSE_${index + 1}`);
    const declaration = context.responseDeclMap.get(responseIdentifier);
    const correctResponse = responseValues(declaration)[0];
    return {
      responseIdentifier,
      shuffle: xmlBooleanAttribute(attr(entry, "shuffle")),
      required: xmlBooleanAttribute(attr(entry, "required")),
      options: findAllDescendantsByLocalName(entry, "inlinechoice").map((choice, choiceIndex) => ({
        identifier: normalizeIdentifier(attr(choice, "identifier"), `CHOICE_${choiceIndex + 1}`),
        contentHtml: trusted(serializeChildren(choice)),
        text: textOf(choice) || undefined,
        fixed: xmlBooleanAttribute(attr(choice, "fixed")),
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

export function mapHottext(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
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

export function mapGapMatch(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
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
    bodyHtml: bodyWithGapPlaceholders(interaction),
    responseIdentifier,
    choices,
    targets,
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    shuffle: xmlBooleanAttribute(attr(interaction, "shuffle")),
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
    scoring: hasMapping(context.responseDeclMap.get(responseIdentifier))
      ? "map_response"
      : "match_correct",
  };
}

function textEntryAnswers(declaration: XmlElement | undefined, context: Qti2Context) {
  const correctValues = responseValues(declaration);
  const repair = applyRepairPolicy({
    needed: !correctValues.length,
    context,
    code: "qti2_text_entry_correct_response_missing",
    message: "QTI 2.x text entry interaction has no correct text value.",
    repairMessage:
      "QTI 2.x text entry response did not declare a correct value; using an empty answer.",
  });
  if (blockMigrationOnRepair(context, repair)) return [];
  if (!correctValues.length) return [{ value: "", score: 1, caseSensitive: false }];
  return correctValues.map((value) => ({ value, score: 1, caseSensitive: false }));
}

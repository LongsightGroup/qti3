import type {
  Qti3AuthoringItem,
  Qti3GraphicGapChoice,
  Qti3GraphicGapTarget,
} from "@longsightgroup/qti3-writer";

import { interactionPresentation, trusted } from "./qti2-body.js";
import { graphicGapChoice } from "./qti2-choices.js";
import { graphicObject, hotspotShape } from "./qti2-graphic.js";
import { type Qti2Context, responseIdentifierFor } from "./qti2-context.js";
import {
  hasMapping,
  orderedIdentifierValues,
  pairValues,
  responseValues,
} from "./qti2-response.js";
import { normalizeIdentifier } from "./text.js";
import {
  attr,
  findAllDescendantsByAnyLocalName,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  toNumber,
  type XmlElement,
} from "./xml.js";

export function mapHotspot(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
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
    ...interactionPresentation(interaction, context.body, "prompt-only"),
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

export function mapGraphicOrder(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
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
    ...interactionPresentation(interaction, context.body, "separate"),
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

export function mapGraphicAssociate(
  interaction: XmlElement,
  context: Qti2Context,
): Qti3AuthoringItem {
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
    ...interactionPresentation(interaction, context.body, "separate"),
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

export function mapGraphicGapMatch(
  interaction: XmlElement,
  context: Qti2Context,
): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const object = findDescendantByLocalName(interaction, "object");
  const choices = findAllDescendantsByAnyLocalName(interaction, ["gaptext", "gapimg"]).map(
    (choice, index): Qti3GraphicGapChoice => graphicGapChoice(choice, index),
  );
  const hotspotTargets: Qti3GraphicGapTarget[] = findAllDescendantsByLocalName(
    interaction,
    "associablehotspot",
  ).map((target, index) => ({
    targetType: "hotspot",
    identifier: normalizeIdentifier(attr(target, "identifier"), `T${index + 1}`),
    shape: hotspotShape(attr(target, "shape")),
    coords: attr(target, "coords") ?? "",
    matchMax: toNumber(attr(target, "matchMax")),
  }));
  const inlineTargets: Qti3GraphicGapTarget[] = findAllDescendantsByLocalName(
    interaction,
    "gap",
  ).map((target, index) => ({
    targetType: "inlineGap",
    identifier: normalizeIdentifier(attr(target, "identifier"), `G${index + 1}`),
    matchMax: toNumber(attr(target, "matchMax")),
  }));
  const targets = [...hotspotTargets, ...inlineTargets];
  const targetCoords = targets.flatMap((target) =>
    target.targetType === "inlineGap" ? [] : [target.coords],
  );
  const presentation = interactionPresentation(interaction, context.body, "separate");
  return {
    interactionType: "graphicGapMatch",
    identifier: context.identifier,
    title: context.title,
    responseIdentifier,
    object: graphicObject(object, targetCoords),
    choices,
    targets,
    ...presentation,
    bodyHtml: inlineTargets.length
      ? trusted(
          `<p>${inlineTargets
            .map((target) => `<qti-gap identifier="${target.identifier}"/>`)
            .join(" ")}</p>`,
        )
      : presentation.bodyHtml,
    correctResponse: pairValues(context.responseDeclMap.get(responseIdentifier)),
    minAssociations: toNumber(attr(interaction, "minAssociations")),
    maxAssociations: toNumber(attr(interaction, "maxAssociations")),
    scoring: hasMapping(context.responseDeclMap.get(responseIdentifier))
      ? "map_response"
      : "match_correct",
  };
}

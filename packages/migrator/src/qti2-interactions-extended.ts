import type { Qti3AuthoringItem } from "@longsightgroup/qti3-writer";

import { bodyWithoutInteraction, interactionPresentation, trusted } from "./qti2-body.js";
import { graphicObject } from "./qti2-graphic.js";
import { type Qti2Context, responseIdentifierFor } from "./qti2-context.js";
import { hasMapping, responseValues } from "./qti2-response.js";
import { xmlBooleanAttribute } from "./xml-boolean.js";
import {
  attr,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  serializeChildren,
  textOf,
  toNumber,
  type XmlElement,
} from "./xml.js";

export function mapDrawing(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  return {
    interactionType: "drawing",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier: responseIdentifierFor(interaction),
    object: graphicObject(findDescendantByLocalName(interaction, "object"), []),
  };
}

export function mapEndAttempt(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  return {
    interactionType: "endAttempt",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: bodyWithoutInteraction(context.body, interaction),
    responseIdentifier: responseIdentifierFor(interaction),
    buttonTitle: attr(interaction, "title")?.trim() || "End attempt",
    countAttempt: xmlBooleanAttribute(attr(interaction, "countAttempt")),
  };
}

export function mapMedia(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const object = findDescendantByLocalName(interaction, "object");
  const sourceElements = findAllDescendantsByLocalName(interaction, "source");
  const objectData = attr(object, "data");
  const objectType = attr(object, "type");
  const sources = sourceElements.length
    ? sourceElements.map((source) => ({
        src: attr(source, "src") ?? "",
        type: attr(source, "type") ?? undefined,
      }))
    : objectData
      ? [{ src: objectData, type: objectType ?? undefined }]
      : [];
  const mediaType = sources[0]?.type ?? "";
  const kind = mediaType.startsWith("audio/")
    ? ("audio" as const)
    : mediaType.startsWith("video/")
      ? ("video" as const)
      : ("object" as const);
  return {
    interactionType: "media",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier: responseIdentifierFor(interaction),
    kind,
    sources,
    objectLabel: textOf(object) || attr(object, "label") || undefined,
    autostart: xmlBooleanAttribute(attr(interaction, "autostart")),
    loop: xmlBooleanAttribute(attr(interaction, "loop")),
    minPlays: toNumber(attr(interaction, "minPlays")),
    maxPlays: toNumber(attr(interaction, "maxPlays")),
    width: toNumber(attr(object, "width")),
    height: toNumber(attr(object, "height")),
  };
}

export function mapSelectPoint(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  return {
    interactionType: "selectPoint",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier,
    object: graphicObject(findDescendantByLocalName(interaction, "object"), []),
    targets: pointTargets(declaration),
    correctResponse: responseValues(declaration),
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: toNumber(attr(interaction, "maxChoices")),
  };
}

export function mapPositionObject(
  interaction: XmlElement,
  context: Qti2Context,
): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  const stage = findDescendantByLocalName(context.body, "positionobjectstage");
  return {
    interactionType: "positionObject",
    identifier: context.identifier,
    title: context.title,
    bodyHtml: bodyWithoutInteraction(context.body, stage ?? interaction),
    promptHtml: interactionPresentation(interaction, context.body, "separate").promptHtml,
    responseIdentifier,
    stageObject: graphicObject(stage ? findDescendantByLocalName(stage, "object") : null, []),
    movableObject: graphicObject(findDescendantByLocalName(interaction, "object"), []),
    targets: pointTargets(declaration),
    correctResponse: responseValues(declaration),
    centerPoint: attr(interaction, "centerPoint") ?? undefined,
    minChoices: toNumber(attr(interaction, "minChoices")),
    maxChoices: toNumber(attr(interaction, "maxChoices")),
  };
}

export function mapSlider(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  const lowerBound = toNumber(attr(interaction, "lowerBound")) ?? 0;
  const correctResponse = Number(responseValues(declaration)[0] ?? lowerBound);
  const mappings = declaration
    ? findAllDescendantsByLocalName(declaration, "mapentry")
        .map((entry) => ({
          mapKey: toNumber(attr(entry, "mapKey")),
          mappedValue: toNumber(attr(entry, "mappedValue")),
        }))
        .filter(
          (entry): entry is { mapKey: number; mappedValue: number } =>
            entry.mapKey !== undefined && entry.mappedValue !== undefined,
        )
    : [];
  return {
    interactionType: "slider",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier,
    lowerBound,
    upperBound: toNumber(attr(interaction, "upperBound")) ?? 1,
    correctResponse: Number.isFinite(correctResponse) ? correctResponse : lowerBound,
    step: toNumber(attr(interaction, "step")),
    stepLabel: xmlBooleanAttribute(attr(interaction, "stepLabel")),
    orientation: attr(interaction, "orientation") === "vertical" ? "vertical" : "horizontal",
    reverse: xmlBooleanAttribute(attr(interaction, "reverse")),
    baseType: attr(declaration, "baseType") === "float" ? "float" : "integer",
    ...(mappings.length > 0 ? { mappings } : {}),
    scoring: hasMapping(declaration) ? "map_response" : "match_correct",
  };
}

export function mapUpload(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  return {
    interactionType: "upload",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier: responseIdentifierFor(interaction),
    maxFileSize: toNumber(attr(interaction, "maxFileSize")),
    fileTypes: attr(interaction, "type") ?? undefined,
    multiple: xmlBooleanAttribute(attr(interaction, "data-multiple")),
  };
}

export function mapCustom(interaction: XmlElement, context: Qti2Context): Qti3AuthoringItem {
  const responseIdentifier = responseIdentifierFor(interaction);
  const declaration = context.responseDeclMap.get(responseIdentifier);
  return {
    interactionType: "custom",
    identifier: context.identifier,
    title: context.title,
    ...interactionPresentation(interaction, context.body, "separate"),
    responseIdentifier,
    responseBaseType: customBaseType(attr(declaration, "baseType")),
    responseCardinality: customCardinality(attr(declaration, "cardinality")),
    definition: attr(interaction, "definition") ?? undefined,
    interactionMarkupHtml: trusted(serializeChildren(interaction)),
  };
}

function pointTargets(declaration: XmlElement | undefined) {
  return declaration
    ? findAllDescendantsByLocalName(declaration, "areamapentry").map((entry) => ({
        shape: pointShape(attr(entry, "shape")),
        coords: attr(entry, "coords") ?? "",
        mappedValue: toNumber(attr(entry, "mappedValue")),
      }))
    : [];
}

function pointShape(value: string | null): "circle" | "default" | "poly" | "rect" {
  return value === "circle" || value === "default" || value === "poly" ? value : "rect";
}

function customBaseType(
  value: string | null,
):
  | "identifier"
  | "boolean"
  | "integer"
  | "float"
  | "string"
  | "point"
  | "pair"
  | "directedPair"
  | "duration"
  | "file"
  | "uri" {
  switch (value) {
    case null:
      return "string";
    case "identifier":
    case "boolean":
    case "integer":
    case "float":
    case "string":
    case "point":
    case "pair":
    case "directedPair":
    case "duration":
    case "file":
    case "uri":
      return value;
    default:
      return "string";
  }
}

function customCardinality(value: string | null): "single" | "multiple" | "ordered" | "record" {
  return value === "multiple" || value === "ordered" || value === "record" ? value : "single";
}

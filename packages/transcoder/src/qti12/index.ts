import type { QtiInteraction } from "@longsightgroup/qti3-core";

import type { Qti12InteractionPolicy } from "../profiles.js";
import { serializeCanvasItemMetadata } from "../qti12-canvas.js";
import { serializeRichContentBody } from "../rich-content-html.js";
import type { NormalizedQti3Item } from "../source.js";
import { escapeXml } from "../xml.js";
import {
  portableCustomAssets,
  serializeQti12Asset,
  serializeQti12ContentAssets,
} from "./assets.js";
import { declarationFor, mapQti12Interaction } from "./mappers.js";
import {
  isCanvasQti12Dialect,
  type Qti12MappedInteraction,
  type Qti12WireDialect,
  type Qti12WriteResult,
} from "./types.js";

export type { Qti12MappedInteraction, Qti12WireDialect, Qti12WriteResult } from "./types.js";

export function writeQti12Item(
  source: NormalizedQti3Item,
  policies: Readonly<Record<QtiInteraction["type"], Qti12InteractionPolicy>>,
  dialect: Qti12WireDialect = "standard",
): Qti12WriteResult {
  const responses = source.item.interactions.map((interaction, index) =>
    mapQti12Interaction(
      interaction,
      declarationFor(source, interaction),
      policies[interaction.type],
      index,
      source.sourcePath,
      dialect,
    ),
  );
  const mappings = responses.map<Qti12MappedInteraction>((response, index) => ({
    source: source.item.interactions[index]?.type ?? "custom",
    emitted: response.emitted,
    scoring: response.scoring,
    fallback: response.fallback,
    responseXml: response.xml,
    processingXml: response.processingXml,
    diagnostics: response.diagnostics,
  }));
  const diagnostics = mappings.flatMap((mapping) => mapping.diagnostics);
  const identifier = source.item.identifier || "ITEM";
  const title = source.item.title?.trim() || identifier;
  const plainPrompt = [source.item.prompt, source.item.bodyText]
    .map((value) => value?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" ");
  const prompt = isCanvasQti12Dialect(dialect)
    ? serializeRichContentBody(source.item.body, source.item.interactions) || escapeXml(plainPrompt)
    : escapeXml(plainPrompt);
  const retainedAssets = source.item.interactions
    .flatMap((interaction) => [
      interaction.object,
      interaction.positionObjectStage,
      ...interaction.choices.map((choice) => choice.asset),
      ...portableCustomAssets(interaction),
    ])
    .filter((asset): asset is NonNullable<typeof asset> => asset !== undefined)
    .map(serializeQti12Asset)
    .join("\n      ");
  const retainedBodyAssets = isCanvasQti12Dialect(dialect)
    ? ""
    : serializeQti12ContentAssets(source.item.body);
  const responseProcessing = responses.map((response) => response.processingXml).join("\n      ");
  const canvasMetadata = isCanvasQti12Dialect(dialect)
    ? serializeCanvasItemMetadata(source, responses)
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2.xsd">
  <item ident="${escapeXml(identifier)}" title="${escapeXml(title)}">
    ${canvasMetadata}
    <presentation>
      <material><mattext texttype="text/html">${prompt}</mattext></material>
      ${retainedAssets}
      ${retainedBodyAssets}
      ${responses.map((response) => response.xml).join("\n      ")}
    </presentation>
    <resprocessing>
      <outcomes><decvar varname="SCORE" vartype="Decimal" defaultval="0"${
        isCanvasQti12Dialect(dialect) ? ' minvalue="0" maxvalue="100"' : ""
      }/></outcomes>
      ${responseProcessing || '<respcondition continue="No"><conditionvar><other/></conditionvar></respcondition>'}
    </resprocessing>
  </item>
</questestinterop>`.replace(/^[\t ]+$/gm, "");

  return {
    xml,
    mappings,
    diagnostics,
  };
}

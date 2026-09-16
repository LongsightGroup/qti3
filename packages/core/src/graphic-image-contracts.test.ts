import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseQtiXml } from "./index.js";

for (const type of [
  "hotspot",
  "graphicOrder",
  "graphicAssociate",
  "graphicGapMatch",
  "positionObject",
  "selectPoint",
]) {
  it.each(["img", "picture"])(`preserves ${type} %s image contracts`, (form) => {
    const xml = readFileSync(
      new URL(`../../fixtures/xml/${type}-reference.xml`, import.meta.url),
      "utf8",
    );
    const original = parseQtiXml(xml).document?.item.interactions[0];
    const result = parseQtiXml(
      xml.replace(/<object\s[^>]*\/>/g, (object) => {
        const img = object
          .replace("<object", "<img")
          .replace(' data="', ' src="')
          .replace("/>", ' alt="Workflow"/>');
        return form === "img"
          ? img
          : `<picture><source srcset="workflow.webp 1x, workflow-large.webp 2x" type="image/webp"/>${img}</picture>`;
      }),
    );
    expect(result.diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
    const interaction = result.document?.item.interactions[0];
    expect(interaction?.object).toMatchObject({
      data: original?.object?.data,
      width: original?.object?.width,
      height: original?.object?.height,
      text: "Workflow",
    });
    expect(interaction?.choices.map((choice) => choice.attributes.coords)).toEqual(
      original?.choices.map((choice) => choice.attributes.coords),
    );
    if (form === "picture")
      expect(interaction?.object?.sources[0]?.attributes.srcset).toBe(
        "workflow.webp 1x, workflow-large.webp 2x",
      );
    if (type === "positionObject")
      expect(interaction?.positionObjectStage).toMatchObject({
        data: original?.positionObjectStage?.data,
        width: "480",
        height: "300",
        text: "Workflow",
      });
  });
}

it("requires Graphic Gap Match hotspots after its image and gap choices", () => {
  const xml = readFileSync(
    new URL("../../fixtures/xml/graphicGapMatch-reference.xml", import.meta.url),
    "utf8",
  );
  const target = /<qti-associable-hotspot[^>]*\/>/g;
  const invalidItems = [
    xml.replace(target, ""),
    xml.replace(target, '<p><qti-gap identifier="TEXT_GAP"/></p>'),
    xml.replace(
      '<qti-gap-text identifier="A"',
      '<qti-associable-hotspot identifier="EARLY" shape="rect" coords="1,1,10,10" match-max="1"/><qti-gap-text identifier="A"',
    ),
  ];
  for (const invalid of invalidItems)
    expect(parseQtiXml(invalid).diagnostics).toContainEqual(
      expect.objectContaining({ code: "interaction.graphicGapMatch.children", severity: "error" }),
    );
});

it("requires exactly one marker image inside Position Object", () => {
  const xml = readFileSync(
    new URL("../../fixtures/xml/positionObject-reference.xml", import.meta.url),
    "utf8",
  );
  for (const child of [
    "<qti-prompt>Move it</qti-prompt>",
    '<img src="extra.png" alt="Extra"/>',
    '<qti-position-object-stage><img src="nested.png" alt="Nested"/></qti-position-object-stage>',
  ]) {
    const invalid = xml.replace(
      "</qti-position-object-interaction>",
      `${child}</qti-position-object-interaction>`,
    );
    expect(parseQtiXml(invalid).diagnostics).toContainEqual(
      expect.objectContaining({ code: "interaction.positionObject.children", severity: "error" }),
    );
  }
});

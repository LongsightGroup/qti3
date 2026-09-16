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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml, validateAssessmentItem } from "./index.js";

function fixture(type: string, choiceName: string, shuffle?: string) {
  const path = type === "choice" ? "shuffle/choice" : `${type}-reference`;
  let xml = readFileSync(new URL(`../../fixtures/xml/${path}.xml`, import.meta.url), "utf8")
    .replace(' shuffle="true"', shuffle === undefined ? "" : ` shuffle="${shuffle}"`)
    .replace(
      `<${choiceName} identifier="A"`,
      `<${choiceName} template-identifier="VISIBLE" identifier="A"`,
    )
    .replace(
      `<${choiceName} identifier="B"`,
      `<${choiceName} template-identifier="VISIBLE" show-hide="hide" identifier="B"`,
    );
  xml = xml.replace(
    "<qti-item-body>",
    `<qti-template-declaration identifier="VISIBLE" cardinality="multiple" base-type="identifier"><qti-default-value><qti-value>B</qti-value><qti-value>C</qti-value></qti-default-value></qti-template-declaration><qti-item-body>`,
  );
  const parsed = parseQtiXml(xml);
  if (!parsed.document) throw new Error("Fixture must parse");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  return parsed.document;
}

describe("template choice visibility", () => {
  it.each([undefined, "false", "0", "true", "1"])(
    "filters both visibility polarities with shuffle=%s and restores",
    (shuffle) => {
      const doc = fixture("choice", "qti-simple-choice", shuffle);
      const original = structuredClone(doc);
      const session = createItemSession(doc, undefined, { presentationSeed: 31 });
      const result = session.presentation();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.interactions[0]?.choices.map((choice) => choice.identifier).toSorted()).toEqual(
        ["C", "D", "E"],
      );
      expect(doc).toEqual(original);
      expect(createItemSession(doc, session.serialize()).presentation()).toEqual(result);
    },
  );

  it.each([
    ["hotspot", "qti-hotspot-choice"],
    ["hottext", "qti-hottext"],
  ])("filters nonshufflable %s choices", (type, name) => {
    const doc = fixture(type, name);
    const result = createItemSession(doc).presentation();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.interactions[0]?.choices.map((choice) => choice.identifier)).toEqual(["C", "D"]);
    if (type === "hottext") {
      const segments = result.interactions[0]?.hottextSegments ?? [];
      expect(
        segments
          .filter((segment) => segment.kind === "hottext")
          .map((segment) => segment.identifier),
      ).toEqual(["C", "D"]);
      expect(
        segments
          .filter((segment) => segment.kind === "text")
          .map((segment) => segment.text)
          .join(" "),
      ).toContain("The lot is 0.4 acres");
    }
  });
});

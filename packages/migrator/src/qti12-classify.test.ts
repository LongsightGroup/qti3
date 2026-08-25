import { describe, expect, it } from "vitest";
import { detectQtiMigrationSource } from "./index.js";
import { classifyQti12Item } from "./qti12-classify.js";
import { parseXml } from "./xml.js";

describe("QTI 1.2 item classification", () => {
  it("classifies Sakai essay metadata before response markup", () => {
    const classification = classify(`
      <item>
        <itemmetadata><qtimetadata><qtimetadatafield>
          <fieldlabel>qmd_itemtype</fieldlabel><fieldentry>Essay</fieldentry>
        </qtimetadatafield></qtimetadata></itemmetadata>
        <presentation><response_str ident="answer"><render_fib/></response_str></presentation>
      </item>
    `);

    expect(classification).toEqual({ kind: "essay" });
  });

  it("classifies response-string and response-number fib renderers as text entry", () => {
    expect(
      classify(
        '<item><presentation><response_str ident="text"><render_fib/></response_str></presentation></item>',
      ),
    ).toMatchObject({ kind: "textEntry" });
    expect(
      classify(
        '<item><presentation><response_num ident="number"><render_fib/></response_num></presentation></item>',
      ),
    ).toMatchObject({ kind: "textEntry" });
  });

  it("recognizes Canvas-style multi-response matching", () => {
    const classification = classify(`
      <item>
        <itemmetadata><qtimetadata><qtimetadatafield>
          <fieldlabel>question_type</fieldlabel><fieldentry>matching_question</fieldentry>
        </qtimetadatafield></qtimetadata></itemmetadata>
        <presentation>
          <response_lid ident="left"><render_choice><response_label ident="A"/></render_choice></response_lid>
          <response_lid ident="right"><render_choice><response_label ident="B"/></render_choice></response_lid>
        </presentation>
      </item>
    `);

    expect(classification).toMatchObject({ kind: "canvasMatch" });
    if (classification.kind !== "canvasMatch") throw new Error("Expected Canvas match.");
    expect(classification.choiceResponses).toHaveLength(2);
  });

  it("falls back to essay only without scorable responses and otherwise stays unsupported", () => {
    expect(
      classify("<item><presentation><material>Prompt</material></presentation></item>"),
    ).toEqual({
      kind: "essay",
    });
    expect(
      classify(
        '<item><presentation><response_str ident="unknown"><render_extension/></response_str></presentation></item>',
      ),
    ).toEqual({ kind: "unsupported" });
  });

  it("reports stable QTI 1.2 source confidence and reason metadata", () => {
    expect(
      detectQtiMigrationSource({
        filename: "legacy.xml",
        xml: '<questestinterop><item ident="legacy"/></questestinterop>',
      }),
    ).toEqual({
      supported: true,
      sourceFormat: "qti12",
      confidence: 0.75,
      reason: "qti12-root",
      isPackage: false,
    });
  });
});

function classify(xml: string): ReturnType<typeof classifyQti12Item> {
  return classifyQti12Item(parseXml(xml, "qti12-classify-test").documentElement);
}

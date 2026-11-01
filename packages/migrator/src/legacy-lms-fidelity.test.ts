import { describe, expect, it } from "vitest";
import { scoreQtiItemServerSide } from "@longsightgroup/qti3-core";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { canvasChoiceXml, canvasEssayXml } from "./canvas-export-fixture.js";
import { migrateQtiToQti3, migrateQtiResourceToQti3 } from "./index.js";

// Original synthetic inputs follow Canvas qti_items.rb; the authored SCORE=100 is percentage,
// while points_possible gives the item mark. Assertions are source grades, not round-trip totals.
describe("legacy LMS source fidelity", () => {
  it("retains Canvas point grades and keeps answer labels out of the stem", async () => {
    const result = await migrateQtiToQti3({ xml: canvasChoiceXml("3") });
    const item = result.items[0];
    expect(item.xml).toBeDefined();
    if (!item.xml) return;
    const document = validQtiDocument(item.xml);
    expect(document.item.interactions[0]?.choices).toHaveLength(2);
    expect(item.authoringItem?.bodyHtml).not.toContain("Paris");
    for (const [response, expected] of [
      ["A", 3],
      ["B", 0],
      [null, 0],
    ] as const) {
      const scored = scoreQtiItemServerSide({
        itemXml: item.xml,
        trustedResponses: { RESPONSE: response },
      });
      expect(scored.ok).toBe(true);
      expect(scored.score).toBe(expected);
    }
  });
  it("normalizes HTML void tags and feedback without changing the answer program", async () => {
    const xml = canvasChoiceXml()
      .replace("Which city is in France?", "<![CDATA[<p>Read<br>this&nbsp;question.</p>]]>")
      .replace(
        "</respcondition>",
        '<displayfeedback feedbacktype="Response" linkrefid="FB"/></respcondition>',
      )
      .replace(
        "</item>",
        '<itemfeedback ident="FB"><material><mattext>Correct</mattext></material></itemfeedback></item>',
      );
    const result = await migrateQtiToQti3({ xml });
    const item = result.items[0];
    if (!item.xml) throw new Error("Expected converted HTML item");
    validQtiDocument(item.xml);
    expect(item.diagnostics.map((d) => d.code)).toContain("qti12_feedback_review");
    expect(
      scoreQtiItemServerSide({ itemXml: item.xml, trustedResponses: { RESPONSE: "A" } }).score,
    ).toBe(3);
  });
  it("preserves manual essay/upload grading and their source mark guidance", async () => {
    for (const upload of [false, true]) {
      const xml = upload
        ? canvasEssayXml()
            .replace("essay_question", "file_upload_question")
            .replace(/<response_str[\s\S]*?<\/response_str>/, "")
        : canvasEssayXml();
      const result = await migrateQtiToQti3({ xml });
      const item = result.items[0];
      if (!item.xml) throw new Error("Expected manual item");
      validQtiDocument(item.xml);
      expect(item.xml).toContain('external-scored="human"');
      expect(item.xml).toContain("Source maximum: 5 points");
      expect(
        scoreQtiItemServerSide({ itemXml: item.xml, trustedResponses: { RESPONSE: "submission" } })
          .score,
      ).toBeNull();
    }
  });
  it("retains blocked siblings with their own identifiers and rejects score-changing programs", async () => {
    const xml = canvasChoiceXml().replace(
      "</item></section>",
      '</item><item ident="BAD" title="Needs review"><presentation><material><mattext>Unsupported</mattext></material><response_num ident="NUMBER"><render_slider/></response_num></presentation></item></section>',
    );
    const result = await migrateQtiResourceToQti3(
      { sourcePath: "quiz.xml", files: { "quiz.xml": new TextEncoder().encode(xml) } },
      { unsupportedPolicy: "stub", repairPolicy: "safe" },
    );
    expect(result.migration.items.map((item) => item.identifier)).toEqual(["CHOICE", "BAD"]);
    const good = result.migration.items[0];
    if (!good.xml) throw new Error("Expected retained sibling");
    validQtiDocument(good.xml);
    expect(good.diagnostics.some((d) => d.severity === "error")).toBe(false);
    const unsafe = await migrateQtiToQti3(
      {
        xml: canvasChoiceXml().replace("</setvar>", '</setvar><setvar varname="EXTRA">1</setvar>'),
      },
      { repairPolicy: "safe" },
    );
    expect(unsafe.items[0]?.xml).toBeUndefined();
    expect(unsafe.items[0]?.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });
  it("retains random-group evidence and unscored passages without inventing essay responses", async () => {
    const passage =
      '<item ident="PASSAGE" title="Read"><itemmetadata><qtimetadata><qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>text_only_question</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>passage</fieldlabel><fieldentry>true</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>0</fieldentry></qtimetadatafield></qtimetadata></itemmetadata><presentation><material><mattext>Read first.</mattext></material></presentation></item>';
    const xml = canvasChoiceXml().replace(
      '<section ident="SECTION">',
      '<section ident="SECTION" title="Draw"><selection_ordering><selection><selection_number>1</selection_number><selection_extension><points_per_item>9</points_per_item></selection_extension></selection></selection_ordering>' +
        passage,
    );
    const result = await migrateQtiToQti3({ xml });
    expect(result.items[0]?.standaloneHtml).toContain("Read first.");
    expect(result.items[0]?.xml).toBeUndefined();
    expect(result.items[0]?.qti12SourceGroups?.[0]).toMatchObject({
      selectionNumber: "1",
      pointsPerItem: "9",
      title: "Draw",
    });
    const bank = await migrateQtiToQti3({
      xml: canvasChoiceXml("")
        .replace(/<assessment[^>]*><section[^>]*>/, '<objectbank ident="BANK">')
        .replace("</section></assessment>", "</objectbank>"),
    });
    expect(bank.items[0]?.diagnostics.map((d) => d.code)).toContain("qti12_bank_points_unassigned");
  });
  it("keeps unsupported media/application materials rejected after recognizing manual profiles", async () => {
    for (const material of ['<mataudio uri="audio.mp3"/>', '<matapplication uri="widget.js"/>']) {
      const xml = canvasEssayXml().replace(
        '<mattext texttype="text/html"><![CDATA[<p>Explain <strong>your reasoning</strong>.</p>]]></mattext>',
        material,
      );
      const result = await migrateQtiToQti3({ xml }, { repairPolicy: "safe" });
      expect(result.items[0].xml).toBeUndefined();
      expect(result.items[0].authoringItem).toBeUndefined();
      expect(result.items[0].diagnostics.map((d) => d.code)).toContain(
        "qti12_material_not_preserved",
      );
    }
  });
});

import { describe, expect, it } from "vitest";
import { scoreQtiItemServerSide } from "@longsightgroup/qti3-core";
import { validQtiDocument } from "../../../tests/fixtures/valid-qti-document.js";
import { migrateGiftToQti3, migrateMoodleXmlToQti3, type LmsMigrationResult } from "./index.js";

// Original, synthetic Moodle export shapes; grade expectations come from the source rules.
function question(type: string, body: string, fields = "", title = "Example"): string {
  return `<question type="${type}"><name><text>${title}</text></name><questiontext format="html"><text><![CDATA[${body}]]></text></questiontext>${fields}</question>`;
}
function moodle(type: string, body: string, fields = ""): LmsMigrationResult {
  return migrateMoodleXmlToQti3({ xml: `<quiz>${question(type, body, fields)}</quiz>` });
}
function converted(result: LmsMigrationResult, index = 0): string {
  expect(result.diagnostics).toEqual([]);
  const item = result.items[index];
  expect(item.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  if (!item.xml) throw new Error(`Expected QTI: ${JSON.stringify(item.diagnostics)}`);
  validQtiDocument(item.xml);
  expect(item.xml).not.toMatch(/data-qti|qflow|tailwind/);
  return item.xml;
}
function score(
  xml: string,
  response: Record<string, string | string[] | null>,
): number | null | undefined {
  const result = scoreQtiItemServerSide({ itemXml: xml, trustedResponses: response });
  expect(result.ok).toBe(true);
  return result.score;
}
function refused(result: LmsMigrationResult, code = "lms_scoring_not_preserved"): void {
  expect(result.items[0]?.xml).toBeUndefined();
  expect(result.items[0]?.diagnostics.some((d) => d.severity === "error" && d.code === code)).toBe(
    true,
  );
}

describe("standalone Moodle XML migration", () => {
  it("scales choice grades once and retains category, tags, hints and rich feedback", () => {
    const fields =
      '<defaultgrade>3</defaultgrade><single>true</single><answer fraction="100" format="html"><text>Paris</text></answer><answer fraction="0"><text>Rome</text></answer><tags><tag><text>Geography</text></tag></tags><hint format="html"><text><![CDATA[<b>Think</b>]]></text><clearwrong>1</clearwrong></hint><generalfeedback format="html"><text><![CDATA[<em>Explanation</em>]]></text></generalfeedback>';
    const result = migrateMoodleXmlToQti3({
      xml: `<quiz><question type="category"><category><text>Places</text></category></question>${question("multichoice", "Choose<br>one&nbsp;city", fields)}</quiz>`,
    });
    const xml = converted(result);
    expect(score(xml, { RESPONSE: "OPTION_1" })).toBe(3);
    expect(score(xml, { RESPONSE: "OPTION_2" })).toBe(0);
    expect(score(xml, { RESPONSE: null })).toBe(0);
    expect(result.parts[0]?.title).toBe("Places");
    expect(result.items[0]?.sourceMetadata.tags).toEqual(["Geography"]);
    expect(result.items[0]?.sourceMetadata.annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "hint",
          contentHtml: "<b>Think</b>",
          settings: { clearwrong: "1" },
        }),
      ]),
    );
  });
  it("preserves per-blank Cloze weights, partial credit, case and escaped delimiters", () => {
    const xml = converted(
      moodle(
        "cloze",
        "<p>{2:SAC:=A\\#B~%50%half} then {1:NUMERICAL:=3:0}</p>",
        "<defaultgrade>3</defaultgrade>",
      ),
    );
    expect(score(xml, { RESPONSE_1: "A#B", RESPONSE_2: "3" })).toBe(3);
    expect(score(xml, { RESPONSE_1: "half", RESPONSE_2: "3" })).toBe(2);
    expect(score(xml, { RESPONSE_1: "a#b", RESPONSE_2: "3" })).toBe(1);
    expect(score(xml, { RESPONSE_1: null, RESPONSE_2: null })).toBe(0);
    refused(moodle("cloze", "<p>{1:NUMERICAL:=3:0.1}</p>"));
    refused(moodle("cloze", "<p>{1:SA:=prefix*}</p>"));
    const exact = converted(
      moodle(
        "numerical",
        "Number",
        '<answer fraction="100"><text>3</text><tolerance>0</tolerance></answer><units/>',
      ),
    );
    expect(score(exact, { RESPONSE: "3" })).toBe(1);
    refused(moodle("cloze", "<p>{2:SA:=yes}</p>", "<defaultgrade>4</defaultgrade>"));
    refused(moodle("cloze", "<p>{1:SA:=yes} {1:MC:=yes~no}</p>"));
  });
  it("keeps weighted dropdown alternatives and shuffle aliases", () => {
    const xml = converted(moodle("cloze", "<p>{2:MCHS:%50%half~=full~wrong}</p>"));
    expect(score(xml, { RESPONSE_1: "OPTION_1" })).toBe(1);
    expect(score(xml, { RESPONSE_1: "OPTION_2" })).toBe(2);
    expect(score(xml, { RESPONSE_1: "OPTION_3" })).toBe(0);
    expect(xml).toContain('shuffle="true"');
  });
  it("retains manual grading and settings without manufacturing an automatic zero", () => {
    const result = moodle(
      "essay",
      "Explain",
      '<defaultgrade>5</defaultgrade><graderinfo format="html"><text>Use evidence</text></graderinfo><attachments>2</attachments><minwordlimit>20</minwordlimit>',
    );
    const xml = converted(result);
    expect(score(xml, { RESPONSE: "My answer" })).toBeNull();
    expect(score(xml, { RESPONSE: null })).toBeNull();
    expect(xml).toContain("Use evidence");
    expect(xml).toContain("Source maximum: 5 points");
    expect(result.items[0]?.sourceMetadata.settings.attachments).toBe("2");
    expect(result.items[0]?.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });
  it("preserves matching partial grades, reused targets and target-only distractors", () => {
    const result = moodle(
      "matching",
      "Match",
      '<subquestion format="html"><text>First</text><answer><text>Shared</text></answer></subquestion><subquestion format="html"><text>Second</text><answer><text>Shared</text></answer></subquestion><subquestion format="html"><text></text><answer><text>Distractor</text></answer></subquestion>',
    );
    const xml = converted(result);
    expect(score(xml, { RESPONSE: ["SOURCE_1 TARGET_1"] })).toBe(0.5);
    expect(score(xml, { RESPONSE: ["SOURCE_1 TARGET_1", "SOURCE_2 TARGET_1"] })).toBe(1);
    expect(score(xml, { RESPONSE: ["SOURCE_1 TARGET_2"] })).toBe(0);
    expect(result.items[0]?.authoringItem?.interactionType).toBe("match");
    const item = result.items[0]?.authoringItem;
    if (item?.interactionType === "match") {
      expect(item.sources).toHaveLength(2);
      expect(item.targets).toHaveLength(2);
    }
  });
  it("gives each repeated drag gap an identifier and normalizes marks", () => {
    const xml = converted(
      moodle(
        "ddwtos",
        "<p>[[1]] and [[1]]</p>",
        "<dragbox><text>same</text><group>1</group><infinite/></dragbox><dragbox><text>wrong</text><group>2</group></dragbox>",
      ),
    );
    expect(score(xml, { RESPONSE: ["CHOICE_1 GAP_1"] })).toBe(0.5);
    expect(score(xml, { RESPONSE: ["CHOICE_1 GAP_1", "CHOICE_1 GAP_2"] })).toBe(1);
  });
  it("scopes embedded files to fields and preserves encoded asset names", () => {
    const xml =
      '<quiz><question type="essay"><name><text>Files</text></name><questiontext format="html"><text><![CDATA[<p><img alt="Diagram" src="@@PLUGINFILE@@/a%20b.png"></p>]]></text><file name="a b.png" path="/" encoding="base64">AQID</file></questiontext><graderinfo format="html"><text><![CDATA[<p><img alt="Diagram" src="@@PLUGINFILE@@/a%20b.png"></p>]]></text><file name="a b.png" path="/" encoding="base64">BAUG</file></graderinfo></question></quiz>';
    const result = migrateMoodleXmlToQti3({ xml });
    const output = converted(result);
    expect(result.assets.map((asset) => [...asset.data])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(new Set(result.assets.map((asset) => asset.path)).size).toBe(2);
    expect(output).toContain("field-1/a%20b.png");
    expect(output).toContain("field-2/a%20b.png");
    refused(
      moodle("essay", '<p><img alt="Diagram" src="@@PLUGINFILE@@/missing.png"></p>'),
      "lms_media_not_preserved",
    );
  });
  it("keeps descriptions unscored and errors owned by their source item", () => {
    const result = migrateMoodleXmlToQti3({
      xml: `<quiz>${question("description", "<p><b>Read</b> this</p>")}${question("calculated", "Formula", "", "Unknown")}${question("shortanswer", "Answer", '<answer fraction="100"><text>yes</text></answer>', "Good")}</quiz>`,
    });
    expect(result.items[0]?.standaloneHtml).toBe("<p><b>Read</b> this</p>");
    expect(result.items[0]?.xml).toBeUndefined();
    expect(result.items[1]?.xml).toBeUndefined();
    expect(result.items[1]?.diagnostics.some((d) => d.code === "lms_interaction_unsupported")).toBe(
      true,
    );
    expect(score(converted(result, 2), { RESPONSE: "YES" })).toBe(1);
  });
  it("requires explicit support for unsafe source scoring and executable markup", () => {
    refused(
      moodle(
        "multichoice",
        "Choose",
        '<single>true</single><answer fraction="100"><text>A</text></answer><answer fraction="-100"><text>B</text></answer>',
      ),
    );
    refused(
      moodle("shortanswer", "Answer", '<answer fraction="100"><text>prefix*</text></answer>'),
    );
    refused(
      moodle(
        "numerical",
        "Number",
        '<answer fraction="100"><text>3</text><tolerance>1</tolerance></answer>',
      ),
    );
    refused(moodle("essay", "<script>bad()</script>"), "lms_content_invalid");
    refused(
      moodle(
        "ordering",
        "Sort",
        "<gradingtype>RELATIVE</gradingtype><answer><text>One</text></answer><answer><text>Two</text></answer>",
      ),
    );
    expect(migrateMoodleXmlToQti3({ xml: "<quiz>" }).diagnostics[0]?.code).toBe(
      "moodle_source_invalid",
    );
  });
});

describe("standalone GIFT migration", () => {
  it("converts source choice, numerical, text and manual essay without app models", () => {
    const result = migrateGiftToQti3({
      xml: "$CATEGORY: Examples\n::Choice::[plain]Pick {=yes~no}\n\n::Number::Value {#3:0}\n\n::Text::Name {=right=correct}\n\n::Essay::Explain {}",
    });
    expect(result.items).toHaveLength(4);
    expect(score(converted(result), { RESPONSE: "OPTION_1" })).toBe(1);
    expect(score(converted(result, 1), { RESPONSE: "3" })).toBe(1);
    expect(score(converted(result, 2), { RESPONSE: "CORRECT" })).toBe(1);
    expect(score(converted(result, 3), { RESPONSE: "Explain" })).toBeNull();
    expect(result.parts[0]?.title).toBe("Examples");
  });
  it("preserves escaped literal delimiters and feedback evidence", () => {
    const result = migrateGiftToQti3({
      xml: "::Literal::[plain]Read \\{literal\\} and \\nnext {=A\\#B#why~wrong####General}",
    });
    const xml = converted(result);
    expect(xml).toContain("{literal}");
    expect(xml).toContain("A#B");
    expect(result.items[0]?.sourceMetadata.annotations.map((a) => a.text)).toEqual(
      expect.arrayContaining(["why", "General"]),
    );
    const tf = migrateGiftToQti3({ xml: "::TF::Fact {FALSE#wrong#right}" });
    expect(score(converted(tf), { RESPONSE: "OPTION_2" })).toBe(1);
    expect(tf.items[0]?.sourceMetadata.annotations[0]?.text).toContain("wrong");
  });
  it("preserves matching partial credit and embedded single-response blanks", () => {
    const match = converted(
      migrateGiftToQti3({ xml: "::Match::Pair {=a -> one =b -> two = -> extra}" }),
    );
    expect(score(match, { RESPONSE: ["SOURCE_1 TARGET_1"] })).toBe(0.5);
    const text = converted(migrateGiftToQti3({ xml: "::Blanks::First {=yes} then {=right} end." }));
    expect(score(text, { RESPONSE_1: "yes", RESPONSE_2: "right" })).toBe(2);
    const inline = converted(
      migrateGiftToQti3({ xml: "::Inline::First {=yes~no} then {=right~wrong} end." }),
    );
    expect(score(inline, { RESPONSE_1: "OPTION_1", RESPONSE_2: "OPTION_1" })).toBe(2);
    const rich = converted(
      migrateGiftToQti3({
        xml: "::Rich::[html]<p>First <b>{=yes~no}</b> then {=right~wrong} end.</p>",
      }),
    );
    expect(score(rich, { RESPONSE_1: "OPTION_1", RESPONSE_2: "OPTION_1" })).toBe(2);
    expect(rich).toContain("<b>");
  });
  it("preserves rich descriptions and refuses lossy programs and malformed sources", () => {
    const result = migrateGiftToQti3({ xml: "::Read::[html]<p><b>Read</b></p>" });
    expect(result.items[0]?.standaloneHtml).toBe("<p><b>Read</b></p>");
    expect(result.items[0]?.xml).toBeUndefined();
    refused(migrateGiftToQti3({ xml: "Number {#3:1}" }));
    refused(migrateGiftToQti3({ xml: "Typed {2:SA:=yes}" }));
    refused(moodle("description", '<img src="missing.png"/>'), "lms_image_alt_required");
    refused(migrateGiftToQti3({ xml: "Choose {=%50%half~%100%full}" }));
    refused(migrateGiftToQti3({ xml: "Mixed {=yes} and {=yes~no} end" }));
    expect(migrateGiftToQti3({ xml: "Broken {=answer" }).diagnostics[0]?.severity).toBe("error");
    expect(migrateGiftToQti3({ bytes: new Uint8Array([255]) }).diagnostics[0]?.severity).toBe(
      "error",
    );
  });
});

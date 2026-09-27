import { expect, it } from "vitest";
import { parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import {
  buildQti3RubricBlock,
  buildQti3ExtendedTextItem,
  qti3TrustedXmlFragment,
  validateQti3ExtendedTextItem,
} from "./index.js";
// QTI 3.0.1 §5.120: audience/purpose and placement are authored independently.
it("writes a reusable candidate rubric through the item writer", () => {
  const bodyHtml = buildQti3RubricBlock({
    view: ["candidate", "tutor"],
    use: "instructions",
    placement: "inline",
    content: qti3TrustedXmlFragment("<p>Read carefully.</p>"),
  });
  const xml = buildQti3ExtendedTextItem({ identifier: "essay", title: "Essay", bodyHtml });
  expect(xml).toContain('view="candidate tutor" use="instructions" class="qti-rubric-inline"');
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
});
it("rejects interaction and nested rubric fragments through validation and writing", () => {
  for (const content of [
    '<qti-text-entry-interaction response-identifier="RESPONSE"/>',
    '<qti-rubric-block view="candidate" use="instructions"><qti-content-body>Nested</qti-content-body></qti-rubric-block>',
  ]) {
    const input = {
      identifier: "essay",
      title: "Essay",
      rubricHtml: qti3TrustedXmlFragment(content),
    };
    expect(validateQti3ExtendedTextItem(input).length).toBeGreaterThan(0);
    expect(() => buildQti3ExtendedTextItem(input)).toThrow();
  }
});

// QTI 3.0.1 §5.160: test instructions cannot contain templates or interactions.
it("rejects forbidden content through the fixed-test writer", async () => {
  const { writeQti3FixedAssessmentTest } = await import("./index.js");
  for (const [content, code] of [
    [
      '<qti-template-block template-identifier="T" identifier="A" show-hide="show">Instructions</qti-template-block>',
      "rubric.template.forbidden",
    ],
    ['<qti-text-entry-interaction response-identifier="R"/>', "rubric.interaction.forbidden"],
  ]) {
    const result = writeQti3FixedAssessmentTest({
      identifier: "test",
      title: "Test",
      parts: [
        {
          identifier: "part",
          title: "Part",
          navigationMode: "linear",
          submissionMode: "individual",
          instructions: qti3TrustedXmlFragment(content),
          sections: [
            {
              identifier: "section",
              title: "Section",
              items: [{ identifier: "item", href: "item.xml", categories: [] }],
            },
          ],
          feedback: [],
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [expect.objectContaining({ code })] });
  }
});

import { expect, it } from "vitest";
import { parseQtiXml, validateAssessmentItem } from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment, writeQti3AssessmentItemResult } from "./index.js";
const base = {
  interactionType: "choice" as const,
  identifier: "wrapper",
  title: "Wrapper",
  choices: [{ identifier: "A", text: "Alpha" }],
  correctResponse: ["A"],
  responseCardinality: "single" as const,
};
it("places the rendered body once while preserving comments and surrounding content", () => {
  const result = writeQti3AssessmentItemResult({
    ...base,
    itemBodyHtml: qti3TrustedXmlFragment(
      "<div><p>Before</p><!-- example <qti-interaction-placeholder/> --><qti-interaction-placeholder/><p>After</p></div>",
    ),
  });
  expect(result.diagnostics).toEqual([]);
  if (!result.ok) throw new Error("Expected item");
  const parsed = parseQtiXml(result.xml);
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected document");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
  expect(result.xml.match(/<qti-choice-interaction /g)).toHaveLength(1);
  expect(result.xml).toContain("<!-- example <qti-interaction-placeholder/> -->");
});
it.each([
  "<p>No slot</p>",
  "<qti-interaction-placeholder/><qti-interaction-placeholder/>",
  "<!-- <qti-interaction-placeholder/> -->",
  "<p><qti-interaction-placeholder/>",
  "<qti-interaction-placeholder>content</qti-interaction-placeholder>",
])("rejects malformed placement %s", (template) => {
  const result = writeQti3AssessmentItemResult({
    ...base,
    itemBodyHtml: qti3TrustedXmlFragment(template),
  });
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code: "invalid_item_body_template" }),
  );
});

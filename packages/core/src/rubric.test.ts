import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  parseQtiXml,
  validateAssessmentItem,
  validateQtiRubricFragment,
  parseQtiTestExecution,
} from "./index.js";
const item = (content: string) =>
  `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="rubric" title="Rubric" time-dependent="false"><qti-response-declaration identifier="R" cardinality="single" base-type="identifier"/><qti-item-body>${content}</qti-item-body></qti-assessment-item>`;
const block = (content = "Instructions", attrs = 'view="candidate" use="instructions"') =>
  `<qti-rubric-block ${attrs}><qti-content-body>${content}</qti-content-body></qti-rubric-block>`;
// QTI 3.0.1 §5.120: mandatory attributes/content, no nesting or interactions.
it.each([
  "author",
  "candidate",
  "proctor",
  "scorer",
  "testConstructor",
  "tutor",
  "candidate scorer",
])("[ASI-RUBRIC-AUDIENCE] accepts the defined audience %s", (view) => {
  const parsed = parseQtiXml(item(block("Instructions", `view="${view}" use="instructions"`)));
  expect(parsed.diagnostics).toEqual([]);
  if (!parsed.document) throw new Error("Expected item");
  expect(validateAssessmentItem(parsed.document).diagnostics).toEqual([]);
});
it.each([
  [block("Text", 'use="instructions"'), "rubric.view.required"],
  [block("Text", 'view="candidate"'), "rubric.use.required"],
  [block("Text", 'view="student" use="instructions"'), "rubric.view.invalid"],
  [block("Text", 'view="candidate" use="bogus"'), "rubric.use.invalid"],
  [block("Text", 'view="candidate" use="ext:"'), "rubric.use.invalid"],
  [
    '<qti-rubric-block view="candidate" use="instructions">Text</qti-rubric-block>',
    "rubric.content.required",
  ],
  [block(block()), "rubric.nested"],
  [block('<qti-stylesheet href="local.css" type="text/css"/>'), "rubric.resource.unsupported"],
  [block("<qti-catalog-info/>"), "rubric.resource.unsupported"],
])("rejects invalid or unsupported rubric contracts: %s", (xml, code) => {
  const parsed = parseQtiXml(item(xml));
  expect(parsed.ok).toBe(false);
  expect(parsed.diagnostics).toContainEqual(expect.objectContaining({ code, severity: "error" }));
});
it("[ASI-RUBRIC-INTERACTIONS] excludes hidden rubric interactions from the live response list", () => {
  const parsed = parseQtiXml(
    item(
      block(
        '<qti-choice-interaction response-identifier="R" min-choices="1" max-choices="1"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></qti-choice-interaction>',
        'view="scorer" use="scoring"',
      ),
    ),
  );
  expect(parsed.ok).toBe(false);
  expect(parsed.diagnostics).toContainEqual(
    expect.objectContaining({ code: "rubric.interaction.forbidden" }),
  );
  expect(parsed.document?.item.interactions).toEqual([]);
});
it("preserves foreign namespace lookalikes and reports valid extensions without rejecting them", () => {
  const parsed = parseQtiXml(
    item(
      block(
        '<foreign:choice-interaction xmlns:foreign="urn:foreign">Example</foreign:choice-interaction>',
        'view="candidate" use="ext:custom"',
      ),
    ),
  );
  expect(parsed.ok).toBe(true);
  expect(parsed.diagnostics).toMatchObject([{ code: "rubric.use.extension", severity: "warning" }]);
});
it("rejects test template content and refuses fixed delivery that would omit rubric instructions", () => {
  expect(
    validateQtiRubricFragment(
      block(
        '<qti-template-block template-identifier="T" identifier="A" show-hide="show">Text</qti-template-block>',
      ),
      true,
    ),
  ).toContainEqual(expect.objectContaining({ code: "rubric.template.forbidden" }));
  const result = parseQtiTestExecution(
    `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="T" title="Test">${block()}</qti-assessment-test>`,
  );
  expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "test.rubric.unsupported" }] });
});

// Valid rubric-local resource placement is still unsupported by the item player.
it.each(["stylesheet", "catalog"])(
  "[ASI-RUBRIC-RESOURCES] rejects scoped resource delivery: %s",
  (resource) => {
    const xml = readFileSync(
      new URL(`../../../tests/fixtures/rubric-content/${resource}.xml`, import.meta.url),
      "utf8",
    );
    const parsed = parseQtiXml(xml);
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "rubric.resource.unsupported", severity: "error" }),
    );
  },
);

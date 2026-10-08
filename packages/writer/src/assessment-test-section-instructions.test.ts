import { expect, it } from "vitest";
import {
  parseQtiFixedTestOrdering,
  parseQtiTestRubrics,
  prepareQtiFixedTestOrder,
} from "@longsightgroup/qti3-core";
import { createCandidateTestRubricDelivery } from "@longsightgroup/qti3-player";
import { assertQtiXmlSchema } from "../../../tests/fixtures/valid-qti-document.js";
import { requireTestResult } from "../../../tests/fixtures/test-result.js";
import { writeQti3FixedAssessmentTest } from "./assessment-test-fixed.js";
import { qti3TrustedXmlFragment } from "./types.js";

function writeWithInstructions(content: string, shuffle?: boolean) {
  const section = {
    identifier: "after_instructions",
    title: "Following questions",
    instructions: qti3TrustedXmlFragment(content),
    shuffle,
    items: [{ identifier: "Q2", href: "items/two.xml", categories: [] }],
  };
  return writeQti3FixedAssessmentTest({
    identifier: "assessment",
    title: "Instructions between questions",
    parts: [
      {
        identifier: "part",
        title: "Part",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        instructions: qti3TrustedXmlFragment("<p>Whole part.</p>"),
        sections: [
          {
            identifier: "before_instructions",
            title: "First question",
            items: [{ identifier: "Q1", href: "items/one.xml", categories: [] }],
          },
          section,
        ],
        feedback: [],
      },
    ],
  });
}

// QTI implementation guide §4.6.1: candidate rubrics belong to their authored scope,
// appear on entry to that scope and cannot contain response interactions.
it.each([undefined, false, true])(
  "[ASI-SECTION-INSTRUCTIONS-WRITER] retains instructions at the following section without creating a question (shuffle=%s)",
  (shuffle) => {
    const xml = requireTestResult(writeWithInstructions("<p>Read the passage.</p>", shuffle));
    assertQtiXmlSchema(xml);
    const rubrics = requireTestResult(parseQtiTestRubrics(xml));
    expect(
      rubrics.map(({ scopeType, scopeIdentifier, node }) => [
        scopeType,
        scopeIdentifier,
        node.attributes.view,
        node.attributes.use,
      ]),
    ).toEqual([
      ["test-part", "part", "candidate", "instructions"],
      ["assessment-section", "after_instructions", "candidate", "instructions"],
    ]);
    expect(createCandidateTestRubricDelivery(rubrics)).toMatchObject([
      {
        scopeIdentifier: "part",
        content: [{ children: [{ children: [{ kind: "text", text: "Whole part." }] }] }],
      },
      {
        scopeIdentifier: "after_instructions",
        content: [{ children: [{ children: [{ kind: "text", text: "Read the passage." }] }] }],
      },
    ]);
    const definition = requireTestResult(parseQtiFixedTestOrdering(xml));
    expect(
      definition.sections.map(({ sectionIdentifier, shuffle: sectionShuffle, items }) => [
        sectionIdentifier,
        sectionShuffle,
        items.map(({ identifier, href }) => [identifier, href]),
      ]),
    ).toEqual([
      ["before_instructions", false, [["Q1", "items/one.xml"]]],
      ["after_instructions", shuffle === true, [["Q2", "items/two.xml"]]],
    ]);
    expect(
      requireTestResult(
        prepareQtiFixedTestOrder(definition, { kind: "new", seed: "attempt" }),
      ).sections.map(({ itemRefs }) => itemRefs),
    ).toEqual([["Q1"], ["Q2"]]);
  },
);

it.each([
  [
    '<qti-choice-interaction response-identifier="R" max-choices="1"/>',
    "rubric.interaction.forbidden",
  ],
  [
    '<qti-template-block template-identifier="T" identifier="B" show-hide="show">Dynamic</qti-template-block>',
    "rubric.template.forbidden",
  ],
  [
    '<qti-rubric-block view="candidate"><qti-content-body>Nested</qti-content-body></qti-rubric-block>',
    "rubric.nested",
  ],
])("refuses invalid section instruction content instead of discarding it: %s", (content, code) => {
  expect(writeWithInstructions(content)).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([expect.objectContaining({ code, severity: "error" })]),
  });
});

import { expect, it } from "vitest";
import { writeQti3FixedAssessmentTest } from "./assessment-test-fixed.js";
import { writeQti3AssessmentTest } from "./assessment-test.js";
import { assertQtiXmlSchema } from "../../../tests/fixtures/valid-qti-document.js";
import { requireTestResult } from "../../../tests/fixtures/test-result.js";
import { parseQtiFixedTestOrdering, prepareQtiFixedTestOrder } from "@longsightgroup/qti3-core";

const section = {
  identifier: "section",
  title: "Questions",
  shuffle: true,
  items: [
    { identifier: "A", href: "items/a.xml", categories: [] },
    { identifier: "B", href: "items/b.xml", categories: [], fixed: true },
    { identifier: "C", href: "items/c.xml", categories: [] },
    { identifier: "D", href: "items/d.xml", categories: [] },
  ],
};

it("[ASI-FIXED-ORDER-WRITER] writes section ordering and fixed slots without rewriting authored item order", () => {
  const result = writeQti3FixedAssessmentTest({
    identifier: "test",
    title: "Shuffled questions",
    parts: [
      {
        identifier: "part",
        title: "Part",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        sections: [section],
        feedback: [],
      },
    ],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Fixed shuffle did not serialize.");
  assertQtiXmlSchema(result.value);
  expect(result.value).toContain('<qti-ordering shuffle="true"/>');
  expect(result.value).toContain('identifier="B" href="items/b.xml" fixed="true"');
  expect(result.value.indexOf("<qti-ordering")).toBeLessThan(
    result.value.indexOf('identifier="A"'),
  );
  expect(
    [...result.value.matchAll(/<qti-assessment-item-ref identifier="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  ).toEqual(section.items.map((item) => item.identifier));
  const definition = requireTestResult(parseQtiFixedTestOrdering(result.value));
  const order = requireTestResult(
    prepareQtiFixedTestOrder(definition, { kind: "new", seed: "attempt" }),
  );
  expect(order.sections[0]?.itemRefs[1]).toBe("B");
});

it("refuses ordering hints at the separate branching writer rather than emitting unsupported XML", () => {
  const input = {
    identifier: "test",
    title: "Branch profile",
    partIdentifier: "part",
    outcomeDeclarations: [],
    outcomeProcessing: [],
    sections: [{ ...section, branches: [] }],
  };
  expect(writeQti3AssessmentTest(input)).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ code: "test.ordering.unsupported" }),
    ]),
  });
  const fixedOnly = {
    ...input,
    sections: [{ identifier: "section", title: "Section", items: section.items, branches: [] }],
  };
  expect(writeQti3AssessmentTest(fixedOnly)).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ code: "test.ordering.unsupported" }),
    ]),
  });
});

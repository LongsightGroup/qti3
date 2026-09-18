import { expect, it } from "vitest";
import { writeQti3AssessmentTest } from "./assessment-test.js";
import { writeQti3FixedAssessmentTest } from "./assessment-test-fixed.js";
import { qti3TrustedXmlFragment } from "./types.js";
import { parseQtiTestExecution } from "@longsightgroup/qti3-core";

it("writes fixed options and content in QTI 3 schema order without claiming sequenced execution", () => {
  const result = writeQti3FixedAssessmentTest({
    identifier: "test",
    title: "Fixed test",
    parts: [
      {
        identifier: "part",
        title: "Part",
        navigationMode: "nonlinear",
        submissionMode: "simultaneous",
        timeLimits: { minTime: 5, maxTime: 300 },
        instructions: qti3TrustedXmlFragment("<p>Read carefully.</p>"),
        sections: [
          {
            identifier: "section",
            title: "Questions",
            items: [{ identifier: "ref", href: "items/one.xml", categories: [] }],
          },
        ],
        feedback: [
          {
            identifier: "feedback",
            access: "atEnd",
            showHide: "show",
            outcomeIdentifier: "FEEDBACK",
            content: qti3TrustedXmlFragment("<p>Finished.</p>"),
          },
        ],
      },
    ],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.indexOf("</qti-assessment-section>")).toBeLessThan(
    result.value.indexOf("<qti-test-feedback"),
  );
  expect(result.value).toContain("<qti-content-body><p>Read carefully.</p></qti-content-body>");
  expect(parseQtiTestExecution(result.value)).toEqual({ ok: true, value: { kind: "fixed" } });
});

it.each([
  "",
  "../item.xml",
  "items/../item.xml",
  "/item.xml",
  "\\item.xml",
  "items\\item.xml",
  "https://example.com/item.xml",
  "custom+qti:item.xml",
  "./item.xml",
  "items//item.xml",
  "item.xml#fragment",
])("applies the same package-local href policy to fixed and executable tests: %s", (href) => {
  const item = { identifier: "ref", href, categories: [] };
  const fixed = writeQti3FixedAssessmentTest({
    identifier: "test",
    title: "Test",
    parts: [
      {
        identifier: "part",
        title: "Part",
        navigationMode: "linear",
        submissionMode: "individual",
        sections: [{ identifier: "section", title: "Section", items: [item] }],
        feedback: [],
      },
    ],
  });
  const executable = writeQti3AssessmentTest({
    identifier: "test",
    title: "Test",
    partIdentifier: "part",
    outcomeDeclarations: [],
    outcomeProcessing: [],
    sections: [{ identifier: "section", title: "Section", items: [item], branches: [] }],
  });
  expect(fixed.ok).toBe(false);
  expect(executable.ok).toBe(false);
});

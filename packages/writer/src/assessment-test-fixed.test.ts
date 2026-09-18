import { expect, it } from "vitest";
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

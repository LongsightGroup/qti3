import { describe, expect, it } from "vitest";
import { parseQtiTest, startQtiTest, submitQtiTestAnswer } from "@longsightgroup/qti3-core";
import { stagedTestFixture } from "../../../tests/fixtures/staged-test.js";
import { writeQti3AssessmentTest } from "./assessment-test.js";

describe("assessment test XML", () => {
  it("round trips a complete 15-answer adaptive route through the public writer and parser", () => {
    const written = writeQti3AssessmentTest(stagedTestFixture());
    if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
    const parsed = parseQtiTest(written.value);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    let session = startQtiTest(parsed.value);
    const path: string[] = [];
    while (session.status === "active") {
      path.push(session.currentItemRef);
      const result = submitQtiTestAnswer(parsed.value, session, {
        itemRef: session.currentItemRef,
        score: 1,
      });
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      session = result.value;
    }
    expect(path).toHaveLength(15);
    expect(path[5]).toBe("stage1_level1_item0");
    expect(path[10]).toBe("stage2_level2_item0");
  });
  it("rejects unsupported routing, expression attributes and invalid targets", () => {
    const written = writeQti3AssessmentTest(stagedTestFixture());
    if (!written.ok) throw new Error("Fixture invalid");
    for (const invalid of [
      written.value.replace('navigation-mode="linear"', 'navigation-mode="nonlinear"'),
      written.value.replace("<qti-branch-rule ", "<qti-pre-condition "),
      written.value.replace('target="stage1_level1"', 'target="stage0_level0"'),
      written.value.replace(
        'variable-identifier="SCORE"',
        'variable-identifier="SCORE" weight-identifier="weight"',
      ),
      written.value.replace("<qti-sum>", "<qti-unsupported>"),
    ])
      expect(parseQtiTest(invalid).ok).toBe(false);
  });
});

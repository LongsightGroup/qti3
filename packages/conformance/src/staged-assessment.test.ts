import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseQtiPackageFromEntries,
  parseQtiTest,
  startQtiTest,
  submitQtiTestAnswer,
} from "@longsightgroup/qti3-core";
import { writeQti3AssessmentTest } from "@longsightgroup/qti3-writer";
import { stagedTestFixture } from "../../../tests/fixtures/staged-test.js";

describe("staged test package conformance", () => {
  it("uses writer XML through the package parser and executes the selected test", () => {
    const fixture = stagedTestFixture();
    const written = writeQti3AssessmentTest(fixture);
    if (!written.ok) throw new Error("Fixture failed to serialize");
    expect(written.value).toBe(readFileSync("tests/fixtures/staged-assessment-test.xml", "utf8"));
    const items = fixture.sections.flatMap((s) => s.items);
    const entries = [
      { path: "test.xml", bytes: new TextEncoder().encode(written.value) },
      {
        path: "imsmanifest.xml",
        bytes: new TextEncoder().encode(
          `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="staged"><resources><resource identifier="test" type="imsqti_test_xmlv3p0" href="test.xml"><file href="test.xml"/></resource>${items.map((i) => `<resource identifier="${i.identifier}" type="imsqti_item_xmlv3p0" href="${i.href}"><file href="${i.href}"/></resource>`).join("")}</resources></manifest>`,
        ),
      },
      ...items.map((item) => ({
        path: item.href,
        bytes: new TextEncoder().encode(
          `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${item.identifier}" title="Synthetic question" time-dependent="false"><qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>a</qti-value></qti-correct-response></qti-response-declaration><qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/><qti-item-body><qti-choice-interaction response-identifier="RESPONSE" max-choices="1"><qti-prompt>Choose A.</qti-prompt><qti-simple-choice identifier="a">A</qti-simple-choice><qti-simple-choice identifier="b">B</qti-simple-choice></qti-choice-interaction></qti-item-body><qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/></qti-assessment-item>`,
        ),
      })),
    ];
    const imported = parseQtiPackageFromEntries(entries);
    expect(imported.ok).toBe(true);
    expect(imported.items).toHaveLength(30);
    if (!imported.assessmentTest) throw new Error("Test resource lost");
    const parsed = parseQtiTest(imported.assessmentTest.xml);
    if (!parsed.ok) throw new Error("Execution contract lost");
    let session = startQtiTest(parsed.value);
    while (session.status === "active") {
      const result = submitQtiTestAnswer(parsed.value, session, {
        itemRef: session.currentItemRef,
        score: 0,
      });
      if (!result.ok) throw new Error("Route failed");
      session = result.value;
    }
    expect(session.submissions).toHaveLength(15);
    expect(session.submissions.every((s) => s.itemRef.includes("level0"))).toBe(true);
  });
});

import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseQtiTestRubrics } from "@longsightgroup/qti3-core";
import { createCandidateTestRubricDelivery } from "../src/index.js";

const fixture = readFileSync(
  new URL("../../../tests/fixtures/test-delivery/rubric-static-scopes.xml", import.meta.url),
  "utf8",
);

it("[ASI-TEST-RUBRIC-CANDIDATE] delivers scoped rich instructions and resolves assets without leaking scorer content", () => {
  const parsed = parseQtiTestRubrics(fixture);
  if (!parsed.ok) throw new Error("Expected static test rubrics");
  const delivered = createCandidateTestRubricDelivery(parsed.value, (href) => `/content/${href}`);
  const serialized = JSON.stringify(delivered);
  expect(serialized).not.toContain("Private scoring key.");
  expect(delivered.map(({ scopeType, scopeIdentifier }) => [scopeType, scopeIdentifier])).toEqual([
    ["assessment-test", "T"],
    ["test-part", "P"],
    ["assessment-section", "S"],
  ]);
  expect(serialized).toContain('"name":"strong"');
  expect(serialized).toContain('"name":"ul"');
  expect(serialized).toContain('"href":"https://example.org/help"');
  expect(serialized).toContain('"src":"/content/images/map.png"');
  expect(serialized).toContain('"alt":"Reference map"');
});

it("uses the shared sanitizer for unsafe markup, attributes, links and resolver output", () => {
  const parsed = parseQtiTestRubrics(
    fixture.replace(
      "Test instructions.",
      '<script>unsafeCode()</script><a href="javascript:unsafeCode()" onclick="unsafeCode()">Safe text</a><img src="images/map.png" onerror="unsafeCode()" alt="Map"/>',
    ),
  );
  if (!parsed.ok) throw new Error("Expected parsed markup for sanitizer regression");
  const serialized = JSON.stringify(
    createCandidateTestRubricDelivery(parsed.value, () => "javascript:unsafeCode()"),
  );
  expect(serialized).toContain("Safe text");
  expect(serialized).not.toContain("unsafeCode");
  expect(serialized).not.toContain('"src"');
  expect(serialized).not.toContain('"onclick"');
  expect(serialized).not.toContain('"onerror"');
});

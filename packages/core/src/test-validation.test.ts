import { describe, expect, it } from "vitest";
import { validateQtiTest } from "./test-validation.js";
import { parseQtiTest } from "./test-parser.js";
import { testExecutionSupport } from "./test-support.js";
import { stagedTestFixture } from "../../../tests/fixtures/staged-test.js";
import { readFileSync, existsSync } from "node:fs";

describe("executable test boundary", () => {
  it("rejects duplicate identifiers, repeated item content, missing/backward targets and unknown outcomes", () => {
    const source = stagedTestFixture();
    const first = source.sections[0];
    if (!first) throw new Error("Missing section");
    for (const sections of [
      [...source.sections, first],
      [{ ...first, items: [...first.items, ...first.items] }, ...source.sections.slice(1)],
      [
        {
          ...first,
          branches: [
            {
              target: "unknown",
              expression: { type: "baseValue", baseType: "boolean", value: true } as const,
            },
          ],
        },
        ...source.sections.slice(1),
      ],
      [
        {
          ...first,
          branches: [
            {
              target: first.identifier,
              expression: { type: "baseValue", baseType: "boolean", value: true } as const,
            },
          ],
        },
        ...source.sections.slice(1),
      ],
    ])
      expect(validateQtiTest({ ...source, sections }).ok).toBe(false);
    expect(validateQtiTest({ ...source, outcomeDeclarations: [] }).ok).toBe(false);
    expect(validateQtiTest({ ...source, sections: [] }).ok).toBe(false);
  });
  it("rejects wrong declaration types and test-variable lookups in branch rules", () => {
    const source = stagedTestFixture();
    expect(
      validateQtiTest({
        ...source,
        outcomeDeclarations: source.outcomeDeclarations.map((d) => ({
          ...d,
          defaultValue: "zero",
        })),
      }).ok,
    ).toBe(false);
    expect(
      validateQtiTest({
        ...source,
        sections: source.sections.map((s) => ({
          ...s,
          branches: [
            {
              target: "EXIT_TEST",
              expression: {
                type: "numericCompare",
                operator: "gte",
                left: {
                  type: "sum",
                  expressions: [{ type: "testVariables", variableIdentifier: "SCORE" }],
                },
                right: { type: "baseValue", baseType: "integer", value: 0 },
              },
            },
          ],
        })),
      }).ok,
    ).toBe(false);
  });
  it("publishes support evidence only for the explicit execution profile", () => {
    for (const support of testExecutionSupport) {
      for (const file of [...support.fixtures, ...support.tests])
        expect(existsSync(file)).toBe(true);
    }
    const fixture = readFileSync("tests/fixtures/staged-assessment-test.xml", "utf8");
    expect(parseQtiTest(fixture).ok).toBe(true);
    expect(parseQtiTest(fixture.replace('cardinality="single"', 'cardinality="record"')).ok).toBe(
      false,
    );
    expect(parseQtiTest(fixture.replace('base-type="float"', 'base-type="unknown"')).ok).toBe(
      false,
    );
  });
});

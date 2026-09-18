import type { QtiTestDefinition, QtiTestSection } from "../../packages/core/src/test-model.js";

/** Synthetic MIT fixture. Product difficulty policy is not part of the engine. */
export function stagedTestFixture(length = 15): QtiTestDefinition {
  const sections: QtiTestSection[] = [];
  const id = (stage: number, level: number) => `stage${stage}_level${level}`;
  for (let stage = 0; stage < length / 5; stage++) {
    for (let level = 0; level <= Math.min(stage, 2); level++) {
      const identifier = id(stage, level);
      const score = { type: "variable", identifier: `${identifier}_score` } as const;
      const branches =
        stage === length / 5 - 1
          ? [
              {
                target: "EXIT_TEST",
                expression: { type: "baseValue", baseType: "boolean", value: true } as const,
              },
            ]
          : [
              {
                target: id(stage + 1, Math.min(level + 1, 2)),
                expression: {
                  type: "numericCompare",
                  operator: "gte",
                  left: score,
                  right: { type: "baseValue", baseType: "integer", value: 4 },
                } as const,
              },
              {
                target: id(stage + 1, Math.max(level - 1, 0)),
                expression: {
                  type: "numericCompare",
                  operator: "lte",
                  left: score,
                  right: { type: "baseValue", baseType: "integer", value: 1 },
                } as const,
              },
              {
                target: id(stage + 1, level),
                expression: { type: "baseValue", baseType: "boolean", value: true } as const,
              },
            ];
      sections.push({
        identifier,
        title: `Group ${stage + 1}, level ${level}`,
        branches,
        items: Array.from({ length: 5 }, (_, index) => ({
          identifier: `${identifier}_item${index}`,
          href: `items/${identifier}_${index}.xml`,
          categories: [identifier, `level${level}`],
        })),
      });
    }
  }
  return {
    identifier: "staged_fixture",
    title: "Synthetic staged assessment",
    partIdentifier: "part1",
    sections,
    outcomeDeclarations: sections.map((s) => ({
      kind: "outcome",
      identifier: `${s.identifier}_score`,
      cardinality: "single",
      baseType: "float",
      defaultValue: 0,
      attributes: {},
    })),
    outcomeProcessing: sections.map((s) => ({
      type: "setOutcomeValue",
      identifier: `${s.identifier}_score`,
      expression: {
        type: "sum",
        expressions: [
          { type: "testVariables", variableIdentifier: "SCORE", includeCategory: s.identifier },
        ],
      },
    })),
  };
}

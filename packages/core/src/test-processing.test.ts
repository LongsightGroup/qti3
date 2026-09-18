import { expect, it } from "vitest";
import { stagedTestFixture } from "../../../tests/fixtures/staged-test.js";
import { validateQtiTest } from "./test-validation.js";
import { processTestOutcomes } from "./test-processing.js";

it("recomputes outcomes from committed items without counting another block or accumulating repeats", () => {
  const validated = validateQtiTest(stagedTestFixture());
  if (!validated.ok) throw new Error("Fixture must be executable.");
  const submissions = [
    { itemRef: "stage0_level0_item0", score: 1 },
    { itemRef: "stage0_level0_item1", score: 0 },
    { itemRef: "stage1_level1_item0", score: 1 },
  ];
  const first = processTestOutcomes(validated.value, submissions).outcomes;
  expect(first.stage0_level0_score).toBe(1);
  expect(first.stage1_level1_score).toBe(1);
  expect(processTestOutcomes(validated.value, submissions).outcomes).toEqual(first);
  expect(
    processTestOutcomes(validated.value, [
      ...submissions,
      { itemRef: "stage0_level0_item2", score: 1 },
    ]).outcomes.stage0_level0_score,
  ).toBe(2);
  expect(first.stage0_level0_score).toBe(1);
});

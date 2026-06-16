import { describe, expect, it } from "vitest";
import { testInteraction } from "../interaction-test-fixtures.js";
import { choiceLayout } from "./choice-layout.js";

function interaction(attributes: Record<string, string> = {}) {
  return testInteraction({ type: "choice", attributes });
}

describe("choice layout", () => {
  it("defaults choices to vertical layout", () => {
    expect(choiceLayout(interaction(), 4)).toEqual({
      orientation: "vertical",
      columns: 1,
      rows: 4,
    });
  });

  it("uses horizontal shared vocabulary orientation", () => {
    expect(choiceLayout(interaction({ class: "qti-orientation-horizontal" }), 4)).toEqual({
      orientation: "horizontal",
      columns: 4,
      rows: 1,
    });
  });

  it("uses stacking classes with vertical orientation", () => {
    expect(
      choiceLayout(interaction({ class: "qti-choices-stacking-3 qti-orientation-vertical" }), 5),
    ).toEqual({
      orientation: "vertical",
      columns: 3,
      rows: 2,
      stacking: 3,
    });
  });

  it("defaults stacking classes to horizontal orientation", () => {
    expect(choiceLayout(interaction({ class: "qti-choices-stacking-5" }), 6)).toEqual({
      orientation: "horizontal",
      columns: 5,
      rows: 2,
      stacking: 5,
    });
  });

  it("uses the first valid stacking class when multiple are authored", () => {
    expect(
      choiceLayout(interaction({ class: "qti-choices-stacking-2 qti-choices-stacking-4" }), 5),
    ).toEqual({
      orientation: "horizontal",
      columns: 2,
      rows: 3,
      stacking: 2,
    });
  });

  it("tolerates deprecated orientation attributes without requiring a wrapper class", () => {
    expect(choiceLayout(interaction({ orientation: "horizontal" }), 4)).toEqual({
      orientation: "horizontal",
      columns: 4,
      rows: 1,
    });
  });

  it("uses horizontal deterministically when both orientation classes are authored", () => {
    expect(
      choiceLayout(
        interaction({ class: "qti-orientation-vertical qti-orientation-horizontal" }),
        4,
      ),
    ).toEqual({
      orientation: "horizontal",
      columns: 4,
      rows: 1,
    });
  });
});

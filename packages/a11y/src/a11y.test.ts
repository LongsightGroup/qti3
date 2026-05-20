import { interactionSupport } from "@qti3/core";
import { describe, expect, it } from "vitest";
import { a11yContracts } from "./index.js";

describe("@qti3/a11y", () => {
  it("defines an accessibility contract for every target interaction", () => {
    expect(a11yContracts.map((contract) => contract.interactionType).sort()).toEqual(
      interactionSupport.map((support) => support.interactionType).sort(),
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  PARSED_COMPANION_MATERIAL_CHILD_QTI_NAMES,
  PARSED_COMPANION_MATERIAL_CHILD_NAMES,
} from "./companion-materials.js";
import { itemMetadataSupport } from "./support.js";

describe("companion materials shared metadata", () => {
  it("keeps parsed companion child names aligned with item metadata support", () => {
    for (const qtiName of PARSED_COMPANION_MATERIAL_CHILD_QTI_NAMES) {
      const support = itemMetadataSupport.find((entry) => entry.qtiName === qtiName);
      expect(support?.parse).toBe(true);
      expect(support?.validate).toBe(true);
    }
  });

  it("exposes parsed companion child names as a set", () => {
    expect(PARSED_COMPANION_MATERIAL_CHILD_NAMES).toEqual(
      new Set(PARSED_COMPANION_MATERIAL_CHILD_QTI_NAMES),
    );
  });
});

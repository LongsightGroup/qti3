import { parseQtiXml, type QtiInteractionType } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";

import { qtiTranscodeProfiles, type Qti2InteractionPolicy } from "./profiles.js";
import { writeQti22Item } from "./qti22.js";
import { fixtureXml } from "./transcoder.test-helpers.js";

describe("QTI 2.2 policy dispatch", () => {
  it("executes the interaction policy supplied by its profile boundary", () => {
    const parsed = parseQtiXml(fixtureXml("order"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.document) return;

    const manualOrderPolicy: Qti2InteractionPolicy = {
      transformation: "extended-text-fallback",
      fidelity: "lossy",
      scoring: "manual",
      diagnostic: {
        code: "test.qti22.order.manual_fallback",
        message: "Use a manual response for this test policy.",
      },
    };
    const interactionPolicies: Readonly<Record<QtiInteractionType, Qti2InteractionPolicy>> = {
      ...qtiTranscodeProfiles["qti22-standard@1"].interactions,
      order: manualOrderPolicy,
    };

    const result = writeQti22Item(parsed.document.item, interactionPolicies);

    expect(result.xml).toContain("<extendedTextInteraction");
    expect(result.xml).not.toContain("<orderInteraction");
    expect(result.mappings[0]).toMatchObject({
      kind: "extended-text-fallback",
      source: "order",
      emitted: "extendedTextInteraction",
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "test.qti22.order.manual_fallback" }),
      ]),
    );
  });
});

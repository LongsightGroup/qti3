import type { QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { testInteraction } from "../interaction-test-fixtures.js";
import {
  inlineEmbeddingDisposition,
  interactionRegistry,
  isInlineEmbeddableInteraction,
  matchInteractionRegistryEntry,
} from "./interaction-registry.js";

describe("interaction registry ordering", () => {
  it("keeps a stable registry order for every supported renderer id", () => {
    expect(interactionRegistry.map((entry) => entry.id)).toEqual([
      "graphicOrder",
      "ordered",
      "gapMatch",
      "graphicAssociate",
      "match",
      "pair",
      "hotspot",
      "hottext",
      "choice",
      "inlineChoice",
      "extendedText",
      "selectPoint",
      "positionObject",
      "drawing",
      "portableCustom",
      "textEntry",
      "slider",
      "upload",
      "endAttempt",
      "media",
    ]);
  });

  it("prefers graphicOrder over ordered cardinality", () => {
    expect(
      matchInteractionRegistryEntry(
        testInteraction({ type: "graphicOrder", responseCardinality: "ordered" }),
      )?.id,
    ).toBe("graphicOrder");
  });

  it("prefers match over directedPair pair routing", () => {
    expect(
      matchInteractionRegistryEntry(
        testInteraction({ type: "match", responseBaseType: "directedPair" }),
      )?.id,
    ).toBe("match");
  });

  it("prefers graphicAssociate over directedPair pair routing", () => {
    expect(
      matchInteractionRegistryEntry(
        testInteraction({ type: "graphicAssociate", responseBaseType: "directedPair" }),
      )?.id,
    ).toBe("graphicAssociate");
  });

  it("prefers gapMatch over directedPair pair routing", () => {
    expect(
      matchInteractionRegistryEntry(
        testInteraction({ type: "gapMatch", responseBaseType: "directedPair" }),
      )?.id,
    ).toBe("gapMatch");
  });

  it("routes associate and custom directedPair interactions to pair", () => {
    expect(matchInteractionRegistryEntry(testInteraction({ type: "associate" }))?.id).toBe("pair");
    expect(
      matchInteractionRegistryEntry(
        testInteraction({
          type: "customUnknown" as QtiInteraction["type"],
          responseBaseType: "directedPair",
        }),
      )?.id,
    ).toBe("pair");
  });

  it("requires an object for hotspot rendering", () => {
    expect(matchInteractionRegistryEntry(testInteraction({ type: "hotspot" }))).toBeUndefined();
    expect(
      matchInteractionRegistryEntry(
        testInteraction({
          type: "hotspot",
          object: {
            data: "x",
            type: "image/png",
            text: "",
            width: "100",
            height: "100",
            sources: [],
            tracks: [],
            attributes: {},
          },
        }),
      )?.id,
    ).toBe("hotspot");
  });

  it("allows only inline-flow interaction renderers to embed inside prose", () => {
    expect(isInlineEmbeddableInteraction(testInteraction({ type: "inlineChoice" }))).toBe(true);
    expect(isInlineEmbeddableInteraction(testInteraction({ type: "textEntry" }))).toBe(true);
    expect(isInlineEmbeddableInteraction(testInteraction({ type: "endAttempt" }))).toBe(true);
    expect(isInlineEmbeddableInteraction(testInteraction({ type: "custom" }))).toBe(true);
    expect(isInlineEmbeddableInteraction(testInteraction({ type: "choice" }))).toBe(false);
    expect(isInlineEmbeddableInteraction(testInteraction({ type: "portableCustom" }))).toBe(false);
  });

  it("classifies inline embedding with a single disposition policy", () => {
    expect(inlineEmbeddingDisposition(testInteraction({ type: "inlineChoice" }))).toBe("supported");
    expect(inlineEmbeddingDisposition(testInteraction({ type: "textEntry" }))).toBe("supported");
    expect(inlineEmbeddingDisposition(testInteraction({ type: "endAttempt" }))).toBe("supported");
    expect(inlineEmbeddingDisposition(testInteraction({ type: "custom" }))).toBe("unsupported");
    expect(inlineEmbeddingDisposition(testInteraction({ type: "choice" }))).toBe("invalid");
    expect(inlineEmbeddingDisposition(testInteraction({ type: "portableCustom" }))).toBe("invalid");
  });

  it("uses a dedicated embedded renderer for textEntry", () => {
    const entry = matchInteractionRegistryEntry(testInteraction({ type: "textEntry" }));
    expect(entry?.renderEmbedded).toBeDefined();
    expect(entry?.renderEmbedded).not.toBe(entry?.render);
  });
});

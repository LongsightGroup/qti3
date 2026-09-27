import { describe, expect, it } from "vitest";
import { createPlayerMessageResolver } from "./player-message-resolver.js";
import { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";
import { defaultPlayerMessageResolver } from "./player-message-resolver.js";

describe("createPlayerMessageResolver", () => {
  it("formats English labels, parameters, plurals, and interaction names", () => {
    for (const messages of [
      createPlayerMessageResolver(defaultPlayerMessageCatalog),
      defaultPlayerMessageResolver,
    ]) {
      expect(messages.message("remove")).toBe("Remove");
      expect(messages.message("associationPairLabel", { source: "A", target: "B" })).toBe("A to B");
      expect(messages.message("extendedTextCounter", { count: 1, expectedLength: 20 })).toBe(
        "1 / 20",
      );
      expect(messages.message("associationsMade", { count: 1 })).toBe("1 association made.");
      expect(messages.message("associationsMade", { count: 2 })).toBe("2 associations made.");
      expect(messages.message("graphicOrderNoRegionsSelected")).toBe("No regions ordered.");
      expect(messages.message("interactionHotspots", { type: "graphicOrder" })).toBe(
        "Graphic order hotspots",
      );
    }
  });

  it("merges partial locale files over English", () => {
    const messages = createPlayerMessageResolver({
      locale: "sv-SE",
      strings: {
        remove: "Ta bort",
        graphicOrderNoRegionsSelected: "Inga regioner ordnade.",
        extendedTextCounter: "{count} av {expectedLength}",
      },
    });
    expect(messages.message("remove")).toBe("Ta bort");
    expect(messages.message("graphicOrderNoRegionsSelected")).toBe("Inga regioner ordnade.");
    expect(messages.message("extendedTextCounter", { count: 3, expectedLength: 10 })).toBe(
      "3 av 10",
    );
    expect(messages.message("noPointSelected")).toBe("No point selected");
  });

  it("uses hotspotSelectionSummary.one and .other when count is provided", () => {
    const messages = createPlayerMessageResolver({
      strings: {
        "hotspotSelectionSummary.one": "Valt {selection}",
        "hotspotSelectionSummary.other": "Valda {selection}",
      },
    });
    expect(messages.message("hotspotSelectionSummary", { selection: "A", count: 1 })).toBe(
      "Valt A",
    );
    expect(messages.message("hotspotSelectionSummary", { selection: "A", count: 2 })).toBe(
      "Valda A",
    );
  });
});

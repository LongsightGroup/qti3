import { describe, expect, it } from "vitest";
import { createPlayerMessageResolver } from "./player-message-catalog.js";
import { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";
import { defaultPlayerMessageResolver } from "./player-message-resolver.js";

describe("createPlayerMessageResolver", () => {
  it("builds English defaults equivalent to defaultPlayerMessageResolver", () => {
    const fromCatalog = createPlayerMessageResolver(defaultPlayerMessageCatalog);
    expect(fromCatalog.message("remove")).toBe(defaultPlayerMessageResolver.message("remove"));
    expect(fromCatalog.message("associationPairLabel", { source: "A", target: "B" })).toBe(
      defaultPlayerMessageResolver.message("associationPairLabel", { source: "A", target: "B" }),
    );
    expect(fromCatalog.message("extendedTextCounter", { characters: 1, words: 2 })).toBe(
      defaultPlayerMessageResolver.message("extendedTextCounter", { characters: 1, words: 2 }),
    );
    expect(fromCatalog.message("associationsMade", { count: 2 })).toBe(
      defaultPlayerMessageResolver.message("associationsMade", { count: 2 }),
    );
    expect(fromCatalog.message("graphicOrderNoRegionsSelected")).toBe(
      defaultPlayerMessageResolver.message("graphicOrderNoRegionsSelected"),
    );
    expect(fromCatalog.message("interactionHotspots", { type: "graphicOrder" })).toBe(
      defaultPlayerMessageResolver.message("interactionHotspots", { type: "graphicOrder" }),
    );
  });

  it("merges partial locale files over English", () => {
    const messages = createPlayerMessageResolver({
      locale: "sv-SE",
      strings: {
        remove: "Ta bort",
        graphicOrderNoRegionsSelected: "Inga regioner ordnade.",
        extendedTextCounter: "{characters} tecken, {words} ord",
      },
    });
    expect(messages.message("remove")).toBe("Ta bort");
    expect(messages.message("graphicOrderNoRegionsSelected")).toBe("Inga regioner ordnade.");
    expect(messages.message("extendedTextCounter", { characters: 3, words: 1 })).toBe(
      "3 tecken, 1 ord",
    );
    expect(messages.message("noPointSelected")).toBe(
      defaultPlayerMessageResolver.message("noPointSelected"),
    );
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

import { describe, expect, it } from "vitest";
import type { PlayerMessageCatalog } from "./player-message-catalog.js";
import { defaultPlayerMessageResolver } from "./player-message-resolver.js";
import { resolvePlayerMessages } from "./player-locale.js";

describe("resolvePlayerMessages", () => {
  it("returns English defaults regardless of locale", () => {
    const en = resolvePlayerMessages("en", {});
    const sv = resolvePlayerMessages("sv-SE", {});

    expect(sv.message("remove")).toBe("Remove");
    expect(sv.message("associationPairLabel", { source: "A", target: "B" })).toBe("A to B");
    expect(sv.message("graphicOrderNoRegionsSelected")).toBe("No regions ordered.");
    expect(en.message("remove")).toBe(defaultPlayerMessageResolver.message("remove"));
  });

  it("merges host overrides on top of English defaults", () => {
    const messages = resolvePlayerMessages("sv-SE", {
      remove: () => "Ta bort",
      associationPairLabel: ({ source, target }) => `${source} med ${target}`,
      clearDrawing: () => "Rensa ritning",
    });

    expect(messages.message("remove")).toBe("Ta bort");
    expect(
      messages.message("associationPairLabel", { source: "Item XML", target: "Response capture" }),
    ).toBe("Item XML med Response capture");
    expect(messages.message("clearDrawing")).toBe("Rensa ritning");
    expect(messages.message("noPointSelected")).toBe("No point selected");
    expect(messages.message("graphicOrderNoRegionsSelected")).toBe("No regions ordered.");
  });

  it("builds from a host catalog with optional function overrides", () => {
    const catalog: PlayerMessageCatalog = {
      locale: "sv-SE",
      strings: { remove: "Ta bort" },
    };
    const messages = resolvePlayerMessages("sv-SE", {}, catalog);
    expect(messages.message("remove")).toBe("Ta bort");
    expect(messages.message("clearDrawing")).toBe("Clear drawing");
  });

  it("lets overrides replace individual messages on unknown locales", () => {
    const messages = resolvePlayerMessages("zz-ZZ", {
      clearDrawing: () => "Erase marks",
    });

    expect(messages.message("clearDrawing")).toBe("Erase marks");
    expect(messages.message("remove")).toBe("Remove");
    expect(
      messages.message("associationPairLabel", { source: "Item XML", target: "Response capture" }),
    ).toBe("Item XML to Response capture");
    expect(messages.message("associationsMade", { count: 2 })).toBe("2 associations made.");
  });
});

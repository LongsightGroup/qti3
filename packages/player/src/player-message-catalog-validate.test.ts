import { describe, expect, it } from "vitest";
import type { PlayerMessageCatalog } from "./player-message-catalog.js";
import { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";
import { validatePlayerMessageCatalog } from "./player-message-catalog-validate.js";

describe("validatePlayerMessageCatalog", () => {
  it("accepts the English default catalog", () => {
    const result = validatePlayerMessageCatalog(defaultPlayerMessageCatalog, {
      requireAllKeys: true,
    });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports unknown string keys", () => {
    const result = validatePlayerMessageCatalog({
      strings: { remove: "Ta bort", typoKey: "oops" },
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((item) => item.code === "unknown-string-key")).toBe(true);
  });

  it("reports unknown placeholders", () => {
    const result = validatePlayerMessageCatalog({
      strings: { associationPairLabel: "{source} mit {targe}" },
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "unknown-placeholder",
        key: "associationPairLabel",
      }),
    );
  });

  it("reports missing placeholders required by the English default", () => {
    const result = validatePlayerMessageCatalog({
      strings: { removePair: "Eliminar" },
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-placeholder",
        key: "removePair",
      }),
    );
  });

  it("allows partial plural templates without optional params", () => {
    const result = validatePlayerMessageCatalog({
      strings: {
        "hotspotSelectionSummary.one": "Valt {selection}",
        "hotspotSelectionSummary.other": "Valda {selection}",
      },
    });
    expect(result.valid).toBe(true);
  });

  it("accepts partial locale catalogs used in Playwright fixtures", () => {
    const swedish: PlayerMessageCatalog = {
      locale: "sv-SE",
      strings: {
        "hotspotSelectionSummary.one": "Valt {selection}",
        "hotspotSelectionSummary.other": "Valda {selection}",
        extendedTextCounter: "{count} av {expectedLength}",
      },
    };
    const german: PlayerMessageCatalog = {
      locale: "de",
      strings: {
        removePair: "{label} entfernen",
        "associationsMade.one": "{count} Zuordnung erstellt.",
      },
    };
    const spanish: PlayerMessageCatalog = {
      locale: "es-MX",
      strings: {
        removePair: "Eliminar {label}",
        associationPairLabel: "{source} con {target}",
      },
    };
    for (const catalog of [swedish, german, spanish]) {
      const result = validatePlayerMessageCatalog(catalog);
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    }
  });

  it("requires plural forms when requireAllKeys is set", () => {
    const result = validatePlayerMessageCatalog(
      { strings: { remove: "Remove" } },
      { requireAllKeys: true },
    );
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((item) => item.code === "missing-message-key")).toBe(true);
  });

  it("returns diagnostics for malformed JSON shapes without throwing", () => {
    expect(() => validatePlayerMessageCatalog(null)).not.toThrow();
    expect(() => validatePlayerMessageCatalog({ strings: { remove: 42 } })).not.toThrow();

    const root = validatePlayerMessageCatalog("not-an-object");
    expect(root.valid).toBe(false);
    expect(root.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-catalog-root" }),
    );

    const missingStrings = validatePlayerMessageCatalog({ locale: "sv-SE" });
    expect(missingStrings.valid).toBe(false);
    expect(missingStrings.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-strings-field", key: "strings" }),
    );

    const badTemplate = validatePlayerMessageCatalog({ strings: { remove: 42 } });
    expect(badTemplate.valid).toBe(false);
    expect(badTemplate.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-string-value", key: "remove" }),
    );

    const badDirections = validatePlayerMessageCatalog({
      strings: { remove: "Remove" },
      directions: { up: 1, sideways: "→" },
    });
    expect(badDirections.valid).toBe(false);
    expect(badDirections.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-direction-value", key: "up" }),
    );
    expect(badDirections.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-direction-key", key: "sideways" }),
    );

    const badInteractionTypes = validatePlayerMessageCatalog({
      strings: { remove: "Remove" },
      interactionTypes: { graphicOrder: ["not", "a", "string"] },
    });
    expect(badInteractionTypes.valid).toBe(false);
    expect(badInteractionTypes.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-interaction-type-value", key: "graphicOrder" }),
    );
  });
});

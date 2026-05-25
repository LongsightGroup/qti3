import { describe, expect, it } from "vitest";
import { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";
import { PLAYER_MESSAGE_MANIFEST } from "./player-message-manifest.js";
import { PLAYER_MESSAGE_KEYS } from "./player-message-keys.js";

describe("PLAYER_MESSAGE_MANIFEST", () => {
  it("lists every chrome message id once", () => {
    expect(PLAYER_MESSAGE_KEYS).toHaveLength(PLAYER_MESSAGE_MANIFEST.length);
    expect(new Set(PLAYER_MESSAGE_KEYS).size).toBe(PLAYER_MESSAGE_MANIFEST.length);
  });

  it("has English defaults for every manifest key", () => {
    for (const entry of PLAYER_MESSAGE_MANIFEST) {
      const strings = defaultPlayerMessageCatalog.strings;
      const hasBase = strings[entry.key] !== undefined;
      const hasPluralForms =
        strings[`${entry.key}.one`] !== undefined || strings[`${entry.key}.other`] !== undefined;
      let satisfied = false;
      switch (entry.resolver) {
        case "typeLabel":
          satisfied = true;
          break;
        case "plain":
        case "template":
        case "typeTemplate":
        case "directionTemplate":
          satisfied = hasBase;
          break;
        case "plural":
          satisfied = hasBase || hasPluralForms;
          break;
        case "extendedTextCounter":
          satisfied = hasBase;
          break;
      }
      expect(satisfied, entry.key).toBe(true);
    }
  });
});

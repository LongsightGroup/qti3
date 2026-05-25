import { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";
import { PLAYER_MESSAGE_MANIFEST, type PlayerMessageKey } from "./player-message-manifest.js";

/** Chrome message ids (from {@link PLAYER_MESSAGE_MANIFEST}). */
export const PLAYER_MESSAGE_KEYS = PLAYER_MESSAGE_MANIFEST.map(
  (entry) => entry.key,
) as readonly PlayerMessageKey[];

/** All `strings` keys in the English catalog (including plural/unit suffix keys). */
export const PLAYER_MESSAGE_STRING_KEYS = Object.keys(
  defaultPlayerMessageCatalog.strings,
) as ReadonlyArray<string>;

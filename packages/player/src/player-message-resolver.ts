import { defaultPlayerMessageCatalog } from "./player-message-catalog-default.js";
import {
  formatPlayerMessage,
  mergePlayerMessageCatalogs,
  type PlayerMessageCatalog,
} from "./player-message-catalog.js";
import { warnPlayerMessageOnce } from "./player-dev.js";
import {
  PLAYER_MESSAGE_MANIFEST,
  type PlayerMessageKey,
  type PlayerMessageManifestEntry,
  type PlayerMessageResolverKind,
} from "./player-message-manifest.js";
import type { QtiPlayerMovementDirection } from "./player-messages.js";

function isQtiPlayerMovementDirection(value: unknown): value is QtiPlayerMovementDirection {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

function messageParamsRecord(value: unknown): Record<string, string | number> {
  if (typeof value !== "object" || value === null) return {};
  const params: Record<string, string | number> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string" || typeof entryValue === "number") {
      params[key] = entryValue;
    }
  }
  return params;
}

type ManifestEntry = (typeof PLAYER_MESSAGE_MANIFEST)[number];

const MANIFEST_BY_KEY = new Map(PLAYER_MESSAGE_MANIFEST.map((entry) => [entry.key, entry]));

type NumericParamName = "count" | "expectedLength" | "index" | "position" | "total";

type ParamValue<Name extends string> = Name extends NumericParamName
  ? number
  : Name extends "direction"
    ? QtiPlayerMovementDirection
    : string;

type ParamsFromManifestEntry<E extends PlayerMessageManifestEntry> =
  E["params"] extends readonly string[]
    ? { [K in E["params"][number]]: ParamValue<K> }
    : Record<string, never>;

export type { PlayerMessageKey } from "./player-message-manifest.js";

export type PlayerMessageParams<K extends PlayerMessageKey> = ParamsFromManifestEntry<
  Extract<ManifestEntry, { key: K }>
>;

type MessageParamsArg<K extends PlayerMessageKey> =
  PlayerMessageParams<K> extends Record<string, never> ? never : PlayerMessageParams<K>;

export type { MessageParamsArg };

/** Typed override handler for a single manifest message id. */
export type PlayerMessageOverride<K extends PlayerMessageKey> =
  MessageParamsArg<K> extends never ? () => string : (params: PlayerMessageParams<K>) => string;

/** Per-message function overrides keyed by manifest id (params match {@link PlayerMessageParams}). */
export type QtiPlayerMessageOverrides = {
  [K in PlayerMessageKey]?: PlayerMessageOverride<K>;
};

/** Key-driven player chrome messages (canonical runtime API). */
export interface PlayerMessageResolver {
  message<K extends PlayerMessageKey>(
    key: K,
    ...args: MessageParamsArg<K> extends never ? [] : [MessageParamsArg<K>]
  ): string;
}

function readableTypeFallback(type: string): string {
  return type
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
}

function mergedCatalog(catalog: PlayerMessageCatalog): PlayerMessageCatalog {
  return mergePlayerMessageCatalogs(defaultPlayerMessageCatalog, catalog);
}

function resolveCatalogTemplate(
  strings: Record<string, string>,
  key: string,
  count?: number,
): string | undefined {
  if (count !== undefined) {
    const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
    const pluralTemplate = strings[pluralKey] ?? defaultPlayerMessageCatalog.strings[pluralKey];
    if (pluralTemplate !== undefined) {
      return pluralTemplate;
    }
  }
  return strings[key] ?? defaultPlayerMessageCatalog.strings[key];
}

function catalogString(
  strings: Record<string, string>,
  key: string,
  values: Record<string, string | number> = {},
  count?: number,
): string {
  const template = resolveCatalogTemplate(strings, key, count);
  if (template === undefined) {
    warnPlayerMessageOnce(
      `missing-message:${key}`,
      `Missing player message catalog key "${key}"; showing the key as UI text.`,
    );
    return key;
  }
  return formatPlayerMessage(template, values);
}

type ResolverContext = {
  strings: Record<string, string>;
  typeName: (type: string) => string;
  directionLabel: (direction: QtiPlayerMovementDirection) => string;
};

function resolveManifestEntry(
  entry: PlayerMessageManifestEntry,
  context: ResolverContext,
  params: Record<string, string | number> = {},
): string {
  const { strings, typeName, directionLabel } = context;
  const { key, resolver } = entry;

  switch (resolver as PlayerMessageResolverKind) {
    case "plain":
      return catalogString(strings, key);
    case "typeLabel":
      return typeName(String(params.type ?? ""));
    case "template":
      return catalogString(strings, key, params);
    case "plural": {
      const count = Number(params.count);
      return catalogString(strings, key, params, count);
    }
    case "typeTemplate":
      return catalogString(strings, key, {
        ...params,
        typeName: typeName(String(params.type ?? "")),
      });
    case "directionTemplate": {
      const direction = isQtiPlayerMovementDirection(params.direction) ? params.direction : "up";
      return catalogString(strings, key, {
        ...params,
        direction: directionLabel(direction),
      });
    }
    default:
      return key;
  }
}

class CatalogPlayerMessageResolver implements PlayerMessageResolver {
  private readonly context: ResolverContext;

  constructor(catalog: PlayerMessageCatalog) {
    const merged = mergedCatalog(catalog);
    const types = merged.interactionTypes ?? {};
    const directions = merged.directions ?? defaultPlayerMessageCatalog.directions ?? {};
    this.context = {
      strings: merged.strings,
      typeName: (type) => types[type] ?? readableTypeFallback(type),
      directionLabel: (direction) => directions[direction] ?? direction,
    };
  }

  message<K extends PlayerMessageKey>(
    key: K,
    ...args: MessageParamsArg<K> extends never ? [] : [MessageParamsArg<K>]
  ): string {
    const entry = MANIFEST_BY_KEY.get(key);
    if (!entry) {
      return key;
    }
    const params = messageParamsRecord(args[0]);
    return resolveManifestEntry(entry, this.context, params);
  }
}

/**
 * Resolves player chrome from a host catalog using {@link PLAYER_MESSAGE_MANIFEST}.
 * Missing string keys fall back to English defaults.
 */
export function createPlayerMessageResolver(catalog: PlayerMessageCatalog): PlayerMessageResolver {
  return new CatalogPlayerMessageResolver(catalog);
}

export const defaultPlayerMessageResolver: PlayerMessageResolver = createPlayerMessageResolver(
  defaultPlayerMessageCatalog,
);

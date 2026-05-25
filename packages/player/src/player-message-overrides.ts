import type { PlayerMessageKey } from "./player-message-manifest.js";
import type {
  PlayerMessageOverride,
  PlayerMessageParams,
  PlayerMessageResolver,
  QtiPlayerMessageOverrides,
} from "./player-message-resolver.js";

class OverridePlayerMessageResolver implements PlayerMessageResolver {
  constructor(
    private readonly base: PlayerMessageResolver,
    private readonly overrides: QtiPlayerMessageOverrides,
  ) {}

  message<K extends PlayerMessageKey>(key: K, params?: PlayerMessageParams<K>): string {
    const override = this.overrides[key] as PlayerMessageOverride<K> | undefined;
    if (override) {
      if (params === undefined) {
        return (override as () => string)();
      }
      return (override as (p: PlayerMessageParams<K>) => string)(params);
    }
    if (params === undefined) {
      return (this.base.message as (messageKey: K) => string)(key);
    }
    return (this.base.message as (messageKey: K, p: PlayerMessageParams<K>) => string)(key, params);
  }
}

export function applyPlayerMessageOverrides(
  base: PlayerMessageResolver,
  overrides: QtiPlayerMessageOverrides,
): PlayerMessageResolver {
  if (Object.keys(overrides).length === 0) {
    return base;
  }
  return new OverridePlayerMessageResolver(base, overrides);
}

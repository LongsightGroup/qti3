import type { PlayerMessageKey } from "./player-message-manifest.js";
import type {
  MessageParamsArg,
  PlayerMessageResolver,
  QtiPlayerMessageOverrides,
} from "./player-message-resolver.js";

class OverridePlayerMessageResolver implements PlayerMessageResolver {
  constructor(
    private readonly base: PlayerMessageResolver,
    private readonly overrides: QtiPlayerMessageOverrides,
  ) {}

  message<K extends PlayerMessageKey>(
    key: K,
    ...args: MessageParamsArg<K> extends never ? [] : [MessageParamsArg<K>]
  ): string {
    const override = this.overrides[key];
    if (override) {
      return Reflect.apply(override, null, args);
    }
    return this.base.message(key, ...args);
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

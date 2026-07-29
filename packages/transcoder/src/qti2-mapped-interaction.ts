import type { QtiInteractionType } from "@longsightgroup/qti3-core";

import type { QtiTranscodeDiagnostic } from "./types.js";

interface Qti2MappedInteractionBase {
  readonly source: QtiInteractionType;
  readonly emitted: string;
  readonly xml: string;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

/** Typed wire mapping result after policy dispatch and native serialization. */
export type Qti2MappedInteraction =
  | (Qti2MappedInteractionBase & { readonly kind: "native" })
  | (Qti2MappedInteractionBase & {
      readonly kind: "extended-text-fallback";
      readonly scoring: "manual";
    })
  | (Qti2MappedInteractionBase & {
      readonly kind: "text-entry-fallback";
      readonly responseValueMap: Readonly<Record<string, string>>;
    });

export function qti2MappingFallback(
  mapping: Qti2MappedInteraction,
): "extended-text" | "text-entry" | undefined {
  switch (mapping.kind) {
    case "extended-text-fallback":
      return "extended-text";
    case "text-entry-fallback":
      return "text-entry";
    case "native":
      return undefined;
    default: {
      const unexpected: never = mapping;
      throw new Error(`Unsupported QTI 2 mapping kind: ${JSON.stringify(unexpected)}`);
    }
  }
}

export function mappingsIncludeManualFallback(mappings: readonly Qti2MappedInteraction[]): boolean {
  return mappings.some((mapping) => mapping.kind === "extended-text-fallback");
}

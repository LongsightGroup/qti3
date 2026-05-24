import type { QtiInteraction, QtiPortableCustomDefinition, QtiPortableCustomStateValue, QtiValue } from "@longsightgroup/qti3-core";

export function scalarString(value: QtiValue): string {
  if (value === null || Array.isArray(value) || typeof value === "object") return "";
  return String(value);
}

export function portableCustomDefinitionFromAttributes(
  interaction: QtiInteraction,
): QtiPortableCustomDefinition {
  return {
    responseIdentifier: interaction.responseIdentifier,
    customInteractionTypeIdentifier: interaction.attributes["custom-interaction-type-identifier"],
    module: interaction.attributes.module,
    interactionMarkup: [],
    templateVariables: [],
    contextVariables: [],
    stylesheets: [],
    dataAttributes: Object.fromEntries(
      Object.entries(interaction.attributes).filter(([name]) => name.startsWith("data-")),
    ),
    attributes: interaction.attributes,
    source: interaction.source,
  };
}

export function portableCustomEventValue(event: Event): QtiValue | undefined {
  if (!("detail" in event)) return undefined;
  const detail = event.detail as { value?: QtiValue; response?: QtiValue } | QtiValue | undefined;
  if (detail === undefined) return undefined;
  if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
    if ("value" in detail) return detail.value ?? null;
    if ("response" in detail) return detail.response ?? null;
    if ("state" in detail || "valid" in detail) return undefined;
  }
  return detail as QtiValue;
}

export function portableCustomEventState(event: Event): QtiPortableCustomStateValue | undefined {
  if (!("detail" in event)) return undefined;
  const detail = event.detail as { state?: unknown } | undefined;
  if (typeof detail !== "object" || detail === null || !("state" in detail)) return undefined;
  return isPortableCustomStateValue(detail.state) ? detail.state : undefined;
}

export function portableCustomEventValidity(
  event: Event,
): { valid: boolean; message?: string | undefined } | undefined {
  if (!("detail" in event)) return undefined;
  const detail = event.detail as { valid?: unknown; message?: unknown } | undefined;
  if (typeof detail !== "object" || detail === null || typeof detail.valid !== "boolean") {
    return undefined;
  }
  return {
    valid: detail.valid,
    message: typeof detail.message === "string" ? detail.message : undefined,
  };
}

export function isPortableCustomStateValue(value: unknown): value is QtiPortableCustomStateValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPortableCustomStateValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isPortableCustomStateValue);
  }
  return false;
}

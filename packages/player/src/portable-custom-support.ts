import type {
  QtiInteraction,
  QtiPortableCustomDefinition,
  QtiPortableCustomStateValue,
  QtiValue,
} from "@longsightgroup/qti3-core";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQtiValue(value: unknown): value is QtiValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isQtiValue);
  if (isRecord(value)) return Object.values(value).every(isQtiValue);
  return false;
}

function portableCustomEventDetail(event: Event): unknown {
  if (!("detail" in event)) return undefined;
  return event.detail;
}

export function portableCustomEventValue(event: Event): QtiValue | undefined {
  const detail = portableCustomEventDetail(event);
  if (detail === undefined) return undefined;
  if (isRecord(detail)) {
    if ("value" in detail) {
      const value = detail.value;
      return isQtiValue(value) ? value : null;
    }
    if ("response" in detail) {
      const response = detail.response;
      return isQtiValue(response) ? response : null;
    }
    if ("state" in detail || "valid" in detail) return undefined;
  }
  return isQtiValue(detail) ? detail : undefined;
}

export function portableCustomEventState(event: Event): QtiPortableCustomStateValue | undefined {
  const detail = portableCustomEventDetail(event);
  if (!isRecord(detail) || !("state" in detail)) return undefined;
  return isPortableCustomStateValue(detail.state) ? detail.state : undefined;
}

export function portableCustomEventValidity(
  event: Event,
): { valid: boolean; message?: string | undefined } | undefined {
  const detail = portableCustomEventDetail(event);
  if (!isRecord(detail) || typeof detail.valid !== "boolean") {
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
  if (isRecord(value)) {
    return Object.values(value).every(isPortableCustomStateValue);
  }
  return false;
}

import type {
  Qti3PnpCalculatorType,
  Qti3PnpCapabilityMap,
  Qti3PnpDiagnostic,
  Qti3PnpDiagnosticCode,
  Qti3PnpDiagnosticSeverity,
  Qti3PnpParams,
  Qti3PnpPreference,
  Qti3PnpSupportDefinition,
} from "./types.js";

export function diagnostic(
  code: Qti3PnpDiagnosticCode,
  severity: Qti3PnpDiagnosticSeverity,
  preference: Qti3PnpPreference,
  message: string,
): Qti3PnpDiagnostic {
  return { code, severity, message, support: preference.support, source: preference.source };
}

export function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

export function isDefined<T>(input: T | undefined): input is T {
  return input !== undefined;
}

export function isExtensionSupport(support: string): support is `ext:${string}` {
  return support.startsWith("ext:");
}

export function validExtensionSupport(support: string): boolean {
  return /^ext:[A-Za-z][A-Za-z0-9._-]*$/.test(support);
}

export function numberParam(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function stringParam(
  params: Qti3PnpParams | Record<string, string>,
  name: string,
): string | undefined {
  const value = params[name];
  return typeof value === "string" ? value : undefined;
}

export function stringProperty(input: Record<string, unknown>, name: string): string | undefined {
  const value = input[name];
  return typeof value === "string" ? value : undefined;
}

export function isCapabilitySupported(
  preference: Qti3PnpPreference,
  capabilities: Qti3PnpCapabilityMap,
  definition: Pick<Qti3PnpSupportDefinition, "name"> & {
    capability?: (preference: Qti3PnpPreference, capabilities: Qti3PnpCapabilityMap) => boolean;
  },
): boolean {
  const supportKey = preference.support.toLowerCase();
  const override =
    capabilities.supports[supportKey]?.supported ??
    capabilities.supports[preference.support]?.supported;
  if (override !== undefined) return override;
  return definition.capability?.(preference, capabilities) ?? false;
}

export function calculatorType(value: unknown): Qti3PnpCalculatorType | undefined {
  if (
    value === "basic" ||
    value === "standard" ||
    value === "scientific" ||
    value === "graphing" ||
    (typeof value === "string" && isExtensionSupport(value))
  ) {
    return value;
  }
  return undefined;
}

export function readingType(value: unknown): "screen-reader" | "computer-read-aloud" | undefined {
  return value === "screen-reader" || value === "computer-read-aloud" ? value : undefined;
}

export function coerceValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function toCamelName(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function normalizeName(name: string): string {
  if (name.startsWith("ext:")) return name;
  return name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
}

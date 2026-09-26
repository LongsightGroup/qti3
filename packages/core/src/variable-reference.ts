import { xmlNameCharacters, xmlNameInitial } from "./xml-schema-regex-data.js";

/** QTI attribute variable references enclose an XML identifier in braces. */
export function parseVariableReference(value: string): string | undefined {
  if (!value.startsWith("{") || !value.endsWith("}")) return undefined;
  const identifier = value.slice(1, -1);
  const initial = `[${xmlNameInitial}]`;
  const rest = `[${xmlNameCharacters}]`;
  return !identifier.includes(":") && new RegExp(`^${initial}${rest}*$`, "u").test(identifier)
    ? identifier
    : undefined;
}

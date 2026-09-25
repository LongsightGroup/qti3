import type { QtiValue } from "./types.js";
import { qtiValueToString } from "./value-format.js";

/** Apply QTI identifier membership and show/hide semantics to feedback or template choices. */
export function identifierIsVisible(
  identifier: string,
  value: QtiValue,
  showHide: string | undefined,
): boolean {
  const matches = Array.isArray(value)
    ? value.includes(identifier)
    : qtiValueToString(value) === identifier;
  return showHide === "hide" ? !matches : matches;
}

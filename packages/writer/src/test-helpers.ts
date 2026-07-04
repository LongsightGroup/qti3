import {
  parseQtiXml,
  validateAssessmentItem,
  type QtiAssessmentItem,
} from "@longsightgroup/qti3-core";
import { expect } from "vitest";

export function expectValidParsedItem(xml: string): QtiAssessmentItem {
  const parsed = parseQtiXml(xml);
  expect(parsed.ok).toBe(true);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.document).toBeDefined();
  const validation = validateAssessmentItem(parsed.document!);
  expect(validation.ok).toBe(true);
  expect(validation.diagnostics).toEqual([]);
  return parsed.document!.item;
}

export function expectValidParsedItemAllowingDiagnostics(
  xml: string,
  allowedCodes: readonly string[],
): QtiAssessmentItem {
  const parsed = parseQtiXml(xml);
  expect(parsed.ok).toBe(true);
  expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(allowedCodes);
  expect(parsed.document).toBeDefined();
  const validation = validateAssessmentItem(parsed.document!);
  expect(validation.ok).toBe(true);
  expect(validation.diagnostics).toEqual([]);
  return parsed.document!.item;
}

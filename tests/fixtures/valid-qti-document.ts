import { spawnSync } from "node:child_process";
import { expect } from "vitest";
import {
  parseQtiXml,
  validateAssessmentItem,
  type QtiDocument,
} from "../../packages/core/src/index.js";

/** Positive fixtures must pass semantic checks and, in the XSD gate, the official schema. */
export function validQtiDocument(xml: string): QtiDocument {
  const schema = process.env.QTI3_TEST_XSD_SCHEMA;
  if (schema) {
    const result = spawnSync("xmllint", ["--nonet", "--noout", "--schema", schema, "-"], {
      input: xml,
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    expect(result.status, `${result.stderr}\nFixture:\n${xml}`).toBe(0);
  }
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.ok).toBe(true);
  if (!parsed.document) throw new Error("Expected parsed QTI document");
  expect(validateAssessmentItem(parsed.document)).toEqual({ ok: true, diagnostics: [] });
  return parsed.document;
}

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import {
  parseQtiXml,
  validateAssessmentItem,
  type QtiDocument,
} from "../../packages/core/src/index.js";

/**
 * Positive fixtures must pass semantic checks and, in the XSD gate, the official schema.
 * The gate sets `QTI3_TEST_XSD_OUT` so each distinct document is recorded for one `xmllint`
 * invocation. A schema path alone still validates immediately for a single-suite run.
 */
export function assertQtiXmlSchema(xml: string): void {
  const out = process.env.QTI3_TEST_XSD_OUT;
  if (out) {
    recordSchemaCandidate(out, xml);
    return;
  }
  const schema = process.env.QTI3_TEST_XSD_SCHEMA;
  if (schema) {
    const result = spawnSync("xmllint", ["--nonet", "--noout", "--schema", schema, "-"], {
      input: xml,
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    expect(result.status, `${result.stderr}\nFixture:\n${xml}`).toBe(0);
  }
}

function recordSchemaCandidate(directory: string, xml: string): void {
  const hash = createHash("sha256").update(xml).digest("hex");
  try {
    writeFileSync(join(directory, `${hash}.xml`), xml, { flag: "wx" });
  } catch (error) {
    if (isErrorCode(error, "EEXIST")) return;
    throw error;
  }
  const testName = expect.getState().currentTestName;
  if (testName) writeFileSync(join(directory, `${hash}.name`), `${testName}\n`);
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export function validQtiDocument(xml: string): QtiDocument {
  assertQtiXmlSchema(xml);
  const parsed = parseQtiXml(xml);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.ok).toBe(true);
  if (!parsed.document) throw new Error("Expected parsed QTI document");
  expect(validateAssessmentItem(parsed.document)).toEqual({ ok: true, diagnostics: [] });
  return parsed.document;
}

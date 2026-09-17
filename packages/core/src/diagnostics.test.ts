import { describe, expect, it } from "vitest";
import {
  diagnosticKey,
  uniqueDiagnostics,
  scopeDiagnosticToPackagePath,
  type QtiDiagnostic,
} from "./index.js";

describe("diagnostic identity", () => {
  const first: QtiDiagnostic = {
    code: "item.invalid",
    severity: "error",
    message: "Invalid item.",
    path: "item.xml",
    source: { line: 1, column: 1, offset: 0, path: "item.xml" },
  };

  it("retains the first occurrence and its source metadata without mutating input", () => {
    const duplicate: QtiDiagnostic = {
      ...first,
      source: { line: 2, column: 3, offset: 20, path: "item.xml" },
    };
    const second: QtiDiagnostic = { ...first, message: "Another problem." };
    const input: readonly QtiDiagnostic[] = Object.freeze([
      Object.freeze(first),
      Object.freeze(second),
      Object.freeze(duplicate),
      first,
    ]);

    const result = uniqueDiagnostics(input);
    expect(result).toEqual([first, second]);
    expect(result[0]).toBe(first);
    expect(result[1]).toBe(second);
    expect(result).not.toBe(input);
    expect(input).toEqual([first, second, duplicate, first]);
    expect(diagnosticKey(duplicate)).toBe(diagnosticKey(first));
  });

  it.each<QtiDiagnostic>([
    { ...first, code: "item.missing" },
    { ...first, severity: "warning" },
    { ...first, message: "Different message." },
    { ...first, path: "other.xml" },
  ])("preserves diagnostics with distinct identity fields: %j", (different) => {
    expect(diagnosticKey(different)).not.toBe(diagnosticKey(first));
    expect(uniqueDiagnostics([first, different])).toEqual([first, different]);
  });

  it("treats absent and empty paths as the same identity", () => {
    const absent: QtiDiagnostic = { code: "item.invalid", severity: "error", message: "Invalid." };
    const empty: QtiDiagnostic = { ...absent, path: "" };
    expect(diagnosticKey(absent)).toBe(diagnosticKey(empty));
    expect(uniqueDiagnostics([absent, empty])).toEqual([absent]);
  });

  it("keeps messages and paths distinct when their newline-delimited forms collide", () => {
    const multilineMessage: QtiDiagnostic = { ...first, message: "first\nsecond", path: "third" };
    const multilinePath: QtiDiagnostic = { ...first, message: "first", path: "second\nthird" };
    expect(diagnosticKey(multilineMessage)).not.toBe(diagnosticKey(multilinePath));
    expect(uniqueDiagnostics([multilineMessage, multilinePath])).toEqual([
      multilineMessage,
      multilinePath,
    ]);
  });
});

describe("package diagnostic locations", () => {
  it.each([
    { path: "items/a.xml", sourcePath: undefined, expected: "bank.zip/items/a.xml" },
    { path: "/qti-assessment-item", sourcePath: "/old", expected: "bank.zip/qti-assessment-item" },
    {
      path: undefined,
      sourcePath: "/qti-assessment-item",
      expected: "bank.zip/qti-assessment-item",
    },
    { path: undefined, sourcePath: undefined, expected: "bank.zip" },
    { path: "", sourcePath: "/old", expected: "bank.zip" },
    { path: "bank.zip", sourcePath: "/old", expected: "bank.zip" },
  ])("scopes $path with source $sourcePath to $expected", ({ path, sourcePath, expected }) => {
    const original: QtiDiagnostic = {
      code: "item.invalid",
      severity: "warning",
      message: "Inspect this item.",
      path,
      source:
        sourcePath === undefined ? undefined : { line: 4, column: 2, offset: 20, path: sourcePath },
    };
    const snapshot = structuredClone(original);
    const scoped = scopeDiagnosticToPackagePath("bank.zip", original);

    expect(scoped).toEqual({
      ...original,
      path: expected,
      source: original.source ? { ...original.source, path: expected } : undefined,
    });
    expect(scoped).not.toBe(original);
    if (original.source) expect(scoped.source).not.toBe(original.source);
    expect(original).toEqual(snapshot);
  });
});

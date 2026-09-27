import { expect } from "vitest";
import type { QtiTestResult } from "../../packages/core/src/index.js";

/** Positive test fixtures must establish successful construction and processing. */
export function requireTestResult<T>(result: QtiTestResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected successful test result");
  return result.value;
}

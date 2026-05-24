import { describe, expect, it } from "vitest";
import {
  isAuthoringDiagnostic,
  mergeVisibleValidationMessages,
  responseValidationMessages,
  splitSerializedValidationMessages,
} from "./validation-messages.js";

describe("validation-messages", () => {
  it("classifies authoring diagnostics", () => {
    expect(isAuthoringDiagnostic({ code: "interaction.choices.missing", severity: "error", message: "x" })).toBe(
      true,
    );
    expect(isAuthoringDiagnostic({ code: "response.required", severity: "error", message: "x" })).toBe(false);
  });

  it("filters response validation from mixed arrays", () => {
    const messages = [
      { code: "interaction.choices.missing", severity: "error" as const, message: "missing", path: "RESPONSE" },
      { code: "response.required", severity: "error" as const, message: "required", path: "RESPONSE" },
    ];
    expect(responseValidationMessages(messages)).toEqual([messages[1]]);
  });

  it("merges visible validation without duplication logic", () => {
    const authoring = [
      { code: "interaction.choices.missing", severity: "error" as const, message: "missing", path: "RESPONSE" },
    ];
    const response = [{ code: "response.required", severity: "error" as const, message: "required", path: "RESPONSE" }];
    expect(mergeVisibleValidationMessages(authoring, response)).toEqual([...authoring, ...response]);
  });

  it("splits serialized validation buckets for restore", () => {
    const split = splitSerializedValidationMessages([
      { code: "interaction.choices.missing", severity: "error", message: "missing", path: "RESPONSE" },
      { code: "response.required", severity: "error", message: "required", path: "RESPONSE" },
    ]);
    expect(split.authoringDiagnostics).toHaveLength(1);
    expect(split.validationMessages).toHaveLength(1);
  });
});

import type { Qti3WriterDiagnostic } from "./types.js";

/** Validate the external scoring boundary and reject a competing automatic scoring authority. */
export function validateManualScoring(value: unknown, automatic: boolean): Qti3WriterDiagnostic[] {
  if (value !== undefined && value !== "human")
    return [
      {
        code: "invalid_manual_scoring",
        path: "externalScored",
        message: "External scoring must be human.",
      },
    ];
  if (value === "human" && automatic)
    return [
      {
        code: "conflicting_manual_scoring",
        path: "externalScored",
        message: "Human grading cannot be combined with automatic processing.",
      },
    ];
  return [];
}

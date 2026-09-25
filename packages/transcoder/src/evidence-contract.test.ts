import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runTranscoderEvidenceMatrix } from "./evidence.js";

const fixtureXml = () => readFileSync("packages/fixtures/xml/choice-reference.xml", "utf8");
const input = {
  profiles: ["qti21-standard@1"] as const,
  interactions: ["choice"] as const,
  fixtureXml,
};

describe("reverse migration evidence integrity", () => {
  it("does not claim unexecuted reverse evidence", () => {
    const result = runTranscoderEvidenceMatrix(input);
    expect(result.failures).toContainEqual(
      expect.objectContaining({ message: "reverse migration evidence was not executed." }),
    );
    expect(result.observations[0]?.evidence).not.toContain("reverse-migration");
  });
  it("records success only after executing the adapter", () => {
    const result = runTranscoderEvidenceMatrix({
      ...input,
      reverseMigration: () => ({ status: "preserved" }),
    });
    expect(result.failures).toEqual([]);
    expect(result.observations[0]?.evidence).toContain("reverse-migration");
  });
  it("records an explicit unsupported result without claiming a round trip", () => {
    const result = runTranscoderEvidenceMatrix({
      ...input,
      reverseMigration: () => ({
        status: "unsupported",
        code: "qti2_response_processing_not_preserved",
      }),
    });
    expect(result.failures).toEqual([]);
    expect(result.observations[0]?.evidence).not.toContain("reverse-migration");
    expect(result.observations[0]?.evidence).toContain(
      "reverse-migration-unsupported:qti2_response_processing_not_preserved",
    );
  });
  it("still fails unexpected reverse errors", () => {
    const result = runTranscoderEvidenceMatrix({
      ...input,
      reverseMigration: () => ({ status: "failed", message: "Unexpected import failure" }),
    });
    expect(result.failures).toContainEqual(
      expect.objectContaining({ message: "Unexpected import failure" }),
    );
    expect(result.observations[0]?.evidence).not.toContain("reverse-migration");
  });
});

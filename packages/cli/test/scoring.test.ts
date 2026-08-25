import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRecordingCliOutput, lastStderr, lastStdout } from "./cli-harness.js";
import { adaptiveDeliveryXml, choiceFixtureXml } from "./item-fixtures.js";
import { main } from "../src/index.js";

describe("@longsightgroup/qti3-cli scoring and delivery", () => {
  it("scores server-trusted response JSON and emits the complete result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-score-"));
    const itemFile = join(directory, "item.xml");
    const responsesFile = join(directory, "responses.json");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");
      await writeFile(responsesFile, JSON.stringify({ RESPONSE: "A" }), "utf8");

      await expect(main(["score", itemFile, "--responses", responsesFile], output)).resolves.toBe(
        0,
      );
      const result = JSON.parse(lastStdout(output));
      expect(result).toMatchObject({
        ok: true,
        responses: { RESPONSE: "A" },
        score: 1,
      });
      expect(result).toHaveProperty("diagnostics");
      expect(result).toHaveProperty("state");
      expect(result).toHaveProperty("outcomes");
      expect(output.stderr).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed score arguments and response JSON without stack traces", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-score-errors-"));
    const itemFile = join(directory, "item.xml");
    const malformedFile = join(directory, "malformed.json");
    const arrayFile = join(directory, "array.json");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");
      await writeFile(malformedFile, "{", "utf8");
      await writeFile(arrayFile, "[]", "utf8");

      await expect(main(["score", itemFile], output)).resolves.toBe(1);
      await expect(
        main(["score", itemFile, "--responses", malformedFile, "--responses", arrayFile], output),
      ).resolves.toBe(1);
      await expect(main(["score", itemFile, "--unknown", arrayFile], output)).resolves.toBe(1);
      await expect(main(["score", itemFile, "--responses", malformedFile], output)).resolves.toBe(
        1,
      );
      expect(lastStderr(output)).toContain(malformedFile);
      expect(lastStderr(output)).not.toContain("\n");
      await expect(main(["score", itemFile, "--responses", arrayFile], output)).resolves.toBe(1);
      expect(lastStderr(output)).toContain("JSON object");
      const missingFile = join(directory, "missing.json");
      await expect(main(["score", itemFile, "--responses", missingFile], output)).resolves.toBe(1);
      expect(lastStderr(output)).toContain(missingFile);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("emits core scoring diagnostics and exits one for invalid QTI", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-score-invalid-"));
    const itemFile = join(directory, "item.xml");
    const responsesFile = join(directory, "responses.json");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, "<qti-assessment-item>", "utf8");
      await writeFile(responsesFile, JSON.stringify({ RESPONSE: "A" }), "utf8");

      await expect(main(["score", itemFile, "--responses", responsesFile], output)).resolves.toBe(
        1,
      );
      const result = JSON.parse(lastStdout(output));
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ severity: "error" })]),
      );

      await writeFile(itemFile, choiceFixtureXml(), "utf8");
      await writeFile(responsesFile, JSON.stringify({ RESPONSE: [{}] }), "utf8");
      await expect(main(["score", itemFile, "--responses", responsesFile], output)).resolves.toBe(
        1,
      );
      const invalidResponseResult = JSON.parse(lastStdout(output));
      expect(invalidResponseResult.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "serverScoring.response.value", severity: "error" }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prepares static candidate-safe XML as a structured result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-static-"));
    const itemFile = join(directory, "item.xml");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");

      await expect(main(["prepare-delivery", itemFile], output)).resolves.toBe(0);
      const result = JSON.parse(lastStdout(output));
      expect(result).toMatchObject({ ok: true, mode: "static" });
      expect(result.candidateSafeXml).not.toContain("qti-correct-response");
      expect(result.candidateSafeXml).not.toContain("qti-response-processing");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("materializes adaptive delivery to an output file without duplicating XML in stdout", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-adaptive-"));
    const itemFile = join(directory, "item.xml");
    const stateFile = join(directory, "state.json");
    const outputFile = join(directory, "candidate.xml");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, adaptiveDeliveryXml(), "utf8");
      await writeFile(stateFile, JSON.stringify({ outcomes: { FEEDBACK: "yes" } }), "utf8");

      await expect(
        main(
          [
            "prepare-delivery",
            itemFile,
            "--mode",
            "server-materialized-adaptive",
            "--state",
            stateFile,
            "--out",
            outputFile,
          ],
          output,
        ),
      ).resolves.toBe(0);
      const summary = JSON.parse(lastStdout(output));
      expect(summary).toMatchObject({
        ok: true,
        mode: "server-materialized-adaptive",
        outputFile,
      });
      expect(summary).not.toHaveProperty("candidateSafeXml");
      const candidateXml = await readFile(outputFile, "utf8");
      expect(candidateXml).toContain("Visible feedback.");
      expect(candidateXml).not.toContain("qti-response-processing");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects incompatible delivery flags and invalid state objects", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-errors-"));
    const itemFile = join(directory, "item.xml");
    const stateFile = join(directory, "state.json");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, adaptiveDeliveryXml(), "utf8");
      await writeFile(stateFile, JSON.stringify({ outcomes: [], extra: true }), "utf8");

      await expect(
        main(["prepare-delivery", itemFile, "--state", stateFile], output),
      ).resolves.toBe(1);
      await expect(
        main(["prepare-delivery", itemFile, "--mode", "server-materialized-adaptive"], output),
      ).resolves.toBe(1);
      await expect(
        main(["prepare-delivery", itemFile, "--mode", "unsupported", "--state", stateFile], output),
      ).resolves.toBe(1);
      await expect(
        main(["prepare-delivery", itemFile, "--mode", "static", "--mode", "static"], output),
      ).resolves.toBe(1);
      await expect(
        main(
          [
            "prepare-delivery",
            itemFile,
            "--mode",
            "server-materialized-adaptive",
            "--state",
            stateFile,
          ],
          output,
        ),
      ).resolves.toBe(1);
      expect(lastStderr(output)).toContain(stateFile);
      expect(lastStderr(output)).not.toContain("\n");

      await writeFile(stateFile, JSON.stringify({ outcomes: { SCORE: [{}] } }), "utf8");
      await expect(
        main(
          [
            "prepare-delivery",
            itemFile,
            "--mode",
            "server-materialized-adaptive",
            "--state",
            stateFile,
          ],
          output,
        ),
      ).resolves.toBe(1);
      expect(lastStderr(output)).toContain("QTI values");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not write delivery output when core preparation fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-failure-"));
    const itemFile = join(directory, "item.xml");
    const outputFile = join(directory, "candidate.xml");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, "<qti-assessment-item>", "utf8");

      await expect(main(["prepare-delivery", itemFile, "--out", outputFile], output)).resolves.toBe(
        1,
      );
      await expect(readFile(outputFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      const summary = JSON.parse(lastStdout(output));
      expect(summary.ok).toBe(false);
      expect(summary).not.toHaveProperty("candidateSafeXml");
      expect(summary.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ severity: "error" })]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("exits one when candidate XML cannot be written", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-write-error-"));
    const itemFile = join(directory, "item.xml");
    const outputFile = join(directory, "missing", "candidate.xml");
    const output = createRecordingCliOutput();
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");

      await expect(main(["prepare-delivery", itemFile, "--out", outputFile], output)).resolves.toBe(
        1,
      );
      expect(lastStderr(output)).toContain(outputFile);
      expect(lastStderr(output)).not.toContain("\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

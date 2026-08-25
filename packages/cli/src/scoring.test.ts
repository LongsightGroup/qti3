import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main } from "./index.js";
import { adaptiveDeliveryXml, choiceFixtureXml } from "./test-support.js";

describe("@longsightgroup/qti3-cli scoring and delivery", () => {
  it("scores server-trusted response JSON and emits the complete result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-score-"));
    const itemFile = join(directory, "item.xml");
    const responsesFile = join(directory, "responses.json");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");
      await writeFile(responsesFile, JSON.stringify({ RESPONSE: "A" }), "utf8");

      await expect(main(["score", itemFile, "--responses", responsesFile])).resolves.toBe(0);
      const result = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(result).toMatchObject({
        ok: true,
        responses: { RESPONSE: "A" },
        score: 1,
      });
      expect(result).toHaveProperty("diagnostics");
      expect(result).toHaveProperty("state");
      expect(result).toHaveProperty("outcomes");
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed score arguments and response JSON without stack traces", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-score-errors-"));
    const itemFile = join(directory, "item.xml");
    const malformedFile = join(directory, "malformed.json");
    const arrayFile = join(directory, "array.json");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");
      await writeFile(malformedFile, "{", "utf8");
      await writeFile(arrayFile, "[]", "utf8");

      await expect(main(["score", itemFile])).resolves.toBe(1);
      await expect(
        main(["score", itemFile, "--responses", malformedFile, "--responses", arrayFile]),
      ).resolves.toBe(1);
      await expect(main(["score", itemFile, "--unknown", arrayFile])).resolves.toBe(1);
      await expect(main(["score", itemFile, "--responses", malformedFile])).resolves.toBe(1);
      expect(String(error.mock.calls.at(-1)?.[0])).toContain(malformedFile);
      expect(String(error.mock.calls.at(-1)?.[0])).not.toContain("\n");
      await expect(main(["score", itemFile, "--responses", arrayFile])).resolves.toBe(1);
      expect(String(error.mock.calls.at(-1)?.[0])).toContain("JSON object");
      const missingFile = join(directory, "missing.json");
      await expect(main(["score", itemFile, "--responses", missingFile])).resolves.toBe(1);
      expect(String(error.mock.calls.at(-1)?.[0])).toContain(missingFile);
    } finally {
      error.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("emits core scoring diagnostics and exits one for invalid QTI", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-score-invalid-"));
    const itemFile = join(directory, "item.xml");
    const responsesFile = join(directory, "responses.json");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeFile(itemFile, "<qti-assessment-item>", "utf8");
      await writeFile(responsesFile, JSON.stringify({ RESPONSE: "A" }), "utf8");

      await expect(main(["score", itemFile, "--responses", responsesFile])).resolves.toBe(1);
      const result = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(result.ok).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ severity: "error" })]),
      );

      await writeFile(itemFile, choiceFixtureXml(), "utf8");
      await writeFile(responsesFile, JSON.stringify({ RESPONSE: [{}] }), "utf8");
      await expect(main(["score", itemFile, "--responses", responsesFile])).resolves.toBe(1);
      const invalidResponseResult = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(invalidResponseResult.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "serverScoring.response.value", severity: "error" }),
        ]),
      );
    } finally {
      log.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prepares static candidate-safe XML as a structured result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-static-"));
    const itemFile = join(directory, "item.xml");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");

      await expect(main(["prepare-delivery", itemFile])).resolves.toBe(0);
      const result = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(result).toMatchObject({ ok: true, mode: "static" });
      expect(result.candidateSafeXml).not.toContain("qti-correct-response");
      expect(result.candidateSafeXml).not.toContain("qti-response-processing");
    } finally {
      log.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("materializes adaptive delivery to an output file without duplicating XML in stdout", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-adaptive-"));
    const itemFile = join(directory, "item.xml");
    const stateFile = join(directory, "state.json");
    const outputFile = join(directory, "candidate.xml");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeFile(itemFile, adaptiveDeliveryXml(), "utf8");
      await writeFile(stateFile, JSON.stringify({ outcomes: { FEEDBACK: "yes" } }), "utf8");

      await expect(
        main([
          "prepare-delivery",
          itemFile,
          "--mode",
          "server-materialized-adaptive",
          "--state",
          stateFile,
          "--out",
          outputFile,
        ]),
      ).resolves.toBe(0);
      const summary = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
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
      log.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects incompatible delivery flags and invalid state objects", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-errors-"));
    const itemFile = join(directory, "item.xml");
    const stateFile = join(directory, "state.json");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await writeFile(itemFile, adaptiveDeliveryXml(), "utf8");
      await writeFile(stateFile, JSON.stringify({ outcomes: [], extra: true }), "utf8");

      await expect(main(["prepare-delivery", itemFile, "--state", stateFile])).resolves.toBe(1);
      await expect(
        main(["prepare-delivery", itemFile, "--mode", "server-materialized-adaptive"]),
      ).resolves.toBe(1);
      await expect(
        main(["prepare-delivery", itemFile, "--mode", "unsupported", "--state", stateFile]),
      ).resolves.toBe(1);
      await expect(
        main(["prepare-delivery", itemFile, "--mode", "static", "--mode", "static"]),
      ).resolves.toBe(1);
      await expect(
        main([
          "prepare-delivery",
          itemFile,
          "--mode",
          "server-materialized-adaptive",
          "--state",
          stateFile,
        ]),
      ).resolves.toBe(1);
      expect(String(error.mock.calls.at(-1)?.[0])).toContain(stateFile);
      expect(String(error.mock.calls.at(-1)?.[0])).not.toContain("\n");

      await writeFile(stateFile, JSON.stringify({ outcomes: { SCORE: [{}] } }), "utf8");
      await expect(
        main([
          "prepare-delivery",
          itemFile,
          "--mode",
          "server-materialized-adaptive",
          "--state",
          stateFile,
        ]),
      ).resolves.toBe(1);
      expect(String(error.mock.calls.at(-1)?.[0])).toContain("QTI values");
    } finally {
      error.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not write delivery output when core preparation fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-failure-"));
    const itemFile = join(directory, "item.xml");
    const outputFile = join(directory, "candidate.xml");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeFile(itemFile, "<qti-assessment-item>", "utf8");

      await expect(main(["prepare-delivery", itemFile, "--out", outputFile])).resolves.toBe(1);
      await expect(readFile(outputFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      const summary = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(summary.ok).toBe(false);
      expect(summary).not.toHaveProperty("candidateSafeXml");
      expect(summary.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ severity: "error" })]),
      );
    } finally {
      log.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("exits one when candidate XML cannot be written", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-prepare-write-error-"));
    const itemFile = join(directory, "item.xml");
    const outputFile = join(directory, "missing", "candidate.xml");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await writeFile(itemFile, choiceFixtureXml(), "utf8");

      await expect(main(["prepare-delivery", itemFile, "--out", outputFile])).resolves.toBe(1);
      expect(String(error.mock.calls.at(-1)?.[0])).toContain(outputFile);
      expect(String(error.mock.calls.at(-1)?.[0])).not.toContain("\n");
    } finally {
      error.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

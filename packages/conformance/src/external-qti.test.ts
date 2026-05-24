import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createItemSession, parseQtiXml, unknownToDisplayString } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";

const externalDir = process.env.QTI3_EXTERNAL_QTI_DIR;
const requireExternal = process.env.QTI3_REQUIRE_EXTERNAL === "1";
const validatorReport = process.env.QTI3_EXTERNAL_VALIDATOR_REPORT;
const scoreCorrect = process.env.QTI3_EXTERNAL_SCORE_CORRECT === "1";
const hasExternalDir = Boolean(externalDir);
const runIfConfigured = hasExternalDir || requireExternal ? describe : describe.skip;

runIfConfigured("@longsightgroup/qti3-conformance external QTI directory", () => {
  it.runIf(requireExternal)("requires official external conformance content", () => {
    expect(
      externalDir,
      "Set QTI3_EXTERNAL_QTI_DIR to the official 1EdTech QTI 3 test content.",
    ).toBeTruthy();
  });

  it.runIf(requireExternal)("requires a non-empty official validator report artifact", async () => {
    expect(
      validatorReport,
      "Set QTI3_EXTERNAL_VALIDATOR_REPORT to the official 1EdTech validator report.",
    ).toBeTruthy();
    const report = await stat(validatorReport!);
    expect(report.isFile()).toBe(true);
    expect(report.size).toBeGreaterThan(0);
  });

  it.runIf(hasExternalDir)(
    "parses every XML assessment item under QTI3_EXTERNAL_QTI_DIR",
    async () => {
      const files = await findXmlFiles(externalDir!);
      let checked = 0;

      const failures: string[] = [];
      for (const file of files) {
        const xml = await readFile(file, "utf8");
        if (!xml.includes("qti-assessment-item")) continue;
        checked += 1;
        const result = parseQtiXml(xml);
        if (!result.ok) {
          failures.push(
            `${file}: ${result.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`,
          );
        }
      }

      expect(checked).toBeGreaterThan(0);
      expect(failures).toEqual([]);
    },
  );

  it.runIf(hasExternalDir && scoreCorrect)(
    "scores each XML assessment item with its declared correct responses",
    async () => {
      const files = await findXmlFiles(externalDir!);
      const failures: string[] = [];
      let checked = 0;

      for (const file of files) {
        const xml = await readFile(file, "utf8");
        if (!xml.includes("qti-assessment-item")) continue;

        const result = parseQtiXml(xml);
        if (!result.document || !result.ok) {
          failures.push(`${file}: parse failed`);
          continue;
        }

        const session = createItemSession(result.document);
        let scorable = false;
        for (const declaration of result.document.item.responseDeclarations) {
          if (declaration.correctResponse !== null) {
            scorable = true;
            session.respond(declaration.identifier, declaration.correctResponse);
          }
        }
        if (!scorable) continue;
        checked += 1;

        const scored = session.score();
        if (typeof scored.outcomes.SCORE !== "number" || scored.outcomes.SCORE <= 0) {
          failures.push(
            `${file}: expected positive SCORE, got ${unknownToDisplayString(scored.outcomes.SCORE)}`,
          );
        }
      }

      expect(checked).toBeGreaterThan(0);
      expect(failures).toEqual([]);
    },
  );
});

async function findXmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await findXmlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".xml")) files.push(path);
  }
  return files;
}

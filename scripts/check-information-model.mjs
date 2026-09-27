#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditQtiInformationModel,
  checkQtiRequirementResults,
} from "../packages/conformance/dist/information-model.js";
import { qtiInformationModelRequirements as requirements } from "../packages/conformance/dist/information-model-requirements.js";
import {
  qtiInformationModelInventory as inventory,
  qtiInformationModelSource as source,
} from "../packages/conformance/dist/information-model-inventory.js";

import { elementSupport } from "../packages/core/dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const audit = auditQtiInformationModel(inventory, requirements);
if (audit.violations.length) throw new Error(audit.violations.join("\n"));
const temporary = await mkdtemp(join(tmpdir(), "qti3-information-model-"));
try {
  const reportPath = join(temporary, "vitest.json");
  const files = [
    "packages/conformance/src/information-model.test.ts",
    ...new Set(requirements.flatMap((rule) => rule.evidence.map((test) => test.path))),
  ];
  execFileSync(
    "pnpm",
    ["exec", "vitest", "run", ...files, "--reporter=json", `--outputFile=${reportPath}`],
    { cwd: root, stdio: "inherit" },
  );
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  if (report.success !== true || !Array.isArray(report.testResults))
    throw new Error("Missing successful Vitest report");
  const results = report.testResults.flatMap((file) => {
    if (typeof file.name !== "string" || !Array.isArray(file.assertionResults))
      throw new Error("Malformed Vitest file result");
    const path = relative(root, file.name).replaceAll("\\", "/");
    return file.assertionResults.map((test) => {
      if (typeof test.fullName !== "string" || typeof test.status !== "string")
        throw new Error("Malformed Vitest assertion result");
      return { path, name: test.fullName, status: test.status };
    });
  });
  const failures = checkQtiRequirementResults(requirements, results);
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    `${requirements.filter((rule) => rule.disposition !== "open").length} reviewed requirements: executable evidence passed.`,
  );
  console.log(
    `${audit.unauditedSections.length}/${audit.totalSections} headings have no reviewed requirement. Headings with evidence are not fully audited.`,
  );
  console.log(
    `Open requirements: ${audit.openRequirements.join(", ") || "none recorded"}. This is not a certification or full-conformance result.`,
  );
  const relatedSupport = requirements.map((requirement) => ({
    requirement: requirement.id,
    elements: requirement.elements.map((qtiName) => ({
      qtiName,
      support: elementSupport.find((entry) => entry.qtiName === qtiName) ?? null,
    })),
  }));
  const output = process.argv[2];
  if (output) {
    await writeFile(
      output,
      JSON.stringify({ source, audit, requirements, relatedSupport, results }, null, 2) + "\n",
    );
    console.log(`Wrote audit evidence to ${output}`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}

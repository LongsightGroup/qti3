#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Curated semantic faults, not a line-coverage score. Anchors must match exactly;
// drift, timeouts, missing tests and import failures never count as killed mutants.
const mutants = [
  {
    id: "restored-outcomes",
    file: "packages/core/src/session.ts",
    before: "Object.assign(outcomes, priorOutcomes);",
    after: "Object.assign(outcomes, {});",
    occurrences: 1,
    witness: "adaptive model:",
  },
  {
    id: "import-answer-key",
    file: "packages/migrator/src/qti12-mappers.ts",
    before: "const rawCorrect = correct.get(source) ?? [];",
    after: 'const rawCorrect = ["A"];',
    occurrences: 1,
    witness: "choice fidelity:",
  },
  {
    id: "outcome-default-routing",
    file: "packages/core/src/test-parser.ts",
    before: "test.outcomeDeclarations.length > 0 ||",
    after: "false ||",
    occurrences: 1,
    witness: "[ASI-TEST-DEFAULT-OUTCOME]",
  },
  {
    id: "adaptive-completion-guard",
    file: "packages/core/src/session.ts",
    before: "if (closed) return [completedDiagnostic()];",
    after: "if (false) return [completedDiagnostic()];",
    occurrences: 1,
    witness: "adaptive model:",
  },
  {
    id: "import-shuffle",
    file: "packages/migrator/src/qti12-mappers.ts",
    before: "shuffle: choiceShuffle(response),",
    after: "shuffle: false,",
    occurrences: 2,
    witness: "choice fidelity:",
  },
  {
    id: "import-pinned-choice",
    file: "packages/migrator/src/qti12-mappers.ts",
    before: 'fixed: attr(label, "rshuffle")?.toLowerCase() === "no",',
    after: "fixed: false,",
    occurrences: 2,
    witness: "choice fidelity:",
  },
];
const files = [
  "packages/core/src/test-execution-profile.test.ts",
  "packages/core/src/session-sequences.test.ts",
  "packages/migrator/src/choice-semantic-matrix.test.ts",
  "packages/migrator/src/scoring-fidelity.test.ts",
];
const root = fileURLToPath(new URL("..", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "qti3-semantic-mutations-"));
const evidence = [];
try {
  // Copy current sources, including uncommitted work, without ever editing the checkout.
  for (const name of [
    "packages",
    "tests",
    "examples",
    "vitest.config.ts",
    "package.json",
    "tsconfig.json",
    "tsconfig.base.json",
  ]) {
    await cp(join(root, name), join(temporary, name), {
      recursive: true,
      filter: (path) => !["node_modules", "dist", ".vite"].includes(basename(path)),
    });
  }
  await symlink(join(root, "node_modules"), join(temporary, "node_modules"), "dir");
  for (const name of await readdir(join(root, "packages"))) {
    const dependencies = join(root, "packages", name, "node_modules");
    if (existsSync(dependencies))
      await symlink(dependencies, join(temporary, "packages", name, "node_modules"), "dir");
  }
  const baseline = await run("baseline");
  if (
    baseline.exit !== 0 ||
    baseline.report.success !== true ||
    baseline.tests.length === 0 ||
    baseline.tests.some((test) => test.status !== "passed")
  )
    throw new Error("Semantic baseline failed; fix it before evaluating mutants.");
  const names = baseline.tests.map((test) => test.fullName).toSorted();
  for (const mutant of mutants) {
    const path = join(temporary, mutant.file);
    const original = await readFile(path, "utf8");
    if (original.split(mutant.before).length - 1 !== mutant.occurrences)
      throw new Error(`Mutation anchor drift: ${mutant.id}. Review the fault definition.`);
    let result;
    try {
      await writeFile(path, original.replaceAll(mutant.before, mutant.after));
      result = await run(mutant.id);
    } finally {
      await writeFile(path, original);
    }
    const sameTests =
      JSON.stringify(result.tests.map((test) => test.fullName).toSorted()) ===
      JSON.stringify(names);
    const failures = result.tests.filter((test) => test.status === "failed");
    const killed =
      sameTests &&
      result.exit === 1 &&
      result.tests.every((test) => ["passed", "failed"].includes(test.status)) &&
      failures.some((test) => test.fullName.includes(mutant.witness));
    evidence.push({
      id: mutant.id,
      status: killed ? "killed" : "survived-or-invalid",
      failures: failures.map((test) => test.fullName),
    });
    console.log(
      `${mutant.id}: ${killed ? "killed" : "SURVIVED OR INVALID"} (${failures.length} failing cases)`,
    );
  }
  const output = process.argv[2];
  if (output)
    await writeFile(
      resolve(output),
      JSON.stringify({ baselineCases: names.length, mutants: evidence }, null, 2) + "\n",
    );
  if (evidence.some((entry) => entry.status !== "killed"))
    throw new Error("Semantic mutation gate failed; review the report.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function run(name) {
  const reportPath = join(temporary, `${name}.json`);
  const processResult = spawnSync(
    process.execPath,
    [
      join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      ...files,
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ],
    {
      cwd: temporary,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, QTI3_EXTENDED_SEMANTICS: "0" },
    },
  );
  if (processResult.error || processResult.signal)
    throw new Error(
      `Mutation run ${name} did not complete: ${processResult.error ?? processResult.signal}`,
    );
  let report;
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch {
    throw new Error(`Missing mutation report for ${name}: ${processResult.stderr}`);
  }
  if (!Array.isArray(report.testResults)) throw new Error(`Invalid report for ${name}`);
  const tests = report.testResults.flatMap((file) => {
    if (!Array.isArray(file.assertionResults) || file.assertionResults.length === 0)
      throw new Error(`Test collection failed for ${name}: ${file.message}`);
    return file.assertionResults;
  });
  return { exit: processResult.status, report, tests };
}

import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const qtiRoot = process.env.QTI3_EXTERNAL_QTI_DIR;
if (!qtiRoot) throw new Error("QTI3_EXTERNAL_QTI_DIR is required.");
const output =
  process.env.QTI3_CERTIFICATION_OUTPUT_DIR ??
  (await mkdtemp(join(tmpdir(), "qti3-certification-")));
await mkdir(output, { recursive: true, mode: 0o700 });
const realOutput = await realpath(output);
const relation = relative(await realpath(root), realOutput);
if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation)))
  throw new Error("Certification evidence must be stored outside the repository.");
const reportPath = join(realOutput, "basic-import-items.json");
const cli = join(root, "packages/cli/dist/index.js");
const args = [cli, "certification", "import-basic-items", "--qti-root", resolve(qtiRoot)];
const result = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
await writeFile(reportPath, result.stdout, { mode: 0o600 });
await writeFile(
  join(realOutput, "runner-stderr.log"),
  result.error ? String(result.error) : result.stderr,
  { mode: 0o600 },
);
if (result.status !== 0)
  throw new Error(`Import evidence failed. Inspect the private reports in ${realOutput}.`);
const report = JSON.parse(result.stdout);
const summary = [
  "# Basic IMPORT item evidence",
  "",
  `Candidate: ${report.identity.producer.revision}`,
  `Version: ${report.identity.producer.version}`,
  `Runtime SHA-256: ${report.identity.producer.runtimeSha256}`,
  `Conformance revision: ${report.identity.source.revision}`,
  `Checklist SHA-256: ${report.identity.source.workbookSha256}`,
  "",
  `Checklist rows: ${report.coverage.passed}/${report.coverage.required} passed; ${report.coverage.missing} missing.`,
  `Executable cases: ${report.checked}; failures: ${report.failed}.`,
  `Automated evidence ready: ${report.automatedEvidenceReady}.`,
  "",
  "This is local evidence, not a certification decision.",
  "",
  "## Submission clarification notes",
  "",
  ...[...new Set(report.coverage.rows.flatMap((row) => (row.note ? [row.note] : [])))].map(
    (note) => `- ${note}`,
  ),
  "",
  "## Acceptance crosswalk",
  "",
  "| Worksheet row | Authored AC ID | Evidence cases | Result |",
  "| --- | --- | --- | --- |",
  ...report.coverage.rows.map(
    (row) => `| ${row.row} | ${row.originalAcId} | ${row.caseIds.join(", ")} | ${row.status} |`,
  ),
  "",
].join("\n");
await writeFile(join(realOutput, "basic-import-items-summary.md"), summary, { mode: 0o600 });
const checked = spawnSync(
  process.execPath,
  [
    cli,
    "certification",
    "check-import-report",
    "--qti-root",
    resolve(qtiRoot),
    "--saved-report",
    reportPath,
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
await writeFile(join(realOutput, "report-check.json"), checked.stdout, { mode: 0o600 });
if (checked.status !== 0)
  throw new Error(
    `The evidence is not reproducible or ready for automated evidence collection. Inspect ${realOutput}.`,
  );
console.log(`Verified private evidence: ${realOutput}`);

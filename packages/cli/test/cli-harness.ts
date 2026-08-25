import type { CliOutput } from "../src/cli-result.js";
import { main } from "../src/index.js";

interface CliPackageJsonReport {
  packageErrors?: unknown;
  checked?: number;
  failed?: number;
  assessmentTestFiles?: unknown;
}

interface CliResultJsonReport {
  diagnostics?: unknown;
}

interface CliJsonReport {
  ok?: boolean;
  target?: unknown;
  interactions?: unknown;
  manualAssistiveTechnologyScripts?: unknown;
  assetFiles?: unknown;
  basicFeatures?: unknown;
  packageErrors?: unknown;
  missingPackageFeatures?: unknown;
  packages: CliPackageJsonReport[];
  results: CliResultJsonReport[];
}

/** In-memory CLI output boundary for behavior tests. */
export interface RecordingCliOutput extends CliOutput {
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}

/** Create an output boundary that records complete stdout and stderr messages. */
export function createRecordingCliOutput(): RecordingCliOutput {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: (text) => {
      stderr.push(text);
    },
  };
}

/** Run the public CLI seam with recorded output. */
export async function runCli(
  args: string[],
  output: RecordingCliOutput = createRecordingCliOutput(),
): Promise<{
  readonly code: number;
  readonly output: RecordingCliOutput;
}> {
  const code = await main(args, output);
  return { code, output };
}

/** Run the public CLI seam and parse its final JSON output for behavior assertions. */
export async function runCliJson(args: string[]): Promise<{ code: number; report: CliJsonReport }> {
  const { code, output } = await runCli(args);
  const payload: unknown = JSON.parse(lastStdout(output));
  if (!isCliJsonReport(payload)) {
    throw new Error("CLI output must be a JSON report object.");
  }
  const report: CliJsonReport = {
    packages: [],
    results: [],
    ...payload,
  };
  return { code, report };
}

/** Return the final standard-output message or fail when none was written. */
export function lastStdout(output: RecordingCliOutput): string {
  const message = output.stdout.at(-1);
  if (message === undefined) throw new Error("Expected CLI standard output.");
  return message;
}

/** Return the final standard-error message or fail when none was written. */
export function lastStderr(output: RecordingCliOutput): string {
  const message = output.stderr.at(-1);
  if (message === undefined) throw new Error("Expected CLI standard error.");
  return message;
}

function isCliJsonReport(value: unknown): value is Partial<CliJsonReport> {
  if (!isJsonObject(value)) return false;
  const packages = value.packages;
  const results = value.results;
  return (
    (packages === undefined ||
      (Array.isArray(packages) && packages.every((entry) => isJsonObject(entry)))) &&
    (results === undefined ||
      (Array.isArray(results) && results.every((entry) => isJsonObject(entry))))
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { isNodeFileSystemError } from "./cli-io.js";

/** Process exit codes emitted by supported CLI commands. */
export type CliExitCode = 0 | 1;

/** Observable result of executing one CLI command. */
export type CliCommandResult =
  | { readonly exitCode: CliExitCode; readonly stream: "stdout"; readonly text: string }
  | { readonly exitCode: 1; readonly stream: "stderr"; readonly text: string };

/** Output boundary used to render a command result. */
export interface CliOutput {
  writeStdout(text: string): void;
  writeStderr(text: string): void;
}

/** Build a command result whose standard output is formatted JSON. */
export function jsonResult(value: unknown, exitCode: CliExitCode): CliCommandResult {
  return { exitCode, stream: "stdout", text: JSON.stringify(value, null, 2) };
}

/** Build a failed command result whose message belongs on standard error. */
export function errorResult(stderr: string): CliCommandResult {
  return { exitCode: 1, stream: "stderr", text: stderr };
}

/** Translate a Node filesystem failure at the CLI boundary when the cause is classifiable. */
export function fileSystemErrorResult(cause: unknown): CliCommandResult | undefined {
  if (!isNodeFileSystemError(cause)) return undefined;
  return errorResult(cause.message);
}

/** Run a filesystem-backed command, translating expected system failures while preserving defects. */
export async function runFileSystemCommand(
  command: () => Promise<CliCommandResult>,
): Promise<CliCommandResult> {
  try {
    return await command();
  } catch (cause) {
    const failure = fileSystemErrorResult(cause);
    if (failure === undefined) throw cause;
    return failure;
  }
}

/** Render a command result and return its process exit code. */
export function renderCliResult(result: CliCommandResult, output: CliOutput): number {
  if (result.stream === "stdout") output.writeStdout(result.text);
  else output.writeStderr(result.text);
  return result.exitCode;
}

/** Default CLI output boundary backed by the process console. */
export const nodeCliOutput: CliOutput = {
  writeStdout: (text) => console.log(text),
  writeStderr: (text) => console.error(text),
};

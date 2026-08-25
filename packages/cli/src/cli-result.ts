/** Process exit codes emitted by supported CLI commands. */
export type CliExitCode = 0 | 1;

/** Observable result of executing one CLI command. */
export interface CliCommandResult {
  readonly exitCode: CliExitCode;
  readonly stdout?: string;
  readonly stderr?: string;
}

/** Output boundary used to render a command result. */
export interface CliOutput {
  writeStdout(text: string): void;
  writeStderr(text: string): void;
}

/** Build a command result whose standard output is formatted JSON. */
export function jsonResult(value: unknown, exitCode: CliExitCode): CliCommandResult {
  return { exitCode, stdout: JSON.stringify(value, null, 2) };
}

/** Build a failed command result whose message belongs on standard error. */
export function errorResult(stderr: string): CliCommandResult {
  return { exitCode: 1, stderr };
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
  if (result.stdout !== undefined) output.writeStdout(result.stdout);
  if (result.stderr !== undefined) output.writeStderr(result.stderr);
  return result.exitCode;
}

/** Default CLI output boundary backed by the process console. */
export const nodeCliOutput: CliOutput = {
  writeStdout: (text) => console.log(text),
  writeStderr: (text) => console.error(text),
};

function isNodeFileSystemError(cause: unknown): cause is NodeJS.ErrnoException {
  return (
    cause instanceof Error &&
    "code" in cause &&
    typeof cause.code === "string" &&
    "syscall" in cause &&
    typeof cause.syscall === "string"
  );
}

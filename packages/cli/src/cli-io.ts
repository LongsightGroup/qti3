import { readFile } from "node:fs/promises";

/** Result of parsing or reading one CLI boundary value. */
export type CliParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/** Read a UTF-8 CLI input file and classify filesystem failures. */
export async function readTextInput(file: string, label: string): Promise<CliParseResult<string>> {
  try {
    return { ok: true, value: await readFile(file, "utf8") };
  } catch (error) {
    return { ok: false, message: fileErrorMessage(label, file, "read", error) };
  }
}

/** Read and parse a CLI input file whose root value must be a JSON object. */
export async function readJsonObject(
  file: string,
  label: string,
): Promise<CliParseResult<Record<string, unknown>>> {
  const text = await readTextInput(file, `${label} JSON`);
  if (!text.ok) return text;

  let value: unknown;
  try {
    value = JSON.parse(text.value);
  } catch {
    return { ok: false, message: `${label} file "${file}" is not valid JSON.` };
  }

  return isJsonObject(value)
    ? { ok: true, value }
    : { ok: false, message: `${label} file "${file}" must contain a JSON object.` };
}

/** Format a filesystem boundary failure without assuming the thrown value is an Error. */
export function fileErrorMessage(
  label: string,
  file: string,
  action: "read" | "write",
  error: unknown,
): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${label} file "${file}" could not be ${action}: ${detail}`;
}

/** Identify a Node system error produced by a filesystem operation. */
export function isNodeFileSystemError(cause: unknown): cause is NodeJS.ErrnoException {
  return (
    cause instanceof Error &&
    "code" in cause &&
    typeof cause.code === "string" &&
    "syscall" in cause &&
    typeof cause.syscall === "string"
  );
}

/** Identify filesystem absence while preserving permission failures and defects. */
export function isMissingPathError(cause: unknown): boolean {
  return isNodeFileSystemError(cause) && (cause.code === "ENOENT" || cause.code === "ENOTDIR");
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

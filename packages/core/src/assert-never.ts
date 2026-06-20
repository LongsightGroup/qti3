/** Fail loudly when a value should be unreachable after exhaustive union handling. */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${String(value)}`);
}

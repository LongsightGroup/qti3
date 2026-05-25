/** True when dev warnings are enabled (non-production Node, or browser without NODE_ENV). */
export function playerDevWarningsEnabled(): boolean {
  const nodeEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
    ?.NODE_ENV;
  return nodeEnv !== "production";
}

const warnedKeys = new Set<string>();

export function warnPlayerMessageOnce(code: string, message: string): void {
  if (!playerDevWarningsEnabled() || warnedKeys.has(code)) return;
  warnedKeys.add(code);
  console.warn(`[qti3-player] ${message}`);
}

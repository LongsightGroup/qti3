/** True when dev warnings are enabled (non-production Node, or browser without NODE_ENV). */
export function playerDevWarningsEnabled(): boolean {
  const nodeEnv = readNodeEnv();
  return nodeEnv !== "production";
}

function readNodeEnv(): string | undefined {
  const globalProcess = Reflect.get(globalThis, "process");
  if (typeof globalProcess !== "object" || globalProcess === null) return undefined;
  const env = Reflect.get(globalProcess, "env");
  if (typeof env !== "object" || env === null) return undefined;
  const nodeEnv = Reflect.get(env, "NODE_ENV");
  return typeof nodeEnv === "string" ? nodeEnv : undefined;
}

const warnedKeys = new Set<string>();

export function warnPlayerMessageOnce(code: string, message: string): void {
  if (!playerDevWarningsEnabled() || warnedKeys.has(code)) return;
  warnedKeys.add(code);
  console.warn(`[qti3-player] ${message}`);
}

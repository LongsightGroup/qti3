import type { QtiDiagnostic } from "./types.js";

/** Add a package parser diagnostic to an existing diagnostics list. */
export function pushPackageDiagnostic(
  diagnostics: QtiDiagnostic[],
  code: string,
  severity: QtiDiagnostic["severity"],
  message: string,
  path?: string,
): void {
  diagnostics.push({
    code,
    severity,
    message,
    path,
  });
}

/** Normalize a package-relative path and diagnose absolute or escaping paths. */
export function normalizePackagePath(
  path: string,
  context: string,
  diagnostics: QtiDiagnostic[],
): string | undefined {
  if (path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    pushPackageDiagnostic(
      diagnostics,
      "package.path.absolute",
      "error",
      `${context} ${path} must be a package-relative path.`,
      path,
    );
    return undefined;
  }

  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) {
        pushPackageDiagnostic(
          diagnostics,
          "package.path.escape",
          "error",
          `${context} ${path} escapes the package root.`,
          path,
        );
        return undefined;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

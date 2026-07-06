export function migrationPathIdentifier(path: string): string {
  return sanitizeMigrationIdentifier(path, "ITEM", "ITEM");
}

export function migrationPackageIdentifier(title: string): string {
  return sanitizeMigrationIdentifier(title, "PACKAGE", "PACKAGE");
}

function sanitizeMigrationIdentifier(value: string, fallback: string, prefix: string): string {
  const normalized = value.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_") || fallback;
  return /^[A-Za-z_]/.test(normalized) ? normalized : `${prefix}_${normalized}`;
}

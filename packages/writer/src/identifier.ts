const QTI_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function isQtiIdentifier(identifier: string): boolean {
  return QTI_IDENTIFIER_PATTERN.test(identifier.trim());
}

export function assertQtiIdentifier(identifier: string, label: string): string {
  const trimmed = identifier.trim();
  if (!isQtiIdentifier(trimmed)) {
    throw new Error(`${label} must be a valid QTI identifier.`);
  }
  return trimmed;
}

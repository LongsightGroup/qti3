/** Whether a value is a complete QTI identifier in the supported ASCII lexical space. */
export function isQtiIdentifier(identifier: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(identifier);
}

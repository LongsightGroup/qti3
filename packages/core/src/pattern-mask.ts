/** Compiles a QTI pattern-mask attribute value for full-string matching. */
export function compileQtiPatternMask(patternMask: string | undefined): RegExp | undefined {
  if (patternMask === undefined) return undefined;
  let mask = patternMask.trim();
  if (mask.length === 0) return undefined;

  mask = mask.startsWith("^") ? mask.slice(1) : mask;
  mask = mask.endsWith("$") ? mask.slice(0, -1) : mask;
  if (mask.length === 0) return undefined;

  try {
    return new RegExp(`^(?:${mask.replaceAll("/", "\\/")})$`);
  } catch {
    return undefined;
  }
}

export function isValidQtiPatternMask(patternMask: string): boolean {
  return compileQtiPatternMask(patternMask) !== undefined;
}

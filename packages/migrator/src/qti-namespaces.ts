const qti2Namespaces: ReadonlySet<string> = new Set([
  "http://www.imsglobal.org/xsd/imsqti_v2p1",
  "http://www.imsglobal.org/xsd/imsqti_v2p2",
]);
const qti3Namespace = "http://www.imsglobal.org/xsd/imsqtiasi_v3p0";

export function isQtiNamespace(namespace: string | null | undefined): boolean {
  return namespace === qti3Namespace || qti2Namespaces.has(namespace ?? "");
}

/** Foreign nodes retain their own names/serialization; legacy QTI prefixes do not migrate. */
export function migratedQti2ContentName(
  namespace: string | null | undefined,
  localName: string,
): string | undefined {
  if (namespace && !qti2Namespaces.has(namespace)) return undefined;
  return localName.toLowerCase() === "rubricblock" ? "qti-rubric-block" : localName;
}

import { parseXmlBoolean } from "@longsightgroup/qti3-core";

export function xmlBooleanAttribute(value: string | null | undefined): boolean {
  return parseXmlBoolean(value ?? undefined) === true;
}

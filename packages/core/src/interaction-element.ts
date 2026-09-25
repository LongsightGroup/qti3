import { interactionNameToType } from "./support.js";
import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import type { XmlNode } from "./xml.js";

export function isInteractionElement(node: XmlNode): boolean {
  return (
    node.uri === QTI_ASI_NAMESPACE &&
    (interactionNameToType.has(node.localName) || /^qti-.+-interaction$/.test(node.localName))
  );
}

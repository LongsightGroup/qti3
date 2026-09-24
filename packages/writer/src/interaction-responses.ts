import { assertNever } from "@longsightgroup/qti3-core";
import type { Qti3AuthoringItem } from "./types.js";

/** Enumerate every declared response; new interaction types must define their response shape. */
export function authoringResponseIdentifiers(item: Qti3AuthoringItem): string[] {
  switch (item.interactionType) {
    case "textEntry":
      return item.responses.map((response) => response.responseIdentifier);
    case "inlineChoice":
      return item.slots.map((slot) => slot.responseIdentifier);
    case "choice":
    case "order":
    case "hottext":
    case "gapMatch":
    case "extendedText":
    case "upload":
    case "media":
    case "associate":
    case "match":
    case "hotspot":
    case "graphicOrder":
    case "selectPoint":
    case "positionObject":
    case "slider":
    case "custom":
    case "portableCustom":
    case "drawing":
    case "endAttempt":
    case "graphicAssociate":
    case "graphicGapMatch":
      return [item.responseIdentifier ?? "RESPONSE"];
    default:
      return assertNever(item);
  }
}

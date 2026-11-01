import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  localName,
  type XmlElement,
  type XmlNode,
} from "./xml.js";

/** Isolate Canvas's recognized, non-scoring feedback instructions from its answer program. */
export function prepareQti12Feedback(
  item: XmlElement,
):
  | { readonly ok: true; readonly item: XmlElement; readonly feedback: boolean }
  | { readonly ok: false } {
  const copy = item.cloneNode(true);
  if (!isElement(copy)) return { ok: false };
  const definitions = findAllDescendantsByLocalName(copy, "itemfeedback");
  const ids = new Set(definitions.map((node) => attr(node, "ident")));
  if (ids.size !== definitions.length) return { ok: false };
  let feedback = false;
  for (const block of findAllDescendantsByLocalName(copy, "resprocessing")) {
    for (const condition of childElements(block).filter(
      (node) => localName(node) === "respcondition",
    )) {
      const children = childElements(condition);
      const links = children.filter((node) => localName(node) === "displayfeedback");
      if (!links.length) continue;
      if (
        links.some(
          (node) =>
            attr(node, "feedbacktype") !== "Response" ||
            !ids.has(attr(node, "linkrefid")) ||
            !attr(node, "linkrefid") ||
            childElements(node).length,
        )
      )
        return { ok: false };
      const scoring = children.some((node) => localName(node) === "setvar");
      if (!scoring) {
        const predicates = children.filter((node) => localName(node) === "conditionvar");
        const conditionvar = predicates[0];
        const predicate = conditionvar && childElements(conditionvar)[0];
        if (
          attr(condition, "continue") !== "Yes" ||
          predicates.length !== 1 ||
          !conditionvar ||
          !predicate ||
          childElements(conditionvar).length !== 1 ||
          childElements(predicate).length ||
          !["other", "varequal"].includes(localName(predicate)) ||
          children.some((node) => !["conditionvar", "displayfeedback"].includes(localName(node)))
        )
          return { ok: false };
        block.removeChild(condition);
      } else for (const link of links) condition.removeChild(link);
      feedback = true;
    }
  }
  return { ok: true, item: copy, feedback };
}

function isElement(node: XmlNode): node is XmlElement {
  return node.nodeType === 1 && "attributes" in node;
}

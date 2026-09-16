import { readFileSync } from "node:fs";
import { parseQtiPackageXmlTree, type QtiPackageXmlNode } from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import {
  canonicalFixtures,
  basicItemPlayerFixtures,
  basicItemPlayerToleranceFixtures,
} from "@longsightgroup/qti3-fixtures";

it.each(canonicalFixtures)("keeps published $id XML synchronized with its generator", (fixture) => {
  expect(
    readFileSync(new URL(`../../fixtures/xml/${fixture.id}.xml`, import.meta.url), "utf8").trim(),
  ).toBe(fixture.xml.trim());
});

it.each(["endAttempt-reference", "adaptive-feedback-reference"])(
  "places %s inline End Attempt controls in paragraphs",
  (id) => {
    const fixture = canonicalFixtures.find((entry) => entry.id === id);
    if (!fixture) throw new Error("Missing fixture");
    const body = parseQtiPackageXmlTree(fixture.xml).root?.children.find(
      (node) => node.localName === "qti-item-body",
    );
    expect(body?.children.some((node) => node.localName === "qti-end-attempt-interaction")).toBe(
      false,
    );
    expect(
      body?.children.some(
        (node) =>
          node.localName === "p" &&
          node.children.some((child) => child.localName === "qti-end-attempt-interaction"),
      ),
    ).toBe(true);
  },
);

// QTI 3.0.1 AssessmentItemDType sequence; this check deliberately needs no runtime XSD engine.
const itemChildOrder = [
  "qti-context-declaration",
  "qti-response-declaration",
  "qti-outcome-declaration",
  "qti-template-declaration",
  "qti-template-processing",
  "qti-assessment-stimulus-ref",
  "qti-companion-materials-info",
  "qti-stylesheet",
  "qti-item-body",
  "qti-catalog-info",
  "qti-response-processing",
  "qti-modal-feedback",
];

it.each([
  canonicalFixtures.find((fixture) => fixture.id === "template-content-reference"),
  basicItemPlayerFixtures.find((fixture) => fixture.id === "basic-mathml"),
])("places every MathML element in the MathML namespace in $id", (fixture) => {
  if (!fixture) throw new Error("Missing MathML fixture");
  const root = parseQtiPackageXmlTree(fixture.xml).root;
  if (!root) throw new Error("Missing item root");
  const nodes = descendants(root);
  const math = nodes.find((node) => node.localName === "math");
  expect(math).toBeDefined();
  if (!math) return;
  for (const node of [math, ...descendants(math)]) {
    expect(node.uri).toBe("http://www.w3.org/1998/Math/MathML");
  }
});

function descendants(node: QtiPackageXmlNode): QtiPackageXmlNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

it.each([...canonicalFixtures, ...basicItemPlayerFixtures, ...basicItemPlayerToleranceFixtures])(
  "generates $id in the complete item child order",
  (fixture) => {
    const root = parseQtiPackageXmlTree(fixture.xml).root;
    expect(root?.localName).toBe("qti-assessment-item");
    const ranks =
      root?.children.map((child) => {
        expect(itemChildOrder).toContain(child.localName);
        return itemChildOrder.indexOf(child.localName);
      }) ?? [];
    expect(ranks).toEqual(ranks.toSorted((left, right) => left - right));
  },
);

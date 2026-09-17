import { readFileSync } from "node:fs";
import {
  parseQtiPackageXmlTree,
  parseQtiXml,
  validateAssessmentItem,
  type QtiPackageXmlNode,
} from "@longsightgroup/qti3-core";
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
    const parsed = parseQtiXml(fixture.xml);
    const document = parsed.document;
    if (!document) throw new Error(`Could not parse fixture ${fixture.id}`);
    expect(
      validateAssessmentItem(document).diagnostics.filter((diagnostic) =>
        diagnostic.code.startsWith("assessmentItem.child."),
      ),
    ).toEqual([]);
  },
);

import { readFileSync } from "node:fs";
import { parseQtiPackageXmlTree } from "@longsightgroup/qti3-core";
import { expect, it } from "vitest";
import { canonicalFixtures } from "@longsightgroup/qti3-fixtures";

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

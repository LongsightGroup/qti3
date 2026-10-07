import { isQtiIdentifier } from "./qti-identifier.js";
import { isQtiPackageItemHref } from "./qti-package-paths.js";
import { QTI_ASI_NAMESPACE } from "./qti-namespaces.js";
import { parseXmlTree, type XmlNode } from "./xml.js";
import { checkTestXml } from "./test-xml.js";
import { seededRandom } from "./processing-random.js";
import { testFailure, type QtiTestItemRef, type QtiTestResult } from "./test-model.js";
import type { QtiDiagnostic } from "./types.js";

/** A fixed-test reference whose authored slot can be protected during section shuffling. */
export interface QtiFixedTestItemRef extends QtiTestItemRef {
  readonly fixed?: boolean | undefined;
}

const fixedOrdering = Symbol("qti3.fixed-test-ordering");

/** Parsed flat-section ordering; navigation, timing and content delivery remain host policies. */
export interface QtiFixedTestOrdering {
  readonly [fixedOrdering]: true;
  readonly testIdentifier: string;
  readonly sections: readonly {
    readonly partIdentifier: string;
    readonly sectionIdentifier: string;
    readonly shuffle: boolean;
    readonly items: readonly QtiFixedTestItemRef[];
  }[];
}

/** Persisted per-attempt section permutations, validated against the published definition. */
export interface QtiFixedTestOrderState {
  readonly schema: "qti3.fixed-test-order.v1";
  readonly testIdentifier: string;
  readonly sections: readonly {
    readonly partIdentifier: string;
    readonly sectionIdentifier: string;
    readonly itemRefs: readonly string[];
  }[];
}

/** Fresh shuffle needs host-supplied entropy; restoration always uses saved permutations. */
export type QtiFixedTestOrderInput =
  | { readonly kind: "new"; readonly seed: string | number | undefined }
  | { readonly kind: "restore"; readonly state: unknown };

/**
 * Parse ordering for fixed flat sections without claiming full test delivery support.
 * Selection, branches, preconditions and nested sections are refused. Other authored
 * static content and delivery controls must still be validated by their execution owner.
 */
export function parseQtiFixedTestOrdering(xml: string): QtiTestResult<QtiFixedTestOrdering> {
  const { root, errors } = parseXmlTree(xml);
  if (
    errors.length ||
    !root ||
    root.uri !== QTI_ASI_NAMESPACE ||
    root.localName !== "qti-assessment-test"
  )
    return testFailure("ordering.xml", "Expected a well-formed QTI 3 assessment test.");
  const diagnostics: QtiDiagnostic[] = [];
  const identifiers = new Set<string>();
  const register = (node: XmlNode) => {
    const identifier = node.attributes.identifier ?? "";
    if (!isQtiIdentifier(identifier) || identifiers.has(identifier))
      diagnostics.push({
        code: "test.ordering.identifier",
        severity: "error",
        message: "Ordering identifiers must be valid and unique.",
        source: node.source,
      });
    identifiers.add(identifier);
    return identifier;
  };
  const testIdentifier = register(root);
  checkTestXml(
    root,
    ["qti-test-part", "qti-time-limits", "qti-rubric-block", "qti-test-feedback"],
    ["identifier", "title", "tool-name", "tool-version"],
    diagnostics,
  );
  const sections: QtiFixedTestOrdering["sections"][number][] = [];
  const parts = root.children.filter((node) => node.localName === "qti-test-part");
  if (!parts.length)
    return testFailure("ordering.parts", "Ordering requires at least one test part.");
  for (const part of parts) {
    const partIdentifier = register(part);
    checkTestXml(
      part,
      ["qti-assessment-section", "qti-time-limits", "qti-rubric-block", "qti-test-feedback"],
      ["identifier", "title", "navigation-mode", "submission-mode"],
      diagnostics,
    );
    const children = part.children.filter((node) => node.localName === "qti-assessment-section");
    if (!children.length)
      return testFailure("ordering.sections", "Every ordered part requires a section.");
    for (const section of children) {
      const sectionIdentifier = register(section);
      checkTestXml(
        section,
        [
          "qti-assessment-item-ref",
          "qti-ordering",
          "qti-time-limits",
          "qti-rubric-block",
          "qti-item-session-control",
        ],
        ["identifier", "title", "visible", "keep-together"],
        diagnostics,
      );
      if (
        !["true", "1"].includes(section.attributes.visible ?? "") ||
        (section.attributes["keep-together"] !== undefined &&
          !["true", "1"].includes(section.attributes["keep-together"]))
      )
        diagnostics.push({
          code: "test.ordering.section",
          severity: "error",
          message: "Fixed ordering requires visible, intact flat sections.",
          source: section.source,
        });
      const orderings = section.children.filter((node) => node.localName === "qti-ordering");
      const ordering = orderings[0];
      if (orderings.length > 1)
        diagnostics.push({
          code: "test.ordering.duplicate",
          severity: "error",
          message: "A section can have only one ordering policy.",
          source: section.source,
        });
      if (ordering) checkTestXml(ordering, [], ["shuffle"], diagnostics);
      const shuffle = booleanAttribute(ordering, "shuffle", diagnostics);
      const items = section.children
        .filter((node) => node.localName === "qti-assessment-item-ref")
        .map((item) => {
          checkTestXml(
            item,
            ["qti-time-limits", "qti-item-session-control"],
            ["identifier", "href", "category", "fixed"],
            diagnostics,
          );
          const identifier = register(item);
          const href = item.attributes.href ?? "";
          if (!isQtiPackageItemHref(href))
            diagnostics.push({
              code: "test.ordering.href",
              severity: "error",
              message: "Ordered references require package-local item paths.",
              source: item.source,
            });
          return {
            identifier,
            href,
            categories: (item.attributes.category ?? "")
              .split(/\s+/)
              .filter((category) => category.length > 0),
            fixed: booleanAttribute(item, "fixed", diagnostics),
          };
        });
      if (!items.length)
        return testFailure("ordering.items", "Every ordered section requires item references.");
      sections.push({ partIdentifier, sectionIdentifier, shuffle, items });
    }
  }
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, value: { [fixedOrdering]: true, testIdentifier, sections } };
}

function booleanAttribute(
  node: XmlNode | undefined,
  name: string,
  diagnostics: QtiDiagnostic[],
): boolean {
  const value = node?.attributes[name];
  if (value === undefined) return false;
  if (!["true", "1", "false", "0"].includes(value))
    diagnostics.push({
      code: "test.ordering.boolean",
      severity: "error",
      message: "Ordering flags must be QTI booleans.",
      source: node?.source,
    });
  return value === "true" || value === "1";
}

/** Generate once, or validate and copy a saved order without regenerating it. */
export function prepareQtiFixedTestOrder(
  definition: QtiFixedTestOrdering,
  input: QtiFixedTestOrderInput,
): QtiTestResult<QtiFixedTestOrderState> {
  if (input.kind === "restore") return restoreOrder(definition, input.state);
  if (
    definition.sections.some((section) => section.shuffle) &&
    (input.seed === undefined || (typeof input.seed === "number" && !Number.isFinite(input.seed)))
  )
    return testFailure(
      "ordering.seed",
      "A string or finite numeric seed is required for shuffled test order.",
    );
  return {
    ok: true,
    value: {
      schema: "qti3.fixed-test-order.v1",
      testIdentifier: definition.testIdentifier,
      sections: definition.sections.map((section) => ({
        partIdentifier: section.partIdentifier,
        sectionIdentifier: section.sectionIdentifier,
        itemRefs: section.shuffle
          ? shuffledRefs(
              section.items,
              seededRandom(
                JSON.stringify([
                  input.seed,
                  definition.testIdentifier,
                  section.partIdentifier,
                  section.sectionIdentifier,
                ]),
              ),
            )
          : section.items.map((item) => item.identifier),
      })),
    },
  };
}

function shuffledRefs(items: readonly QtiFixedTestItemRef[], random: () => number): string[] {
  const movable = items.filter((item) => !item.fixed).map((item) => item.identifier);
  for (let index = movable.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const left = movable[index];
    const right = movable[other];
    if (left === undefined || right === undefined)
      throw new Error("Fixed ordering selected an invalid slot.");
    movable[index] = right;
    movable[other] = left;
  }
  let next = 0;
  return items.map((item) => {
    if (item.fixed) return item.identifier;
    const identifier = movable[next++];
    if (identifier === undefined) throw new Error("Fixed ordering lost a movable item.");
    return identifier;
  });
}

function restoreOrder(
  definition: QtiFixedTestOrdering,
  input: unknown,
): QtiTestResult<QtiFixedTestOrderState> {
  if (
    !recordWithKeys(input, ["schema", "testIdentifier", "sections"]) ||
    input.schema !== "qti3.fixed-test-order.v1" ||
    input.testIdentifier !== definition.testIdentifier ||
    !Array.isArray(input.sections) ||
    input.sections.length !== definition.sections.length
  )
    return testFailure("ordering.state", "Saved test order does not match this definition.");
  const sections: QtiFixedTestOrderState["sections"][number][] = [];
  for (const [index, section] of definition.sections.entries()) {
    const saved: unknown = input.sections[index];
    if (
      !recordWithKeys(saved, ["partIdentifier", "sectionIdentifier", "itemRefs"]) ||
      saved.partIdentifier !== section.partIdentifier ||
      saved.sectionIdentifier !== section.sectionIdentifier ||
      !Array.isArray(saved.itemRefs) ||
      saved.itemRefs.length !== section.items.length
    )
      return testFailure("ordering.state", "Saved sections do not match the published order.");
    const refs: string[] = [];
    for (const raw of saved.itemRefs) {
      const value: unknown = raw;
      if (
        typeof value !== "string" ||
        refs.includes(value) ||
        !section.items.some((item) => item.identifier === value)
      )
        return testFailure(
          "ordering.state",
          "Saved item order must be an exact section permutation.",
        );
      refs.push(value);
    }
    if (
      section.items.some(
        (item, slot) => (!section.shuffle || item.fixed) && refs[slot] !== item.identifier,
      )
    )
      return testFailure("ordering.state", "Saved order moves an authored or fixed item slot.");
    sections.push({
      partIdentifier: section.partIdentifier,
      sectionIdentifier: section.sectionIdentifier,
      itemRefs: refs,
    });
  }
  return {
    ok: true,
    value: {
      schema: "qti3.fixed-test-order.v1",
      testIdentifier: definition.testIdentifier,
      sections,
    },
  };
}

function recordWithKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

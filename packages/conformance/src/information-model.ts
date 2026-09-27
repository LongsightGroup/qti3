import type { QtiElementSupport, QtiSupportStatus } from "@longsightgroup/qti3-core";

export type QtiInformationModelKind =
  | "part"
  | "behavior"
  | "class"
  | "characteristic"
  | "attribute"
  | "vocabulary";

export interface QtiInformationModelEntry {
  readonly id: string;
  readonly title: string;
  readonly kind: QtiInformationModelKind;
  readonly anchor: string;
}

export type QtiInformationModelScope =
  | "item"
  | "test-tooling"
  | "out-of-scope"
  | "reference"
  | "catalog";

export interface QtiInformationModelEvidence {
  readonly qtiName: string;
  readonly category: QtiElementSupport["category"];
  readonly support: QtiSupportStatus;
  readonly tests: readonly string[];
}

export type QtiInformationModelReference =
  | { readonly type: "section"; readonly path: string; readonly sectionId: string }
  | { readonly type: "anchor"; readonly path: string; readonly anchor: string };

export type QtiInformationModelClaim =
  | { readonly type: "out-of-scope"; readonly reason: string }
  | { readonly type: "reference"; readonly reason: string }
  | {
      readonly type: "test-tooling";
      readonly reason: string;
      readonly qtiName: string | undefined;
      readonly tests: readonly string[];
    }
  | { readonly type: "element-tested"; readonly qtiName: string; readonly tests: readonly string[] }
  | { readonly type: "diagnostic"; readonly qtiName: string; readonly tests: readonly string[] }
  | {
      readonly type: "with-element";
      readonly qtiName: string;
      readonly tests: readonly string[];
    }
  | { readonly type: "mentioned"; readonly paths: readonly string[] }
  | { readonly type: "heading" }
  | { readonly type: "open" }
  | { readonly type: "unassigned" };

export interface QtiInformationModelReviewRow {
  readonly id: string;
  readonly title: string;
  readonly kind: QtiInformationModelKind;
  readonly anchor: string;
  readonly scope: QtiInformationModelScope;
  readonly claim: QtiInformationModelClaim;
}

export interface QtiInformationModelUnresolvedReference {
  readonly path: string;
  readonly reference: string;
}

export interface QtiInformationModelReview {
  readonly rows: readonly QtiInformationModelReviewRow[];
  readonly duplicateEvidence: readonly string[];
  readonly unmatchedEvidence: readonly string[];
  readonly unresolvedReferences: readonly QtiInformationModelUnresolvedReference[];
}

export interface QtiInformationModelReviewSummary {
  readonly rows: number;
  readonly elementTested: number;
  readonly diagnostic: number;
  readonly mentioned: number;
  readonly openBehavior: readonly string[];
  readonly openTestedClassDetails: number;
  readonly unassigned: number;
  readonly outOfScope: number;
  readonly unmatchedEvidence: number;
  readonly unresolvedReferences: number;
}

interface ScopeRule {
  readonly prefix: string;
  readonly scope: QtiInformationModelScope;
  readonly reason: string;
}

const scopeRules: readonly ScopeRule[] = [
  {
    prefix: "2.1.4",
    scope: "out-of-scope",
    reason: "Results reporting is outside the item engine.",
  },
  { prefix: "2.8.6", scope: "item", reason: "Rubric blocks are item content." },
  {
    prefix: "2.8",
    scope: "out-of-scope",
    reason: "Test delivery, navigation, branching, CAT, and time limits belong to the host.",
  },
  {
    prefix: "2.9",
    scope: "out-of-scope",
    reason: "Outcome processing is test-level and outside the item engine.",
  },
  {
    prefix: "2.10",
    scope: "out-of-scope",
    reason: "Test-level feedback is outside the item engine.",
  },
  {
    prefix: "2.11.2",
    scope: "out-of-scope",
    reason: "These expressions are defined only for outcome processing.",
  },
  {
    prefix: "2.1",
    scope: "reference",
    reason: "This is structural overview, not an item contract.",
  },
  { prefix: "2.2", scope: "item", reason: "Item session lifecycle and variables." },
  { prefix: "2.3", scope: "item", reason: "Item content model." },
  { prefix: "2.4", scope: "item", reason: "Item interactions." },
  { prefix: "2.5", scope: "item", reason: "Item response processing." },
  { prefix: "2.6", scope: "item", reason: "Item modal feedback." },
  { prefix: "2.7", scope: "item", reason: "Item templates and template processing." },
  { prefix: "2.11", scope: "item", reason: "Item expressions and operators." },
  { prefix: "2.12", scope: "item", reason: "Item and response-processing fragments." },
  { prefix: "2.13", scope: "item", reason: "Item accessibility content." },
  { prefix: "2.14", scope: "item", reason: "Item internationalization." },
  {
    prefix: "3.2",
    scope: "test-tooling",
    reason: "Assessment-section structure is import tooling.",
  },
  {
    prefix: "3.3",
    scope: "out-of-scope",
    reason: "Shared stimulus delivery is outside the item engine.",
  },
  { prefix: "3.4", scope: "test-tooling", reason: "Assessment-test structure is import tooling." },
  { prefix: "3.1", scope: "item", reason: "Assessment-item root attributes." },
  { prefix: "3.5", scope: "item", reason: "Outcome declarations used by items." },
  { prefix: "3.6", scope: "item", reason: "Response-processing root attributes." },
  {
    prefix: "4.2",
    scope: "test-tooling",
    reason: "Assessment-section structure is import tooling.",
  },
  {
    prefix: "4.3",
    scope: "out-of-scope",
    reason: "Shared stimulus delivery is outside the item engine.",
  },
  { prefix: "4.4", scope: "test-tooling", reason: "Assessment-test structure is import tooling." },
  { prefix: "4.1", scope: "item", reason: "Assessment item." },
  { prefix: "4.5", scope: "item", reason: "Outcome declarations used by items." },
  { prefix: "4.6", scope: "item", reason: "Response processing." },
  {
    prefix: "10.1.2",
    scope: "out-of-scope",
    reason: "Section selection is test delivery.",
  },
  {
    prefix: "10.1.3",
    scope: "out-of-scope",
    reason: "Section ordering is test delivery.",
  },
  { prefix: "1", scope: "reference", reason: "Introduction." },
  { prefix: "2", scope: "reference", reason: "Information-model overview." },
  { prefix: "3", scope: "reference", reason: "Root-attribute overview." },
  { prefix: "4", scope: "reference", reason: "Root-class overview." },
  { prefix: "5", scope: "catalog", reason: "Data-class catalog." },
  { prefix: "6", scope: "catalog", reason: "Abstract-class catalog." },
  { prefix: "7", scope: "catalog", reason: "Derived-class catalog." },
  { prefix: "8", scope: "catalog", reason: "Enumerated vocabularies." },
  { prefix: "9", scope: "item", reason: "Value types used by item processing." },
  { prefix: "10", scope: "reference", reason: "Extension and profiling guidance." },
] as const satisfies readonly ScopeRule[];

const titleAliases: Readonly<Record<string, string>> = {
  "Alternative Ways to End an Attempt": "qti-end-attempt-interaction",
  "Hot Text Interaction": "qti-hottext-interaction",
  "Rubric Blocks": "qti-rubric-block",
  StyleSheet: "qti-stylesheet",
  "Text Interaction": "qti-text-entry-interaction",
};

// The TOC titles this operator "Duration Expression" while its anchor is the GTE operator.
const anchorElements: Readonly<Record<string, string>> = {
  OpDurationGTE: "qti-duration-gte",
};

/** Narrative sections exercised by existing tests that do not cite the section number. */
const behaviorEvidence: Readonly<Record<string, readonly string[]>> = {
  "2.2.1": [
    "packages/core/src/session-completed.test.ts",
    "tests/browser/player-lifecycle.spec.ts",
  ],
  "2.2.2.1": ["packages/core/src/session-builtins.test.ts"],
  "2.2.2.2": [
    "packages/core/src/response-validation.test.ts",
    "packages/core/src/scoring-spec-contracts.test.ts",
  ],
  "2.2.2.3": ["packages/core/src/scoring-spec-contracts.test.ts"],
  "2.3.1": [
    "packages/core/src/parser-content.test.ts",
    "tests/browser/player-body-content.spec.ts",
  ],
  "2.3.2.1": [
    "packages/core/src/content-text.test.ts",
    "tests/browser/player-body-content.spec.ts",
  ],
  "2.3.2.2": ["tests/browser/player-dom-behavior.spec.ts"],
  "2.3.2.3": ["packages/core/src/content-text.test.ts", "tests/browser/player-graphic.spec.ts"],
  "2.3.2.4": ["packages/core/src/parser-content.test.ts"],
  "2.3.2.5": ["tests/browser/player-body-content.spec.ts"],
  "2.3.2.6": [
    "packages/player/src/image-source-set.test.ts",
    "tests/browser/player-body-content.spec.ts",
  ],
  "2.3.2.7": ["tests/browser/player-body-content.spec.ts"],
  "2.3.2.8": ["tests/browser/player-media.spec.ts", "tests/browser/player-package.spec.ts"],
  "2.3.4": ["packages/core/src/parser-content.test.ts", "tests/browser/player-lifecycle.spec.ts"],
  "2.3.5": [
    "packages/core/src/parser-item-metadata.test.ts",
    "packages/player/src/player/stylesheet-delivery.test.ts",
    "tests/browser/player-package.spec.ts",
  ],
  "2.3.6": ["tests/browser/player-body-content.spec.ts"],
  "2.3.7": ["tests/browser/player-body-content.spec.ts"],
  "2.5.1": ["packages/core/src/scoring-spec-contracts.test.ts"],
  "2.5.2": [
    "packages/core/src/processing-operators.test.ts",
    "packages/core/src/processing-response.test.ts",
  ],
  "2.7.1": [
    "packages/core/src/processing-template.test.ts",
    "tests/browser/player-lifecycle.spec.ts",
  ],
  "2.12": ["packages/core/src/processing-response.test.ts"],
  "2.13.1": ["packages/core/src/catalog.test.ts", "packages/player/src/catalog-delivery.test.ts"],
  "2.13.2": ["tests/browser/player-body-content.spec.ts"],
  "2.13.3": ["tests/browser/player-body-content.spec.ts"],
  "2.14.1": ["tests/browser/player-body-content.spec.ts"],
  "2.14.2": ["tests/browser/player-body-content.spec.ts"],
  "2.14.3": ["packages/core/src/catalog.test.ts", "tests/browser/player-body-content.spec.ts"],
};

const testedSupport = new Set<QtiSupportStatus>([
  "parsed",
  "validated",
  "rendered",
  "interactive",
  "scored",
  "accessible-tested",
  "conformance-tested",
  "supported",
]);

/** Map a support-matrix entry into the evidence the information-model review consumes. */
export function qtiInformationModelEvidence(
  support: readonly QtiElementSupport[],
): QtiInformationModelEvidence[] {
  return support.map((entry) => ({
    qtiName: entry.qtiName,
    category: entry.category,
    support: entry.support,
    tests: entry.tests,
  }));
}

/**
 * Normalize an information-model title to a `qti-*` name.
 * A returned name is only evidence when the support matrix contains it.
 */
export function qtiNameFromInformationModelTitle(title: string): string {
  const quoted = title.match(/^"([^"]+)"/u)?.[1];
  const phrase = (quoted ?? title).replace(
    /\s+(?:Class|Characteristic|Attribute|Vocabulary) Description$/u,
    "",
  );
  const alias = titleAliases[phrase];
  if (alias) return alias;
  const normalized = phrase
    .replace(/\s*\([^)]*\)\s*/gu, " ")
    .replaceAll("HotText", "Hottext")
    .replaceAll("Custiom", "Custom")
    .replaceAll("Exprssion", "Expression")
    .replaceAll("Resprocessing", "Processing")
    .replaceAll("Expresson", "Expression")
    .replace(/\s+Expression$/u, "")
    .trim();
  const kebab = normalized
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
  return kebab.startsWith("qti-") ? kebab : `qti-${kebab}`;
}

/** Read QTI 3 information-model section citations and info-model anchors from source text. */
export function collectQtiInformationModelReferences(
  sources: readonly { readonly path: string; readonly text: string }[],
): QtiInformationModelReference[] {
  const references: QtiInformationModelReference[] = [];
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/u);
    for (const line of lines) {
      const citationText = qti3CitationText(line);
      if (citationText) {
        for (const sectionId of sectionIdsIn(citationText)) {
          references.push({ type: "section", path: source.path, sectionId });
        }
      }
      for (const anchor of infoModelAnchors(line)) {
        references.push({ type: "anchor", path: source.path, anchor });
      }
    }
  }
  return references;
}

/** Bind inventory rows to support-matrix evidence and source citations. */
export function reviewQtiInformationModel(input: {
  readonly inventory: readonly QtiInformationModelEntry[];
  readonly evidence: readonly QtiInformationModelEvidence[];
  readonly references: readonly QtiInformationModelReference[];
}): QtiInformationModelReview {
  const evidenceByName = new Map<string, QtiInformationModelEvidence>();
  const duplicateEvidence: string[] = [];
  for (const entry of input.evidence) {
    if (evidenceByName.has(entry.qtiName)) duplicateEvidence.push(entry.qtiName);
    evidenceByName.set(entry.qtiName, entry);
  }

  const ids = new Set(input.inventory.map((entry) => entry.id));
  const anchors = new Map<string, string>();
  for (const entry of input.inventory) {
    if (!anchors.has(entry.anchor)) anchors.set(entry.anchor, entry.id);
  }
  const childBearing = new Set<string>();
  for (const entry of input.inventory) {
    const parent = parentSectionId(entry.id);
    if (parent) childBearing.add(parent);
  }

  const mentions = new Map<string, Set<string>>();
  const unresolved: QtiInformationModelUnresolvedReference[] = [];
  const seenUnresolved = new Set<string>();
  for (const reference of input.references) {
    const sectionId =
      reference.type === "section" ? reference.sectionId : anchors.get(reference.anchor);
    const label = reference.type === "section" ? reference.sectionId : `#${reference.anchor}`;
    if (!sectionId || !ids.has(sectionId)) {
      const key = `${reference.path}\0${label}`;
      if (!seenUnresolved.has(key)) {
        seenUnresolved.add(key);
        unresolved.push({ path: reference.path, reference: label });
      }
      continue;
    }
    const paths = mentions.get(sectionId) ?? new Set<string>();
    paths.add(reference.path);
    mentions.set(sectionId, paths);
  }

  const structuralMatches = new Set<string>();
  for (const entry of input.inventory) {
    if (!elementMatchAllowed(scopeFor(entry.id).scope, entry.kind)) continue;
    const qtiName = elementNameFor(entry, evidenceByName);
    if (qtiName) structuralMatches.add(qtiName);
  }
  const attributeBinding = new Map<string, string>();
  for (const entry of input.inventory) {
    if (entry.kind !== "attribute") continue;
    if (!scopeAllowsElementMatch(scopeFor(entry.id).scope)) continue;
    const quoted = entry.title.match(/^"(qti-[^"]+)"/u)?.[1];
    if (!quoted || !evidenceByName.has(quoted) || structuralMatches.has(quoted)) continue;
    if ([...attributeBinding.values()].includes(quoted)) continue;
    attributeBinding.set(entry.id, quoted);
  }

  const refinedScope = new Map<string, QtiInformationModelScope>();
  const matchedEvidence = new Set<string>();
  const rows: QtiInformationModelReviewRow[] = [];
  for (const entry of input.inventory) {
    const base = scopeFor(entry.id);
    const parentScope = parentScopeFor(entry.id, refinedScope);
    let scope = base.scope;
    if (scope === "catalog" && parentScope && parentScope !== "catalog") scope = parentScope;

    const structuralName = elementMatchAllowed(scope, entry.kind)
      ? elementNameFor(entry, evidenceByName)
      : undefined;
    const qtiName = structuralName ?? attributeBinding.get(entry.id);
    const evidence = qtiName ? evidenceByName.get(qtiName) : undefined;
    if (evidence) {
      matchedEvidence.add(evidence.qtiName);
      if (evidence.category === "test") scope = "test-tooling";
      else if (scope === "catalog") scope = "item";
    }
    refinedScope.set(entry.id, scope);

    rows.push({
      id: entry.id,
      title: entry.title,
      kind: entry.kind,
      anchor: entry.anchor,
      scope,
      claim: claimFor({
        entry,
        scope,
        reason: base.reason,
        evidence,
        mentioned: mentions.get(entry.id),
        hasChildren: childBearing.has(entry.id),
      }),
    });
  }

  const coveredRows = coverKnownBehavior(rows);

  const unmatchedEvidence = input.evidence
    .map((entry) => entry.qtiName)
    .filter((qtiName) => !matchedEvidence.has(qtiName))
    .toSorted();

  return {
    rows: coveredRows,
    duplicateEvidence: duplicateEvidence.toSorted(),
    unmatchedEvidence,
    unresolvedReferences: unresolved.toSorted((left, right) =>
      `${left.path}:${left.reference}`.localeCompare(`${right.path}:${right.reference}`),
    ),
  };
}

/** Counts and the remaining item rules with no element tests and no exercising test. */
export function summarizeQtiInformationModelReview(
  review: QtiInformationModelReview,
): QtiInformationModelReviewSummary {
  const testedClassIds = new Set(
    review.rows
      .filter(
        (row) =>
          row.kind === "class" &&
          (row.claim.type === "element-tested" || row.claim.type === "diagnostic"),
      )
      .map((row) => row.id),
  );
  return {
    rows: review.rows.length,
    elementTested: review.rows.filter((row) => row.claim.type === "element-tested").length,
    diagnostic: review.rows.filter((row) => row.claim.type === "diagnostic").length,
    mentioned: review.rows.filter((row) => row.claim.type === "mentioned").length,
    openBehavior: review.rows
      .filter((row) => row.scope === "item" && row.kind === "behavior" && row.claim.type === "open")
      .map((row) => row.id),
    openTestedClassDetails: review.rows.filter((row) => {
      if (row.claim.type !== "open") return false;
      if (row.kind !== "characteristic" && row.kind !== "attribute") return false;
      const parent = parentSectionId(row.id);
      return parent !== undefined && testedClassIds.has(parent);
    }).length,
    unassigned: review.rows.filter((row) => row.claim.type === "unassigned").length,
    outOfScope: review.rows.filter((row) => row.claim.type === "out-of-scope").length,
    unmatchedEvidence: review.unmatchedEvidence.length + review.duplicateEvidence.length,
    unresolvedReferences: review.unresolvedReferences.length,
  };
}

/** Fail when the inventory or a support-matrix binding is internally inconsistent. */
export function findQtiInformationModelReviewViolations(input: {
  readonly inventory: readonly QtiInformationModelEntry[];
  readonly review: QtiInformationModelReview;
}): string[] {
  const violations: string[] = [];
  const ids = new Set(input.inventory.map((entry) => entry.id));
  if (ids.size !== input.inventory.length) {
    violations.push("Information-model section ids must be unique");
  }
  for (const entry of input.inventory) {
    const parent = parentSectionId(entry.id);
    if (parent && !ids.has(parent)) violations.push(`${entry.id} is missing parent ${parent}`);
  }
  for (const qtiName of input.review.duplicateEvidence) {
    violations.push(`${qtiName} is listed more than once in the support matrix`);
  }
  for (const qtiName of input.review.unmatchedEvidence) {
    violations.push(`${qtiName} is in the support matrix and matches no information-model section`);
  }
  for (const reference of input.review.unresolvedReferences) {
    violations.push(
      `${reference.path} cites unresolved information-model reference ${reference.reference}`,
    );
  }
  for (const row of input.review.rows) {
    if (
      (row.kind === "characteristic" || row.kind === "vocabulary") &&
      (row.claim.type === "element-tested" || row.claim.type === "diagnostic")
    ) {
      violations.push(`${row.id} claims element evidence for a ${row.kind}`);
    }
    const tests = testsFor(row.claim);
    if (tests && tests.length === 0) {
      violations.push(`${row.id} claims ${row.claim.type} without a test path`);
    }
  }
  return violations;
}

export function informationModelReviewRow(
  review: QtiInformationModelReview,
  id: string,
): QtiInformationModelReviewRow | undefined {
  return review.rows.find((row) => row.id === id);
}

function scopeFor(id: string): ScopeRule {
  return (
    scopeRules.find((rule) => id === rule.prefix || id.startsWith(`${rule.prefix}.`)) ?? {
      prefix: id,
      scope: "catalog",
      reason: "No product scope rule matches this section.",
    }
  );
}

function parentSectionId(id: string): string | undefined {
  const dot = id.lastIndexOf(".");
  if (dot === -1) return undefined;
  return id.slice(0, dot);
}

function parentScopeFor(
  id: string,
  refinedScope: ReadonlyMap<string, QtiInformationModelScope>,
): QtiInformationModelScope | undefined {
  const parent = parentSectionId(id);
  if (!parent) return undefined;
  return refinedScope.get(parent);
}

function scopeAllowsElementMatch(scope: QtiInformationModelScope): boolean {
  return scope !== "out-of-scope" && scope !== "reference";
}

function elementMatchAllowed(
  scope: QtiInformationModelScope,
  kind: QtiInformationModelKind,
): boolean {
  return scopeAllowsElementMatch(scope) && (kind === "class" || kind === "behavior");
}

function elementNameFor(
  entry: QtiInformationModelEntry,
  evidenceByName: ReadonlyMap<string, QtiInformationModelEvidence>,
): string | undefined {
  const fromTitle = qtiNameFromInformationModelTitle(entry.title);
  if (evidenceByName.has(fromTitle)) return fromTitle;
  const fromAnchor = anchorElements[entry.anchor];
  if (fromAnchor && evidenceByName.has(fromAnchor)) return fromAnchor;
  return undefined;
}

function claimFor(input: {
  readonly entry: QtiInformationModelEntry;
  readonly scope: QtiInformationModelScope;
  readonly reason: string;
  readonly evidence: QtiInformationModelEvidence | undefined;
  readonly mentioned: ReadonlySet<string> | undefined;
  readonly hasChildren: boolean;
}): QtiInformationModelClaim {
  if (input.scope === "out-of-scope") return { type: "out-of-scope", reason: input.reason };
  if (input.scope === "reference") return { type: "reference", reason: input.reason };
  if (input.evidence?.category === "test") {
    return {
      type: "test-tooling",
      reason: "The support matrix covers a limited test-import and sequencing profile.",
      qtiName: input.evidence.qtiName,
      tests: input.evidence.tests,
    };
  }
  if (
    input.evidence &&
    (input.evidence.support === "deprecated" || input.evidence.support === "unsupported")
  ) {
    return { type: "diagnostic", qtiName: input.evidence.qtiName, tests: input.evidence.tests };
  }
  if (input.evidence && testedSupport.has(input.evidence.support)) {
    return {
      type: "element-tested",
      qtiName: input.evidence.qtiName,
      tests: input.evidence.tests,
    };
  }
  if (input.scope === "test-tooling") {
    return { type: "test-tooling", reason: input.reason, qtiName: undefined, tests: [] };
  }
  if (input.mentioned && input.mentioned.size > 0) {
    return { type: "mentioned", paths: [...input.mentioned].toSorted() };
  }
  if (input.hasChildren && (input.entry.kind === "behavior" || input.entry.kind === "part")) {
    return { type: "heading" };
  }
  if (input.scope === "item") return { type: "open" };
  return { type: "unassigned" };
}

function testsFor(claim: QtiInformationModelClaim): readonly string[] | undefined {
  if (
    claim.type === "element-tested" ||
    claim.type === "diagnostic" ||
    claim.type === "with-element"
  ) {
    return claim.tests;
  }
  if (claim.type === "mentioned") return claim.paths;
  if (claim.type === "test-tooling" && claim.qtiName) return claim.tests;
  return undefined;
}

function coverKnownBehavior(
  rows: readonly QtiInformationModelReviewRow[],
): QtiInformationModelReviewRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const exercise = behaviorEvidence[row.id];
    if (exercise && (row.claim.type === "open" || row.claim.type === "mentioned")) {
      const cited = row.claim.type === "mentioned" ? row.claim.paths : [];
      return {
        ...row,
        claim: { type: "mentioned", paths: [...new Set([...cited, ...exercise])].toSorted() },
      };
    }
    if (row.claim.type !== "open") return row;
    if (row.kind !== "characteristic" && row.kind !== "attribute") return row;
    const ancestor = testedAncestor(row.id, byId);
    if (!ancestor) return row;
    return {
      ...row,
      claim: { type: "with-element", qtiName: ancestor.qtiName, tests: ancestor.tests },
    };
  });
}

function testedAncestor(
  id: string,
  byId: ReadonlyMap<string, QtiInformationModelReviewRow>,
): { readonly qtiName: string; readonly tests: readonly string[] } | undefined {
  let parentId = parentSectionId(id);
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) return undefined;
    if (parent.claim.type === "element-tested" || parent.claim.type === "diagnostic") {
      return parent.claim;
    }
    parentId = parentSectionId(parentId);
  }
  return undefined;
}

function qti3CitationText(line: string): string | undefined {
  if (!/QTI\s+3(?:\.0\.1)?\b/u.test(line)) return undefined;
  const cut = line.split(
    /implementation guide|QTI\s+1\.2\b|QTI\s+2(?:\.\d+)?\b|shared vocabulary/iu,
  )[0];
  if (!cut || !/QTI\s+3(?:\.0\.1)?\b/u.test(cut)) return undefined;
  return cut;
}

function sectionIdsIn(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(/§+\s*([^§\n]+)/gu)) {
    const body = match[1] ?? "";
    for (const token of body.matchAll(/(\d+(?:\.\d+)*)(?:\s*[–-]\s*(\d+))?/gu)) {
      const start = token[1];
      const end = token[2];
      if (!start) continue;
      ids.push(...expandSectionRange(start, end));
    }
  }
  return ids;
}

function expandSectionRange(start: string, end: string | undefined): string[] {
  if (!end) return [start];
  const parts = start.split(".");
  const last = parts.at(-1);
  const prefix = parts.slice(0, -1);
  if (!last || end.length > last.length) return [start];
  const startNumber = Number(last);
  const endNumber = Number(end);
  if (!Number.isInteger(startNumber) || !Number.isInteger(endNumber) || endNumber < startNumber) {
    return [start];
  }
  const ids: string[] = [];
  for (let number = startNumber; number <= endNumber; number += 1) {
    ids.push([...prefix, String(number)].join("."));
  }
  return ids;
}

function infoModelAnchors(line: string): string[] {
  return [...line.matchAll(/spec\/qti\/v3\/info\/[^)\s"]*#([A-Za-z][A-Za-z0-9_.-]*)/gu)].flatMap(
    (match) => {
      const anchor = match[1]?.replace(/[.,:;)]+$/u, "");
      return anchor ? [anchor] : [];
    },
  );
}

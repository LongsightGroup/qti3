import type { Qti12ItemClassification } from "./qti12-classify.js";
import { normalizeIdentifier } from "./text.js";
import { diagnostic } from "./diagnostics.js";
import type { QtiMigrationDiagnostic } from "./types.js";
import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  findDescendantByLocalName,
  localName,
  textOf,
  type XmlElement,
} from "./xml.js";

interface Qti12AnswerKey {
  readonly correct: ReadonlyMap<string, string[]>;
  readonly caseSensitive: ReadonlyMap<string, boolean>;
}
type PreparedQti12Scoring =
  | ({ readonly ok: true } & Qti12AnswerKey)
  | { readonly ok: false; readonly diagnostics: readonly QtiMigrationDiagnostic[] };

/** Accept only the legacy all-or-nothing scoring subset represented by our answer-key mappers. */
export function prepareQti12Scoring(
  item: XmlElement,
  path: string,
  kind: Qti12ItemClassification["kind"],
): PreparedQti12Scoring {
  const processing = findAllDescendantsByLocalName(item, "resprocessing");
  if (!processing.length) return { ok: true, correct: new Map(), caseSensitive: new Map() }; // Missing keys remain subject to the explicit repair policy.
  const block = processing[0];
  if (processing.length !== 1 || !block) return refuseScoring(path);
  const children = childElements(block);
  if (children.some((child) => !["outcomes", "respcondition"].includes(localName(child))))
    return refuseScoring(path);
  const conditions = children.filter((child) => localName(child) === "respcondition");
  if (conditions.length === 0) {
    if (!supportedDefaults(block, 0)) return refuseScoring(path);
    return { ok: true, correct: new Map(), caseSensitive: new Map() };
  }
  if (kind === "essay" || kind === "upload" || kind === "unsupported") return refuseScoring(path);
  const condition = conditions[0];
  if (conditions.length !== 1 || !condition) return refuseScoring(path);
  if (!supportedDefaults(block, 1)) return refuseScoring(path);
  const comparisons = parseCondition(item, condition);
  if (!comparisons) return refuseScoring(path);
  const correct = new Map<string, string[]>();
  const caseSensitive = new Map<string, boolean>();
  for (const comparison of comparisons) {
    correct.set(comparison.identifier, [comparison.value]);
    caseSensitive.set(comparison.identifier, comparison.caseSensitive);
  }
  return { ok: true, correct, caseSensitive };
}

function refuseScoring(path: string): PreparedQti12Scoring {
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "qti12_response_processing_unsupported",
        "error",
        "QTI 1.2 scoring must be a single positive conjunction setting SCORE to 1 with a zero default; other predicates, scores, actions, or continuation programs cannot be preserved.",
        { path, sourceFormat: "qti12" },
      ),
    ],
  };
}

function supportedDefaults(item: XmlElement, maximum: 0 | 1): boolean {
  if (
    findAllDescendantsByLocalName(item, "outcomes").some((entry) =>
      childElements(entry).some((child) => localName(child) !== "decvar"),
    )
  )
    return false;
  return findAllDescendantsByLocalName(item, "decvar").every(
    (entry) =>
      (attr(entry, "varname") ?? "SCORE") === "SCORE" &&
      ["integer", "decimal", "scientific"].includes(
        (attr(entry, "vartype") ?? "Integer").toLowerCase(),
      ) &&
      Number(attr(entry, "defaultval") ?? "0") === 0 &&
      (attr(entry, "minvalue") === null || Number(attr(entry, "minvalue")) <= 0) &&
      (attr(entry, "maxvalue") === null || Number(attr(entry, "maxvalue")) >= maximum),
  );
}

function parseCondition(
  item: XmlElement,
  condition: XmlElement,
): readonly PositiveComparison[] | undefined {
  const children = childElements(condition);
  if (children.some((child) => !["conditionvar", "setvar"].includes(localName(child))))
    return undefined;
  const predicates = children.filter((child) => localName(child) === "conditionvar");
  const actions = children.filter((child) => localName(child) === "setvar");
  const action = actions[0];
  const predicate = predicates[0];
  if (
    predicates.length !== 1 ||
    actions.length !== 1 ||
    !action ||
    !predicate ||
    !["set", "add"].includes((attr(action, "action") ?? "Set").toLowerCase()) ||
    (attr(action, "varname") ?? "SCORE") !== "SCORE" ||
    Number(textOf(action)) !== 1
  )
    return undefined;
  const nodes = parsePositiveConjunction(predicate);
  if (!nodes) return undefined;
  const responses = ["response_lid", "response_str", "response_grp"].flatMap((tag) =>
    findAllDescendantsByLocalName(item, tag),
  );
  const comparisons = nodes.map((node) => parseComparison(node, responses));
  if (comparisons.some((entry) => entry === undefined)) return undefined;
  const parsed = comparisons.filter((entry) => entry !== undefined);
  const identifiers = new Set(parsed.map((entry) => entry.identifier));
  if (identifiers.size !== parsed.length || parsed.length !== responses.length) return undefined;
  return parsed;
}

interface PositiveComparison {
  readonly identifier: string;
  readonly value: string;
  readonly caseSensitive: boolean;
}

function parsePositiveConjunction(node: XmlElement): readonly XmlElement[] | undefined {
  const name = localName(node);
  const children = childElements(node);
  if (name === "varequal") return children.length === 0 ? [node] : undefined;
  if ((name !== "conditionvar" && name !== "and") || children.length === 0) return undefined;
  const terms = children.map(parsePositiveConjunction);
  if (terms.some((term) => term === undefined)) return undefined;
  return terms.flatMap((term) => term ?? []);
}

function parseComparison(
  node: XmlElement,
  responses: readonly XmlElement[],
): PositiveComparison | undefined {
  const identifier = attr(node, "respident");
  if (!identifier || attr(node, "index") !== null) return undefined;
  const response = responses.find((entry) => attr(entry, "ident") === identifier);
  if (!response || (attr(response, "rcardinality") ?? "Single").toLowerCase() !== "single")
    return undefined;
  const fib = findDescendantByLocalName(response, "render_fib");
  if (fib && Number(attr(fib, "rows") ?? "1") > 1) return undefined;
  // QTI 1.2 §5.7.24: varequal comparisons default to case-sensitive.
  const caseValue = (attr(node, "case") ?? "Yes").toLowerCase();
  if (caseValue !== "yes" && caseValue !== "no") return undefined;
  return {
    identifier: normalizeIdentifier(identifier),
    value: node.textContent ?? "",
    caseSensitive: caseValue === "yes",
  };
}

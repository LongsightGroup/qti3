import { prepareQti12Feedback } from "./qti12-feedback.js";
import { qti12MetadataField } from "./qti12-classify.js";
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
  readonly maximumScore?: number | undefined;
  readonly diagnostics?: readonly QtiMigrationDiagnostic[];
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
  let sourceBank = false;
  for (let parent = item.parentNode; parent; parent = parent.parentNode) {
    if (parent.nodeName.split(":").pop()?.toLowerCase() === "objectbank") sourceBank = true;
  }
  const prepared = prepareQti12Feedback(item);
  if (!prepared.ok) return refuseScoring(path);
  const scoring = prepareScoringProgram(prepared.item, path, kind, sourceBank);
  if (!scoring.ok || !prepared.feedback) return scoring;
  return {
    ...scoring,
    diagnostics: [
      ...(scoring.diagnostics ?? []),
      diagnostic(
        "qti12_feedback_review",
        "warning",
        "Question content and scoring are retained. Source feedback remains in the original XML; configure its release and answer-specific explanations explicitly before delivery.",
        { path, sourceFormat: "qti12" },
      ),
    ],
  };
}

function prepareScoringProgram(
  item: XmlElement,
  path: string,
  kind: Qti12ItemClassification["kind"],
  sourceBank: boolean,
): PreparedQti12Scoring {
  const questionType = qti12MetadataField(item, "question_type");
  const canvasChoice =
    kind === "choice" &&
    (questionType === "multiple_choice_question" || questionType === "true_false_question");
  const points = qti12MetadataField(item, "points_possible")?.trim();
  // An unassigned bank question still has an explicit 0..100 percentage program.
  // Retain that source scale for review; the host blocks acceptance until real points are assigned.
  const unassignedBankPoints =
    canvasChoice && sourceBank && (points === undefined || points === "");
  const maximumScore = unassignedBankPoints
    ? 100
    : canvasChoice &&
        points &&
        /^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(points)
      ? Number(points)
      : undefined;
  if (canvasChoice && (maximumScore === undefined || !Number.isFinite(maximumScore)))
    return refuseScoring(path);
  const award = canvasChoice ? 100 : 1;
  const processing = findAllDescendantsByLocalName(item, "resprocessing");
  if (!processing.length)
    return canvasChoice
      ? refuseScoring(path)
      : { ok: true, correct: new Map(), caseSensitive: new Map() }; // Missing keys remain subject to the explicit repair policy.
  const block = processing[0];
  if (processing.length !== 1 || !block) return refuseScoring(path);
  const children = childElements(block);
  if (children.some((child) => !["outcomes", "respcondition"].includes(localName(child))))
    return refuseScoring(path);
  const conditions = children.filter((child) => localName(child) === "respcondition");
  const canvasEssay =
    kind === "essay" &&
    (questionType === "essay_question" ||
      (qti12MetadataField(item, "cc_profile") === "cc.essay.v0p1" &&
        qti12MetadataField(item, "qmd_computerscored")?.toLowerCase() === "no"));
  if (canvasEssay || (kind === "upload" && questionType === "file_upload_question")) {
    const manualPoints = points === undefined ? undefined : Number(points);
    if (
      points !== undefined &&
      (!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(points) ||
        !Number.isFinite(manualPoints))
    )
      return refuseScoring(path);
    if (
      !supportedDefaults(block, 0) ||
      !conditions.every((condition) => {
        const conditionChildren = childElements(condition);
        if (
          conditionChildren.length !== 1 ||
          !conditionChildren[0] ||
          localName(conditionChildren[0]) !== "conditionvar"
        )
          return false;
        const predicates = childElements(conditionChildren[0]);
        const predicate = predicates[0];
        return (
          predicates.length === 1 &&
          predicate !== undefined &&
          localName(predicate) === "other" &&
          childElements(predicate).length === 0 &&
          !textOf(predicate).trim()
        );
      })
    )
      return refuseScoring(path);
    return {
      ok: true,
      correct: new Map(),
      caseSensitive: new Map(),
      maximumScore: manualPoints,
      diagnostics:
        manualPoints === undefined
          ? []
          : [
              diagnostic(
                "qti12_manual_points_review",
                "warning",
                `Manual grading is retained. Source maximum ${manualPoints} points is preserved in scorer guidance; configure the manual point ceiling in delivery.`,
                { path, sourceFormat: "qti12" },
              ),
            ],
    };
  }
  if (conditions.length === 0) {
    if (canvasChoice || !supportedDefaults(block, 0)) return refuseScoring(path);
    return { ok: true, correct: new Map(), caseSensitive: new Map() };
  }
  if (kind === "essay" || kind === "upload" || kind === "unsupported") return refuseScoring(path);
  const condition = conditions[0];
  if (conditions.length !== 1 || !condition) return refuseScoring(path);
  if (!supportedDefaults(block, award)) return refuseScoring(path);
  if (canvasChoice) {
    const declarations = findAllDescendantsByLocalName(block, "decvar");
    const pointFields = findAllDescendantsByLocalName(item, "qtimetadatafield").filter(
      (field) =>
        textOf(findDescendantByLocalName(field, "fieldlabel")).trim() === "points_possible",
    );
    if (
      declarations.length !== 1 ||
      (unassignedBankPoints ? pointFields.length > 1 : pointFields.length !== 1) ||
      Number(attr(declarations[0], "maxvalue")) !== 100
    )
      return refuseScoring(path);
  }
  const comparisons = parseCondition(item, condition, award);
  if (!comparisons) return refuseScoring(path);
  const correct = new Map<string, string[]>();
  const caseSensitive = new Map<string, boolean>();
  for (const comparison of comparisons) {
    correct.set(comparison.identifier, [comparison.value]);
    caseSensitive.set(comparison.identifier, comparison.caseSensitive);
  }
  return {
    ok: true,
    correct,
    caseSensitive,
    maximumScore,
    diagnostics: unassignedBankPoints
      ? [
          diagnostic(
            "qti12_bank_points_unassigned",
            "warning",
            "This Canvas bank question has no assigned points. Its prompt, choices, answer key and original 0–100 percentage scoring scale are retained for review; 100 is not an assigned point ceiling. Assign points in the source bank or assessment and import again before delivery.",
            { path, sourceFormat: "qti12" },
          ),
        ]
      : [],
  };
}

function refuseScoring(path: string): PreparedQti12Scoring {
  return {
    ok: false,
    diagnostics: [
      diagnostic(
        "qti12_response_processing_unsupported",
        "error",
        "QTI 1.2 scoring or point metadata cannot be preserved by the supported conversion. Only explicit all-or-nothing answer programs with a zero default are accepted.",
        { path, sourceFormat: "qti12" },
      ),
    ],
  };
}

function supportedDefaults(item: XmlElement, maximum: number): boolean {
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
  award: number,
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
    Number(textOf(action)) !== award
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

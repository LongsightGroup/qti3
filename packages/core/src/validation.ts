import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiCardinality,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiValidationResult,
} from "./types.js";

export function validateAssessmentItem(document: QtiDocument): QtiValidationResult {
  const diagnostics: QtiDiagnostic[] = [];
  const item = document.item;

  requireIdentifier("qti-assessment-item", item.identifier, diagnostics, item.source);
  validateDeclarationIdentifiers(item, diagnostics);
  validateInteractions(item, diagnostics);
  validateModalFeedback(item, diagnostics);

  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

function requireIdentifier(
  elementName: string,
  identifier: string | undefined,
  diagnostics: QtiDiagnostic[],
  source?: QtiDiagnostic["source"],
): void {
  if (!identifier || identifier.trim().length === 0) {
    diagnostics.push({
      code: "identifier.required",
      severity: "error",
      message: `${elementName} requires a non-empty identifier.`,
      path: source?.path,
      source,
    });
  }
}

function validateDeclarationIdentifiers(
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  const seen = new Set<string>();
  for (const declaration of [
    ...item.responseDeclarations,
    ...item.outcomeDeclarations,
    ...item.templateDeclarations,
  ]) {
    requireIdentifier(
      `${declaration.kind} declaration`,
      declaration.identifier,
      diagnostics,
      declaration.source,
    );
    if (seen.has(declaration.identifier)) {
      diagnostics.push({
        code: "identifier.duplicate",
        severity: "error",
        message: `Duplicate declaration identifier ${declaration.identifier}.`,
        path: declaration.source?.path,
        source: declaration.source,
      });
    }
    seen.add(declaration.identifier);
  }
}

function validateModalFeedback(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  const outcomeIdentifiers = new Set(
    item.outcomeDeclarations.map((declaration) => declaration.identifier),
  );
  const seen = new Set<string>();
  for (const feedback of item.modalFeedback) {
    requireIdentifier("qti-modal-feedback", feedback.identifier, diagnostics, feedback.source);
    const key = `${feedback.outcomeIdentifier}\n${feedback.identifier}`;
    if (seen.has(key)) {
      diagnostics.push({
        code: "feedback.identifier.duplicate",
        severity: "error",
        message: `Duplicate modal feedback ${feedback.identifier} for outcome ${feedback.outcomeIdentifier}.`,
        path: feedback.source?.path,
        source: feedback.source,
      });
    }
    seen.add(key);
    if (!outcomeIdentifiers.has(feedback.outcomeIdentifier)) {
      diagnostics.push({
        code: "feedback.outcomeIdentifier.reference",
        severity: "error",
        message: `qti-modal-feedback ${feedback.identifier} references missing outcome declaration ${feedback.outcomeIdentifier}.`,
        path: feedback.source?.path,
        source: feedback.source,
      });
    }
  }
}

function validateInteractions(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  const responseIdentifiers = new Set(
    item.responseDeclarations.map((declaration) => declaration.identifier),
  );
  for (const interaction of item.interactions) {
    validateInteractionResponseReference(interaction, responseIdentifiers, diagnostics);
    validateInteractionResponseShape(interaction, diagnostics);
    validateInteractionChoices(interaction, diagnostics);
    validateInteractionChildren(interaction, diagnostics);
  }
}

function validateInteractionResponseReference(
  interaction: QtiInteraction,
  responseIdentifiers: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (!interaction.responseIdentifier) {
    if (interaction.type !== "endAttempt" && interaction.type !== "media") {
      diagnostics.push({
        code: "interaction.responseIdentifier",
        severity: "error",
        message: `${interaction.qtiName} is missing response-identifier.`,
        path: interaction.source?.path,
        source: interaction.source,
      });
    }
    return;
  }

  if (!responseIdentifiers.has(interaction.responseIdentifier)) {
    diagnostics.push({
      code: "interaction.responseIdentifier.reference",
      severity: "error",
      message: `${interaction.qtiName} references missing response declaration ${interaction.responseIdentifier}.`,
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
}

function validateInteractionResponseShape(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  const expected = expectedResponseShape(interaction);
  if (!expected) return;

  if (
    interaction.responseCardinality &&
    !expected.cardinalities.includes(interaction.responseCardinality)
  ) {
    diagnostics.push({
      code: "interaction.cardinality",
      severity: "error",
      message: `${interaction.qtiName} expects ${expected.cardinalities.join(" or ")} cardinality, got ${interaction.responseCardinality}.`,
      path: interaction.source?.path,
      source: interaction.source,
    });
  }

  if (interaction.responseBaseType && !expected.baseTypes.includes(interaction.responseBaseType)) {
    diagnostics.push({
      code: "interaction.baseType",
      severity: "error",
      message: `${interaction.qtiName} expects ${expected.baseTypes.join(" or ")} base type, got ${interaction.responseBaseType}.`,
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
}

function validateInteractionChoices(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  const identifiers = new Set<string>();
  for (const choice of interaction.choices) {
    if (identifiers.has(choice.identifier)) {
      diagnostics.push({
        code: "choice.identifier.duplicate",
        severity: "error",
        message: `${interaction.qtiName} has duplicate choice identifier ${choice.identifier}.`,
        path: choice.source?.path ?? interaction.source?.path,
        source: choice.source ?? interaction.source,
      });
    }
    identifiers.add(choice.identifier);
  }

  if (
    needsChoices(interaction) &&
    interaction.choices.filter((choice) => choice.role !== "gap").length === 0
  ) {
    diagnostics.push({
      code: "interaction.choices.required",
      severity: "error",
      message: `${interaction.qtiName} requires at least one choice.`,
      path: interaction.source?.path,
      source: interaction.source,
    });
  }
}

function validateInteractionChildren(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  const allowed = allowedInteractionChildren(interaction);
  if (!allowed) return;

  for (const child of interaction.childElements) {
    if (allowed.has(child.qtiName)) continue;
    diagnostics.push({
      code: "interaction.child.unsupported",
      severity: "error",
      message: `${interaction.qtiName} does not allow ${child.qtiName} as a direct child.`,
      path: child.source?.path ?? interaction.source?.path,
      source: child.source ?? interaction.source,
    });
  }
}

function allowedInteractionChildren(interaction: QtiInteraction): Set<string> | undefined {
  const common = ["qti-prompt"];
  switch (interaction.type) {
    case "choice":
      return setOf(common, ["qti-simple-choice"]);
    case "order":
      return setOf(common, ["qti-simple-choice"]);
    case "associate":
      return setOf(common, ["qti-simple-match-set"]);
    case "match":
      return setOf(common, ["qti-simple-match-set"]);
    case "gapMatch":
      return setOf(common, ["qti-gap-text", "qti-gap-img", ...staticContentNames()]);
    case "inlineChoice":
      return setOf(common, ["qti-inline-choice"]);
    case "hottext":
      return setOf(common, staticContentNames());
    case "graphicOrder":
      return setOf(common, ["object", "qti-hotspot-choice"]);
    case "graphicAssociate":
      return setOf(common, ["object", "qti-associable-hotspot"]);
    case "graphicGapMatch":
      return setOf(common, ["object", "qti-gap-text", "qti-gap-img", ...staticContentNames()]);
    case "hotspot":
      return setOf(common, ["object", "qti-hotspot-choice"]);
    case "selectPoint":
    case "positionObject":
    case "media":
      return setOf(common, ["object"]);
    case "drawing":
    case "extendedText":
    case "portableCustom":
      return new Set(common);
    case "slider":
    case "textEntry":
    case "upload":
    case "endAttempt":
      return new Set(common);
    case "custom":
      return undefined;
  }
}

function staticContentNames(): string[] {
  return ["p", "div", "span", "ul", "ol", "li", "table", "tbody", "thead", "tr", "td", "th"];
}

function setOf(...items: string[][]): Set<string> {
  return new Set(items.flat());
}

function expectedResponseShape(
  interaction: QtiInteraction,
): { cardinalities: QtiCardinality[]; baseTypes: QtiBaseType[] } | undefined {
  if (interaction.type === "endAttempt" || interaction.type === "media") return undefined;
  if (interaction.type === "custom") return undefined;
  if (interaction.type === "order" || interaction.type === "graphicOrder") {
    return { cardinalities: ["ordered"], baseTypes: ["identifier"] };
  }
  if (interaction.type === "associate" || interaction.type === "graphicAssociate") {
    return { cardinalities: ["multiple"], baseTypes: ["pair", "directedPair"] };
  }
  if (
    interaction.type === "match" ||
    interaction.type === "gapMatch" ||
    interaction.type === "graphicGapMatch"
  ) {
    return { cardinalities: ["multiple"], baseTypes: ["directedPair"] };
  }
  if (interaction.type === "selectPoint" || interaction.type === "positionObject") {
    return { cardinalities: ["single", "multiple"], baseTypes: ["point"] };
  }
  if (interaction.type === "slider") {
    return { cardinalities: ["single"], baseTypes: ["integer", "float"] };
  }
  if (interaction.type === "upload") {
    return { cardinalities: ["single"], baseTypes: ["file"] };
  }
  if (interaction.type === "textEntry" || interaction.type === "extendedText") {
    return { cardinalities: ["single"], baseTypes: ["string"] };
  }
  if (interaction.type === "drawing" || interaction.type === "portableCustom") {
    return { cardinalities: ["single"], baseTypes: ["string", "file", "uri"] };
  }
  return { cardinalities: ["single", "multiple"], baseTypes: ["identifier"] };
}

function needsChoices(interaction: QtiInteraction): boolean {
  return (
    interaction.type === "choice" ||
    interaction.type === "order" ||
    interaction.type === "associate" ||
    interaction.type === "match" ||
    interaction.type === "gapMatch" ||
    interaction.type === "inlineChoice" ||
    interaction.type === "hottext" ||
    interaction.type === "graphicOrder" ||
    interaction.type === "graphicAssociate" ||
    interaction.type === "graphicGapMatch" ||
    interaction.type === "hotspot"
  );
}

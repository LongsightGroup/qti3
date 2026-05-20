import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiCardinality,
  QtiChoice,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiOutcomeDeclaration,
  QtiResponseDeclaration,
  QtiTemplateDeclaration,
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
    validateDeclarationRequiredAttributes(declaration, diagnostics);
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

function validateDeclarationRequiredAttributes(
  declaration: QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration,
  diagnostics: QtiDiagnostic[],
): void {
  if (!declaration.attributes.cardinality) {
    diagnostics.push({
      code: "declaration.cardinality.required",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} requires cardinality.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  } else if (!isCardinality(declaration.attributes.cardinality)) {
    diagnostics.push({
      code: "declaration.cardinality",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} has unsupported cardinality ${declaration.attributes.cardinality}.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }

  if (declaration.cardinality === "record") return;

  if (!declaration.attributes["base-type"]) {
    diagnostics.push({
      code: "declaration.baseType.required",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} requires base-type unless cardinality is record.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  } else if (!isBaseType(declaration.attributes["base-type"])) {
    diagnostics.push({
      code: "declaration.baseType",
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier || "(missing identifier)"} has unsupported base-type ${declaration.attributes["base-type"]}.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
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
    validateInteractionRequiredAttributes(interaction, diagnostics);
    validateInteractionLimitAttributes(interaction, diagnostics);
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

  for (const choice of interaction.choices) {
    validateChoiceLimitAttributes(choice, diagnostics);
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

function validateInteractionRequiredAttributes(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  if (requiresObject(interaction) && !interaction.object?.data) {
    diagnostics.push({
      code: "interaction.object.required",
      severity: "error",
      message: `${interaction.qtiName} requires an object child with a data attribute.`,
      path: interaction.source?.path,
      source: interaction.source,
    });
  }

  if (interaction.type === "portableCustom") {
    requireInteractionAttribute(
      interaction,
      "custom-interaction-type-identifier",
      "interaction.portableCustom.typeIdentifier",
      diagnostics,
    );
    requireInteractionAttribute(
      interaction,
      "module",
      "interaction.portableCustom.module",
      diagnostics,
    );
  }

  if (interaction.type === "slider") {
    const lower = interaction.attributes["lower-bound"];
    const upper = interaction.attributes["upper-bound"];
    requireInteractionAttribute(
      interaction,
      "lower-bound",
      "interaction.slider.lowerBound",
      diagnostics,
    );
    requireInteractionAttribute(
      interaction,
      "upper-bound",
      "interaction.slider.upperBound",
      diagnostics,
    );
    if (lower !== undefined && !isFiniteNumber(lower)) {
      invalidNumber(interaction, "lower-bound", lower, diagnostics);
    }
    if (upper !== undefined && !isFiniteNumber(upper)) {
      invalidNumber(interaction, "upper-bound", upper, diagnostics);
    }
    if (
      lower !== undefined &&
      upper !== undefined &&
      isFiniteNumber(lower) &&
      isFiniteNumber(upper)
    ) {
      if (Number(lower) >= Number(upper)) {
        diagnostics.push({
          code: "interaction.slider.bounds",
          severity: "error",
          message: `${interaction.qtiName} requires lower-bound to be less than upper-bound.`,
          path: interaction.source?.path,
          source: interaction.source,
        });
      }
    }
    const step = interaction.attributes.step;
    if (step !== undefined && (!isFiniteNumber(step) || Number(step) <= 0)) {
      invalidNumber(interaction, "step", step, diagnostics);
    }
  }
}

function requiresObject(interaction: QtiInteraction): boolean {
  return (
    interaction.type === "graphicOrder" ||
    interaction.type === "graphicAssociate" ||
    interaction.type === "graphicGapMatch" ||
    interaction.type === "hotspot" ||
    interaction.type === "selectPoint" ||
    interaction.type === "positionObject" ||
    interaction.type === "media"
  );
}

function requireInteractionAttribute(
  interaction: QtiInteraction,
  attribute: string,
  code: string,
  diagnostics: QtiDiagnostic[],
): void {
  if (interaction.attributes[attribute]) return;
  diagnostics.push({
    code,
    severity: "error",
    message: `${interaction.qtiName} requires ${attribute}.`,
    path: interaction.source?.path,
    source: interaction.source,
  });
}

function invalidNumber(
  interaction: QtiInteraction,
  attribute: string,
  value: string,
  diagnostics: QtiDiagnostic[],
): void {
  diagnostics.push({
    code: "interaction.numericAttribute",
    severity: "error",
    message: `${interaction.qtiName} requires numeric ${attribute}, got ${value}.`,
    path: interaction.source?.path,
    source: interaction.source,
  });
}

function validateInteractionLimitAttributes(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  validateNonNegativeIntegerAttribute(interaction, "max-choices", diagnostics);
  validateNonNegativeIntegerAttribute(interaction, "min-choices", diagnostics);
  validateNonNegativeIntegerAttribute(interaction, "max-associations", diagnostics);
  validateNonNegativeIntegerAttribute(interaction, "min-associations", diagnostics);
  validateNonNegativeIntegerAttribute(interaction, "expected-length", diagnostics);
  validateNonNegativeIntegerAttribute(interaction, "expected-lines", diagnostics);

  validateMinMaxPair(interaction, "min-choices", "max-choices", diagnostics);
  validateMinMaxPair(interaction, "min-associations", "max-associations", diagnostics);
}

function validateChoiceLimitAttributes(choice: QtiChoice, diagnostics: QtiDiagnostic[]): void {
  if (requiresMatchMax(choice) && !choice.attributes["match-max"]) {
    diagnostics.push({
      code: "choice.matchMax.required",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} requires match-max.`,
      path: choice.source?.path,
      source: choice.source,
    });
  }

  validateChoiceNonNegativeIntegerAttribute(choice, "match-max", diagnostics);
  validateChoiceNonNegativeIntegerAttribute(choice, "match-min", diagnostics);
}

function requiresMatchMax(choice: QtiChoice): boolean {
  return (
    choice.qtiName === "qti-simple-associable-choice" ||
    choice.qtiName === "qti-associable-hotspot" ||
    choice.qtiName === "qti-gap-text" ||
    choice.qtiName === "qti-gap-img"
  );
}

function validateNonNegativeIntegerAttribute(
  interaction: QtiInteraction,
  attribute: string,
  diagnostics: QtiDiagnostic[],
): void {
  const value = interaction.attributes[attribute];
  if (value === undefined || isNonNegativeInteger(value)) return;
  diagnostics.push({
    code: "interaction.integerAttribute",
    severity: "error",
    message: `${interaction.qtiName} requires non-negative integer ${attribute}, got ${value}.`,
    path: interaction.source?.path,
    source: interaction.source,
  });
}

function validateChoiceNonNegativeIntegerAttribute(
  choice: QtiChoice,
  attribute: string,
  diagnostics: QtiDiagnostic[],
): void {
  const value = choice.attributes[attribute];
  if (value === undefined || isNonNegativeInteger(value)) return;
  diagnostics.push({
    code: "choice.integerAttribute",
    severity: "error",
    message: `${choice.qtiName} ${choice.identifier} requires non-negative integer ${attribute}, got ${value}.`,
    path: choice.source?.path,
    source: choice.source,
  });
}

function validateMinMaxPair(
  interaction: QtiInteraction,
  minAttribute: string,
  maxAttribute: string,
  diagnostics: QtiDiagnostic[],
): void {
  const min = interaction.attributes[minAttribute];
  const max = interaction.attributes[maxAttribute];
  if (
    min === undefined ||
    max === undefined ||
    !isNonNegativeInteger(min) ||
    !isNonNegativeInteger(max) ||
    max === "0"
  ) {
    return;
  }
  if (Number(min) <= Number(max)) return;
  diagnostics.push({
    code: "interaction.minMax",
    severity: "error",
    message: `${interaction.qtiName} requires ${minAttribute} to be less than or equal to ${maxAttribute}, unless ${maxAttribute} is 0 for unlimited.`,
    path: interaction.source?.path,
    source: interaction.source,
  });
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

function isCardinality(value: string): value is QtiCardinality {
  return value === "single" || value === "multiple" || value === "ordered" || value === "record";
}

function isBaseType(value: string): value is QtiBaseType {
  return (
    value === "identifier" ||
    value === "boolean" ||
    value === "integer" ||
    value === "float" ||
    value === "string" ||
    value === "point" ||
    value === "pair" ||
    value === "directedPair" ||
    value === "duration" ||
    value === "file" ||
    value === "uri"
  );
}

function isFiniteNumber(value: string): boolean {
  return Number.isFinite(Number(value));
}

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value);
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

import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiCatalogCard,
  QtiCatalogCardEntry,
  QtiCardinality,
  QtiChoice,
  QtiContentNode,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiOutcomeDeclaration,
  QtiProcessingExpression,
  QtiResponseCondition,
  QtiResponseDeclaration,
  QtiResponseRule,
  QtiSetOutcomeValue,
  QtiTemplateDeclaration,
  QtiTemplateRule,
  QtiValue,
  QtiValidationResult,
} from "./types.js";

const BUILT_IN_COMPLETION_STATUS = "completionStatus";

export function validateAssessmentItem(document: QtiDocument): QtiValidationResult {
  const diagnostics: QtiDiagnostic[] = [];
  const item = document.item;

  requireIdentifier("qti-assessment-item", item.identifier, diagnostics, item.source);
  validateDeclarationIdentifiers(item, diagnostics);
  validateOutcomeLookupTables(item, diagnostics);
  validateInteractions(item, diagnostics);
  validateModalFeedback(item, diagnostics);
  validateCatalogInfo(item, diagnostics);
  validateStylesheets(item, diagnostics);
  validateProcessingReferences(item, diagnostics);

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
    validateDeclarationValueMetadata(declaration, diagnostics);
    if (declaration.kind === "outcome" && declaration.identifier === BUILT_IN_COMPLETION_STATUS) {
      diagnostics.push({
        code: "declaration.outcome.builtIn",
        severity: "error",
        message:
          "completionStatus is a built-in QTI outcome variable and must not be declared explicitly.",
        path: declaration.source?.path,
        source: declaration.source,
      });
    }
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

function validateDeclarationValueMetadata(
  declaration: QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration,
  diagnostics: QtiDiagnostic[],
): void {
  validateDeclarationValue(declaration, declaration.defaultValue, "defaultValue", diagnostics);
  if (declaration.kind === "response") {
    validateDeclarationValue(
      declaration,
      declaration.correctResponse,
      "correctResponse",
      diagnostics,
    );
  }
  if (declaration.kind !== "response") return;
  validateMapping(declaration, diagnostics);
  validateAreaMapping(declaration, diagnostics);
}

function validateDeclarationValue(
  declaration: QtiResponseDeclaration | QtiOutcomeDeclaration | QtiTemplateDeclaration,
  value: QtiValue,
  role: "defaultValue" | "correctResponse",
  diagnostics: QtiDiagnostic[],
): void {
  if (value === null || declaration.cardinality === "record" || !declaration.baseType) return;
  if (!isBaseType(declaration.baseType)) return;

  if (declaration.cardinality === "single" && Array.isArray(value)) {
    const severity =
      declaration.kind === "response" &&
      role === "correctResponse" &&
      declaration.baseType === "string"
        ? "warning"
        : "error";
    diagnostics.push({
      code: `declaration.${role}.cardinality`,
      severity,
      message: `${declaration.kind} declaration ${declaration.identifier} ${role} must contain one value for single cardinality.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
    return;
  }

  for (const entry of declarationValueEntries(value)) {
    if (isValidDeclarationBaseValue(entry, declaration.baseType)) continue;
    diagnostics.push({
      code: `declaration.${role}.baseType`,
      severity: "error",
      message: `${declaration.kind} declaration ${declaration.identifier} ${role} value ${entry} is not valid for base-type ${declaration.baseType}.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }
}

function declarationValueEntries(value: QtiValue): string[] {
  if (value === null) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "object") return Object.values(value).flatMap(declarationValueEntries);
  return [String(value)];
}

function isValidDeclarationBaseValue(value: string, baseType: QtiBaseType): boolean {
  switch (baseType) {
    case "integer":
      return isInteger(value);
    case "float":
      return isFiniteNumber(value);
    case "boolean":
      return value === "true" || value === "false";
    case "point":
      return isPoint(value);
    case "pair":
    case "directedPair":
      return isPair(value);
    case "identifier":
      return value.trim().length > 0 && !/\s/.test(value);
    case "string":
    case "duration":
    case "file":
    case "uri":
      return true;
  }
}

function validateMapping(declaration: QtiResponseDeclaration, diagnostics: QtiDiagnostic[]): void {
  const mapping = declaration.mapping;
  if (!mapping) return;
  if (!Number.isFinite(mapping.defaultValue)) {
    diagnostics.push({
      code: "mapping.defaultValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} mapping requires numeric default-value.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }
  validateMappingBounds(declaration, mapping.attributes, mapping.source, "mapping", diagnostics);

  for (const entry of mapping.entries) {
    validateMapEntry(declaration, entry, diagnostics);
  }
}

function validateMapEntry(
  declaration: QtiResponseDeclaration,
  entry: NonNullable<QtiResponseDeclaration["mapping"]>["entries"][number],
  diagnostics: QtiDiagnostic[],
): void {
  if (!entry.attributes["map-key"]) {
    diagnostics.push({
      code: "mapEntry.mapKey.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} map entry requires map-key.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  const mappedValue = entry.attributes["mapped-value"];
  if (mappedValue === undefined) {
    diagnostics.push({
      code: "mapEntry.mappedValue.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} map entry requires mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isFiniteNumber(mappedValue)) {
    diagnostics.push({
      code: "mapEntry.mappedValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} map entry requires numeric mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }
}

function validateAreaMapping(
  declaration: QtiResponseDeclaration,
  diagnostics: QtiDiagnostic[],
): void {
  const areaMapping = declaration.areaMapping;
  if (!areaMapping) return;
  if (!Number.isFinite(areaMapping.defaultValue)) {
    diagnostics.push({
      code: "areaMapping.defaultValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area mapping requires numeric default-value.`,
      path: declaration.source?.path,
      source: declaration.source,
    });
  }
  validateMappingBounds(
    declaration,
    areaMapping.attributes,
    areaMapping.source,
    "areaMapping",
    diagnostics,
  );

  for (const entry of areaMapping.entries) {
    validateAreaMapEntry(declaration, entry, diagnostics);
  }
}

function validateMappingBounds(
  declaration: QtiResponseDeclaration,
  attributes: Record<string, string>,
  source: QtiDiagnostic["source"],
  codePrefix: "mapping" | "areaMapping",
  diagnostics: QtiDiagnostic[],
): void {
  const lower = attributes["lower-bound"];
  const upper = attributes["upper-bound"];
  if (lower !== undefined && !isFiniteNumber(lower)) {
    diagnostics.push({
      code: `${codePrefix}.lowerBound`,
      severity: "error",
      message: `Response declaration ${declaration.identifier} ${codePrefix} requires numeric lower-bound.`,
      path: source?.path ?? declaration.source?.path,
      source: source ?? declaration.source,
    });
  }
  if (upper !== undefined && !isFiniteNumber(upper)) {
    diagnostics.push({
      code: `${codePrefix}.upperBound`,
      severity: "error",
      message: `Response declaration ${declaration.identifier} ${codePrefix} requires numeric upper-bound.`,
      path: source?.path ?? declaration.source?.path,
      source: source ?? declaration.source,
    });
  }
  if (
    lower !== undefined &&
    upper !== undefined &&
    isFiniteNumber(lower) &&
    isFiniteNumber(upper) &&
    Number(lower) > Number(upper)
  ) {
    diagnostics.push({
      code: `${codePrefix}.bounds`,
      severity: "error",
      message: `Response declaration ${declaration.identifier} ${codePrefix} requires lower-bound to be less than or equal to upper-bound.`,
      path: source?.path ?? declaration.source?.path,
      source: source ?? declaration.source,
    });
  }
}

function validateAreaMapEntry(
  declaration: QtiResponseDeclaration,
  entry: NonNullable<QtiResponseDeclaration["areaMapping"]>["entries"][number],
  diagnostics: QtiDiagnostic[],
): void {
  const shape = entry.attributes.shape;
  const coords = entry.attributes.coords;
  const mappedValue = entry.attributes["mapped-value"];

  if (!shape) {
    diagnostics.push({
      code: "areaMapEntry.shape.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires shape.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isAreaShape(shape)) {
    diagnostics.push({
      code: "areaMapEntry.shape",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry has unsupported shape ${shape}.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  if (!coords) {
    diagnostics.push({
      code: "areaMapEntry.coords.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires coords.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isNumericCsv(coords)) {
    diagnostics.push({
      code: "areaMapEntry.coords",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires comma-separated numeric coords.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (
    shape &&
    isAreaShape(shape) &&
    !hasValidShapeCoordinateCount(shape, numericCsv(coords))
  ) {
    diagnostics.push({
      code: "areaMapEntry.coords.shape",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry shape ${shape} has invalid coords arity.`,
      path: entry.source?.path,
      source: entry.source,
    });
  }

  if (mappedValue === undefined) {
    diagnostics.push({
      code: "areaMapEntry.mappedValue.required",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
  } else if (!isFiniteNumber(mappedValue)) {
    diagnostics.push({
      code: "areaMapEntry.mappedValue",
      severity: "error",
      message: `Response declaration ${declaration.identifier} area map entry requires numeric mapped-value.`,
      path: entry.source?.path,
      source: entry.source,
    });
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

function validateOutcomeLookupTables(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  for (const outcome of item.outcomeDeclarations) {
    const lookupTable = outcome.lookupTable;
    if (!lookupTable) continue;
    if (outcome.cardinality !== "single") {
      diagnostics.push({
        code: "lookupTable.outcome.cardinality",
        severity: "error",
        message: `Outcome declaration ${outcome.identifier} lookup table requires single cardinality.`,
        path: lookupTable.source?.path,
        source: lookupTable.source,
      });
    }
    if (lookupTable.entries.length === 0) {
      diagnostics.push({
        code: "lookupTable.entries.required",
        severity: "error",
        message: `${lookupTable.type} lookup table requires at least one entry.`,
        path: lookupTable.source?.path,
        source: lookupTable.source,
      });
    }
    for (const entry of lookupTable.entries) {
      if (!isFiniteNumber(entry.attributes["source-value"] ?? "")) {
        diagnostics.push({
          code: "lookupTable.entry.sourceValue",
          severity: "error",
          message: "Lookup table entry requires numeric source-value.",
          path: entry.source?.path,
          source: entry.source,
        });
      }
      if (entry.attributes["target-value"] === undefined) {
        diagnostics.push({
          code: "lookupTable.entry.targetValue",
          severity: "error",
          message: "Lookup table entry requires target-value.",
          path: entry.source?.path,
          source: entry.source,
        });
      }
      if (
        lookupTable.type === "match" &&
        entry.attributes["source-value"] !== undefined &&
        !isInteger(entry.attributes["source-value"])
      ) {
        diagnostics.push({
          code: "lookupTable.match.sourceValue",
          severity: "error",
          message: "qti-match-table-entry source-value must be an integer.",
          path: entry.source?.path,
          source: entry.source,
        });
      }
    }
  }
}

function validateStylesheets(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  for (const stylesheet of item.stylesheets) {
    if (stylesheet.href.trim().length > 0) continue;
    diagnostics.push({
      code: "stylesheet.href.required",
      severity: "error",
      message: "qti-stylesheet requires a non-empty href attribute.",
      path: stylesheet.source?.path,
      source: stylesheet.source,
    });
  }
}

function validateCatalogInfo(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  const catalogInfo = item.catalogInfo;
  if (!catalogInfo) {
    for (const reference of item.catalogReferences) {
      diagnostics.push({
        code: "catalog.idref.reference",
        severity: "error",
        message: `data-catalog-idref references missing qti-catalog id ${reference.idref}.`,
        path: reference.source?.path,
        source: reference.source,
      });
    }
    return;
  }

  const catalogIds = new Set<string>();
  for (const catalog of catalogInfo.catalogs) {
    requireIdentifier("qti-catalog", catalog.id, diagnostics, catalog.source);
    if (catalog.id && catalogIds.has(catalog.id)) {
      diagnostics.push({
        code: "catalog.id.duplicate",
        severity: "error",
        message: `Duplicate qti-catalog id ${catalog.id}.`,
        path: catalog.source?.path,
        source: catalog.source,
      });
    }
    catalogIds.add(catalog.id);

    if (catalog.cards.length === 0) {
      diagnostics.push({
        code: "catalog.card.required",
        severity: "error",
        message: `qti-catalog ${catalog.id || "(missing id)"} requires at least one qti-card.`,
        path: catalog.source?.path,
        source: catalog.source,
      });
    }

    const supports = new Set<string>();
    for (const card of catalog.cards) {
      validateCatalogCard(card, diagnostics);
      if (card.support && supports.has(card.support)) {
        diagnostics.push({
          code: "catalog.card.support.duplicate",
          severity: "error",
          message: `qti-catalog ${catalog.id || "(missing id)"} contains duplicate card support ${card.support}.`,
          path: card.source?.path,
          source: card.source,
        });
      }
      supports.add(card.support);
    }
  }

  for (const reference of item.catalogReferences) {
    if (catalogIds.has(reference.idref)) continue;
    diagnostics.push({
      code: "catalog.idref.reference",
      severity: "error",
      message: `data-catalog-idref references missing qti-catalog id ${reference.idref}.`,
      path: reference.source?.path,
      source: reference.source,
    });
  }
}

function validateCatalogCard(
  card: QtiCatalogCard | QtiCatalogCardEntry,
  diagnostics: QtiDiagnostic[],
): void {
  if ("support" in card && !card.support) {
    diagnostics.push({
      code: "catalog.card.support.required",
      severity: "error",
      message: "qti-card requires a non-empty support attribute.",
      path: card.source?.path,
      source: card.source,
    });
  }

  const entries = "entries" in card ? card.entries : [];
  const hasContent = Boolean(card.htmlContent) || card.fileHrefs.length > 0 || entries.length > 0;
  if (!hasContent) {
    diagnostics.push({
      code: "catalog.card.content.required",
      severity: "error",
      message: "qti-card or qti-card-entry requires qti-html-content or qti-file-href content.",
      path: card.source?.path,
      source: card.source,
    });
  }

  if (card.htmlContent) {
    validateCatalogHtmlContent(card.htmlContent.children, diagnostics);
  }
  for (const fileHref of card.fileHrefs) {
    if (fileHref.href.length > 0) continue;
    diagnostics.push({
      code: "catalog.fileHref.required",
      severity: "error",
      message: "qti-file-href requires a non-empty file reference.",
      path: fileHref.source?.path,
      source: fileHref.source,
    });
  }
  for (const entry of entries) {
    validateCatalogCard(entry, diagnostics);
  }
}

function validateCatalogHtmlContent(nodes: QtiContentNode[], diagnostics: QtiDiagnostic[]): void {
  for (const node of nodes) {
    if (node.kind === "element") {
      if (node.qtiName.startsWith("qti-")) {
        diagnostics.push({
          code: "catalog.htmlContent.qtiElement",
          severity: "error",
          message: "qti-html-content must not contain QTI-specific elements.",
          path: node.source?.path,
          source: node.source,
        });
      }
      validateCatalogHtmlContent(node.children, diagnostics);
    }
  }
}

function validateProcessingReferences(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  const responses = new Set(item.responseDeclarations.map((declaration) => declaration.identifier));
  const outcomes = new Set(item.outcomeDeclarations.map((declaration) => declaration.identifier));
  outcomes.add(BUILT_IN_COMPLETION_STATUS);
  const templates = new Set(item.templateDeclarations.map((declaration) => declaration.identifier));
  const variables = new Set([...responses, ...outcomes, ...templates]);

  for (const rule of item.templateProcessing?.rules ?? []) {
    validateTemplateRule(rule, responses, outcomes, templates, variables, diagnostics);
  }

  for (const rule of item.responseProcessing?.rules ?? []) {
    validateResponseRule(rule, outcomes, responses, variables, diagnostics);
  }
}

function validateResponseCondition(
  condition: QtiResponseCondition,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  validateExpressionReferences(condition.ifExpression, responses, variables, diagnostics);
  for (const rule of condition.thenRules) {
    validateResponseRule(rule, outcomes, responses, variables, diagnostics);
  }
  for (const branch of condition.elseIfs) {
    validateExpressionReferences(branch.expression, responses, variables, diagnostics);
    for (const rule of branch.rules) {
      validateResponseRule(rule, outcomes, responses, variables, diagnostics);
    }
  }
  for (const rule of condition.elseRules) {
    validateResponseRule(rule, outcomes, responses, variables, diagnostics);
  }
}

function validateTemplateRule(
  rule: QtiTemplateRule,
  responses: Set<string>,
  outcomes: Set<string>,
  templates: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (rule.type === "exitTemplate") return;
  if (rule.type === "templateConstraint") {
    validateExpressionReferences(rule.expression, responses, variables, diagnostics);
    return;
  }

  if (rule.type === "templateCondition") {
    validateExpressionReferences(rule.ifExpression, responses, variables, diagnostics);
    for (const branchRule of rule.thenRules) {
      validateTemplateRule(branchRule, responses, outcomes, templates, variables, diagnostics);
    }
    for (const branch of rule.elseIfs) {
      validateExpressionReferences(branch.expression, responses, variables, diagnostics);
      for (const branchRule of branch.rules) {
        validateTemplateRule(branchRule, responses, outcomes, templates, variables, diagnostics);
      }
    }
    for (const branchRule of rule.elseRules) {
      validateTemplateRule(branchRule, responses, outcomes, templates, variables, diagnostics);
    }
    return;
  }

  if (rule.type === "setTemplateValue") {
    validateProcessingIdentifier(
      rule.identifier,
      "processing.templateTarget",
      rule.source,
      diagnostics,
    );
    if (rule.identifier && !templates.has(rule.identifier)) {
      diagnostics.push({
        code: "processing.templateTarget.reference",
        severity: "error",
        message: `qti-set-template-value references missing template declaration ${rule.identifier}.`,
        path: rule.source?.path,
        source: rule.source,
      });
    }
  }

  if (rule.type === "setDefaultValue") {
    validateProcessingIdentifier(
      rule.identifier,
      "processing.defaultTarget",
      rule.source,
      diagnostics,
    );
    if (rule.identifier && !responses.has(rule.identifier) && !outcomes.has(rule.identifier)) {
      diagnostics.push({
        code: "processing.defaultTarget.reference",
        severity: "error",
        message: `qti-set-default-value references missing response or outcome declaration ${rule.identifier}.`,
        path: rule.source?.path,
        source: rule.source,
      });
    }
  }

  if (rule.type === "setCorrectResponse") {
    validateProcessingIdentifier(
      rule.identifier,
      "processing.correctResponse",
      rule.source,
      diagnostics,
    );
    if (rule.identifier && !responses.has(rule.identifier)) {
      diagnostics.push({
        code: "processing.correctResponse.reference",
        severity: "error",
        message: `qti-set-correct-response references missing response declaration ${rule.identifier}.`,
        path: rule.source?.path,
        source: rule.source,
      });
    }
  }

  validateExpressionReferences(rule.expression, responses, variables, diagnostics);
}

function validateResponseRule(
  rule: QtiResponseRule,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (rule.type === "exitResponse") return;
  if (rule.type === "responseCondition") {
    validateResponseCondition(rule.condition, outcomes, responses, variables, diagnostics);
    return;
  }
  if (rule.type === "responseProcessingFragment") {
    for (const childRule of rule.rules) {
      validateResponseRule(childRule, outcomes, responses, variables, diagnostics);
    }
    return;
  }
  if (rule.type === "lookupOutcomeValue") {
    validateLookupOutcomeRule(rule, outcomes, responses, variables, diagnostics);
    return;
  }
  validateSetOutcomeRule(rule, outcomes, responses, variables, diagnostics);
}

function validateLookupOutcomeRule(
  rule: Extract<QtiResponseRule, { type: "lookupOutcomeValue" }>,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  validateProcessingIdentifier(
    rule.identifier,
    "processing.lookupOutcomeTarget",
    rule.source,
    diagnostics,
  );
  if (rule.identifier && !outcomes.has(rule.identifier)) {
    diagnostics.push({
      code: "processing.lookupOutcomeTarget.reference",
      severity: "error",
      message: `qti-lookup-outcome-value references missing outcome declaration ${rule.identifier}.`,
      path: rule.source?.path,
      source: rule.source,
    });
  }
  validateExpressionReferences(rule.expression, responses, variables, diagnostics);
}

function validateSetOutcomeRule(
  rule: QtiSetOutcomeValue,
  outcomes: Set<string>,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  validateProcessingIdentifier(
    rule.identifier,
    "processing.outcomeTarget",
    rule.source,
    diagnostics,
  );
  if (rule.identifier && !outcomes.has(rule.identifier)) {
    diagnostics.push({
      code: "processing.outcomeTarget.reference",
      severity: "error",
      message: `qti-set-outcome-value references missing outcome declaration ${rule.identifier}.`,
      path: rule.source?.path,
      source: rule.source,
    });
  }
  validateExpressionReferences(rule.expression, responses, variables, diagnostics);
}

function validateExpressionReferences(
  expression: QtiProcessingExpression | undefined,
  responses: Set<string>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (!expression) return;

  if (expression.type === "variable" || expression.type === "isNull") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.variable",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !variables.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.variable.reference",
        severity: "error",
        message: `Processing expression references missing variable ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "matchCorrect") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.response",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !responses.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.response.reference",
        severity: "error",
        message: `Processing expression references missing response declaration ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
    validateProcessingIdentifier(
      expression.correctIdentifier,
      "processing.correct",
      expression.source,
      diagnostics,
    );
    if (expression.correctIdentifier && !responses.has(expression.correctIdentifier)) {
      diagnostics.push({
        code: "processing.correct.reference",
        severity: "error",
        message: `Processing expression references missing correct response declaration ${expression.correctIdentifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "mapResponse" || expression.type === "mapResponsePoint") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.response",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !responses.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.response.reference",
        severity: "error",
        message: `Processing expression references missing response declaration ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "correct") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.correct",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !responses.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.correct.reference",
        severity: "error",
        message: `Processing expression references missing correct response declaration ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "default") {
    validateProcessingIdentifier(
      expression.identifier,
      "processing.variable",
      expression.source,
      diagnostics,
    );
    if (expression.identifier && !variables.has(expression.identifier)) {
      diagnostics.push({
        code: "processing.variable.reference",
        severity: "error",
        message: `Processing expression references missing variable ${expression.identifier}.`,
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  if (expression.type === "randomInteger") {
    validateRandomIntegerExpression(expression, diagnostics);
  }

  if (expression.type === "randomFloat") {
    validateRandomFloatExpression(expression, diagnostics);
  }

  if (expression.type === "baseValue") {
    validateBaseValueExpression(expression, diagnostics);
  }

  if (expression.type === "equalRounded") {
    validateRounding(
      "qti-equal-rounded",
      expression.roundingMode,
      expression.figures,
      diagnostics,
      expression.source,
    );
  }

  if (expression.type === "mathConstant" && !mathConstantNames.has(expression.name)) {
    diagnostics.push({
      code: "processing.mathConstant.name",
      severity: "error",
      message: `qti-math-constant has unsupported name ${expression.name}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (expression.type === "mathOperator" && !mathOperatorNames.has(expression.name)) {
    diagnostics.push({
      code: "processing.mathOperator.name",
      severity: "error",
      message: `qti-math-operator has unsupported name ${expression.name}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (expression.type === "statsOperator" && !statsOperatorNames.has(expression.name)) {
    diagnostics.push({
      code: "processing.statsOperator.name",
      severity: "error",
      message: `qti-stats-operator has unsupported name ${expression.name}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  if (expression.type === "repeat") {
    validateRepeatExpression(expression, variables, diagnostics);
  }

  if (expression.type === "inside") {
    validateInsideExpression(expression, diagnostics);
  }

  if (expression.type === "fieldValue") {
    validateProcessingIdentifier(
      expression.fieldIdentifier,
      "processing.fieldValue.fieldIdentifier",
      expression.source,
      diagnostics,
    );
  }

  for (const child of expressionChildren(expression)) {
    validateExpressionReferences(child, responses, variables, diagnostics);
  }
}

const mathConstantNames = new Set(["pi", "e"]);
const mathOperatorNames = new Set([
  "abs",
  "acos",
  "acot",
  "acsc",
  "asec",
  "asin",
  "atan",
  "atan2",
  "ceil",
  "cos",
  "cosh",
  "cot",
  "coth",
  "csc",
  "csch",
  "exp",
  "floor",
  "ln",
  "log",
  "sec",
  "sech",
  "signum",
  "sin",
  "sinh",
  "tan",
  "tanh",
  "toDegrees",
  "toRadians",
]);
const statsOperatorNames = new Set(["mean", "sampleVariance", "sampleSD", "popVariance", "popSD"]);

function validateRounding(
  qtiName: string,
  roundingMode: string,
  figures: number,
  diagnostics: QtiDiagnostic[],
  source: QtiDiagnostic["source"],
): void {
  if (roundingMode !== "decimalPlaces" && roundingMode !== "significantFigures") {
    diagnostics.push({
      code: "processing.roundingMode",
      severity: "error",
      message: `${qtiName} requires rounding-mode decimalPlaces or significantFigures.`,
      path: source?.path,
      source,
    });
  }
  const validFigures =
    Number.isInteger(figures) && (roundingMode === "decimalPlaces" ? figures >= 0 : figures > 0);
  if (!validFigures) {
    diagnostics.push({
      code: "processing.roundingFigures",
      severity: "error",
      message: `${qtiName} requires valid figures for its rounding mode.`,
      path: source?.path,
      source,
    });
  }
}

function validateRepeatExpression(
  expression: Extract<QtiProcessingExpression, { type: "repeat" }>,
  variables: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (isInteger(expression.numberRepeats)) return;
  validateProcessingIdentifier(
    expression.numberRepeats,
    "processing.repeat.numberRepeats",
    expression.source,
    diagnostics,
  );
  if (expression.numberRepeats && !variables.has(expression.numberRepeats)) {
    diagnostics.push({
      code: "processing.repeat.numberRepeats.reference",
      severity: "error",
      message: `qti-repeat references missing template or outcome variable ${expression.numberRepeats}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateInsideExpression(
  expression: Extract<QtiProcessingExpression, { type: "inside" }>,
  diagnostics: QtiDiagnostic[],
): void {
  const rawShape = expression.attributes.shape;
  if (rawShape === undefined) {
    diagnostics.push({
      code: "processing.inside.shape.required",
      severity: "error",
      message: "qti-inside requires shape.",
      path: expression.source?.path,
      source: expression.source,
    });
  } else if (
    rawShape !== "circle" &&
    rawShape !== "rect" &&
    rawShape !== "poly" &&
    rawShape !== "default"
  ) {
    diagnostics.push({
      code: "processing.inside.shape",
      severity: "error",
      message: `qti-inside has unsupported shape ${rawShape}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }

  const expectedCoordCount =
    rawShape === "circle" ? 3 : rawShape === "rect" ? 4 : rawShape === "default" ? 0 : undefined;
  if (expectedCoordCount !== undefined && expression.coords.length !== expectedCoordCount) {
    diagnostics.push({
      code: "processing.inside.coords",
      severity: "error",
      message: `qti-inside shape ${rawShape} requires ${expectedCoordCount} coordinates.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
  if (rawShape === "poly" && (expression.coords.length < 6 || expression.coords.length % 2 !== 0)) {
    diagnostics.push({
      code: "processing.inside.coords",
      severity: "error",
      message: "qti-inside poly requires an even number of at least 6 coordinates.",
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateBaseValueExpression(
  expression: Extract<QtiProcessingExpression, { type: "baseValue" }>,
  diagnostics: QtiDiagnostic[],
): void {
  if (!expression.baseType) {
    diagnostics.push({
      code: "processing.baseValue.baseType.required",
      severity: "error",
      message: "qti-base-value requires base-type.",
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  if (!isBaseType(expression.baseType)) {
    diagnostics.push({
      code: "processing.baseValue.baseType",
      severity: "error",
      message: `qti-base-value has unsupported base-type ${expression.baseType}.`,
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  const value = expression.rawValue ?? "";
  if (
    (expression.baseType === "integer" && !isInteger(value)) ||
    (expression.baseType === "float" && !isFiniteNumber(value))
  ) {
    diagnostics.push({
      code: "processing.baseValue.numeric",
      severity: "error",
      message: `qti-base-value requires ${expression.baseType} content, got ${value}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
  if (expression.baseType === "boolean" && value !== "true" && value !== "false") {
    diagnostics.push({
      code: "processing.baseValue.boolean",
      severity: "error",
      message: `qti-base-value requires boolean content, got ${value}.`,
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateRandomIntegerExpression(
  expression: Extract<QtiProcessingExpression, { type: "randomInteger" }>,
  diagnostics: QtiDiagnostic[],
): void {
  validateRandomIntegerAttribute(expression, "min", diagnostics);
  validateRandomIntegerAttribute(expression, "max", diagnostics);

  if (expression.attributes.step !== undefined) {
    validateRandomIntegerAttribute(expression, "step", diagnostics);
    if (isInteger(expression.attributes.step) && Number(expression.attributes.step) <= 0) {
      diagnostics.push({
        code: "processing.randomInteger.step",
        severity: "error",
        message: "qti-random-integer requires step to be greater than 0.",
        path: expression.source?.path,
        source: expression.source,
      });
    }
  }

  const min = expression.attributes.min;
  const max = expression.attributes.max;
  if (
    min !== undefined &&
    max !== undefined &&
    isInteger(min) &&
    isInteger(max) &&
    Number(min) > Number(max)
  ) {
    diagnostics.push({
      code: "processing.randomInteger.bounds",
      severity: "error",
      message: "qti-random-integer requires min to be less than or equal to max.",
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateRandomIntegerAttribute(
  expression: Extract<QtiProcessingExpression, { type: "randomInteger" }>,
  attribute: "min" | "max" | "step",
  diagnostics: QtiDiagnostic[],
): void {
  const value = expression.attributes[attribute];
  if (value === undefined) {
    diagnostics.push({
      code: "processing.randomInteger.attribute",
      severity: "error",
      message: `qti-random-integer requires ${attribute}.`,
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  if (isInteger(value)) return;
  diagnostics.push({
    code: "processing.randomInteger.integer",
    severity: "error",
    message: `qti-random-integer requires integer ${attribute}, got ${value}.`,
    path: expression.source?.path,
    source: expression.source,
  });
}

function validateRandomFloatExpression(
  expression: Extract<QtiProcessingExpression, { type: "randomFloat" }>,
  diagnostics: QtiDiagnostic[],
): void {
  validateRandomFloatAttribute(expression, "max", diagnostics);
  if (expression.attributes.min !== undefined)
    validateRandomFloatAttribute(expression, "min", diagnostics);

  const min = expression.attributes.min ?? "0";
  const max = expression.attributes.max;
  if (
    max !== undefined &&
    isFiniteNumber(min) &&
    isFiniteNumber(max) &&
    Number(min) > Number(max)
  ) {
    diagnostics.push({
      code: "processing.randomFloat.bounds",
      severity: "error",
      message: "qti-random-float requires min to be less than or equal to max.",
      path: expression.source?.path,
      source: expression.source,
    });
  }
}

function validateRandomFloatAttribute(
  expression: Extract<QtiProcessingExpression, { type: "randomFloat" }>,
  attribute: "min" | "max",
  diagnostics: QtiDiagnostic[],
): void {
  const value = expression.attributes[attribute];
  if (value === undefined) {
    diagnostics.push({
      code: "processing.randomFloat.attribute",
      severity: "error",
      message: `qti-random-float requires ${attribute}.`,
      path: expression.source?.path,
      source: expression.source,
    });
    return;
  }
  if (isFiniteNumber(value)) return;
  diagnostics.push({
    code: "processing.randomFloat.numeric",
    severity: "error",
    message: `qti-random-float requires numeric ${attribute}, got ${value}.`,
    path: expression.source?.path,
    source: expression.source,
  });
}

function validateProcessingIdentifier(
  identifier: string,
  code: string,
  source: QtiDiagnostic["source"],
  diagnostics: QtiDiagnostic[],
): void {
  if (identifier.trim().length > 0) return;
  diagnostics.push({
    code,
    severity: "error",
    message: "Processing rule requires a non-empty identifier.",
    path: source?.path,
    source,
  });
}

function expressionChildren(expression: QtiProcessingExpression): QtiProcessingExpression[] {
  if (expression.type === "random") {
    return expression.values;
  }
  if (
    expression.type === "multiple" ||
    expression.type === "ordered" ||
    expression.type === "sum" ||
    expression.type === "product" ||
    expression.type === "min" ||
    expression.type === "max" ||
    expression.type === "and" ||
    expression.type === "anyN" ||
    expression.type === "or" ||
    expression.type === "gcd" ||
    expression.type === "lcm" ||
    expression.type === "mathOperator" ||
    expression.type === "repeat" ||
    expression.type === "customOperator"
  ) {
    return expression.expressions;
  }
  if (
    expression.type === "subtract" ||
    expression.type === "divide" ||
    expression.type === "power" ||
    expression.type === "integerDivide" ||
    expression.type === "integerModulus" ||
    expression.type === "match" ||
    expression.type === "equal" ||
    expression.type === "equalRounded" ||
    expression.type === "numericCompare" ||
    expression.type === "durationCompare"
  ) {
    return [expression.left, expression.right];
  }
  if (
    expression.type === "not" ||
    expression.type === "round" ||
    expression.type === "roundTo" ||
    expression.type === "truncate" ||
    expression.type === "integerToFloat" ||
    expression.type === "index" ||
    expression.type === "containerSize" ||
    expression.type === "patternMatch" ||
    expression.type === "fieldValue" ||
    expression.type === "inside"
  ) {
    return [expression.expression];
  }
  if (expression.type === "stringMatch" || expression.type === "substring") {
    return [expression.left, expression.right];
  }
  if (expression.type === "member") {
    return [expression.value, expression.collection];
  }
  if (expression.type === "delete") {
    return [expression.value, expression.collection];
  }
  if (expression.type === "contains") {
    return [expression.collection, expression.values];
  }
  if (expression.type === "statsOperator") {
    return [expression.expression];
  }
  return [];
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
  const responseDeclarations = new Map(
    item.responseDeclarations.map((declaration) => [declaration.identifier, declaration]),
  );
  const responseIdentifiers = new Set(responseDeclarations.keys());
  for (const interaction of item.interactions) {
    validateInteractionResponseReference(interaction, responseIdentifiers, diagnostics);
    validateInteractionResponseShape(interaction, diagnostics);
    validateInteractionChoices(interaction, diagnostics);
    validateInteractionChildren(interaction, diagnostics);
    validateInteractionRequiredAttributes(interaction, diagnostics);
    validateInteractionLimitAttributes(interaction, diagnostics);
    validateCorrectResponseReferences(
      interaction,
      interaction.responseIdentifier
        ? responseDeclarations.get(interaction.responseIdentifier)
        : undefined,
      diagnostics,
    );
    validateMappingReferences(
      interaction,
      interaction.responseIdentifier
        ? responseDeclarations.get(interaction.responseIdentifier)
        : undefined,
      diagnostics,
    );
  }
}

function validateInteractionResponseReference(
  interaction: QtiInteraction,
  responseIdentifiers: Set<string>,
  diagnostics: QtiDiagnostic[],
): void {
  if (!interaction.responseIdentifier) {
    if (interaction.type !== "endAttempt") {
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
    requireIdentifier(choice.qtiName, choice.attributes.identifier, diagnostics, choice.source);
    if (!choice.identifier) continue;
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

function validateCorrectResponseReferences(
  interaction: QtiInteraction,
  declaration: QtiResponseDeclaration | undefined,
  diagnostics: QtiDiagnostic[],
): void {
  if (!declaration || declaration.correctResponse === null) return;
  if (
    declaration.baseType !== "identifier" &&
    declaration.baseType !== "pair" &&
    declaration.baseType !== "directedPair"
  ) {
    return;
  }

  const identifiers = new Set(
    interaction.choices
      .map((choice) => choice.identifier)
      .filter((identifier) => identifier.length > 0),
  );
  if (identifiers.size === 0) return;

  for (const value of responseValues(declaration.correctResponse)) {
    if (declaration.baseType === "identifier") {
      if (identifiers.has(value)) continue;
      invalidCorrectResponseReference(interaction, declaration, value, diagnostics);
      continue;
    }

    const parts = value.trim().split(/\s+/);
    if (parts.length !== 2 || parts.some((part) => !identifiers.has(part))) {
      invalidCorrectResponseReference(interaction, declaration, value, diagnostics);
    }
  }
}

function responseValues(value: QtiResponseDeclaration["correctResponse"]): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function invalidCorrectResponseReference(
  interaction: QtiInteraction,
  declaration: QtiResponseDeclaration,
  value: string,
  diagnostics: QtiDiagnostic[],
): void {
  diagnostics.push({
    code: "response.correctResponse.reference",
    severity: "error",
    message: `Response declaration ${declaration.identifier} correct response ${value} does not reference choices in ${interaction.qtiName}.`,
    path: declaration.source?.path,
    source: declaration.source,
  });
}

function validateMappingReferences(
  interaction: QtiInteraction,
  declaration: QtiResponseDeclaration | undefined,
  diagnostics: QtiDiagnostic[],
): void {
  if (!declaration?.mapping) return;
  if (
    declaration.baseType !== "identifier" &&
    declaration.baseType !== "pair" &&
    declaration.baseType !== "directedPair"
  ) {
    return;
  }

  const identifiers = new Set(
    interaction.choices
      .map((choice) => choice.identifier)
      .filter((identifier) => identifier.length > 0),
  );
  if (identifiers.size === 0) return;

  for (const entry of declaration.mapping.entries) {
    const mapKey = entry.mapKey;
    if (!mapKey) continue;
    if (declaration.baseType === "identifier") {
      if (identifiers.has(mapKey)) continue;
      invalidMappingReference(interaction, declaration, entry, diagnostics);
      continue;
    }

    const parts = mapKey.trim().split(/\s+/);
    if (parts.length !== 2 || parts.some((part) => !identifiers.has(part))) {
      invalidMappingReference(interaction, declaration, entry, diagnostics);
    }
  }
}

function invalidMappingReference(
  interaction: QtiInteraction,
  declaration: QtiResponseDeclaration,
  entry: NonNullable<QtiResponseDeclaration["mapping"]>["entries"][number],
  diagnostics: QtiDiagnostic[],
): void {
  diagnostics.push({
    code: "mapping.mapKey.reference",
    severity: "error",
    message: `Response declaration ${declaration.identifier} map-key ${entry.mapKey ?? ""} does not reference choices in ${interaction.qtiName}.`,
    path: entry.source?.path ?? declaration.source?.path,
    source: entry.source ?? declaration.source,
  });
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
  if (requiresObject(interaction) && !hasRequiredObjectAsset(interaction)) {
    diagnostics.push({
      code: "interaction.object.required",
      severity: "error",
      message:
        interaction.type === "drawing"
          ? `${interaction.qtiName} requires an object, img, or picture canvas with a data/src attribute.`
          : `${interaction.qtiName} requires an object, img, audio, or video child with a data/src attribute or media sources.`,
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
    interaction.type === "media" ||
    interaction.type === "drawing"
  );
}

function hasRequiredObjectAsset(interaction: QtiInteraction): boolean {
  if (interaction.type === "media") {
    return Boolean(
      interaction.object?.data || interaction.object?.sources.some((source) => Boolean(source.src)),
    );
  }
  if (interaction.type === "drawing") return Boolean(interaction.object?.data);
  return Boolean(interaction.object?.data);
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
  if (interaction.type === "media") {
    validateNonNegativeIntegerAttribute(interaction, "max-plays", diagnostics);
    validateNonNegativeIntegerAttribute(interaction, "min-plays", diagnostics);
    validateBooleanAttribute(interaction, "autostart", diagnostics);
    validateBooleanAttribute(interaction, "loop", diagnostics);
    validateMinMaxPair(interaction, "min-plays", "max-plays", diagnostics);
  }
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
  validateChoiceMinMaxPair(choice, "match-min", "match-max", diagnostics);
  validateHotspotGeometry(choice, diagnostics);
}

function requiresMatchMax(choice: QtiChoice): boolean {
  return (
    choice.qtiName === "qti-simple-associable-choice" ||
    choice.qtiName === "qti-associable-hotspot" ||
    choice.qtiName === "qti-gap-text" ||
    choice.qtiName === "qti-gap-img"
  );
}

function validateHotspotGeometry(choice: QtiChoice, diagnostics: QtiDiagnostic[]): void {
  if (choice.qtiName !== "qti-hotspot-choice" && choice.qtiName !== "qti-associable-hotspot") {
    return;
  }

  const shape = choice.attributes.shape;
  const coords = choice.attributes.coords;
  if (!shape) {
    diagnostics.push({
      code: "choice.shape.required",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} requires shape.`,
      path: choice.source?.path,
      source: choice.source,
    });
  } else if (!isHotspotShape(shape)) {
    diagnostics.push({
      code: "choice.shape",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} has unsupported shape ${shape}.`,
      path: choice.source?.path,
      source: choice.source,
    });
  }

  if (!coords) {
    diagnostics.push({
      code: "choice.coords.required",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} requires coords.`,
      path: choice.source?.path,
      source: choice.source,
    });
    return;
  }

  const values = coords.split(",").map((value) => value.trim());
  if (values.length === 0 || values.some((value) => value.length === 0 || !isFiniteNumber(value))) {
    diagnostics.push({
      code: "choice.coords",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} requires comma-separated numeric coords.`,
      path: choice.source?.path,
      source: choice.source,
    });
    return;
  }

  if (shape && isHotspotShape(shape) && !hasValidShapeCoordinateCount(shape, values.map(Number))) {
    diagnostics.push({
      code: "choice.coords.shape",
      severity: "error",
      message: `${choice.qtiName} ${choice.identifier} shape ${shape} has invalid coords arity.`,
      path: choice.source?.path,
      source: choice.source,
    });
  }
}

function isHotspotShape(value: string): boolean {
  return (
    value === "circle" ||
    value === "default" ||
    value === "ellipse" ||
    value === "poly" ||
    value === "rect"
  );
}

function isAreaShape(value: string): boolean {
  return value === "circle" || value === "default" || value === "poly" || value === "rect";
}

function isNumericCsv(value: string): boolean {
  return value
    .split(",")
    .map((part) => part.trim())
    .every((part) => part.length > 0 && isFiniteNumber(part));
}

function numericCsv(value: string): number[] {
  return value.split(",").map((part) => Number(part.trim()));
}

function hasValidShapeCoordinateCount(shape: string, coords: number[]): boolean {
  switch (shape) {
    case "circle":
      return coords.length === 3;
    case "ellipse":
    case "rect":
      return coords.length === 4;
    case "poly":
      return coords.length >= 6 && coords.length % 2 === 0;
    case "default":
      return true;
    default:
      return false;
  }
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

function validateBooleanAttribute(
  interaction: QtiInteraction,
  attribute: string,
  diagnostics: QtiDiagnostic[],
): void {
  const value = interaction.attributes[attribute];
  if (value === undefined || isBooleanAttribute(value)) return;
  diagnostics.push({
    code: "interaction.booleanAttribute",
    severity: "error",
    message: `${interaction.qtiName} requires boolean ${attribute}, got ${value}.`,
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

function validateChoiceMinMaxPair(
  choice: QtiChoice,
  minAttribute: string,
  maxAttribute: string,
  diagnostics: QtiDiagnostic[],
): void {
  const min = choice.attributes[minAttribute];
  const max = choice.attributes[maxAttribute];
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
    code: "choice.minMax",
    severity: "error",
    message: `${choice.qtiName} ${choice.identifier} requires ${minAttribute} to be less than or equal to ${maxAttribute}, unless ${maxAttribute} is 0 for unlimited.`,
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
      return setOf(common, ["qti-simple-match-set", "qti-simple-associable-choice"]);
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
      return setOf(common, [
        "object",
        "qti-gap-text",
        "qti-gap-img",
        "qti-associable-hotspot",
        ...staticContentNames(),
      ]);
    case "hotspot":
      return setOf(common, ["object", "qti-hotspot-choice"]);
    case "positionObject":
      return setOf(common, ["object", "img", "qti-position-object-stage"]);
    case "selectPoint":
    case "media":
      return setOf(common, ["audio", "video", "object", "img"]);
    case "drawing":
      return setOf(common, ["object", "img", "picture"]);
    case "extendedText":
      return new Set(common);
    case "portableCustom":
      return setOf(common, ["qti-interaction-markup"]);
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

function isInteger(value: string): boolean {
  return /^-?\d+$/.test(value);
}

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

function isBooleanAttribute(value: string): boolean {
  return value === "true" || value === "false" || value === "1" || value === "0";
}

function isPoint(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 2 && parts.every(isFiniteNumber);
}

function isPair(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length === 2 && parts.every((part) => part.length > 0);
}

function expectedResponseShape(
  interaction: QtiInteraction,
): { cardinalities: QtiCardinality[]; baseTypes: QtiBaseType[] } | undefined {
  if (interaction.type === "endAttempt") {
    return { cardinalities: ["single"], baseTypes: ["boolean"] };
  }
  if (interaction.type === "media") return { cardinalities: ["single"], baseTypes: ["integer"] };
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
  if (interaction.type === "drawing") return { cardinalities: ["single"], baseTypes: ["file"] };
  if (interaction.type === "portableCustom") {
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

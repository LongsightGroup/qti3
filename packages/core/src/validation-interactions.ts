import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiCardinality,
  QtiChoice,
  QtiDiagnostic,
  QtiInteraction,
  QtiResponseDeclaration,
} from "./types.js";
import { assertNever } from "./assert-never.js";
import { isValidQtiPatternMask } from "./pattern-mask.js";
import { parseQtiMediaDefinition } from "./media-definition.js";
import { parseQtiSliderDefinition } from "./slider-definition.js";
import { validateInteractionSharedVocabulary } from "./shared-vocabulary-interaction-validation.js";
import { qtiValueToStringList } from "./value-format.js";
import {
  validateGraphicHotspotObjectDimensions,
  validateHotspotGeometry,
} from "./validation-geometry.js";
import {
  isBooleanAttribute,
  isNonNegativeInteger,
  requireIdentifier,
} from "./validation-primitives.js";

export function validateInteractions(item: QtiAssessmentItem, diagnostics: QtiDiagnostic[]): void {
  const responseDeclarations = new Map(
    item.responseDeclarations.map((declaration) => [declaration.identifier, declaration]),
  );
  const responseIdentifiers = new Set(responseDeclarations.keys());
  for (const interaction of item.interactions) {
    validateInteractionResponseReference(interaction, responseIdentifiers, diagnostics);
    validateInteractionResponseShape(interaction, diagnostics);
    validateInteractionSharedVocabulary(interaction, diagnostics);
    validateInteractionChoices(interaction, diagnostics);
    validateInteractionChildren(interaction, diagnostics);
    validateInteractionRequiredAttributes(interaction, diagnostics);
    validatePortableCustomInteraction(interaction, item, diagnostics);
    validateInteractionLimitAttributes(interaction, diagnostics);
    validatePatternMaskAttribute(interaction, diagnostics);
    validateGraphicHotspotObjectDimensions(interaction, diagnostics);
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

  if (
    interaction.type !== "slider" &&
    interaction.responseBaseType &&
    !expected.baseTypes.includes(interaction.responseBaseType)
  ) {
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
  return qtiValueToStringList(value);
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
  }

  if (interaction.type === "slider") {
    const definition = parseQtiSliderDefinition(interaction);
    if (!definition.ok) diagnostics.push(...definition.diagnostics);
  }

  if (interaction.type === "media") {
    const definition = parseQtiMediaDefinition(interaction);
    if (!definition.ok) diagnostics.push(...definition.diagnostics);
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

function validatePortableCustomInteraction(
  interaction: QtiInteraction,
  item: QtiAssessmentItem,
  diagnostics: QtiDiagnostic[],
): void {
  if (interaction.type !== "portableCustom") return;
  const definition = interaction.portableCustom;
  if (!definition) return;

  const configuredModules = definition.interactionModules?.modules ?? [];
  const hasModuleAttribute = Boolean(definition.module?.trim());
  const hasConfiguredModule = configuredModules.some((module) => Boolean(module.id?.trim()));
  if (!hasModuleAttribute && !hasConfiguredModule) {
    diagnostics.push({
      code: "interaction.portableCustom.module",
      severity: "error",
      message: `${interaction.qtiName} requires a module attribute or at least one qti-interaction-module id.`,
      path: interaction.source?.path,
      source: interaction.source,
    });
  }

  for (const module of configuredModules) {
    if (!module.id?.trim()) {
      diagnostics.push({
        code: "interaction.portableCustom.moduleId",
        severity: "error",
        message: "qti-interaction-module requires a non-empty id.",
        path: module.source?.path,
        source: module.source,
      });
    }
    warnExternalPortableCustomUrl(module.primaryPath, module.source, diagnostics);
    warnExternalPortableCustomUrl(module.fallbackPath, module.source, diagnostics);
  }

  warnExternalPortableCustomUrl(
    definition.interactionModules?.primaryConfiguration,
    definition.interactionModules?.source,
    diagnostics,
  );
  warnExternalPortableCustomUrl(
    definition.interactionModules?.secondaryConfiguration,
    definition.interactionModules?.source,
    diagnostics,
  );

  const templateIdentifiers = new Set(
    item.templateDeclarations.map((declaration) => declaration.identifier),
  );
  for (const variable of definition.templateVariables) {
    if (!variable.identifier?.trim()) {
      diagnostics.push({
        code: "interaction.portableCustom.templateVariable",
        severity: "error",
        message: "qti-template-variable requires template-identifier or identifier.",
        path: variable.source?.path,
        source: variable.source,
      });
      continue;
    }
    if (!templateIdentifiers.has(variable.identifier)) {
      diagnostics.push({
        code: "interaction.portableCustom.templateVariable.reference",
        severity: "error",
        message: `qti-template-variable references missing template declaration ${variable.identifier}.`,
        path: variable.source?.path,
        source: variable.source,
      });
    }
  }

  for (const variable of definition.contextVariables) {
    if (variable.identifier?.trim()) continue;
    diagnostics.push({
      code: "interaction.portableCustom.contextVariable",
      severity: "error",
      message: "qti-context-variable requires identifier.",
      path: variable.source?.path,
      source: variable.source,
    });
  }

  for (const stylesheet of definition.stylesheets) {
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

function warnExternalPortableCustomUrl(
  url: string | undefined,
  source: QtiDiagnostic["source"],
  diagnostics: QtiDiagnostic[],
): void {
  if (!url || !/^https?:\/\//i.test(url)) return;
  diagnostics.push({
    code: "interaction.portableCustom.externalModuleUrl",
    severity: "warning",
    message: `Portable custom interaction module URL ${url} requires host delivery policy approval.`,
    path: source?.path,
    source,
  });
}

function validatePatternMaskAttribute(
  interaction: QtiInteraction,
  diagnostics: QtiDiagnostic[],
): void {
  if (interaction.type !== "textEntry" && interaction.type !== "extendedText") return;
  const patternMask = interaction.attributes["pattern-mask"];
  if (patternMask === undefined || isValidQtiPatternMask(patternMask)) return;
  diagnostics.push({
    code: "interaction.patternMask.invalid",
    severity: "error",
    message: `${interaction.qtiName} pattern-mask is not a valid regular expression.`,
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
  validateBooleanAttribute(interaction, "required", diagnostics);
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
  validateGapImageAsset(choice, diagnostics);
  validateHotspotGeometry(choice, diagnostics);
}

function validateGapImageAsset(choice: QtiChoice, diagnostics: QtiDiagnostic[]): void {
  if (choice.qtiName !== "qti-gap-img" || choice.asset?.data) return;
  diagnostics.push({
    code: "choice.gapImg.media.required",
    severity: "error",
    message: `qti-gap-img ${choice.identifier} requires an img, object, or picture child with a usable src or data attribute.`,
    path: choice.source?.path,
    source: choice.source,
  });
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
      return setOf(common, [
        "qti-interaction-markup",
        "qti-interaction-modules",
        "qti-template-variable",
        "qti-context-variable",
        "qti-stylesheet",
        "qti-catalog-info",
      ]);
    case "slider":
    case "textEntry":
    case "upload":
    case "endAttempt":
      return new Set(common);
    case "custom":
      return undefined;
    default:
      return assertNever(interaction.type);
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
    return {
      cardinalities: ["single", "multiple", "ordered", "record"],
      baseTypes: [
        "identifier",
        "boolean",
        "integer",
        "float",
        "string",
        "point",
        "pair",
        "directedPair",
        "duration",
        "file",
        "uri",
      ],
    };
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

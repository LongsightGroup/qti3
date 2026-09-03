import type {
  QtiAssessmentItem,
  QtiBaseType,
  QtiCardinality,
  QtiDiagnostic,
  QtiInteraction,
  QtiResponseDeclaration,
  QtiScalarValue,
  QtiValue,
} from "./types.js";
import { assertNever } from "./assert-never.js";
import { isNullResponse, isRecordValue, valueContainer } from "./processing-values.js";
import { listNamedResponseInputs, type QtiNamedResponseInput } from "./response-input.js";
import {
  matchMaxDiagnostics,
  maximumAllowedResponses,
  maximumResponseDiagnostic,
  mediaPlayCount,
  minimumRequiredResponses,
  requiredResponseDiagnostic,
  responseCount,
  responseLimitAttribute,
  responseValidationPolicy,
} from "./response-validation-policy.js";
import { parseQtiSliderDefinition, parseQtiSliderValue } from "./slider-definition.js";
import { qtiValueToString, readQtiJsonValue } from "./value-format.js";
import { parseQtiScalarForBaseType } from "./validation-primitives.js";

export type { QtiNamedResponseInput as QtiResponseVariableInput } from "./response-input.js";
export type QtiResponseVariablesInput = Record<string, unknown> | readonly QtiNamedResponseInput[];

export type QtiResponseValidationDiagnosticCode =
  | "response.required"
  | "response.maximum"
  | "response.matchMax"
  | "response.cardinality"
  | "response.baseType"
  | "response.domain"
  | "response.undeclared"
  | "response.identifier.required"
  | "response.value.invalid";

export interface QtiResponseValidationDiagnostic extends QtiDiagnostic {
  code: QtiResponseValidationDiagnosticCode;
  identifier?: string | undefined;
}

/** Result of validating submitted responses, including normalized values on success. */
export type QtiResponseValidationResult =
  | {
      ok: true;
      diagnostics: QtiResponseValidationDiagnostic[];
      responses: Record<string, QtiValue>;
    }
  | {
      ok: false;
      diagnostics: QtiResponseValidationDiagnostic[];
    };

export interface QtiResponseValidationInput {
  item: QtiAssessmentItem;
  responses: QtiResponseVariablesInput;
  allowIncompleteResponses?: boolean | undefined;
  allowedUndeclaredResponseIdentifiers?: readonly string[] | undefined;
  responseIdentifiers?: Iterable<string> | undefined;
}

/** Validate and normalize submitted response variables against a parsed QTI assessment item. */
export function validateQtiResponseVariables(
  input: QtiResponseValidationInput,
): QtiResponseValidationResult {
  const diagnostics: QtiResponseValidationDiagnostic[] = [];
  const declaredIdentifiers = new Set(
    input.item.responseDeclarations.map((declaration) => declaration.identifier),
  );
  const allowedUndeclaredIdentifiers = new Set(input.allowedUndeclaredResponseIdentifiers ?? []);
  const responses = ingestSubmittedResponses(
    input.responses,
    declaredIdentifiers,
    allowedUndeclaredIdentifiers,
    diagnostics,
  );
  const scopedResponseIdentifiers = input.responseIdentifiers
    ? new Set(input.responseIdentifiers)
    : undefined;
  const interactionsByResponse = indexInteractionsByResponse(input.item.interactions);

  for (const declaration of input.item.responseDeclarations) {
    if (
      scopedResponseIdentifiers !== undefined &&
      !scopedResponseIdentifiers.has(declaration.identifier)
    ) {
      continue;
    }

    const value = responses.get(declaration.identifier);
    const interactions = interactionsByResponse.get(declaration.identifier);
    if (value !== undefined) {
      const cardinalityMatches = validateResponseCardinality(declaration, value, diagnostics);
      const parsedValue = parseResponseBaseType(declaration, value, diagnostics);
      if (cardinalityMatches && parsedValue !== undefined) {
        responses.set(declaration.identifier, parsedValue);
        validateResponseDomain(declaration, interactions ?? [], parsedValue, diagnostics);
      }
    }

    if (interactions === undefined) {
      validateDeclarationResponse(
        declaration,
        undefined,
        value,
        input.allowIncompleteResponses,
        diagnostics,
      );
      continue;
    }

    for (const interaction of interactions) {
      validateDeclarationResponse(
        declaration,
        interaction,
        value,
        input.allowIncompleteResponses,
        diagnostics,
      );
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }
  return { ok: true, diagnostics, responses: Object.fromEntries(responses) };
}

function ingestSubmittedResponses(
  input: QtiResponseVariablesInput,
  declaredIdentifiers: ReadonlySet<string>,
  allowedUndeclaredIdentifiers: ReadonlySet<string>,
  diagnostics: QtiResponseValidationDiagnostic[],
): Map<string, QtiValue> {
  const responses = new Map<string, QtiValue>();

  for (const entry of listNamedResponseInputs(input)) {
    const identifier = entry.identifier.trim();
    if (!identifier) {
      diagnostics.push({
        code: "response.identifier.required",
        severity: "error",
        message: "Response identifiers must be non-empty strings.",
      });
      continue;
    }

    const value = readQtiJsonValue(entry.value);
    if (value === undefined) {
      diagnostics.push({
        code: "response.value.invalid",
        severity: "error",
        identifier,
        message: `Response ${identifier} is not a supported QTI value.`,
        path: identifier,
      });
      continue;
    }

    if (!declaredIdentifiers.has(identifier)) {
      if (!allowedUndeclaredIdentifiers.has(identifier)) {
        diagnostics.push({
          code: "response.undeclared",
          severity: "error",
          identifier,
          message: `Response ${identifier} is not declared by the assessment item.`,
          path: identifier,
        });
        continue;
      }
    }

    responses.set(identifier, value);
  }

  return responses;
}

function indexInteractionsByResponse(
  interactions: readonly QtiInteraction[],
): Map<string, QtiInteraction[]> {
  const indexed = new Map<string, QtiInteraction[]>();
  for (const interaction of interactions) {
    const identifier = interaction.responseIdentifier;
    if (!identifier) continue;
    const bucket = indexed.get(identifier);
    if (bucket) {
      bucket.push(interaction);
    } else {
      indexed.set(identifier, [interaction]);
    }
  }
  return indexed;
}

function validateResponseCardinality(
  declaration: QtiResponseDeclaration,
  value: QtiValue,
  diagnostics: QtiResponseValidationDiagnostic[],
): boolean {
  if (value === null) return true;

  if (matchesCardinality(declaration.cardinality, value)) return true;
  diagnostics.push({
    code: "response.cardinality",
    severity: "error",
    identifier: declaration.identifier,
    message: `Response ${declaration.identifier} must match ${declaration.cardinality} cardinality.`,
    path: declaration.identifier,
    source: declaration.source,
  });
  return false;
}

function parseResponseBaseType(
  declaration: QtiResponseDeclaration,
  value: QtiValue,
  diagnostics: QtiResponseValidationDiagnostic[],
): QtiValue | undefined {
  const baseType = declaration.baseType;
  if (value === null || baseType === undefined || isRecordValue(value)) return value;

  if (Array.isArray(value)) {
    const parsedValues: QtiScalarValue[] = [];
    for (const entry of value) {
      const parsedValue = parseQtiScalarForBaseType(entry, baseType);
      if (parsedValue === undefined) {
        pushResponseBaseTypeDiagnostic(declaration, entry, baseType, diagnostics);
        return undefined;
      }
      parsedValues.push(parsedValue);
    }
    return parsedValues;
  }

  const parsedValue = parseQtiScalarForBaseType(value, baseType);
  if (parsedValue !== undefined) return parsedValue;
  pushResponseBaseTypeDiagnostic(declaration, value, baseType, diagnostics);
  return undefined;
}

function pushResponseBaseTypeDiagnostic(
  declaration: QtiResponseDeclaration,
  value: QtiScalarValue,
  baseType: QtiBaseType,
  diagnostics: QtiResponseValidationDiagnostic[],
): void {
  diagnostics.push({
    code: "response.baseType",
    severity: "error",
    identifier: declaration.identifier,
    message: `Response ${declaration.identifier} value ${qtiValueToString(value)} is not valid for base-type ${baseType}.`,
    path: declaration.identifier,
    source: declaration.source,
  });
}

function validateResponseDomain(
  declaration: QtiResponseDeclaration,
  interactions: readonly QtiInteraction[],
  value: QtiValue,
  diagnostics: QtiResponseValidationDiagnostic[],
): void {
  if (value === null) return;
  const identifiers = new Set(
    interactions.flatMap((interaction) =>
      interaction.choices.flatMap((choice) => (choice.identifier ? [choice.identifier] : [])),
    ),
  );
  if (
    identifiers.size > 0 &&
    (declaration.baseType === "identifier" ||
      declaration.baseType === "pair" ||
      declaration.baseType === "directedPair")
  ) {
    const invalidValue = valueContainer(value).find(
      (entry) => typeof entry !== "string" || !valueReferencesIdentifiers(entry, identifiers),
    );
    if (invalidValue !== undefined) {
      pushResponseDomainDiagnostic(declaration, invalidValue, diagnostics);
      return;
    }
  }

  for (const interaction of interactions) {
    if (interaction.type !== "slider") continue;
    const definition = parseQtiSliderDefinition(interaction);
    if (!definition.ok || parseQtiSliderValue(value, definition.value).ok) continue;
    pushResponseDomainDiagnostic(declaration, value, diagnostics);
    return;
  }
}

function valueReferencesIdentifiers(value: string, identifiers: ReadonlySet<string>): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length > 0 && parts.every((part) => identifiers.has(part));
}

function pushResponseDomainDiagnostic(
  declaration: QtiResponseDeclaration,
  value: QtiValue,
  diagnostics: QtiResponseValidationDiagnostic[],
): void {
  diagnostics.push({
    code: "response.domain",
    severity: "error",
    identifier: declaration.identifier,
    message: `Response ${declaration.identifier} value ${qtiValueToString(value)} is not in the authored interaction domain.`,
    path: declaration.identifier,
    source: declaration.source,
  });
}

function matchesCardinality(cardinality: QtiCardinality, value: QtiValue): boolean {
  switch (cardinality) {
    case "single":
      return !Array.isArray(value) && !isRecordValue(value);
    case "multiple":
    case "ordered":
      return Array.isArray(value);
    case "record":
      return isRecordValue(value);
  }
  return assertNever(cardinality);
}

function validateDeclarationResponse(
  declaration: QtiResponseDeclaration,
  interaction: QtiInteraction | undefined,
  value: QtiValue | undefined,
  allowIncompleteResponses: boolean | undefined,
  diagnostics: QtiResponseValidationDiagnostic[],
): void {
  const policy = responseValidationPolicy(declaration, interaction);
  if (!policy.checkMinimum && !policy.checkMaximum && !policy.checkMatchMax) return;

  const effectiveValue = value ?? null;
  const count =
    interaction?.type === "media" ? mediaPlayCount(effectiveValue) : responseCount(effectiveValue);

  if (policy.checkMinimum && !allowIncompleteResponses) {
    const minimum = effectiveMinimumRequiredResponses(declaration, interaction);
    if (count < minimum) {
      diagnostics.push(
        attachResponseIdentifier(
          declaration.identifier,
          requiredResponseDiagnostic(declaration.identifier, interaction, minimum),
        ),
      );
    }
  }

  if (policy.checkMaximum && value !== undefined && !isNullResponse(value)) {
    const maximum = maximumAllowedResponses(interaction);
    if (maximum !== undefined && count > maximum) {
      diagnostics.push(
        attachResponseIdentifier(
          declaration.identifier,
          maximumResponseDiagnostic(declaration.identifier, interaction, maximum),
        ),
      );
    }
  }

  if (policy.checkMatchMax && interaction && value !== undefined && !isNullResponse(value)) {
    diagnostics.push(
      ...matchMaxDiagnostics(declaration.identifier, interaction, value).map((diagnostic) =>
        attachResponseIdentifier(declaration.identifier, diagnostic),
      ),
    );
  }
}

function effectiveMinimumRequiredResponses(
  declaration: { readonly correctResponse: QtiValue | null },
  interaction: QtiInteraction | undefined,
): number {
  const minimum = minimumRequiredResponses(interaction);
  if (declaration.correctResponse === null || hasAuthoredMinimum(interaction)) return minimum;
  return Math.max(minimum, 1);
}

function hasAuthoredMinimum(interaction: QtiInteraction | undefined): boolean {
  if (!interaction) return false;
  if (interaction.type === "media") return interaction.attributes["min-plays"] !== undefined;
  return responseLimitAttribute(interaction, "min-choices", "min-associations") !== undefined;
}

function attachResponseIdentifier(
  identifier: string,
  diagnostic: QtiDiagnostic,
): QtiResponseValidationDiagnostic {
  if (!isResponseValidationDiagnosticCode(diagnostic.code)) {
    throw new Error(`Unexpected response validation code: ${diagnostic.code}`);
  }
  return { ...diagnostic, identifier, code: diagnostic.code };
}

function isResponseValidationDiagnosticCode(
  code: string,
): code is QtiResponseValidationDiagnosticCode {
  return (
    code === "response.required" ||
    code === "response.maximum" ||
    code === "response.matchMax" ||
    code === "response.cardinality" ||
    code === "response.baseType" ||
    code === "response.domain" ||
    code === "response.undeclared" ||
    code === "response.identifier.required" ||
    code === "response.value.invalid"
  );
}

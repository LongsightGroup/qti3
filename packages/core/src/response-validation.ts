import type {
  QtiAssessmentItem,
  QtiCardinality,
  QtiDiagnostic,
  QtiInteraction,
  QtiResponseDeclaration,
  QtiValue,
} from "./types.js";
import { assertNever } from "./assert-never.js";
import { isNullResponse, isRecordValue } from "./processing-values.js";
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
import { readQtiJsonValue } from "./value-format.js";

export type { QtiNamedResponseInput as QtiResponseVariableInput } from "./response-input.js";
export type QtiResponseVariablesInput = Record<string, unknown> | readonly QtiNamedResponseInput[];

export type QtiResponseValidationDiagnosticCode =
  | "response.required"
  | "response.maximum"
  | "response.matchMax"
  | "response.cardinality"
  | "response.undeclared"
  | "response.identifier.required"
  | "response.value.invalid";

export interface QtiResponseValidationDiagnostic extends QtiDiagnostic {
  code: QtiResponseValidationDiagnosticCode;
  identifier?: string | undefined;
}

export interface QtiResponseValidationResult {
  ok: boolean;
  diagnostics: QtiResponseValidationDiagnostic[];
}

export interface QtiResponseValidationInput {
  item: QtiAssessmentItem;
  responses: QtiResponseVariablesInput;
  allowIncompleteResponses?: boolean | undefined;
  allowedUndeclaredResponseIdentifiers?: readonly string[] | undefined;
  responseIdentifiers?: Iterable<string> | undefined;
}

/** Validate submitted response variables against a parsed QTI assessment item. */
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
    if (value !== undefined) {
      validateResponseCardinality(declaration, value, diagnostics);
    }

    const interactions = interactionsByResponse.get(declaration.identifier);
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

  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
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
      if (allowedUndeclaredIdentifiers.has(identifier)) continue;
      diagnostics.push({
        code: "response.undeclared",
        severity: "error",
        identifier,
        message: `Response ${identifier} is not declared by the assessment item.`,
        path: identifier,
      });
      continue;
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
): void {
  if (value === null) return;

  if (matchesCardinality(declaration.cardinality, value)) return;
  diagnostics.push({
    code: "response.cardinality",
    severity: "error",
    identifier: declaration.identifier,
    message: `Response ${declaration.identifier} must match ${declaration.cardinality} cardinality.`,
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
    code === "response.undeclared" ||
    code === "response.identifier.required" ||
    code === "response.value.invalid"
  );
}

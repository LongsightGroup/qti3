import { qtiValueToIdentifierList } from "@longsightgroup/qti3-core";
import type {
  QtiAttemptStateV1,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiValue,
} from "@longsightgroup/qti3-core";
import {
  maximumAllowedResponses,
  mediaPlayCount,
  minimumMediaPlays,
  parseUnlimitedMaximum,
  responseLimitAttribute,
} from "./response-limits.js";

export function errorView(message: string): HTMLElement {
  const element = document.createElement("p");
  element.role = "alert";
  element.textContent = message;
  return element;
}

export function validationMessageElement(responseIdentifier: string): HTMLElement {
  const element = document.createElement("p");
  element.id = validationMessageId(responseIdentifier);
  element.dataset.validationFor = responseIdentifier;
  element.hidden = true;
  element.role = "alert";
  return element;
}

export function inlineValidationMessageElement(responseIdentifier: string): HTMLElement {
  const element = document.createElement("span");
  element.id = validationMessageId(responseIdentifier);
  element.dataset.validationFor = responseIdentifier;
  element.hidden = true;
  element.role = "alert";
  return element;
}

export function validationMessageId(responseIdentifier: string): string {
  return `qti3-validation-${responseIdentifier}`;
}

export function cloneDiagnostics(diagnostics: QtiDiagnostic[]): QtiDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    source: diagnostic.source ? { ...diagnostic.source } : undefined,
  }));
}

export function responseIsEmpty(value: QtiValue): boolean {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function responseCount(value: QtiValue): number {
  return responseIsEmpty(value) ? 0 : Array.isArray(value) ? value.length : 1;
}

export function minimumRequiredResponses(interaction: QtiInteraction | undefined): number {
  if (!interaction) return 1;
  if (interaction.type === "media") return minimumMediaPlays(interaction);
  const explicit = responseLimitAttribute(interaction, "min-choices", "min-associations");
  if (explicit === undefined) return 1;
  const parsed = Number(explicit);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
}

export function matchMaxDiagnostics(
  responseIdentifier: string,
  interaction: QtiInteraction,
  response: QtiValue,
): QtiDiagnostic[] {
  const identifiers = responseChoiceIdentifiers(response);
  if (identifiers.length === 0) return [];
  const counts = new Map<string, number>();
  for (const identifier of identifiers) {
    counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
  }

  const diagnostics: QtiDiagnostic[] = [];
  for (const choice of interaction.choices) {
    const maximum = parseUnlimitedMaximum(choice.attributes["match-max"]);
    if (maximum === undefined) continue;
    const count = counts.get(choice.identifier) ?? 0;
    if (count <= maximum) continue;
    diagnostics.push({
      code: "response.matchMax",
      severity: "error",
      message: `${choice.text || choice.identifier} may be used at most ${maximum} time${maximum === 1 ? "" : "s"}.`,
      path: responseIdentifier,
    });
  }
  return diagnostics;
}

export function responseChoiceIdentifiers(response: QtiValue): string[] {
  return qtiValueToIdentifierList(response).flatMap((value) => value.split(/\s+/).filter(Boolean));
}

export function validateItemResponses(
  document: QtiDocument,
  state: QtiAttemptStateV1,
): QtiDiagnostic[] {
  const interactionsByResponse = new Map(
    document.item.interactions
      .filter((interaction) => interaction.responseIdentifier)
      .map((interaction) => [interaction.responseIdentifier!, interaction]),
  );
  const diagnostics: QtiDiagnostic[] = [];
  for (const declaration of document.item.responseDeclarations) {
    const interaction = interactionsByResponse.get(declaration.identifier);
    if (declaration.correctResponse === null && interaction?.type !== "media") continue;
    const minimum = minimumRequiredResponses(interaction);
    const count =
      interaction?.type === "media"
        ? mediaPlayCount(state.responses[declaration.identifier] ?? null)
        : responseCount(state.responses[declaration.identifier] ?? null);
    const maximum = maximumAllowedResponses(interaction);
    if (count < minimum) {
      diagnostics.push({
        code: "response.required",
        severity: "error",
        message:
          interaction?.attributes["data-min-selections-message"] ??
          (interaction?.type === "media"
            ? `${declaration.identifier} requires at least ${minimum} play${minimum === 1 ? "" : "s"}.`
            : minimum === 1
              ? `${declaration.identifier} requires a response.`
              : `${declaration.identifier} requires at least ${minimum} responses.`),
        path: declaration.identifier,
      });
    }
    if (maximum !== undefined && count > maximum) {
      diagnostics.push({
        code: "response.maximum",
        severity: "error",
        message:
          interaction?.attributes["data-max-selections-message"] ??
          (interaction?.type === "media"
            ? `${declaration.identifier} allows at most ${maximum} play${maximum === 1 ? "" : "s"}.`
            : `${declaration.identifier} allows at most ${maximum} response${maximum === 1 ? "" : "s"}.`),
        path: declaration.identifier,
      });
    }
    if (interaction) {
      diagnostics.push(
        ...matchMaxDiagnostics(
          declaration.identifier,
          interaction,
          state.responses[declaration.identifier] ?? null,
        ),
      );
    }
  }
  return diagnostics;
}

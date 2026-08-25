import { assertQtiIdentifier } from "./identifier.js";
import {
  duplicateDiagnostics,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import { assessmentItemShell } from "./shell.js";
import type {
  Qti3TextEntryAnswer,
  Qti3TextEntryBuilderInput,
  Qti3TextEntryResponse,
  Qti3WriterDiagnostic,
} from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export function buildQti3TextEntryItem(input: Qti3TextEntryBuilderInput): string {
  const diagnostics = validateQti3TextEntryItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3TextEntryItem(input);
}

export function renderQti3TextEntryItem(input: Qti3TextEntryBuilderInput): string {
  const declarationsXml = input.responses.map(buildResponseDeclaration).join("\n");
  const prompt = input.promptHtml?.trim()
    ? `    <div class="qti-inline-prompt">${input.promptHtml}</div>\n`
    : "";
  const body = (input.bodyHtml?.trim() ?? "")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml: `${prompt}${body}`,
    responseProcessingXml: buildResponseProcessing(input.responses),
    scoreDefaultZero: true,
  });
}

function buildResponseDeclaration(response: Qti3TextEntryResponse): string {
  const responseIdentifier = escapeXmlAttribute(
    assertQtiIdentifier(response.responseIdentifier, "Text entry response identifier"),
  );
  const baseType = response.baseType ?? "string";
  const answers = (response.answers ?? []).filter((answer) => answer.value.trim().length > 0);
  const parts = [
    `  <qti-response-declaration identifier="${responseIdentifier}" cardinality="single" base-type="${baseType}">`,
  ];
  if (answers.length) {
    const correctAnswers = answers.filter((answer) => normalizeScore(answer.score) >= 1);
    const firstCorrectAnswer = correctAnswers[0];
    if (firstCorrectAnswer) {
      parts.push("    <qti-correct-response>");
      parts.push(`      <qti-value>${escapeXmlText(firstCorrectAnswer.value.trim())}</qti-value>`);
      parts.push("    </qti-correct-response>");
    }
    parts.push('    <qti-mapping default-value="0">');
    for (const answer of answers) parts.push(mapEntryXml(answer));
    parts.push("    </qti-mapping>");
  }
  parts.push("  </qti-response-declaration>");
  return parts.join("\n");
}

function mapEntryXml(answer: Qti3TextEntryAnswer): string {
  const attrs = [
    `map-key="${escapeXmlAttribute(answer.value.trim())}"`,
    `mapped-value="${String(normalizeScore(answer.score))}"`,
  ];
  if (answer.caseSensitive === false) attrs.push('case-sensitive="false"');
  else if (answer.caseSensitive === true) attrs.push('case-sensitive="true"');
  return `      <qti-map-entry ${attrs.join(" ")}/>`;
}

function buildResponseProcessing(responses: readonly Qti3TextEntryResponse[]): string {
  const scoredResponses = responses.filter((response) =>
    response.answers?.some((answer) => answer.value.trim().length > 0),
  );
  if (!scoredResponses.length) {
    return `  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-base-value base-type="float">0</qti-base-value>
    </qti-set-outcome-value>
  </qti-response-processing>`;
  }
  const conditions = scoredResponses
    .map((response) => {
      const responseIdentifier = escapeXmlAttribute(
        assertQtiIdentifier(response.responseIdentifier, "Text entry response identifier"),
      );
      return `  <qti-response-condition>
    <qti-response-if>
      <qti-not>
        <qti-is-null>
          <qti-variable identifier="${responseIdentifier}"/>
        </qti-is-null>
      </qti-not>
      <qti-set-outcome-value identifier="SCORE">
        <qti-sum>
          <qti-variable identifier="SCORE"/>
          <qti-map-response identifier="${responseIdentifier}"/>
        </qti-sum>
      </qti-set-outcome-value>
    </qti-response-if>
  </qti-response-condition>`;
    })
    .join("\n");
  return `  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-base-value base-type="float">0</qti-base-value>
    </qti-set-outcome-value>
${conditions}
  </qti-response-processing>`;
}

function normalizeScore(score?: number): number {
  if (score === undefined || Number.isNaN(score)) return 1;
  return score;
}

export function validateQti3TextEntryItem(
  input: Qti3TextEntryBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  if (!input.responses.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_text_entry_responses",
        "responses",
        "Text entry items must include at least one response.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      input.responses.map((response) => response.responseIdentifier),
      "responses",
      "Text entry response identifier",
    ),
  );

  for (const [index, response] of input.responses.entries()) {
    const identifierDiagnostic = validateQtiIdentifier(
      `responses.${index}.responseIdentifier`,
      "Text entry response identifier",
      response.responseIdentifier,
    );
    if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
    for (const [answerIndex, answer] of (response.answers ?? []).entries()) {
      if (answer.score !== undefined && !Number.isFinite(answer.score)) {
        diagnostics.push(
          writerDiagnostic(
            "invalid_text_entry_score",
            `responses.${index}.answers.${answerIndex}.score`,
            "Text entry answer score must be finite when provided.",
            answer.score,
          ),
        );
      }
    }
  }

  const bodyHtml = input.bodyHtml?.trim() ?? "";
  if (!bodyHtml) {
    diagnostics.push(
      writerDiagnostic(
        "missing_text_entry_body",
        "bodyHtml",
        "Text entry bodyHtml must include qti-text-entry-interaction elements.",
      ),
    );
    return diagnostics;
  }

  const interactions = extractTextEntryInteractionIdentifiers(bodyHtml);
  if (!interactions.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_text_entry_interaction",
        "bodyHtml",
        "Text entry bodyHtml must include at least one qti-text-entry-interaction.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(interactions, "bodyHtml", "Text entry interaction response identifier"),
  );

  const responseIdentifiers = new Set(
    input.responses.map((response) => response.responseIdentifier.trim()),
  );
  const interactionIdentifiers = new Set(interactions);
  for (const responseIdentifier of responseIdentifiers) {
    if (!interactionIdentifiers.has(responseIdentifier)) {
      diagnostics.push(
        writerDiagnostic(
          "missing_text_entry_interaction_for_response",
          "bodyHtml",
          `Text entry response "${responseIdentifier}" has no matching interaction in bodyHtml.`,
          responseIdentifier,
        ),
      );
    }
  }
  for (const [index, interactionIdentifier] of interactions.entries()) {
    if (!responseIdentifiers.has(interactionIdentifier)) {
      diagnostics.push(
        writerDiagnostic(
          "unknown_text_entry_interaction_response",
          `bodyHtml.interactions.${index}`,
          `Text entry interaction references undeclared response "${interactionIdentifier}".`,
          interactionIdentifier,
        ),
      );
    }
  }
  return diagnostics;
}

function extractTextEntryInteractionIdentifiers(bodyHtml: string): string[] {
  const identifiers: string[] = [];
  const interactionPattern = /<qti-text-entry-interaction\b[^>]*>/gi;
  const responseIdentifierPattern = /\bresponse-identifier\s*=\s*(["'])(.*?)\1/i;
  for (const match of bodyHtml.matchAll(interactionPattern)) {
    const tag = match[0];
    const responseIdentifier = responseIdentifierPattern.exec(tag)?.[2]?.trim();
    if (responseIdentifier) identifiers.push(responseIdentifier);
  }
  return identifiers;
}

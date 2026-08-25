import {
  isPositiveInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import { assertQtiIdentifier } from "./identifier.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { responseProcessingTemplateXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3UploadBuilderInput, Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export function buildQti3UploadItem(input: Qti3UploadBuilderInput): string {
  const diagnostics = validateQti3UploadItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3UploadItem(input);
}

export function renderQti3UploadItem(input: Qti3UploadBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Upload response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const correctResponse = input.correctResponse?.trim();
  const declarationsXml = uploadResponseDeclarationXml(escapedResponseIdentifier, correctResponse);
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: input.sharedVocabulary,
    interactionType: "upload",
    classNames: input.classNames,
    extraAttributes: [
      input.maxFileSize === undefined ? "" : `data-max-size="${String(input.maxFileSize)}"`,
      input.fileTypes?.trim()
        ? `data-file-types="${escapeXmlAttribute(input.fileTypes.trim())}"`
        : "",
      input.multiple ? `data-multiple="true"` : "",
    ],
  });
  const bodyXml = `${optionalBodySection(input.bodyHtml)}    <qti-upload-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}    </qti-upload-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: correctResponse ? responseProcessingTemplateXml("match_correct") : "",
    scoreDefaultZero: Boolean(correctResponse),
  });
}

export function validateQti3UploadItem(input: Qti3UploadBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Upload response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);

  if (input.maxFileSize !== undefined && !isPositiveInteger(input.maxFileSize)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_upload_max_file_size",
        "maxFileSize",
        "Upload maxFileSize must be a positive integer.",
        input.maxFileSize,
      ),
    );
  }
  if (input.correctResponse !== undefined && !input.correctResponse.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "empty_upload_correct_response",
        "correctResponse",
        "Upload correctResponse must not be empty when provided.",
      ),
    );
  }
  const scoring: string | undefined = input.scoring;
  if (scoring !== undefined && scoring !== "match_correct") {
    diagnostics.push(
      writerDiagnostic(
        "invalid_upload_scoring",
        "scoring",
        "Upload scoring must be match_correct when provided.",
        scoring,
      ),
    );
  }
  if (scoring === "match_correct" && !input.correctResponse?.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_upload_correct_response",
        "correctResponse",
        "Upload match_correct scoring requires correctResponse.",
      ),
    );
  }
  return diagnostics;
}

function uploadResponseDeclarationXml(
  responseIdentifier: string,
  correctResponse?: string,
): string {
  const parts = [
    `  <qti-response-declaration identifier="${responseIdentifier}" cardinality="single" base-type="file">`,
  ];
  if (correctResponse) {
    parts.push("    <qti-correct-response>");
    parts.push(`      <qti-value>${escapeXmlText(correctResponse)}</qti-value>`);
    parts.push("    </qti-correct-response>");
  }
  parts.push("  </qti-response-declaration>");
  return parts.join("\n");
}

import type { Qti3ResponseProcessingTemplate } from "./types.js";

const RESPONSE_PROCESSING_TEMPLATE_URIS = {
  match_correct: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct",
  map_response: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response",
} as const satisfies Record<Qti3ResponseProcessingTemplate, string>;

export function responseProcessingTemplateXml(template: Qti3ResponseProcessingTemplate): string {
  return `  <qti-response-processing template="${RESPONSE_PROCESSING_TEMPLATE_URIS[template]}"/>`;
}

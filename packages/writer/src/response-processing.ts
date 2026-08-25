import type {
  Qti3PointResponseProcessingTemplate,
  Qti3ResponseProcessingTemplate,
  Qti3TrustedXmlFragment,
} from "./types.js";
import { indentXml, escapeXmlAttribute } from "./xml.js";

const RESPONSE_PROCESSING_TEMPLATE_URIS = {
  match_correct: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct",
  map_response: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response",
} as const satisfies Record<Qti3ResponseProcessingTemplate, string>;

const POINT_RESPONSE_PROCESSING_TEMPLATE_URIS = {
  map_response_point: "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response_point",
} as const satisfies Record<Qti3PointResponseProcessingTemplate, string>;

export function responseProcessingTemplateXml(
  template: Qti3ResponseProcessingTemplate | Qti3PointResponseProcessingTemplate,
): string {
  if (template === "map_response_point") {
    return `  <qti-response-processing template="${POINT_RESPONSE_PROCESSING_TEMPLATE_URIS[template]}"/>`;
  }
  return `  <qti-response-processing template="${RESPONSE_PROCESSING_TEMPLATE_URIS[template]}"/>`;
}

export function mapResponsePointProcessingXml(responseIdentifier: string): string {
  const identifier = escapeXmlAttribute(responseIdentifier);
  return `  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-map-response-point identifier="${identifier}"/>
    </qti-set-outcome-value>
  </qti-response-processing>`;
}

export function mapResponseProcessingXml(responseIdentifier: string): string {
  const identifier = escapeXmlAttribute(responseIdentifier);
  return `  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-map-response identifier="${identifier}"/>
    </qti-set-outcome-value>
  </qti-response-processing>`;
}

export function matchCorrectProcessingXml(responseIdentifier: string): string {
  const identifier = escapeXmlAttribute(responseIdentifier);
  return `  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="${identifier}"/>
          <qti-correct identifier="${identifier}"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>`;
}

export function trustedResponseProcessingXml(xml: Qti3TrustedXmlFragment | undefined): string {
  const raw = stripXmlDeclaration(xml ?? "").trim();
  if (!raw) return zeroScoreProcessingXml();
  const block = /^<\s*qti-response-processing\b/i.test(raw)
    ? raw
    : `<qti-response-processing>\n${raw}\n</qti-response-processing>`;
  return indentXml(block, 2);
}

export function sumMappedResponsesProcessingXml(responseIdentifiers: readonly string[]): string {
  const ids = uniqueIdentifiers(responseIdentifiers);
  if (!ids.length) return zeroScoreProcessingXml();
  const conditions = ids
    .map((id) => {
      const responseIdentifier = escapeXmlAttribute(id);
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

export function allOrNothingCorrectProcessingXml(
  responseIdentifiers: readonly string[],
  score: number,
): string {
  const ids = uniqueIdentifiers(responseIdentifiers);
  const scoreValue = Number.isFinite(score) ? score : 0;
  if (!ids.length || scoreValue <= 0) return zeroScoreProcessingXml();
  const conditions = ids
    .map((id) => {
      const responseIdentifier = escapeXmlAttribute(id);
      return `      <qti-not>
        <qti-is-null>
          <qti-variable identifier="${responseIdentifier}"/>
        </qti-is-null>
      </qti-not>
      <qti-match>
        <qti-variable identifier="${responseIdentifier}"/>
        <qti-correct identifier="${responseIdentifier}"/>
      </qti-match>`;
    })
    .join("\n");
  return `  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-base-value base-type="float">0</qti-base-value>
    </qti-set-outcome-value>
  <qti-response-condition>
    <qti-response-if>
      <qti-and>
${conditions}
      </qti-and>
      <qti-set-outcome-value identifier="SCORE">
        <qti-base-value base-type="float">${String(scoreValue)}</qti-base-value>
      </qti-set-outcome-value>
    </qti-response-if>
  </qti-response-condition>
  </qti-response-processing>`;
}

function zeroScoreProcessingXml(): string {
  return `  <qti-response-processing>
    <qti-set-outcome-value identifier="SCORE">
      <qti-base-value base-type="float">0</qti-base-value>
    </qti-set-outcome-value>
  </qti-response-processing>`;
}

function stripXmlDeclaration(xml: string): string {
  return xml.replace(/^<\?xml[^>]*\?>\s*/i, "").trim();
}

function uniqueIdentifiers(values: readonly string[]): string[] {
  const identifiers: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const identifier = value.trim();
    if (!identifier || seen.has(identifier)) continue;
    seen.add(identifier);
    identifiers.push(identifier);
  }
  return identifiers;
}

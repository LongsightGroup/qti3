import { interactionSupport, type QtiInteractionType, type QtiValue } from "@qti3/core";

export interface QtiFixtureAttempt {
  name: string;
  responses: Record<string, QtiValue>;
  expectedOutcomes: Record<string, QtiValue>;
}

export interface QtiFixture {
  id: string;
  interactionType: QtiInteractionType;
  qtiName: string;
  title: string;
  xml: string;
  attempts: QtiFixtureAttempt[];
}

export const interactionFixtures: QtiFixture[] = interactionSupport.map((support) =>
  createInteractionFixture(support.interactionType, support.qtiName),
);

export function getFixtureById(id: string): QtiFixture | undefined {
  return interactionFixtures.find((fixture) => fixture.id === id);
}

function createInteractionFixture(
  interactionType: QtiInteractionType,
  qtiName: string,
): QtiFixture {
  const id = `${interactionType}-reference`;
  const response = defaultResponse(interactionType);
  const body = renderInteractionXml(qtiName, interactionType);

  return {
    id,
    interactionType,
    qtiName,
    title: `${interactionType} reference fixture`,
    xml: assessmentItem(id, response, body),
    attempts: [
      {
        name: "correct",
        responses: response.identifier ? { [response.identifier]: response.correct } : {},
        expectedOutcomes: response.identifier ? { SCORE: 1 } : { SCORE: "0" },
      },
    ],
  };
}

function assessmentItem(
  identifier: string,
  response: { identifier?: string; cardinality: string; baseType: string; correct: QtiValue },
  interactionXml: string,
): string {
  const responseDeclaration = response.identifier
    ? `
      <qti-response-declaration identifier="${response.identifier}" cardinality="${response.cardinality}" base-type="${response.baseType}">
        <qti-correct-response>${valuesXml(response.correct)}</qti-correct-response>
      </qti-response-declaration>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="${identifier}" title="${identifier}" time-dependent="false" xml:lang="en">
  ${responseDeclaration}
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>Reference item for ${identifier}.</p>
    ${interactionXml}
  </qti-item-body>
</qti-assessment-item>`;
}

function valuesXml(value: QtiValue): string {
  if (Array.isArray(value))
    return value.map((item) => `<qti-value>${escapeXml(item)}</qti-value>`).join("");
  return `<qti-value>${escapeXml(String(value ?? ""))}</qti-value>`;
}

function defaultResponse(interactionType: QtiInteractionType): {
  identifier?: string;
  cardinality: string;
  baseType: string;
  correct: QtiValue;
} {
  if (interactionType === "endAttempt" || interactionType === "media") {
    return { cardinality: "single", baseType: "identifier", correct: null };
  }
  if (
    interactionType === "order" ||
    interactionType === "graphicOrder" ||
    interactionType === "associate" ||
    interactionType === "graphicAssociate" ||
    interactionType === "gapMatch" ||
    interactionType === "graphicGapMatch" ||
    interactionType === "match" ||
    interactionType === "choice"
  ) {
    return {
      identifier: "RESPONSE",
      cardinality: "multiple",
      baseType: "identifier",
      correct: ["A"],
    };
  }
  if (interactionType === "slider") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "integer", correct: "50" };
  }
  if (interactionType === "selectPoint" || interactionType === "hotspot") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "identifier", correct: "A" };
  }
  if (interactionType === "positionObject") {
    return { identifier: "RESPONSE", cardinality: "single", baseType: "point", correct: "10 10" };
  }
  if (interactionType === "upload") {
    return {
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "file",
      correct: "upload.txt",
    };
  }
  return { identifier: "RESPONSE", cardinality: "single", baseType: "string", correct: "A" };
}

function renderInteractionXml(qtiName: string, interactionType: QtiInteractionType): string {
  if (interactionType === "endAttempt") {
    return `<${qtiName} title="End attempt"/>`;
  }
  if (interactionType === "media") {
    return `<${qtiName} response-identifier="RESPONSE" autostart="false"><object data="media.mp3" type="audio/mpeg"/></${qtiName}>`;
  }
  if (interactionType === "slider") {
    return `<${qtiName} response-identifier="RESPONSE" lower-bound="0" upper-bound="100" step="1"/>`;
  }
  if (interactionType === "extendedText") {
    return `<${qtiName} response-identifier="RESPONSE" expected-lines="4"><qti-prompt>Write A.</qti-prompt></${qtiName}>`;
  }
  if (interactionType === "textEntry") {
    return `<p>Type <${qtiName} response-identifier="RESPONSE" expected-length="10"/>.</p>`;
  }
  if (interactionType === "inlineChoice") {
    return `<p>Choose <${qtiName} response-identifier="RESPONSE"><qti-inline-choice identifier="A">A</qti-inline-choice><qti-inline-choice identifier="B">B</qti-inline-choice></${qtiName}>.</p>`;
  }
  if (interactionType === "hottext") {
    return `<${qtiName} response-identifier="RESPONSE"><p><qti-hottext identifier="A">A</qti-hottext> <qti-hottext identifier="B">B</qti-hottext></p></${qtiName}>`;
  }
  if (interactionType === "hotspot") {
    return `<${qtiName} response-identifier="RESPONSE"><object data="image.png" type="image/png"/><qti-hotspot-choice identifier="A" shape="rect" coords="0,0,50,50"/></${qtiName}>`;
  }
  if (interactionType === "selectPoint") {
    return `<${qtiName} response-identifier="RESPONSE"><object data="image.png" type="image/png"/></${qtiName}>`;
  }
  if (interactionType === "positionObject") {
    return `<${qtiName} response-identifier="RESPONSE"><object data="image.png" type="image/png"/></${qtiName}>`;
  }
  if (interactionType === "upload") {
    return `<${qtiName} response-identifier="RESPONSE"/>`;
  }
  if (
    interactionType === "custom" ||
    interactionType === "portableCustom" ||
    interactionType === "drawing"
  ) {
    return `<${qtiName} response-identifier="RESPONSE"><qti-prompt>Enter A.</qti-prompt></${qtiName}>`;
  }
  if (
    interactionType === "match" ||
    interactionType === "associate" ||
    interactionType === "graphicAssociate"
  ) {
    return `<${qtiName} response-identifier="RESPONSE"><qti-simple-match-set><qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice><qti-simple-associable-choice identifier="B" match-max="1">B</qti-simple-associable-choice></qti-simple-match-set></${qtiName}>`;
  }
  if (interactionType === "gapMatch" || interactionType === "graphicGapMatch") {
    return `<${qtiName} response-identifier="RESPONSE"><qti-gap-text identifier="A" match-max="1">A</qti-gap-text><p><qti-gap identifier="G1"/></p></${qtiName}>`;
  }
  return `<${qtiName} response-identifier="RESPONSE"><qti-simple-choice identifier="A">A</qti-simple-choice><qti-simple-choice identifier="B">B</qti-simple-choice></${qtiName}>`;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

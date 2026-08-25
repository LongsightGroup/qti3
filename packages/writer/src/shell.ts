import type { Qti3AuthoringItemBase } from "./types.js";
import { assertQtiIdentifier } from "./identifier.js";
import { escapeXmlAttribute, xmlLines } from "./xml.js";

export interface AssessmentItemShellInput extends Qti3AuthoringItemBase {
  readonly declarationsXml: string;
  readonly bodyXml: string;
  readonly responseProcessingXml: string;
  readonly companionMaterialsXml?: string | undefined;
  readonly scoreDefaultZero?: boolean | undefined;
}

export function assessmentItemShell(input: AssessmentItemShellInput): string {
  const identifier = escapeXmlAttribute(
    assertQtiIdentifier(input.identifier, "Assessment item identifier"),
  );
  const title = escapeXmlAttribute(input.title.trim() || "Untitled");
  const lang = escapeXmlAttribute(input.lang ?? "en-US");
  const outcomeDeclarationXml = input.scoreDefaultZero
    ? `  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>`
    : `  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>`;
  return xmlLines([
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<qti-assessment-item`,
    `  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"`,
    `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqtiasi_v3p0`,
    `    https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0p1_v1p0.xsd"`,
    `  identifier="${identifier}" title="${title}" time-dependent="false" xml:lang="${lang}">`,
    input.declarationsXml,
    outcomeDeclarationXml,
    input.companionMaterialsXml,
    `  <qti-item-body>`,
    input.bodyXml,
    `  </qti-item-body>`,
    input.responseProcessingXml,
    `</qti-assessment-item>`,
  ]);
}

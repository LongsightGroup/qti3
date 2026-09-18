import {
  validateQtiTest,
  serializeProcessingExpression,
  type QtiTestDefinition,
  type QtiTestResult,
  type QtiProcessingExpression,
  type QtiTestItemRef,
} from "@longsightgroup/qti3-core";
import { escapeXmlText, xmlAttributes } from "./xml.js";

/** Write the supported finite QTI test profile, returning validation diagnostics on failure. */
export function writeQti3AssessmentTest(test: QtiTestDefinition): QtiTestResult<string> {
  const validated = validateQtiTest(test);
  if (!validated.ok) return validated;
  const expression = (value: QtiProcessingExpression): string => {
    const result = serializeProcessingExpression(value);
    if (!result.ok || result.xml === undefined)
      throw new Error("Validated test expression could not be serialized.");
    return result.xml;
  };
  const declarations = test.outcomeDeclarations.map(
    (d) =>
      `<qti-outcome-declaration${xmlAttributes({ identifier: d.identifier, cardinality: d.cardinality, "base-type": d.baseType })}>${d.defaultValue === null ? "" : `<qti-default-value><qti-value>${scalarText(d.defaultValue)}</qti-value></qti-default-value>`}</qti-outcome-declaration>`,
  );
  const sections = test.sections.map(
    (s) =>
      `<qti-assessment-section${xmlAttributes({ identifier: s.identifier, title: s.title, visible: true })}>${s.branches.map((b) => `<qti-branch-rule${xmlAttributes({ target: b.target })}>${expression(b.expression)}</qti-branch-rule>`).join("\n")}${s.items.map(writeTestItemRef).join("\n")}</qti-assessment-section>`,
  );
  const processing = test.outcomeProcessing.length
    ? `<qti-outcome-processing>${test.outcomeProcessing.map((r) => `<qti-set-outcome-value${xmlAttributes({ identifier: r.identifier })}>${expression(r.expression)}</qti-set-outcome-value>`).join("\n")}</qti-outcome-processing>`
    : "";
  return {
    ok: true,
    value: testDocument(test, [
      ...declarations,
      `<qti-test-part${xmlAttributes({ identifier: test.partIdentifier, "navigation-mode": "linear", "submission-mode": "individual" })}>`,
      ...sections,
      "</qti-test-part>",
      processing,
    ]),
  };
}

function scalarText(value: import("@longsightgroup/qti3-core").QtiValue): string {
  if (value === null || typeof value === "object")
    throw new Error("Validated test default must be scalar.");
  return escapeXmlText(String(value));
}

export function writeTestItemRef(item: QtiTestItemRef): string {
  return `<qti-assessment-item-ref${xmlAttributes({ identifier: item.identifier, href: item.href, category: item.categories.length ? item.categories.join(" ") : undefined })}/>`;
}

export function testDocument(
  test: { readonly identifier: string; readonly title: string },
  children: readonly string[],
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"${xmlAttributes({ identifier: test.identifier, title: test.title })}>`,
    ...children,
    "</qti-assessment-test>",
  ].join("\n");
}

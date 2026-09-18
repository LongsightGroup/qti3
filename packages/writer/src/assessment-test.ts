import {
  validateQtiTest,
  serializeTestExpression,
  type QtiTestDefinition,
  type QtiTestResult,
  type QtiTestItemRef,
} from "@longsightgroup/qti3-core";
import { escapeXmlText, xmlAttributes } from "./xml.js";

/** Write the supported finite QTI test profile, returning validation diagnostics on failure. */
export function writeQti3AssessmentTest(definition: QtiTestDefinition): QtiTestResult<string> {
  const validated = validateQtiTest(definition);
  if (!validated.ok) return validated;
  const test = validated.value;
  const declarations = test.outcomeDeclarations.map(
    (d) =>
      `<qti-outcome-declaration${xmlAttributes({ identifier: d.identifier, cardinality: d.cardinality, "base-type": d.baseType })}>${d.defaultValue === null ? "" : `<qti-default-value><qti-value>${escapeXmlText(String(d.defaultValue))}</qti-value></qti-default-value>`}</qti-outcome-declaration>`,
  );
  const sections: string[] = [];
  for (const section of test.sections) {
    const branches: string[] = [];
    for (const branch of section.branches) {
      const expression = serializeTestExpression(branch.expression);
      if (!expression.ok) return expression;
      branches.push(
        `<qti-branch-rule${xmlAttributes({ target: branch.target })}>${expression.value}</qti-branch-rule>`,
      );
    }
    sections.push(
      `<qti-assessment-section${xmlAttributes({ identifier: section.identifier, title: section.title, visible: true })}>${branches.join("\n")}${section.items.map(writeTestItemRef).join("\n")}</qti-assessment-section>`,
    );
  }
  const rules: string[] = [];
  for (const rule of test.outcomeProcessing) {
    const expression = serializeTestExpression(rule.expression);
    if (!expression.ok) return expression;
    rules.push(
      `<qti-set-outcome-value${xmlAttributes({ identifier: rule.identifier })}>${expression.value}</qti-set-outcome-value>`,
    );
  }
  const processing = rules.length
    ? `<qti-outcome-processing>${rules.join("\n")}</qti-outcome-processing>`
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

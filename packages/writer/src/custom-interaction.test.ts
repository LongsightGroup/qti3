import { describe, expect, it } from "vitest";

import {
  buildQti3CustomInteractionItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItemAllowingDiagnostics } from "./test-helpers.js";

const CUSTOM_DEPRECATED_DIAGNOSTIC_CODES = ["interaction.deprecated"] as const;

describe("qti3 custom interaction writer", () => {
  it("writes a trusted legacy custom interaction with attributes and response processing", () => {
    const xml = buildQti3CustomInteractionItem({
      identifier: "custom-1",
      title: "Custom Interaction",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the widget.</p>"),
      promptHtml: qti3TrustedXmlFragment("Answer with the widget."),
      responseIdentifier: "RESPONSE",
      responseBaseType: "string",
      responseCardinality: "single",
      definition: "https://example.com/custom",
      classNames: ["customWidget", "customWidget"],
      attributes: [{ name: "data-mode", value: "alpha" }],
      interactionMarkupHtml: qti3TrustedXmlFragment(
        '<div class="widget">Hello <span data-value="42">there</span></div>',
      ),
      responseProcessingXml: qti3TrustedXmlFragment(
        '<qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value></qti-response-processing>',
      ),
    });

    expect(xml).toContain("<qti-custom-interaction");
    expect(xml).toContain('definition="https://example.com/custom"');
    expect(xml).toContain('class="customWidget"');
    expect(xml).toContain('data-mode="alpha"');
    expect(xml).toContain("<qti-set-outcome-value");

    const item = expectValidParsedItemAllowingDiagnostics(xml, CUSTOM_DEPRECATED_DIAGNOSTIC_CODES);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "string",
    });
    expect(item.interactions[0]).toMatchObject({
      type: "custom",
      qtiName: "qti-custom-interaction",
      responseIdentifier: "RESPONSE",
      prompt: "Answer with the widget.",
    });
    expect(item.interactions[0]?.customInteraction).toMatchObject({
      dataAttributes: { "data-mode": "alpha" },
    });
    expect(item.interactions[0]?.customInteraction?.interactionMarkupRaw).toContain(
      '<div class="widget">Hello <span data-value="42">there</span></div>',
    );
  });

  it("uses zero-score response processing when none is provided", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-default-processing",
      title: "Custom Interaction",
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
    });

    expect(xml).toContain("<qti-set-outcome-value");
    const item = expectValidParsedItemAllowingDiagnostics(xml, CUSTOM_DEPRECATED_DIAGNOSTIC_CODES);
    expect(item.interactions[0]?.qtiName).toBe("qti-custom-interaction");
  });

  it("wraps trusted response processing expressions", () => {
    const xml = buildQti3CustomInteractionItem({
      identifier: "custom-processing-expression",
      title: "Custom Interaction",
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
      responseProcessingXml: qti3TrustedXmlFragment(
        '<qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>',
      ),
    });

    expect(xml).toContain("<qti-response-processing>");
    expect(xml).toContain("<qti-set-outcome-value");
    expectValidParsedItemAllowingDiagnostics(xml, CUSTOM_DEPRECATED_DIAGNOSTIC_CODES);
  });

  it("returns diagnostics for invalid custom authoring input", () => {
    expect(() =>
      buildQti3CustomInteractionItem({
        identifier: "bad custom",
        title: "",
        responseIdentifier: "bad response",
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
        responseBaseType: "json" as "string",
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
        responseCardinality: "list" as "single",
        attributes: [
          { name: "", value: "empty" },
          { name: "data mode", value: "bad" },
          { name: "class", value: "reserved" },
          { name: "data-mode", value: "alpha" },
          { name: "data-mode", value: "beta" },
        ],
        interactionMarkupHtml: qti3TrustedXmlFragment(""),
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "custom",
      identifier: "bad custom",
      title: "",
      responseIdentifier: "bad response",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
      responseBaseType: "json" as "string",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
      responseCardinality: "list" as "single",
      attributes: [
        { name: "", value: "empty" },
        { name: "data mode", value: "bad" },
        { name: "class", value: "reserved" },
        { name: "data-mode", value: "alpha" },
        { name: "data-mode", value: "beta" },
      ],
      interactionMarkupHtml: qti3TrustedXmlFragment(""),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "invalid_identifier",
          "missing_title",
          "invalid_custom_response_base_type",
          "invalid_custom_response_cardinality",
          "missing_custom_attribute_name",
          "invalid_custom_attribute_name",
          "reserved_custom_attribute_name",
          "duplicate_identifier",
          "missing_custom_interaction_markup",
        ]),
      );
      expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    }
  });
});

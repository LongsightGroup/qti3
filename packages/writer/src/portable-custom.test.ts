import { describe, expect, it } from "vitest";

import {
  buildQti3PortableCustomItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 portable custom writer", () => {
  it("writes portable custom launch metadata, modules, and trusted markup", () => {
    const xml = buildQti3PortableCustomItem({
      identifier: "pci-1",
      title: "Portable Custom",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the custom widget.</p>"),
      promptHtml: qti3TrustedXmlFragment("Answer with the widget."),
      responseIdentifier: "RESPONSE",
      responseBaseType: "string",
      responseCardinality: "single",
      customInteractionTypeIdentifier: "urn:qti3:fixture:portable-custom",
      module: "pciModule",
      label: "PCI label",
      classNames: ["pci-class"],
      dataAttributes: [{ name: "data-mode", value: "preview" }],
      interactionModules: {
        primaryConfiguration: "modules/module_resolution.js",
        secondaryConfiguration: "modules/fallback_module_resolution.js",
        modules: [
          {
            id: "helper",
            primaryPath: "modules/helper.js",
            fallbackPath: "modules/helper-fallback.js",
          },
        ],
      },
      interactionMarkupHtml: qti3TrustedXmlFragment(
        '<div class="widget"><span data-value="42">Ready</span></div>',
      ),
      responseProcessingXml: qti3TrustedXmlFragment(
        '<qti-response-processing><qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value></qti-response-processing>',
      ),
    });

    expect(xml).toContain("<qti-portable-custom-interaction");
    expect(xml).toContain('custom-interaction-type-identifier="urn:qti3:fixture:portable-custom"');
    expect(xml).toContain('module="pciModule"');
    expect(xml).toContain("<qti-interaction-modules");
    expect(xml).toContain("<qti-interaction-markup>");

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "single",
      baseType: "string",
    });
    expect(item.interactions[0]).toMatchObject({
      type: "portableCustom",
      qtiName: "qti-portable-custom-interaction",
      responseIdentifier: "RESPONSE",
      prompt: "Answer with the widget.",
    });
    expect(item.interactions[0]?.portableCustom).toMatchObject({
      customInteractionTypeIdentifier: "urn:qti3:fixture:portable-custom",
      module: "pciModule",
      dataAttributes: { "data-mode": "preview" },
      interactionModules: {
        primaryConfiguration: "modules/module_resolution.js",
        secondaryConfiguration: "modules/fallback_module_resolution.js",
        modules: [
          {
            id: "helper",
            primaryPath: "modules/helper.js",
            fallbackPath: "modules/helper-fallback.js",
          },
        ],
      },
    });
    expect(item.interactions[0]?.portableCustom?.interactionMarkupRaw).toContain(
      '<div class="widget"><span data-value="42">Ready</span></div>',
    );
  });

  it("supports unified writer with module attribute and default zero-score processing", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "portableCustom",
      identifier: "pci-default-processing",
      title: "Portable Custom",
      customInteractionTypeIdentifier: "urn:qti3:fixture:portable-custom",
      module: "pciModule",
    });

    expect(xml).toContain("<qti-set-outcome-value");
    const item = expectValidParsedItem(xml);
    expect(item.interactions[0]?.qtiName).toBe("qti-portable-custom-interaction");
    expect(item.interactions[0]?.portableCustom?.module).toBe("pciModule");
  });

  it("returns diagnostics for invalid portable custom input", () => {
    expect(() =>
      buildQti3PortableCustomItem({
        identifier: "bad pci",
        title: "",
        responseIdentifier: "bad response",
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
        responseBaseType: "json" as "string",
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
        responseCardinality: "list" as "single",
        customInteractionTypeIdentifier: "",
        module: "bad module",
        dataAttributes: [
          { name: "", value: "empty" },
          { name: "data mode", value: "bad" },
          { name: "aria-label", value: "bad" },
          { name: "data-mode", value: "alpha" },
          { name: "data-mode", value: "beta" },
        ],
        interactionModules: {
          primaryConfiguration: "modules/module_resolution.js",
          modules: [
            { id: "", primaryPath: "modules/empty.js" },
            { id: "bad module", primaryPath: "modules/bad.js" },
            { id: "dup", primaryPath: "modules/dup-a.js" },
            { id: "dup", primaryPath: "modules/dup-b.js" },
          ],
        },
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "portableCustom",
      identifier: "bad pci",
      title: "",
      responseIdentifier: "bad response",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
      responseBaseType: "json" as "string",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate invalid runtime value.
      responseCardinality: "list" as "single",
      customInteractionTypeIdentifier: "",
      module: "bad module",
      dataAttributes: [
        { name: "", value: "empty" },
        { name: "data mode", value: "bad" },
        { name: "aria-label", value: "bad" },
        { name: "data-mode", value: "alpha" },
        { name: "data-mode", value: "beta" },
      ],
      interactionModules: {
        primaryConfiguration: "modules/module_resolution.js",
        modules: [
          { id: "", primaryPath: "modules/empty.js" },
          { id: "bad module", primaryPath: "modules/bad.js" },
          { id: "dup", primaryPath: "modules/dup-a.js" },
          { id: "dup", primaryPath: "modules/dup-b.js" },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "invalid_identifier",
          "missing_title",
          "invalid_portable_custom_response_base_type",
          "invalid_portable_custom_response_cardinality",
          "missing_portable_custom_type_identifier",
          "missing_portable_custom_module_id",
          "duplicate_identifier",
          "missing_portable_custom_data_attribute_name",
          "invalid_portable_custom_data_attribute_name",
          "invalid_portable_custom_data_attribute_prefix",
        ]),
      );
      expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    }
  });

  it("requires interaction modules when module configuration is provided", () => {
    const result = writeQti3AssessmentItemResult({
      interactionType: "portableCustom",
      identifier: "pci-config-no-modules",
      title: "Portable Custom",
      customInteractionTypeIdentifier: "urn:qti3:fixture:portable-custom",
      interactionModules: {
        primaryConfiguration: "modules/module_resolution.js",
        modules: [],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "missing_portable_custom_module",
          "missing_portable_custom_modules",
        ]),
      );
    }
  });
});

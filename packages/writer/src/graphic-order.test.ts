import { describe, expect, it } from "vitest";

import {
  buildQti3GraphicOrderItem,
  qti3TrustedXmlFragment,
  validateQti3GraphicOrderItem,
  writeQti3AssessmentItem,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 graphic order writer", () => {
  it("writes a valid graphic order item with object metadata and hotspot order", () => {
    const xml = buildQti3GraphicOrderItem({
      identifier: "graphic-order-1",
      title: "Graphic Order",
      bodyHtml: qti3TrustedXmlFragment("<p>Order the regions.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Select regions in workflow order.</p>"),
      responseIdentifier: "RESPONSE",
      object: {
        data: "flow.svg",
        alt: "Workflow diagram",
        type: "image/svg+xml",
        width: 480,
        height: 300,
        longDescription: "Workflow regions from left to right.",
      },
      hotspots: [
        { identifier: "A", shape: "rect", coords: "24,52,136,124", hotspotLabel: "Plan" },
        { identifier: "B", shape: "rect", coords: "184,52,296,124", hotspotLabel: "Collect" },
        { identifier: "C", shape: "rect", coords: "344,52,456,124", hotspotLabel: "Analyze" },
      ],
      correctOrder: ["A", "B", "C"],
      minChoices: 1,
      maxChoices: 3,
    });

    expect(xml).toContain("<qti-graphic-order-interaction");
    expect(xml).toContain('cardinality="ordered"');
    expect(xml).toContain('base-type="identifier"');
    expect(xml).toContain('min-choices="1"');
    expect(xml).toContain('max-choices="3"');
    expect(xml).toContain('data-qti-aria-describedby="longdesc-graphic-order-1"');
    expect(xml).toContain('hotspot-label="Plan"');
    expect(xml).toContain("rptemplates/match_correct");

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "RESPONSE",
      cardinality: "ordered",
      baseType: "identifier",
      correctResponse: ["A", "B", "C"],
    });
    expect(item.interactions[0]).toMatchObject({
      type: "graphicOrder",
      qtiName: "qti-graphic-order-interaction",
      responseIdentifier: "RESPONSE",
    });
    expect(item.interactions[0]?.object).toMatchObject({
      data: "flow.svg",
      type: "image/svg+xml",
      width: "480",
      height: "300",
    });
    expect(item.interactions[0]?.choices.map((choice) => choice.identifier)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("defaults correct order to hotspot order through the unified writer", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "graphicOrder",
      identifier: "graphic-order-default",
      title: "Graphic Order",
      responseIdentifier: "RESPONSE",
      object: { data: "map.png", alt: "Map", width: 200, height: 100 },
      hotspots: [
        { identifier: "First", shape: "circle", coords: "25,25,10" },
        { identifier: "Second", shape: "circle", coords: "75,25,10" },
      ],
    });

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]?.correctResponse).toEqual(["First", "Second"]);
  });

  it("requires explicit correct order to cover every hotspot unless subset bounds are configured", () => {
    const base = {
      identifier: "graphic-order-subset",
      title: "Graphic Order",
      responseIdentifier: "RESPONSE",
      object: { data: "map.png", alt: "Map", width: 200, height: 100 },
      hotspots: [
        { identifier: "A", shape: "circle" as const, coords: "25,25,10" },
        { identifier: "B", shape: "circle" as const, coords: "75,25,10" },
        { identifier: "C", shape: "circle" as const, coords: "125,25,10" },
      ],
      correctOrder: ["A", "B"],
    };

    expect(validateQti3GraphicOrderItem(base).map((diagnostic) => diagnostic.code)).toContain(
      "incomplete_graphic_order_correct_order",
    );
    expect(
      validateQti3GraphicOrderItem({ ...base, maxChoices: 2 }).map((diagnostic) => diagnostic.code),
    ).not.toContain("incomplete_graphic_order_correct_order");
  });

  it("reports diagnostics for invalid graphic order input", () => {
    const diagnostics = validateQti3GraphicOrderItem({
      identifier: "bad graphic order",
      title: "",
      responseIdentifier: "bad response",
      object: { data: "/uploads/no-extension" },
      hotspots: [
        { identifier: "A", shape: "rect", coords: "" },
        { identifier: "A", shape: "circle", coords: "1,1,2" },
      ],
      correctOrder: ["A", "UNKNOWN", "A"],
      minChoices: 2,
      maxChoices: 1,
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_title",
        "missing_graphic_order_object_alt",
        "unknown_graphic_order_object_type",
        "duplicate_identifier",
        "missing_graphic_order_coords",
        "invalid_graphic_order_bounds",
        "duplicate_identifier",
        "unknown_graphic_order_reference",
      ]),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
  });
});

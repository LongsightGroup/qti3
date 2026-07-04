import { describe, expect, it } from "vitest";

import {
  buildQti3DrawingItem,
  qti3TrustedXmlFragment,
  writeQti3AssessmentItem,
  writeQti3AssessmentItemResult,
  Qti3WriterError,
} from "./index.js";
import { expectValidParsedItem } from "./test-helpers.js";

describe("qti3 drawing writer", () => {
  it("writes a drawing interaction with accessible object metadata", () => {
    const xml = buildQti3DrawingItem({
      identifier: "drawing-1",
      title: "Drawing",
      bodyHtml: qti3TrustedXmlFragment("<p>Mark up the canvas.</p>"),
      promptHtml: qti3TrustedXmlFragment("<p>Annotate the key area.</p>"),
      responseIdentifier: "DRAWING",
      object: {
        data: "images/canvas.png",
        alt: "Canvas image",
        type: "image/png",
        width: 320,
        height: 200,
        longDescription: "A simple canvas image used for annotation.",
      },
      classNames: ["drawing-widget"],
    });

    expect(xml).toContain("<qti-drawing-interaction");
    expect(xml).toContain('base-type="file"');
    expect(xml).toContain('data="images/canvas.png"');
    expect(xml).toContain("data-qti-aria-describedby=");
    expect(xml).toContain("<qti-set-outcome-value");

    const item = expectValidParsedItem(xml);
    expect(item.responseDeclarations[0]).toMatchObject({
      identifier: "DRAWING",
      cardinality: "single",
      baseType: "file",
    });
    expect(item.interactions[0]).toMatchObject({
      type: "drawing",
      qtiName: "qti-drawing-interaction",
      responseIdentifier: "DRAWING",
      responseCardinality: "single",
      responseBaseType: "file",
      prompt: "Annotate the key area.",
    });
    expect(item.interactions[0]?.attributes).toMatchObject({
      class: "drawing-widget",
    });
    expect(item.interactions[0]?.object).toMatchObject({
      data: "images/canvas.png",
      type: "image/png",
      width: "320",
      height: "200",
      text: "Canvas image",
    });
  });

  it("supports unified writer with inferred object type", () => {
    const xml = writeQti3AssessmentItem({
      interactionType: "drawing",
      identifier: "drawing-unified",
      title: "Drawing",
      object: {
        data: "images/canvas.webp",
        alt: "Canvas image",
      },
    });

    expect(xml).toContain('type="image/webp"');
    const item = expectValidParsedItem(xml);
    expect(item.interactions[0]?.qtiName).toBe("qti-drawing-interaction");
  });

  it("returns diagnostics for invalid drawing input", () => {
    expect(() =>
      buildQti3DrawingItem({
        identifier: "bad drawing",
        title: "",
        responseIdentifier: "bad response",
        object: {
          data: "/uploads/no-extension",
          alt: "",
          type: "",
          width: 0,
          height: 1.5,
        },
      }),
    ).toThrow(Qti3WriterError);

    const result = writeQti3AssessmentItemResult({
      interactionType: "drawing",
      identifier: "bad drawing",
      title: "",
      responseIdentifier: "bad response",
      object: {
        data: "/uploads/no-extension",
        alt: "",
        width: 0,
        height: 1.5,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
        expect.arrayContaining([
          "invalid_identifier",
          "missing_title",
          "missing_drawing_object_alt",
          "unknown_drawing_object_type",
          "invalid_drawing_object_width",
          "invalid_drawing_object_height",
        ]),
      );
      expect(result.diagnostics.every((diagnostic) => diagnostic.path.length > 0)).toBe(true);
    }
  });
});

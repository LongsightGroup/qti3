import { describe, expect, it } from "vitest";
import {
  appendContentTextNode,
  choiceAccessibleLabel,
  flatTextFromContent,
  normalizeFlatText,
} from "./content-text.js";
import type { QtiChoice, QtiContentNode } from "./types.js";

describe("content-text", () => {
  it("drops block-layout indentation whitespace from QTI content", () => {
    const content: QtiContentNode[] = [];
    appendContentTextNode(content, "\n  ");
    expect(content).toEqual([]);
  });

  it("keeps inline boundary spaces that do not contain a newline", () => {
    const content: QtiContentNode[] = [];
    appendContentTextNode(content, "Note: The ");
    appendContentTextNode(content, " of the layout.");
    expect(content).toEqual([
      { kind: "text", text: "Note: The " },
      { kind: "text", text: " of the layout." },
    ]);
  });

  it("ignores empty text nodes", () => {
    const content: QtiContentNode[] = [];
    appendContentTextNode(content, "");
    expect(content).toEqual([]);
  });

  it("normalizes whitespace in flat text", () => {
    expect(normalizeFlatText("  one   two \n three ")).toBe("one two three");
  });

  it("extracts flat text from mixed content", () => {
    const nodes: QtiContentNode[] = [
      { kind: "text", text: "Order" },
      {
        kind: "element",
        qtiName: "math",
        attributes: {},
        children: [
          {
            kind: "element",
            qtiName: "semantics",
            attributes: {},
            children: [
              {
                kind: "element",
                qtiName: "mfrac",
                attributes: {},
                children: [
                  {
                    kind: "element",
                    qtiName: "mi",
                    attributes: {},
                    children: [{ kind: "text", text: "a" }],
                  },
                  {
                    kind: "element",
                    qtiName: "mi",
                    attributes: {},
                    children: [{ kind: "text", text: "b" }],
                  },
                ],
              },
              {
                kind: "element",
                qtiName: "annotation",
                attributes: { encoding: "SnuggleTeX" },
                children: [{ kind: "text", text: "\\[ \\frac{a}{b} \\]" }],
              },
            ],
          },
        ],
      },
      { kind: "text", text: "." },
    ];

    expect(flatTextFromContent(nodes)).toContain("\\[");
    expect(flatTextFromContent(nodes, { excludeAnnotations: true })).toBe("Order a b .");
  });

  it("prefers annotation-stripped content labels for choices", () => {
    const choice: QtiChoice = {
      identifier: "A",
      text: "legacy \\[ fallback \\]",
      content: [
        {
          kind: "element",
          qtiName: "math",
          attributes: {},
          children: [
            {
              kind: "element",
              qtiName: "semantics",
              attributes: {},
              children: [
                {
                  kind: "element",
                  qtiName: "mrow",
                  attributes: {},
                  children: [
                    {
                      kind: "element",
                      qtiName: "mi",
                      attributes: {},
                      children: [{ kind: "text", text: "cos" }],
                    },
                    {
                      kind: "element",
                      qtiName: "mi",
                      attributes: {},
                      children: [{ kind: "text", text: "Θ" }],
                    },
                  ],
                },
                {
                  kind: "element",
                  qtiName: "annotation",
                  attributes: { encoding: "SnuggleTeX" },
                  children: [{ kind: "text", text: "\\[ \\cos{\\theta} \\]" }],
                },
              ],
            },
          ],
        },
      ],
      role: "associableChoice",
      qtiName: "qti-simple-associable-choice",
      attributes: {},
    };

    expect(choiceAccessibleLabel(choice)).toBe("cos Θ");
    expect(choiceAccessibleLabel(undefined, "fallback")).toBe("fallback");
  });

  it("uses image alt text for flat content labels", () => {
    const nodes: QtiContentNode[] = [
      {
        kind: "element",
        qtiName: "img",
        attributes: { alt: "shaded square", src: "data:image/svg+xml,%3Csvg/%3E" },
        children: [],
      },
    ];

    expect(flatTextFromContent(nodes)).toBe("shaded square");
    expect(
      choiceAccessibleLabel({
        identifier: "A",
        text: "",
        content: nodes,
        role: "inlineChoice",
        qtiName: "qti-inline-choice",
        attributes: {},
      }),
    ).toBe("shaded square");
  });

  it("uses math alttext for flat content labels", () => {
    const nodes: QtiContentNode[] = [
      {
        kind: "element",
        qtiName: "math",
        attributes: { alttext: "two plus two" },
        children: [
          {
            kind: "element",
            qtiName: "mrow",
            attributes: {},
            children: [
              {
                kind: "element",
                qtiName: "mn",
                attributes: {},
                children: [{ kind: "text", text: "2" }],
              },
              {
                kind: "element",
                qtiName: "mo",
                attributes: {},
                children: [{ kind: "text", text: "+" }],
              },
              {
                kind: "element",
                qtiName: "mn",
                attributes: {},
                children: [{ kind: "text", text: "2" }],
              },
            ],
          },
        ],
      },
    ];

    expect(flatTextFromContent(nodes)).toBe("two plus two");
    expect(
      choiceAccessibleLabel({
        identifier: "B",
        text: "2 + 2",
        content: nodes,
        role: "inlineChoice",
        qtiName: "qti-inline-choice",
        attributes: {},
      }),
    ).toBe("two plus two");
  });

  it("uses object labels for flat content labels", () => {
    const nodes: QtiContentNode[] = [
      {
        kind: "element",
        qtiName: "object",
        attributes: { "object-label": "audio clip", data: "clip.mp3", type: "audio/mpeg" },
        children: [],
      },
    ];

    expect(flatTextFromContent(nodes)).toBe("audio clip");
  });
});

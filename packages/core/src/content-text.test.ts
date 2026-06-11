import { describe, expect, it } from "vitest";
import { choiceAccessibleLabel, flatTextFromContent, normalizeFlatText } from "./content-text.js";
import type { QtiChoice, QtiContentNode } from "./types.js";

describe("content-text", () => {
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
});

import { describe, expect, it } from "vitest";
import type {
  QtiBaseType,
  QtiCardinality,
  QtiDocument,
  QtiOutcomeDeclaration,
  QtiResponseDeclaration,
  QtiTemplateDeclaration,
  QtiValue,
} from "./types.js";
import {
  defaultValueForIdentifier,
  expressionBaseType,
  expressionIsOrdered,
  getResponseDeclaration,
  resolveVariableValue,
} from "./processing-variables.js";

describe("processing variable resolution", () => {
  it("resolves qti-variable values from the declared variable kind", () => {
    const responseDocument = documentWithDeclarations({
      responses: [responseDeclaration("SAME", null)],
    });
    const outcomeDocument = documentWithDeclarations({
      outcomes: [outcomeDeclaration("SAME", null)],
    });
    const templateDocument = documentWithDeclarations({
      templates: [templateDeclaration("SAME", null)],
    });

    expect(
      resolveVariableValue(
        responseDocument,
        "SAME",
        { SAME: "response" },
        { SAME: "outcome" },
        { SAME: "template" },
      ),
    ).toBe("response");
    expect(
      resolveVariableValue(
        outcomeDocument,
        "SAME",
        { SAME: "response" },
        { SAME: "outcome" },
        { SAME: "template" },
      ),
    ).toBe("outcome");
    expect(
      resolveVariableValue(
        templateDocument,
        "SAME",
        { SAME: "response" },
        { SAME: "outcome" },
        { SAME: "template" },
      ),
    ).toBe("template");
    expect(resolveVariableValue(responseDocument, "MISSING", {}, {}, {})).toBeNull();
  });

  it("does not resolve undeclared variables from runtime stores", () => {
    const document = documentWithDeclarations({});

    expect(
      resolveVariableValue(
        document,
        "duration",
        { duration: 12.5 },
        { duration: 0 },
        { duration: 0 },
      ),
    ).toBeNull();
    expect(
      resolveVariableValue(document, "duration", {}, { duration: 0 }, { duration: 0 }),
    ).toBeNull();
  });

  it("resolves qti-default values from the matching declaration kind", () => {
    const document = documentWithDeclarations({
      responses: [responseDeclaration("RESPONSE", "response")],
      outcomes: [outcomeDeclaration("OUTCOME", "outcome")],
      templates: [templateDeclaration("TEMPLATE", "template")],
    });

    expect(defaultValueForIdentifier(document, "RESPONSE")).toBe("response");
    expect(defaultValueForIdentifier(document, "OUTCOME")).toBe("outcome");
    expect(defaultValueForIdentifier(document, "TEMPLATE")).toBe("template");
    expect(defaultValueForIdentifier(document, "MISSING")).toBeNull();
  });

  it("uses declaration kind when determining ordered variable comparisons", () => {
    const document = documentWithDeclarations({
      responses: [responseDeclaration("RESPONSE", null, "ordered")],
      outcomes: [outcomeDeclaration("OUTCOME", null, "ordered")],
      templates: [templateDeclaration("TEMPLATE", null, "single")],
    });

    expect(expressionIsOrdered({ type: "variable", identifier: "RESPONSE" }, document)).toBe(true);
    expect(expressionIsOrdered({ type: "variable", identifier: "OUTCOME" }, document)).toBe(true);
    expect(expressionIsOrdered({ type: "variable", identifier: "TEMPLATE" }, document)).toBe(false);
  });

  it("propagates declared base types and ordering through collection expressions", () => {
    const document = documentWithDeclarations({
      responses: [responseDeclaration("PAIRS", null, "ordered", "pair")],
    });
    const pairVariable = { type: "variable", identifier: "PAIRS" } as const;

    expect(expressionBaseType({ type: "index", expression: pairVariable, n: "1" }, document)).toBe(
      "pair",
    );
    expect(
      expressionBaseType(
        {
          type: "multiple",
          expressions: [
            { type: "baseValue", baseType: "pair", value: "A B" },
            { type: "baseValue", baseType: "pair", value: "C D" },
          ],
        },
        document,
      ),
    ).toBe("pair");
    expect(
      expressionBaseType(
        {
          type: "delete",
          value: { type: "baseValue", baseType: "pair", value: "A B" },
          collection: pairVariable,
        },
        document,
      ),
    ).toBe("pair");
    expect(
      expressionIsOrdered(
        {
          type: "delete",
          value: { type: "baseValue", baseType: "pair", value: "A B" },
          collection: pairVariable,
        },
        document,
      ),
    ).toBe(true);
  });

  it("reports qti-is-null as a scalar boolean expression", () => {
    const document = documentWithDeclarations({
      responses: [responseDeclaration("PAIRS", null, "ordered", "pair")],
    });
    const expression = {
      type: "isNull",
      expression: { type: "variable", identifier: "PAIRS" },
    } as const;

    expect(expressionBaseType(expression, document)).toBe("boolean");
    expect(expressionIsOrdered(expression, document)).toBe(false);
  });

  it("keeps response-only expression lookup scoped to response declarations", () => {
    const document = documentWithDeclarations({
      outcomes: [outcomeDeclaration("SCORE", 0)],
      templates: [templateDeclaration("TEMPLATE", "A")],
    });

    expect(getResponseDeclaration(document, "SCORE")).toBeUndefined();
    expect(getResponseDeclaration(document, "TEMPLATE")).toBeUndefined();
  });
});

function documentWithDeclarations({
  responses = [],
  outcomes = [],
  templates = [],
}: {
  responses?: QtiResponseDeclaration[];
  outcomes?: QtiOutcomeDeclaration[];
  templates?: QtiTemplateDeclaration[];
}): QtiDocument {
  return {
    diagnostics: [],
    item: {
      identifier: "item",
      adaptive: false,
      attributes: {},
      responseDeclarations: responses,
      outcomeDeclarations: outcomes,
      templateDeclarations: templates,
      interactions: [],
      modalFeedback: [],
      catalogReferences: [],
      stylesheets: [],
      body: [],
      bodyText: "",
    },
  };
}

function responseDeclaration(
  identifier: string,
  defaultValue: QtiValue,
  cardinality: QtiCardinality = "single",
  baseType: QtiBaseType = "identifier",
): QtiResponseDeclaration {
  return {
    kind: "response",
    identifier,
    cardinality,
    baseType,
    defaultValue,
    correctResponse: null,
    attributes: {},
  };
}

function outcomeDeclaration(
  identifier: string,
  defaultValue: QtiValue,
  cardinality: QtiCardinality = "single",
): QtiOutcomeDeclaration {
  return {
    kind: "outcome",
    identifier,
    cardinality,
    defaultValue,
    attributes: {},
  };
}

function templateDeclaration(
  identifier: string,
  defaultValue: QtiValue,
  cardinality: QtiCardinality = "single",
): QtiTemplateDeclaration {
  return {
    kind: "template",
    identifier,
    cardinality,
    defaultValue,
    attributes: {},
  };
}

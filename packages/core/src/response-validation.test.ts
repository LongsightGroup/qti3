import { describe, expect, it } from "vitest";
import { parseQtiXml, validateQtiResponseVariables, type QtiAssessmentItem } from "./index.js";

describe("QTI response variable validation", () => {
  it("validates single, multiple, ordered, and record cardinality", () => {
    const item = parsedItem(cardinalityItemXml());

    const valid = validateQtiResponseVariables({
      item,
      responses: {
        SINGLE: "A",
        MULTIPLE: ["A", "B"],
        ORDERED: ["B", "A"],
        RECORD: { score: 1 },
      },
    });
    expect(valid.ok).toBe(true);
    expect(valid.diagnostics).toEqual([]);

    const invalid = validateQtiResponseVariables({
      item,
      allowIncompleteResponses: true,
      responses: {
        SINGLE: ["A"],
        MULTIPLE: "A",
        ORDERED: "B",
        RECORD: "score",
      },
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.diagnostics).toEqual([
      expect.objectContaining({ code: "response.cardinality", identifier: "SINGLE" }),
      expect.objectContaining({ code: "response.cardinality", identifier: "MULTIPLE" }),
      expect.objectContaining({ code: "response.cardinality", identifier: "ORDERED" }),
      expect.objectContaining({ code: "response.cardinality", identifier: "RECORD" }),
    ]);
  });

  it.each([
    ["authored minimum", choiceBoundsItemXml(), "CHOICE"],
    ["required attribute", choiceItemXml({ required: true }), "CHOICE"],
  ] as const)(
    "reports missing interaction responses for %s unless incomplete responses are allowed",
    (_label, xml, identifier) => {
      const item = parsedItem(xml);

      const blocked = validateQtiResponseVariables({ item, responses: {} });
      expect(blocked.ok).toBe(false);
      expect(blocked.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "response.required",
          identifier,
        }),
      );

      const draft = validateQtiResponseVariables({
        item,
        responses: {},
        allowIncompleteResponses: true,
      });
      expect(draft.ok).toBe(true);
      expect(draft.diagnostics).toEqual([]);
    },
  );

  it("accepts submitted responses for required interactions without authored minimums", () => {
    const item = parsedItem(choiceItemXml({ required: true }));

    const submitted = validateQtiResponseVariables({
      item,
      responses: { CHOICE: "A" },
    });
    expect(submitted.ok).toBe(true);
    expect(submitted.diagnostics).toEqual([]);
  });

  it("does not require optional interactions without authored minimums or correct responses", () => {
    const item = parsedItem(choiceItemXml());

    const result = validateQtiResponseVariables({ item, responses: {} });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("treats explicit required=false as optional", () => {
    const item = parsedItem(choiceItemXml({ required: false }));

    const result = validateQtiResponseVariables({ item, responses: {} });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("requires a response for scored optional interactions without authored minimums", () => {
    const item = parsedItem(scoredOptionalChoiceItemXml());

    const result = validateQtiResponseVariables({ item, responses: {} });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "response.required",
        identifier: "CHOICE",
      }),
    );
  });

  it("applies required interaction validation beyond choice interactions", () => {
    const item = parsedItem(requiredExtendedTextItemXml());

    const result = validateQtiResponseVariables({ item, responses: {} });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "response.required",
        identifier: "TEXT",
      }),
    );
  });

  it("applies required media play defaults without authored min-plays", () => {
    const item = parsedItem(mediaItemXml({ required: true }));

    const blocked = validateQtiResponseVariables({ item, responses: {} });
    expect(blocked.ok).toBe(false);
    expect(blocked.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "response.required",
        identifier: "MEDIA",
      }),
    );

    const optional = parsedItem(mediaItemXml());
    expect(validateQtiResponseVariables({ item: optional, responses: {} }).ok).toBe(true);
  });

  it("rejects invalid required interaction attribute values at parse time", () => {
    const result = parseQtiXml(choiceItemXml({ required: "yes" }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "interaction.booleanAttribute" }),
    );
  });

  it("validates minChoices and maxChoices interaction bounds", () => {
    const item = parsedItem(choiceBoundsItemXml());

    const tooFew = validateQtiResponseVariables({
      item,
      responses: { CHOICE: ["A"] },
    });
    expect(tooFew.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.required", identifier: "CHOICE" }),
    );

    const tooMany = validateQtiResponseVariables({
      item,
      responses: { CHOICE: ["A", "B", "C", "D"] },
    });
    expect(tooMany.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.maximum", identifier: "CHOICE" }),
    );

    const valid = validateQtiResponseVariables({
      item,
      responses: { CHOICE: ["A", "B"] },
    });
    expect(valid.ok).toBe(true);
  });

  it("validates minAssociations and maxAssociations interaction bounds", () => {
    const item = parsedItem(matchBoundsItemXml());

    const tooFew = validateQtiResponseVariables({
      item,
      responses: { MATCH: ["A X"] },
    });
    expect(tooFew.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.required", identifier: "MATCH" }),
    );

    const tooMany = validateQtiResponseVariables({
      item,
      responses: { MATCH: ["A X", "B Y", "A Y", "B X"] },
    });
    expect(tooMany.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.maximum", identifier: "MATCH" }),
    );

    const valid = validateQtiResponseVariables({
      item,
      responses: { MATCH: ["A X", "B Y"] },
    });
    expect(valid.ok).toBe(true);
  });

  it("reports undeclared identifiers and honors external response allow-list", () => {
    const item = parsedItem(choiceBoundsItemXml());

    const rejected = validateQtiResponseVariables({
      item,
      allowIncompleteResponses: true,
      responses: { CHOICE: ["A", "B"], duration: 12.5 },
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "response.undeclared",
        identifier: "duration",
      }),
    );

    const allowed = validateQtiResponseVariables({
      item,
      allowIncompleteResponses: true,
      allowedUndeclaredResponseIdentifiers: ["duration"],
      responses: { CHOICE: ["A", "B"], duration: 12.5 },
    });
    expect(allowed.ok).toBe(true);
  });

  it("validates allowed external response values before accepting the allow-list", () => {
    const item = parsedItem(choiceBoundsItemXml());

    const result = validateQtiResponseVariables({
      item,
      allowIncompleteResponses: true,
      allowedUndeclaredResponseIdentifiers: ["duration"],
      responses: { CHOICE: ["A", "B"], duration: Number.NaN },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.value.invalid", identifier: "duration" }),
    );
  });

  it("rejects values outside the public QTI value contract", () => {
    const item = parsedItem(choiceBoundsItemXml());

    const result = validateQtiResponseVariables({
      item,
      allowIncompleteResponses: true,
      responses: { CHOICE: Number.NaN },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.value.invalid", identifier: "CHOICE" }),
    );
  });

  it("accepts array wire form and trims response identifiers", () => {
    const item = parsedItem(choiceBoundsItemXml());

    const result = validateQtiResponseVariables({
      item,
      responses: [{ identifier: "  CHOICE  ", value: ["A", "B"] }],
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports empty response identifiers", () => {
    const item = parsedItem(choiceBoundsItemXml());

    const result = validateQtiResponseVariables({
      item,
      allowIncompleteResponses: true,
      responses: [{ identifier: "   ", value: "A" }],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "response.identifier.required" }),
    );
  });

  it("skips policy checks for undeclared-only response variables without interactions", () => {
    const item = parsedItem(policySkipItemXml());

    const result = validateQtiResponseVariables({
      item,
      allowIncompleteResponses: true,
      responses: {},
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("validates every interaction that shares a response identifier", () => {
    const item = parsedItem(sharedResponseInteractionsXml());

    const result = validateQtiResponseVariables({
      item,
      responses: { SHARED: ["A", "B"] },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "response.maximum",
        identifier: "SHARED",
        message: "First interaction allows one.",
      }),
    );
  });
});

function parsedItem(xml: string): QtiAssessmentItem {
  const result = parseQtiXml(xml);
  expect(result.ok).toBe(true);
  const document = result.document;
  if (!document) throw new Error("Expected test fixture XML to parse into a QTI document.");
  return document.item;
}

function cardinalityItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="cardinality" title="cardinality" time-dependent="false">
      <qti-response-declaration identifier="SINGLE" cardinality="single" base-type="identifier"/>
      <qti-response-declaration identifier="MULTIPLE" cardinality="multiple" base-type="identifier"/>
      <qti-response-declaration identifier="ORDERED" cardinality="ordered" base-type="identifier"/>
      <qti-response-declaration identifier="RECORD" cardinality="record"/>
      <qti-item-body>
        <qti-choice-interaction response-identifier="SINGLE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
        <qti-choice-interaction response-identifier="MULTIPLE">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
        <qti-order-interaction response-identifier="ORDERED">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-order-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function choiceBoundsItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-bounds" title="choice-bounds" time-dependent="false">
      <qti-response-declaration identifier="CHOICE" cardinality="multiple" base-type="identifier"/>
      <qti-item-body>
        <qti-choice-interaction response-identifier="CHOICE" min-choices="2" max-choices="3">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
          <qti-simple-choice identifier="C">C</qti-simple-choice>
          <qti-simple-choice identifier="D">D</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function matchBoundsItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="match-bounds" title="match-bounds" time-dependent="false">
      <qti-response-declaration identifier="MATCH" cardinality="multiple" base-type="directedPair"/>
      <qti-item-body>
        <qti-match-interaction response-identifier="MATCH" min-associations="2" max-associations="3">
          <qti-simple-match-set>
            <qti-simple-associable-choice identifier="A" match-max="1">A</qti-simple-associable-choice>
            <qti-simple-associable-choice identifier="B" match-max="1">B</qti-simple-associable-choice>
          </qti-simple-match-set>
          <qti-simple-match-set>
            <qti-simple-associable-choice identifier="X" match-max="1">X</qti-simple-associable-choice>
            <qti-simple-associable-choice identifier="Y" match-max="1">Y</qti-simple-associable-choice>
          </qti-simple-match-set>
        </qti-match-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function choiceItemXml(options: { required?: boolean | string } = {}): string {
  const requiredAttribute =
    options.required === true
      ? ' required="true"'
      : options.required === false
        ? ' required="false"'
        : typeof options.required === "string"
          ? ` required="${options.required}"`
          : "";
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice-item" title="choice-item" time-dependent="false">
      <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier"/>
      <qti-item-body>
        <qti-choice-interaction response-identifier="CHOICE" max-choices="1"${requiredAttribute}>
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function scoredOptionalChoiceItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="scored-optional-choice" title="scored-optional-choice" time-dependent="false">
      <qti-response-declaration identifier="CHOICE" cardinality="single" base-type="identifier">
        <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
      </qti-response-declaration>
      <qti-item-body>
        <qti-choice-interaction response-identifier="CHOICE" max-choices="1">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function requiredExtendedTextItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="required-extended-text" title="required-extended-text" time-dependent="false">
      <qti-response-declaration identifier="TEXT" cardinality="single" base-type="string"/>
      <qti-item-body>
        <qti-extended-text-interaction response-identifier="TEXT" required="true"/>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function mediaItemXml(options: { required?: boolean } = {}): string {
  const requiredAttribute = options.required ? ' required="true"' : "";
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="media-item" title="media-item" time-dependent="false">
      <qti-response-declaration identifier="MEDIA" cardinality="single" base-type="integer"/>
      <qti-item-body>
        <qti-media-interaction response-identifier="MEDIA"${requiredAttribute}>
          <audio><source src="clip.mp3"/></audio>
        </qti-media-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function policySkipItemXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="policy-skip" title="policy-skip" time-dependent="false">
      <qti-response-declaration identifier="RECORD" cardinality="record"/>
      <qti-item-body>
        <p>Declaration only.</p>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

function sharedResponseInteractionsXml(): string {
  return `
    <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="shared-response" title="shared-response" time-dependent="false">
      <qti-response-declaration identifier="SHARED" cardinality="multiple" base-type="identifier"/>
      <qti-item-body>
        <qti-choice-interaction response-identifier="SHARED" max-choices="1" data-max-selections-message="First interaction allows one.">
          <qti-simple-choice identifier="A">A</qti-simple-choice>
          <qti-simple-choice identifier="B">B</qti-simple-choice>
        </qti-choice-interaction>
        <qti-choice-interaction response-identifier="SHARED" max-choices="3">
          <qti-simple-choice identifier="C">C</qti-simple-choice>
          <qti-simple-choice identifier="D">D</qti-simple-choice>
        </qti-choice-interaction>
      </qti-item-body>
    </qti-assessment-item>
  `;
}

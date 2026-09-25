import { createItemSession, parseQtiXml } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { migrateQtiItemToQti3, migrateQtiToQti3Package } from "./index.js";

describe("QTI 2 response migration fidelity", () => {
  it.each([
    [
      "weighted entries",
      'defaultValue="0"',
      '<mapEntry mapKey="A" mappedValue="5"/><mapEntry mapKey="B" mappedValue="2"/>',
    ],
    ["nonzero default", 'defaultValue="-1"', '<mapEntry mapKey="A" mappedValue="1"/>'],
    [
      "bounds",
      'defaultValue="0" lowerBound="0" upperBound="0.5"',
      '<mapEntry mapKey="A" mappedValue="1"/>',
    ],
  ])(
    "rejects unrepresentable choice mapping %s instead of changing scores",
    (_label, attributes, entries) => {
      const result = migrateQtiItemToQti3({
        xml: item(
          choiceDeclaration(
            `<correctResponse><value>A</value></correctResponse><mapping ${attributes}>${entries}</mapping>`,
          ),
          choiceBody(),
        ),
      });
      expect(result.xml).toBeUndefined();
      expect(result.authoringItem).toBeUndefined();
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: "qti2_response_mapping_not_preserved", severity: "error" }),
      );
    },
  );

  it("retains representable mapping scores", () => {
    const result = migrateQtiItemToQti3({
      xml: item(
        choiceDeclaration(
          '<correctResponse><value>A</value></correctResponse><mapping defaultValue="0"><mapEntry mapKey="A" mappedValue="1"/><mapEntry mapKey="B" mappedValue="0"/></mapping>',
        ),
        choiceBody(),
      ),
    });
    expect(result.diagnostics).toEqual([]);
    expect(score(result.xml, "A")).toBe(1);
    expect(score(result.xml, "B")).toBe(0);
  });

  it.each(["none", "safe"] as const)(
    "does not reinterpret default values as answers with repairPolicy %s",
    (repairPolicy) => {
      const result = migrateQtiItemToQti3(
        {
          xml: item(
            choiceDeclaration("<defaultValue><value>B</value></defaultValue>"),
            choiceBody(),
          ),
        },
        { repairPolicy },
      );
      expect(result.xml).toBeUndefined();
      expect(result.authoringItem).toBeUndefined();
      expect(result.diagnostics.some((entry) => entry.severity === "error")).toBe(true);
    },
  );

  it("diagnoses discarded defaults even alongside a real correct response", () => {
    const result = migrateQtiItemToQti3({
      xml: item(
        choiceDeclaration(
          "<defaultValue><value>B</value></defaultValue><correctResponse><value>A</value></correctResponse>",
        ),
        choiceBody(),
      ),
    });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_response_default_not_preserved" }),
    );
  });

  it.each(["integer", "float"])(
    "preserves %s text-entry declarations and input constraints",
    (baseType) => {
      const result = migrateQtiItemToQti3({
        xml: item(
          `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="${baseType}"><correctResponse><value>42</value></correctResponse></responseDeclaration>`,
          '<itemBody><p>Number: <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="2" patternMask="[0-9]{2}" placeholderText="00"/></p></itemBody>',
        ),
      });
      expect(result.diagnostics).toEqual([]);
      expect(result.xml).toContain(`base-type="${baseType}"`);
      expect(result.xml).toContain('expected-length="2"');
      expect(result.xml).toContain('pattern-mask="[0-9]{2}"');
      expect(result.xml).toContain('placeholder-text="00"');
      expect(score(result.xml, 42)).toBe(1);
    },
  );

  it("keeps match-correct string answers case-sensitive", () => {
    const result = migrateQtiItemToQti3({ xml: textItem("Paris") });
    expect(result.diagnostics).toEqual([]);
    expect(score(result.xml, "Paris")).toBe(1);
    expect(score(result.xml, "paris")).toBe(0);
  });

  it("preserves representable text mapping weights, case, and an independent answer key", () => {
    const source = textItem("Paris").replace(
      "</responseDeclaration>",
      '<mapping defaultValue="0"><mapEntry mapKey="Paris" mappedValue="0.5" caseSensitive="false"/><mapEntry mapKey="Lyon" mappedValue="0.25" caseSensitive="true"/></mapping></responseDeclaration>',
    );
    const result = migrateQtiItemToQti3({ xml: source });
    expect(result.diagnostics).toEqual([]);
    expect(result.xml).toContain("<qti-value>Paris</qti-value>");
    expect(score(result.xml, "paris")).toBe(0.5);
    expect(score(result.xml, "Lyon")).toBe(0.25);
    expect(score(result.xml, "lyon")).toBe(0);
  });

  it.each([
    [
      '<mapEntry mapKey="Paris" mappedValue="1" caseSensitive="false"/><mapEntry mapKey="paris" mappedValue="2" caseSensitive="true"/>',
      1,
    ],
    [
      '<mapEntry mapKey="paris" mappedValue="2" caseSensitive="true"/><mapEntry mapKey="Paris" mappedValue="1" caseSensitive="false"/>',
      2,
    ],
  ])("preserves overlapping map-entry order", (entries, expected) => {
    const source = textItem("Paris").replace(
      "</responseDeclaration>",
      `<mapping defaultValue="0">${entries}</mapping></responseDeclaration>`,
    );
    const result = migrateQtiItemToQti3({ xml: source });
    expect(result.diagnostics).toEqual([]);
    expect(score(result.xml, "paris")).toBe(expected);
  });

  it("preserves an omitted map caseSensitive as case-insensitive", () => {
    const source = textItem("Paris").replace(
      "</responseDeclaration>",
      '<mapping defaultValue="0"><mapEntry mapKey="Paris" mappedValue="2"/></mapping></responseDeclaration>',
    );
    const result = migrateQtiItemToQti3({ xml: source });
    expect(result.diagnostics).toEqual([]);
    expect(score(result.xml, "paris")).toBe(2);
  });

  it.each([
    [
      "pair",
      '<associateInteraction responseIdentifier="RESPONSE" maxAssociations="1"><simpleAssociableChoice identifier="A" matchMax="1">A</simpleAssociableChoice><simpleAssociableChoice identifier="B" matchMax="1">B</simpleAssociableChoice></associateInteraction>',
    ],
    [
      "directedPair",
      '<gapMatchInteraction responseIdentifier="RESPONSE"><gapText identifier="A" matchMax="1">A</gapText><p><gap identifier="B"/></p></gapMatchInteraction>',
    ],
  ])("rejects lost %s mapping weights", (baseType, interaction) => {
    const source = item(
      `<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="${baseType}"><correctResponse><value>A B</value></correctResponse><mapping defaultValue="0"><mapEntry mapKey="A B" mappedValue="5"/></mapping></responseDeclaration>`,
      `<itemBody>${interaction}</itemBody>`,
    );
    const result = migrateQtiItemToQti3({ xml: source });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_response_mapping_not_preserved" }),
    );
  });

  it("rejects source text-entry response types the writer cannot represent", () => {
    const source = textItem("Paris").replace('baseType="string"', 'baseType="identifier"');
    const result = migrateQtiItemToQti3({ xml: source });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_text_entry_response_type_unsupported" }),
    );
  });

  it("refuses nonrepresentable slider mapping limits", () => {
    const source = item(
      '<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"><correctResponse><value>5</value></correctResponse><mapping defaultValue="0" upperBound="0.5"><mapEntry mapKey="5" mappedValue="2"/></mapping></responseDeclaration>',
      '<itemBody><sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="10" step="1"/></itemBody>',
    );
    const result = migrateQtiItemToQti3({ xml: source });
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_response_mapping_not_preserved" }),
    );
  });

  it("does not emit package output after rejecting mapping loss", async () => {
    const source = item(
      choiceDeclaration(
        '<correctResponse><value>A</value></correctResponse><mapping defaultValue="0"><mapEntry mapKey="A" mappedValue="5"/></mapping>',
      ),
      choiceBody(),
    );
    const result = await migrateQtiToQti3Package({ xml: source });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_response_mapping_not_preserved" }),
    );
  });

  it("honors an explicit review-stub policy for unrepresentable response semantics", () => {
    const source = item(
      choiceDeclaration(
        "<defaultValue><value>B</value></defaultValue><correctResponse><value>A</value></correctResponse>",
      ),
      choiceBody(),
    );
    const result = migrateQtiItemToQti3({ xml: source }, { unsupportedPolicy: "stub" });
    expect(result.authoringItem?.interactionType).toBe("extendedText");
    expect(result.xml).toContain("manual migration review");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti2_response_default_not_preserved" }),
    );
  });
});

function item(declaration: string, body: string): string {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="fidelity" title="Synthetic fidelity item" adaptive="false" timeDependent="false">${declaration}${body}</assessmentItem>`;
}

function choiceDeclaration(content: string): string {
  return `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">${content}</responseDeclaration>`;
}

function choiceBody(): string {
  return '<itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>';
}

function textItem(correct: string): string {
  return item(
    `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"><correctResponse><value>${correct}</value></correctResponse></responseDeclaration>`,
    '<itemBody><p><textEntryInteraction responseIdentifier="RESPONSE"/></p></itemBody>',
  );
}

function score(xml: string | undefined, response: string | number): unknown {
  if (!xml) throw new Error("Expected migrated item XML.");
  const parsed = parseQtiXml(xml);
  if (!parsed.document) throw new Error("Expected parsed migrated item.");
  const session = createItemSession(parsed.document);
  session.respond("RESPONSE", response);
  return session.score().outcomes.SCORE;
}

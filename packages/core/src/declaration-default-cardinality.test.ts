import { describe, expect, it } from "vitest";
import { createItemSession, parseQtiXml } from "./index.js";

describe("declaration default cardinality", () => {
  it.each(["multiple", "ordered"])(
    "retains %s containers across processing and restore",
    (cardinality) => {
      for (const values of [[], [7], [7, 9]]) {
        const defaults = `<qti-default-value>${values.map((value) => `<qti-value>${value}</qti-value>`).join("")}</qti-default-value>`;
        const parsed =
          parseQtiXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="default-shapes" title="Defaults" time-dependent="false">
        <qti-response-declaration identifier="R" cardinality="${cardinality}" base-type="integer">${defaults}</qti-response-declaration>
        <qti-outcome-declaration identifier="O" cardinality="${cardinality}" base-type="integer">${defaults}</qti-outcome-declaration>
        <qti-template-declaration identifier="POOL" cardinality="${cardinality}" base-type="integer">${defaults}</qti-template-declaration>
        <qti-template-declaration identifier="PICK" cardinality="single" base-type="integer"/>
        <qti-template-processing><qti-set-template-value identifier="PICK"><qti-random><qti-variable identifier="POOL"/></qti-random></qti-set-template-value></qti-template-processing>
        <qti-item-body><p>Defaults</p></qti-item-body>
      </qti-assessment-item>`);
        expect(parsed.diagnostics).toEqual([]);
        if (!parsed.document) throw new Error("Expected document");
        const expected = values.length ? values : null;
        const { item } = parsed.document;
        expect(item.responseDeclarations[0]?.defaultValue).toEqual(expected);
        expect(item.outcomeDeclarations[0]?.defaultValue).toEqual(expected);
        expect(item.templateDeclarations[0]?.defaultValue).toEqual(expected);
        const session = createItemSession(parsed.document);
        expect(session.presentationResponse("R")).toEqual(expected);
        const state = session.serialize();
        expect(state.outcomes.O).toEqual(expected);
        expect(state.templateValues?.POOL).toEqual(expected);
        if (values.length) expect(values).toContain(state.templateValues?.PICK);
        else expect(state.templateValues?.PICK).toBeNull();
        const restored = createItemSession(parsed.document, state);
        expect(restored.serialize().templateValues).toEqual(state.templateValues);
        expect(restored.presentationResponse("R")).toEqual(expected);
      }
    },
  );
});

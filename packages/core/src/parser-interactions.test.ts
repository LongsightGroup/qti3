import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";

describe("QTI interaction parsing integration", () => {
  it("accepts qflowlearn package authoring variants used by presidents exports", () => {
    const image =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLz4=";
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="qflow-variants" title="qflow-variants" time-dependent="false">
        <qti-response-declaration identifier="ASSOCIATE" cardinality="multiple" base-type="pair"/>
        <qti-response-declaration identifier="GRAPHIC_GAP" cardinality="multiple" base-type="directedPair"/>
        <qti-response-declaration identifier="POINT" cardinality="single" base-type="point"/>
        <qti-response-declaration identifier="DRAWING" cardinality="single" base-type="file"/>
        <qti-response-declaration identifier="PCI" cardinality="single" base-type="string"/>
        <qti-response-declaration identifier="TEXT" cardinality="single" base-type="string">
          <qti-correct-response>
            <qti-value>Abraham Lincoln</qti-value>
            <qti-value>Lincoln</qti-value>
          </qti-correct-response>
        </qti-response-declaration>
        <qti-item-body>
          <qti-associate-interaction response-identifier="ASSOCIATE">
            <qti-simple-associable-choice identifier="A" match-max="1">Washington</qti-simple-associable-choice>
            <qti-simple-associable-choice identifier="B" match-max="1">Two terms</qti-simple-associable-choice>
          </qti-associate-interaction>
          <qti-graphic-gap-match-interaction response-identifier="GRAPHIC_GAP">
            <object data="${image}" type="image/svg+xml" width="160" height="120"/>
            <qti-gap-text identifier="LABEL" match-max="1">FDR</qti-gap-text>
            <qti-associable-hotspot identifier="TARGET" shape="circle" coords="80,60,12" match-max="1"/>
          </qti-graphic-gap-match-interaction>
          <qti-select-point-interaction response-identifier="POINT">
            <img src="${image}" alt="Timeline" width="160" height="120"/>
          </qti-select-point-interaction>
          <qti-drawing-interaction response-identifier="DRAWING">
            <object data="${image}" type="image/svg+xml" width="160" height="120"/>
          </qti-drawing-interaction>
          <qti-portable-custom-interaction
            response-identifier="PCI"
            custom-interaction-type-identifier="urn:qflow:presidents:timeline"
            module="presidentsPci">
            <qti-interaction-markup><div>Custom presidents widget</div></qti-interaction-markup>
          </qti-portable-custom-interaction>
          <p>Answer: <qti-text-entry-interaction response-identifier="TEXT"/></p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(
      result.document?.item.interactions.find((item) => item.type === "selectPoint")?.object,
    ).toMatchObject({ data: image, type: "image/svg+xml" });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "interaction.child.unsupported" }),
    );
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "interaction.object.required" }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "declaration.correctResponse.cardinality",
        severity: "warning",
      }),
    );
  });

  it("parses position object stage separately from the movable object", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="position-stage" title="position-stage" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point"/>
        <qti-item-body>
          <qti-position-object-stage>
            <object data="stage.svg" type="image/svg+xml" width="480" height="300"/>
            <qti-position-object-interaction response-identifier="RESPONSE">
              <object data="marker.svg" type="image/svg+xml" width="64" height="48"/>
            </qti-position-object-interaction>
          </qti-position-object-stage>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const interaction = result.document?.item.interactions.find(
      (item) => item.type === "positionObject",
    );
    expect(interaction?.object).toMatchObject({ data: "marker.svg", width: "64", height: "48" });
    expect(interaction?.positionObjectStage).toMatchObject({
      data: "stage.svg",
      width: "480",
      height: "300",
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "interaction.child.unsupported" }),
    );
  });
});

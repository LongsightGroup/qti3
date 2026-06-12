import { describe, expect, it } from "vitest";
import { itemMetadataSupport } from "./support.js";
import { parseQtiXml } from "./parser.js";

describe("QTI companion materials parsing", () => {
  it("leaves companion materials undefined when absent", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="no-companion-materials" title="no-companion-materials" time-dependent="false">
        <qti-item-body><p>No companion materials.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.companionMaterials).toBeUndefined();
  });

  it("parses companion physical material text with source metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="physical-material" title="physical-material" time-dependent="false">
        <qti-companion-materials-info>
          <qti-physical-material>
            Supply a transcript sheet.
          </qti-physical-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Listen to the recording.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.companionMaterials).toEqual({
      physicalMaterials: [
        expect.objectContaining({
          text: "Supply a transcript sheet.",
          source: expect.objectContaining({
            path: "/qti-assessment-item/qti-companion-materials-info[1]/qti-physical-material[1]",
          }),
        }),
      ],
      unparsedChildren: [],
      source: expect.objectContaining({
        path: "/qti-assessment-item/qti-companion-materials-info[1]",
      }),
    });
  });

  it("preserves multiple companion physical materials and omits empty values", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="multiple-physical-materials" title="multiple-physical-materials" time-dependent="false">
        <qti-companion-materials-info>
          <qti-physical-material>First material.</qti-physical-material>
          <qti-physical-material>   </qti-physical-material>
          <qti-physical-material>Supply a printed reference sheet.</qti-physical-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Use the companion materials.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.companionMaterials?.physicalMaterials).toEqual([
      expect.objectContaining({ text: "First material." }),
      expect.objectContaining({ text: "Supply a printed reference sheet." }),
    ]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "companionMaterials.physicalMaterial.empty",
          severity: "warning",
          path: "/qti-assessment-item/qti-companion-materials-info[1]/qti-physical-material[2]",
        }),
      ]),
    );
  });

  it("preserves digital-only companion materials with explicit parse diagnostics", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="digital-companion-material" title="digital-companion-material" time-dependent="false">
        <qti-companion-materials-info>
          <qti-digital-material label="Reference card" mime-type="text/plain">
            <qti-file-href>../materials/reference.txt</qti-file-href>
            <qti-resource-icon>../materials/reference.svg</qti-resource-icon>
          </qti-digital-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Use the digital reference card.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.document?.item.companionMaterials).toEqual({
      physicalMaterials: [],
      unparsedChildren: [
        expect.objectContaining({
          qtiName: "qti-digital-material",
          source: expect.objectContaining({
            path: "/qti-assessment-item/qti-companion-materials-info[1]/qti-digital-material[1]",
          }),
        }),
      ],
      source: expect.objectContaining({
        path: "/qti-assessment-item/qti-companion-materials-info[1]",
      }),
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "companionMaterials.child.unsupported",
          severity: "warning",
          path: "/qti-assessment-item/qti-companion-materials-info[1]/qti-digital-material[1]",
        }),
      ]),
    );
  });

  it("reports duplicate qti-companion-materials-info containers", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="duplicate-companion-materials" title="duplicate-companion-materials" time-dependent="false">
        <qti-companion-materials-info>
          <qti-physical-material>First container.</qti-physical-material>
        </qti-companion-materials-info>
        <qti-companion-materials-info>
          <qti-physical-material>Second container.</qti-physical-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Duplicate companion containers.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "item.child.duplicate",
          severity: "error",
          path: "/qti-assessment-item/qti-companion-materials-info[2]",
        }),
      ]),
    );
    expect(result.document?.item.companionMaterials?.physicalMaterials).toEqual([
      expect.objectContaining({ text: "First container." }),
    ]);
  });

  it("documents companion materials support levels in the item metadata matrix", () => {
    expect(itemMetadataSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          qtiName: "qti-companion-materials-info",
          category: "itemMetadata",
          support: "parsed",
          parse: true,
          validate: true,
          render: false,
          process: false,
        }),
        expect.objectContaining({
          qtiName: "qti-digital-material",
          category: "itemMetadata",
          support: "unsupported",
          parse: false,
        }),
      ]),
    );
  });
});

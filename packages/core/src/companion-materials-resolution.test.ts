import { describe, expect, it } from "vitest";
import { parseQtiXml } from "./parser.js";
import { createCompanionMaterialsResolution } from "./companion-materials-resolution.js";

describe("companion materials resolution", () => {
  it("returns undefined when the item has no companion materials container", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="no-companion-materials" title="no-companion-materials" time-dependent="false">
        <qti-item-body><p>No companion materials.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.document).toBeDefined();
    expect(createCompanionMaterialsResolution(result.document!)).toBeUndefined();
  });

  it("returns empty material lists for an empty companion materials container", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="empty-companion-materials" title="empty-companion-materials" time-dependent="false">
        <qti-companion-materials-info/>
        <qti-item-body><p>Answer the question.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(createCompanionMaterialsResolution(result.document!)).toEqual({
      itemIdentifier: "empty-companion-materials",
      physicalMaterials: [],
      digitalMaterials: [],
      unparsedChildren: [],
    });
  });

  it("resolves physical and digital companion materials for hosts", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="companion-materials-host" title="companion-materials-host" time-dependent="false">
        <qti-companion-materials-info>
          <qti-physical-material>Bring a ruler.</qti-physical-material>
          <qti-digital-material label="Reference card" mime-type="text/plain">
            <qti-file-href>../materials/reference.txt</qti-file-href>
            <qti-resource-icon>../materials/reference.svg</qti-resource-icon>
          </qti-digital-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Answer the question.</p></qti-item-body>
      </qti-assessment-item>
    `);

    const resolution = createCompanionMaterialsResolution(result.document!, {
      resolveAsset: (url) => `https://package.example/${url}`,
    });

    expect(resolution).toEqual({
      itemIdentifier: "companion-materials-host",
      physicalMaterials: [expect.objectContaining({ text: "Bring a ruler." })],
      digitalMaterials: [
        expect.objectContaining({
          fileHref: "../materials/reference.txt",
          resolvedFileHref: "https://package.example/../materials/reference.txt",
          label: "Reference card",
          mimeType: "text/plain",
          resourceIcon: "../materials/reference.svg",
          resolvedResourceIcon: "https://package.example/../materials/reference.svg",
          attributes: {
            label: "Reference card",
            "mime-type": "text/plain",
          },
        }),
      ],
      unparsedChildren: [],
    });
  });

  it("exposes unsupported companion material children for host tolerance UI", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="unsupported-companion-child" title="unsupported-companion-child" time-dependent="false">
        <qti-companion-materials-info>
          <qti-unknown-companion-material/>
        </qti-companion-materials-info>
        <qti-item-body><p>Answer the question.</p></qti-item-body>
      </qti-assessment-item>
    `);

    expect(createCompanionMaterialsResolution(result.document!)?.unparsedChildren).toEqual([
      expect.objectContaining({
        qtiName: "qti-unknown-companion-material",
      }),
    ]);
  });

  it("omits resolved asset URLs when resolveAsset is not provided", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="companion-materials-unresolved" title="companion-materials-unresolved" time-dependent="false">
        <qti-companion-materials-info>
          <qti-digital-material>
            <qti-file-href>materials/reference.txt</qti-file-href>
          </qti-digital-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Answer the question.</p></qti-item-body>
      </qti-assessment-item>
    `);

    const resolution = createCompanionMaterialsResolution(result.document!);
    const digitalMaterial = resolution?.digitalMaterials[0];
    expect(digitalMaterial?.fileHref).toBe("materials/reference.txt");
    expect(digitalMaterial).not.toHaveProperty("resolvedFileHref");
    expect(digitalMaterial).not.toHaveProperty("resolvedResourceIcon");
  });

  it("does not resolve absolute companion material asset URLs", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="absolute-companion-material" title="absolute-companion-material" time-dependent="false">
        <qti-companion-materials-info>
          <qti-digital-material>
            <qti-file-href>https://example.com/reference.txt</qti-file-href>
          </qti-digital-material>
        </qti-companion-materials-info>
        <qti-item-body><p>Answer the question.</p></qti-item-body>
      </qti-assessment-item>
    `);

    const resolution = createCompanionMaterialsResolution(result.document!, {
      resolveAsset: (url) => `https://package.example/${url}`,
    });

    const digitalMaterial = resolution?.digitalMaterials[0];
    expect(digitalMaterial?.fileHref).toBe("https://example.com/reference.txt");
    expect(digitalMaterial).not.toHaveProperty("resolvedFileHref");
  });
});

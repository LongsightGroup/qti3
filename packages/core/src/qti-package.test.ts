import { deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseQtiPackage } from "./index.js";

describe("QTI package parser", () => {
  it("parses manifest item-resource packages with dependencies, assets, timing, and standards", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <metadata>
    <title>Manifest package</title>
    <standard-alignment standard-id="ELA.1" framework="CCSS">Read closely</standard-alignment>
  </metadata>
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
      <file href="styles/item.css"/>
      <file href="media/prompt.png"/>
      <dependency identifierref="stimulus"/>
    </resource>
    <resource identifier="stimulus" type="webcontent" href="stimuli/stimulus.xml">
      <file href="stimuli/stimulus.xml"/>
    </resource>
  </resources>
</manifest>`,
        "items/choice.xml": choiceItemXml(),
        "stimuli/stimulus.xml": `<qti-assessment-stimulus xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stimulus">
  <p>Read this first.</p>
</qti-assessment-stimulus>`,
        "styles/item.css": ".prompt { color: currentColor; }",
        "media/prompt.png": new Uint8Array([137, 80, 78, 71]),
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Manifest package");
    expect(result.packageShape).toBe("manifest-item-resources");
    expect(result.manifestResources).toEqual([
      expect.objectContaining({
        identifier: "choice",
        type: "imsqti_item_xmlv3p0",
        href: "items/choice.xml",
        dependencies: ["stimulus"],
      }),
      expect.objectContaining({
        identifier: "stimulus",
        type: "webcontent",
        href: "stimuli/stimulus.xml",
      }),
    ]);
    expect(result.items).toEqual([
      expect.objectContaining({
        href: "items/choice.xml",
        source: "manifest",
        manifestResourceIdentifier: "choice",
        identifier: "choice",
        title: "Choice",
        assetHrefs: ["styles/item.css", "stimuli/stimulus.xml", "media/prompt.png"],
        timing: expect.objectContaining({
          sourcePath: "items/choice.xml",
          timeDependent: true,
          maxTime: "PT2M",
        }),
      }),
    ]);
    expect(result.assets).toEqual([
      {
        href: "media/prompt.png",
        mediaType: "image/png",
        source: "manifest-resource",
        referencedBy: ["choice", "items/choice.xml"],
      },
      {
        href: "stimuli/stimulus.xml",
        mediaType: "application/xml",
        source: "manifest-resource",
        referencedBy: ["stimulus", "items/choice.xml"],
      },
      {
        href: "styles/item.css",
        mediaType: "text/css",
        source: "manifest-resource",
        referencedBy: ["choice", "items/choice.xml"],
      },
    ]);
    expect(result.standards).toEqual([
      expect.objectContaining({
        sourcePath: "imsmanifest.xml",
        qtiName: "standard-alignment",
        identifier: "ELA.1",
        framework: "CCSS",
        targetName: "Read closely",
      }),
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("parses assessment-test-resource packages and item refs", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="test" type="imsqti_test_xmlv3p0" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
  </resources>
</manifest>`,
        "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Assessment Package">
  <qti-time-limits max-time="PT30M" allow-late-submission="false"/>
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" visible="true">
      <qti-assessment-item-ref identifier="choice-ref" href="items/choice.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
        "items/choice.xml": choiceItemXml(),
        "stimuli/stimulus.xml": `<qti-assessment-stimulus xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stimulus">
  <p>Read this first.</p>
</qti-assessment-stimulus>`,
        "styles/item.css": ".prompt { color: currentColor; }",
        "media/prompt.png": new Uint8Array([137, 80, 78, 71]),
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Assessment Package");
    expect(result.packageShape).toBe("assessment-test-resource");
    expect(result.assessmentTest).toEqual(
      expect.objectContaining({
        href: "assessment.xml",
        identifier: "test",
        title: "Assessment Package",
        manifestResourceIdentifier: "test",
        itemRefs: [
          expect.objectContaining({
            identifier: "choice-ref",
            href: "items/choice.xml",
          }),
        ],
        timing: expect.objectContaining({
          sourcePath: "assessment.xml",
          maxTime: "PT30M",
          allowLateSubmission: false,
        }),
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        href: "items/choice.xml",
        source: "assessment-test",
        assessmentItemRefIdentifier: "choice-ref",
        identifier: "choice",
      }),
    ]);
    expect(result.timing).toEqual(
      expect.objectContaining({
        sourcePath: "assessment.xml",
        maxTime: "PT30M",
      }),
    );
  });

  it("parses deflated ZIP entries when the caller supplies an inflater", () => {
    const result = parseQtiPackage(
      createDeflatedZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml"/>
  </resources>
</manifest>`,
        "items/choice.xml": simpleChoiceItemXml(),
      }),
      { inflateRaw: (compressed) => inflateRawSync(compressed) },
    );

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([
      expect.objectContaining({
        href: "items/choice.xml",
        identifier: "choice",
      }),
    ]);
  });

  it("diagnoses packages without imsmanifest.xml", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "items/choice.xml": choiceItemXml(),
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.packageShape).toBe("unknown");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package.manifest.missing",
          severity: "error",
        }),
      ]),
    );
  });

  it("diagnoses item resources without a primary href", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0"/>
  </resources>
</manifest>`,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package.manifest.resource.href.missing",
          severity: "error",
        }),
      ]),
    );
  });

  it("diagnoses duplicate and ambiguous manifest resources", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="duplicate" type="imsqti_item_xmlv3p0" href="items/choice.xml"/>
    <resource identifier="duplicate" type="imsqti_test_xmlv3p0" href="assessment.xml"/>
  </resources>
</manifest>`,
        "items/choice.xml": choiceItemXml(),
        "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Ambiguous">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual"/>
</qti-assessment-test>`,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.packageShape).toBe("unknown");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package.manifest.resource.identifier.duplicate",
          severity: "error",
        }),
        expect.objectContaining({
          code: "package.shape.ambiguous",
          severity: "error",
        }),
      ]),
    );
  });

  it("prefers assessment-test shape when mixed manifest resources are allowed", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
    <resource identifier="test" type="imsqti_test_xmlv3p0" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
  </resources>
</manifest>`,
        "items/choice.xml": choiceItemXml(),
        "stimuli/stimulus.xml": `<qti-assessment-stimulus xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="stimulus">
  <p>Read this first.</p>
</qti-assessment-stimulus>`,
        "styles/item.css": ".prompt { color: currentColor; }",
        "media/prompt.png": new Uint8Array([137, 80, 78, 71]),
        "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Mixed">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" title="Section" visible="true">
      <qti-assessment-item-ref identifier="choice-ref" href="items/choice.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
      }),
      { manifestShapePolicy: "prefer-assessment-test" },
    );

    expect(result.ok).toBe(true);
    expect(result.packageShape).toBe("assessment-test-resource");
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "package.shape.ambiguous" })]),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        href: "items/choice.xml",
        source: "assessment-test",
        assessmentItemRefIdentifier: "choice-ref",
      }),
    ]);
  });
});

function choiceItemXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="Choice" time-dependent="true">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-assessment-stimulus-ref identifier="stimulus" href="../stimuli/stimulus.xml"/>
  <qti-stylesheet href="../styles/item.css" type="text/css"/>
  <qti-time-limits max-time="PT2M"/>
  <qti-item-body>
    <p><img src="../media/prompt.png" alt="Prompt"/></p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;
}

function simpleChoiceItemXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="choice" title="Choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;
}

function createStoredZip(entries: Record<string, string | Uint8Array>): Buffer {
  return createZip(entries, 0);
}

function createDeflatedZip(entries: Record<string, string | Uint8Array>): Buffer {
  return createZip(entries, 8);
}

function createZip(entries: Record<string, string | Uint8Array>, method: 0 | 8): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  let index = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
    index += 1;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(index, 8);
  eocd.writeUInt16LE(index, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

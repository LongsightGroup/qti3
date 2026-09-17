import { createDeflatedZip, createStoredZip } from "../../../tests/fixtures/package-zip.js";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  detectPackageMediaType,
  discoverQtiPackageContentAssets,
  parseQtiPackage,
  parseQtiPackageFromEntries,
  isQtiItemResource,
} from "./index.js";
import { choiceItemXml, simpleChoiceItemXml } from "./qti-package.fixtures.js";

describe("QTI package parser", () => {
  it("reports unsupported item time limits while preserving authored timing metadata", () => {
    const result = parseQtiPackageFromEntries([
      {
        path: "imsmanifest.xml",
        bytes: new TextEncoder().encode(
          `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="timing"><resources><resource identifier="item" type="imsqti_item_xmlv3p0" href="item.xml"><file href="item.xml"/></resource></resources></manifest>`,
        ),
      },
      {
        path: "item.xml",
        bytes: new TextEncoder().encode(
          simpleChoiceItemXml().replace(
            "<qti-item-body>",
            '<qti-time-limits max-time="120"/><qti-item-body>',
          ),
        ),
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.items[0]?.timing?.maxTime).toBe("120");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "assessmentItem.child.unsupported",
        severity: "error",
        message: expect.stringContaining("qti-time-limits"),
      }),
    );
  });

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
    expect(parseQtiPackageFromEntries(result.entries)).toEqual(result);
    expect(result.entries.map((entry) => entry.path)).toEqual([
      "imsmanifest.xml",
      "items/choice.xml",
      "stimuli/stimulus.xml",
      "styles/item.css",
      "media/prompt.png",
    ]);
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
  <qti-time-limits min-time="60" max-time="1800" allow-late-submission="false"/>
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-time-limits max-time="1200"/>
    <qti-assessment-section identifier="section-1" visible="true">
      <qti-assessment-section identifier="section-2" title="Nested" visible="false">
        <qti-time-limits min-time="30" max-time="60"/>
        <qti-assessment-item-ref identifier="choice-ref" href="items/choice.xml">
          <qti-time-limits min-time="10" max-time="60" allow-late-submission="true"/>
          <qti-item-session-control max-attempts="2" allow-skipping="false" show-feedback="false" validate-responses="true"/>
        </qti-assessment-item-ref>
      </qti-assessment-section>
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
    expect(parseQtiPackageFromEntries(result.entries)).toEqual(result);
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
          maxTime: "1800",
          allowLateSubmission: false,
        }),
      }),
    );
    expect(result.assessmentTest?.testParts).toEqual([
      expect.objectContaining({
        identifier: "part-1",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        timeLimits: expect.objectContaining({ maxTimeSeconds: 1200 }),
        sections: [
          expect.objectContaining({
            identifier: "section-1",
            visible: true,
            sections: [
              expect.objectContaining({
                identifier: "section-2",
                title: "Nested",
                visible: false,
                parentSectionIdentifier: "section-1",
                timeLimits: expect.objectContaining({
                  minTimeSeconds: 30,
                  maxTimeSeconds: 60,
                }),
                itemRefs: [
                  expect.objectContaining({
                    identifier: "choice-ref",
                    testPartIdentifier: "part-1",
                    sectionIdentifier: "section-2",
                    timeLimits: expect.objectContaining({
                      minTimeSeconds: 10,
                      maxTimeSeconds: 60,
                      allowLateSubmission: true,
                    }),
                    itemSessionControl: expect.objectContaining({
                      maxAttempts: 2,
                      allowSkipping: false,
                      showFeedback: false,
                      validateResponses: true,
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]);
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
        maxTime: "1800",
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
      {
        inflateRaw: (compressed, context) =>
          inflateRawSync(compressed, { maxOutputLength: context.maxOutputLength }),
      },
    );

    expect(result.ok).toBe(true);
    expect(parseQtiPackageFromEntries(result.entries)).toEqual(result);
    expect(result.items).toEqual([
      expect.objectContaining({
        href: "items/choice.xml",
        identifier: "choice",
      }),
    ]);
  });

  it("enforces entry-count, per-entry, total-size, and compression-ratio limits", () => {
    const entryCount = parseQtiPackage(createStoredZip({ "one.xml": "1", "two.xml": "2" }), {
      limits: { maxEntries: 1 },
    });
    expect(entryCount.diagnostics).toContainEqual(
      expect.objectContaining({ code: "package.zip.limit.entries", severity: "error" }),
    );

    const entrySize = parseQtiPackage(createStoredZip({ "large.xml": "1234" }), {
      limits: { maxEntryUncompressedBytes: 3 },
    });
    expect(entrySize.diagnostics).toContainEqual(
      expect.objectContaining({ code: "package.zip.limit.entrySize", severity: "error" }),
    );

    const totalSize = parseQtiPackage(createStoredZip({ "one.xml": "1234", "two.xml": "5678" }), {
      limits: { maxTotalUncompressedBytes: 7 },
    });
    expect(totalSize.diagnostics).toContainEqual(
      expect.objectContaining({ code: "package.zip.limit.totalSize", severity: "error" }),
    );

    let inflated = false;
    const compressionRatio = parseQtiPackage(
      createDeflatedZip({ "compressed.xml": "A".repeat(1_000) }),
      {
        inflateRaw: () => {
          inflated = true;
          return new Uint8Array();
        },
        limits: { maxCompressionRatio: 2 },
      },
    );
    expect(inflated).toBe(false);
    expect(compressionRatio.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "package.zip.limit.compressionRatio",
        severity: "error",
      }),
    );
  });

  it("rejects inflater output that disagrees with the declared expanded size", () => {
    const result = parseQtiPackage(createDeflatedZip({ "imsmanifest.xml": "manifest" }), {
      inflateRaw: () => new Uint8Array(1),
      limits: { maxCompressionRatio: Number.POSITIVE_INFINITY },
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "package.zip.entry.size", severity: "error" }),
    );
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

  it("rejects manifests from a foreign namespace", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="https://example.invalid/not-qti" identifier="pkg">
  <resources/>
</manifest>`,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.packageShape).toBe("unknown");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "package.manifest.root", severity: "error" }),
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

  it("diagnoses duplicate manifest resource identifiers", () => {
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
    expect(result.packageShape).toBe("assessment-test-resource");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package.manifest.resource.identifier.duplicate",
          severity: "error",
        }),
      ]),
    );
  });

  it("prefers assessment-test shape when mixed manifest resources are allowed", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1"
          xmlns:csm="http://www.imsglobal.org/xsd/imsccv1p3/imscsmd_v1p0"
          identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <metadata>
        <csm:curriculumStandardsMetadataSet resourcePartId="choice" resourceLabel="Question">
          <csm:curriculumStandardsMetadata providerId="CASE">
            <csm:setOfGUIDs>
              <csm:labelledGUID>
                <csm:GUID>standard-1</csm:GUID>
                <csm:label>Use evidence.</csm:label>
              </csm:labelledGUID>
            </csm:setOfGUIDs>
          </csm:curriculumStandardsMetadata>
        </csm:curriculumStandardsMetadataSet>
      </metadata>
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
    );

    expect(result.ok).toBe(true);
    expect(parseQtiPackageFromEntries(result.entries)).toEqual(result);
    expect(result.packageShape).toBe("assessment-test-resource");
    expect(result.diagnostics).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "package.shape.ambiguous" })]),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        href: "items/choice.xml",
        source: "assessment-test",
        manifestResourceIdentifier: "choice",
        assessmentItemRefIdentifier: "choice-ref",
        standards: [
          expect.objectContaining({
            identifier: "standard-1",
            providerIdentifier: "CASE",
          }),
        ],
      }),
    ]);
  });

  it("diagnoses duplicate item resource hrefs when resolving assessment-test item refs", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice-a" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
    <resource identifier="choice-b" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
    <resource identifier="test" type="imsqti_test_xmlv3p0" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
  </resources>
</manifest>`,
        "items/choice.xml": choiceItemXml(),
        "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Assessment">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" title="Section" visible="true">
      <qti-assessment-item-ref identifier="choice-ref" href="items/choice.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
      }),
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package.manifest.itemResource.href.duplicate",
          severity: "error",
          path: "items/choice.xml",
        }),
      ]),
    );
  });

  it("parses resource-scoped IMS curriculum standards metadata onto matching items", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1"
          xmlns:csm="http://www.imsglobal.org/xsd/imsccv1p3/imscsmd_v1p0"
          identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <metadata>
        <csm:curriculumStandardsMetadataSet resourcePartId="choice" resourceLabel="Question" weight="0.5">
          <csm:curriculumStandardsMetadata providerId="CASE">
            <csm:setOfGUIDs>
              <csm:labelledGUID>
                <csm:GUID>standard-1</csm:GUID>
                <csm:label>MA.5.FR.1.1 Add fractions.</csm:label>
                <csm:caseItemURI>https://case.example/standard-1</csm:caseItemURI>
              </csm:labelledGUID>
            </csm:setOfGUIDs>
          </csm:curriculumStandardsMetadata>
        </csm:curriculumStandardsMetadataSet>
      </metadata>
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
        "items/choice.xml": simpleChoiceItemXml(),
      }),
    );

    expect(result.ok).toBe(true);
    expect(parseQtiPackageFromEntries(result.entries)).toEqual(result);
    expect(result.items[0]?.standards).toEqual([
      expect.objectContaining({
        identifier: "standard-1",
        targetName: "MA.5.FR.1.1 Add fractions.",
        targetUrl: "https://case.example/standard-1",
        providerIdentifier: "CASE",
        resourceLabel: "Question",
        resourcePartIdentifier: "choice",
        weight: 0.5,
      }),
    ]);
  });

  it("diagnoses invalid assessment-test timing and control attributes", () => {
    const result = parseQtiPackage(
      createStoredZip({
        "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="test" type="imsqti_test_xmlv3p0" href="assessment.xml"/>
  </resources>
</manifest>`,
        "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Invalid">
  <qti-time-limits min-time="90" max-time="60" allow-late-submission="maybe"/>
  <qti-test-part identifier="part" navigation-mode="sideways" submission-mode="later">
    <qti-assessment-section identifier="section" visible="sometimes">
      <qti-assessment-item-ref identifier="ref" href="items/choice.xml">
        <qti-item-session-control max-attempts="many" allow-skipping="perhaps"/>
      </qti-assessment-item-ref>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
        "items/choice.xml": simpleChoiceItemXml(),
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "package.timing.range.invalid", severity: "error" }),
        expect.objectContaining({
          code: "package.attribute.allow-late-submission.boolean",
          severity: "error",
        }),
        expect.objectContaining({
          code: "package.testPart.navigationMode.invalid",
          severity: "error",
        }),
        expect.objectContaining({
          code: "package.testPart.submissionMode.invalid",
          severity: "error",
        }),
        expect.objectContaining({ code: "package.attribute.visible.boolean", severity: "error" }),
        expect.objectContaining({
          code: "package.attribute.max-attempts.number",
          severity: "error",
        }),
        expect.objectContaining({
          code: "package.attribute.allow-skipping.boolean",
          severity: "error",
        }),
      ]),
    );
  });
});

describe("QTI package asset utilities", () => {
  it("discovers resolved package-local references without regex traversal", () => {
    const discovery = discoverQtiPackageContentAssets(
      `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item" title="Item" adaptive="false" time-dependent="false">
        <qti-stylesheet href="../styles/item.css"/>
        <qti-item-body><img src="../media/prompt.png" alt=""/></qti-item-body>
      </qti-assessment-item>`,
      "items/item.xml",
    );

    expect(discovery.diagnostics).toEqual([]);
    expect(discovery.hrefs).toEqual(["styles/item.css", "media/prompt.png"]);
  });

  it.each([
    ["page.html", "text/html"],
    ["page.htm", "text/html"],
    ["metadata.json", "application/json"],
    ["audio.m4a", "audio/mp4"],
  ])("detects importer media type for %s", (href, mediaType) => {
    expect(detectPackageMediaType(href)).toBe(mediaType);
  });
});

describe("batch import from extracted entries", () => {
  it.each(["../item.xml", "/item.xml", "items/../item.xml", "a\\b.xml", "a\0b.xml", ""])(
    "rejects unsafe or noncanonical inventory path %j before parsing XML",
    (path) => {
      const result = parseQtiPackageFromEntries([
        { path, bytes: Buffer.from(simpleChoiceItemXml()) },
      ]);
      expect(result.ok).toBe(false);
      expect(result.items).toEqual([]);
      expect(result.entries).toEqual([]);
      expect(result.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
    },
  );

  it("rejects duplicate inventory entries", () => {
    const entry = { path: "item.xml", bytes: Buffer.from(simpleChoiceItemXml()) };
    const result = parseQtiPackageFromEntries([entry, entry]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("package.entry.duplicate");
    expect(result.items).toEqual([]);
  });

  it.each([
    [{ maxEntries: 1 }, "package.entries.limit"],
    [{ maxEntryUncompressedBytes: 2 }, "package.bytes.limit"],
    [{ maxTotalUncompressedBytes: 5 }, "package.bytes.limit"],
    [{ maxEntries: 0 }, "package.limit.invalid"],
  ] as const)("enforces extracted inventory budgets %j", (limits, code) => {
    const result = parseQtiPackageFromEntries(
      [
        { path: "a", bytes: Buffer.from("123") },
        { path: "b", bytes: Buffer.from("456") },
      ],
      { limits },
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(code);
    expect(result.items).toEqual([]);
  });

  it("returns the same typed package failure for missing manifests", () => {
    const original = parseQtiPackage(createStoredZip({ "item.xml": simpleChoiceItemXml() }));
    expect(original.ok).toBe(false);
    expect(parseQtiPackageFromEntries(original.entries)).toEqual(original);
  });
});

describe("package reference classification", () => {
  it("rejects root-absolute content references instead of rebasing them into the item directory", () => {
    const result = discoverQtiPackageContentAssets(
      '<qti-item-body><img src="/media/image.svg"/><qti-file-href>/materials/reference.pdf</qti-file-href></qti-item-body>',
      "items/item.xml",
    );
    expect(result.hrefs).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "package.path.absolute",
      "package.path.absolute",
    ]);
  });
  it("resolves relative content and leaves external URLs and fragments outside the package inventory", () => {
    const result = discoverQtiPackageContentAssets(
      '<qti-item-body><img src=" ../media/image.svg?size=2#shape "/><img src="//example.org/image.svg"/><img src="HTTPS://example.org/image.svg"/><img src="DATA:image/png;base64,abc"/><img src="#local"/><qti-file-href>MAILTO:hello@example.org</qti-file-href></qti-item-body>',
      "items/item.xml",
    );
    expect(result.hrefs).toEqual(["media/image.svg"]);
    expect(result.diagnostics).toEqual([]);
  });
  it.each([
    ["imsqti_item_xmlv3p0", true],
    ["IMSQTI_ITEM_XMLV3P0P1", true],
    ["imsqti_test_xmlv3p0", false],
    ["imsqti_item_xmlv2p2", false],
  ])("classifies resource type %s", (type, expected) => {
    expect(isQtiItemResource(type)).toBe(expected);
  });
});

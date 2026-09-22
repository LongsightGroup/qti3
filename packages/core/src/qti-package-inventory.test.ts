import { expect, it } from "vitest";
import { createStoredZip } from "../../../tests/fixtures/package-zip.js";
import { simpleChoiceItemXml } from "./qti-package.fixtures.js";
import {
  parseQtiPackage,
  parseQtiPackageFromEntries,
  parseQtiPackageStream,
  type QtiPackageStreamSummary,
} from "./index.js";

function packageEntries(extraXml: string): Record<string, string> {
  return {
    "imsmanifest.xml": `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="inventory"><resources>
      <resource identifier="extra" type="imsqti_item_xmlv3p0" href="extra.xml"><file href="extra.xml"/></resource>
      <resource identifier="second" type="imsqti_item_xmlv3p0" href="second.xml"><file href="second.xml"/></resource>
      <resource identifier="first" type="imsqti_item_xmlv3p0" href="first.xml"><file href="first.xml"/></resource>
      <resource identifier="test" type="imsqti_test_xmlv3p0" href="test.xml"><file href="test.xml"/></resource>
      </resources></manifest>`,
    "test.xml": `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Subset"><qti-test-part identifier="part" navigation-mode="linear" submission-mode="individual"><qti-assessment-section identifier="section" title="Section" visible="true">
      <qti-assessment-item-ref identifier="first-ref" href="first.xml"/>
      <qti-assessment-item-ref identifier="second-ref" href="second.xml"/>
      </qti-assessment-section></qti-test-part></qti-assessment-test>`,
    "first.xml": simpleChoiceItemXml(),
    "second.xml": simpleChoiceItemXml(),
    "extra.xml": extraXml,
    "unlisted.xml": "<malformed",
  };
}

it("preserves test order and reference metadata, then imports remaining manifest items", () => {
  const result = parseQtiPackage(createStoredZip(packageEntries(simpleChoiceItemXml())));
  expect(result.ok).toBe(true);
  expect(
    result.items.map(({ href, source, assessmentItemRefIdentifier }) => ({
      href,
      source,
      assessmentItemRefIdentifier,
    })),
  ).toEqual([
    { href: "first.xml", source: "assessment-test", assessmentItemRefIdentifier: "first-ref" },
    { href: "second.xml", source: "assessment-test", assessmentItemRefIdentifier: "second-ref" },
    { href: "extra.xml", source: "manifest", assessmentItemRefIdentifier: undefined },
  ]);
  expect(result.items[2]?.document?.item.interactions).toHaveLength(1);
  expect(result.assessmentTest?.itemRefs.map(({ href }) => href)).toEqual([
    "first.xml",
    "second.xml",
  ]);
  expect(result.diagnostics).toEqual([]);
});

it.each([
  ["unterminated declaration", '<?xml version="1.0"?', "xml.parse"],
  ["content after root", `${simpleChoiceItemXml()}stray text`, "xml.parse"],
  [
    "wrong namespace",
    simpleChoiceItemXml().replaceAll("imsqtiasi_v3p0", "imsqti_v2p2"),
    "qti.root",
  ],
  [
    "missing title",
    simpleChoiceItemXml().replace(/ title="[^"]*"/, ""),
    "assessmentItem.title.required",
  ],
])(
  "rejects an unreferenced manifest item with %s through ZIP, restored entries, and stream",
  async (_name, xml, code) => {
    const entries = Object.entries(packageEntries(xml)).map(([path, content]) => ({
      path,
      bytes: new TextEncoder().encode(content),
    }));
    const result = parseQtiPackageFromEntries(entries);
    expect(result).toEqual(parseQtiPackage(new Uint8Array(createStoredZip(packageEntries(xml)))));
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(3);
    expect(result.items[2]?.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        severity: "error",
        path: expect.stringMatching(/^extra\.xml(?:\/|$)/),
      }),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([...(result.items[2]?.diagnostics ?? [])]),
    );
    const items = [];
    let summary: QtiPackageStreamSummary | undefined;
    const reads: string[] = [];
    for await (const event of parseQtiPackageStream(
      {
        entries: entries.map(({ path, bytes }) => ({ path, size: bytes.byteLength })),
        async readEntry(path) {
          reads.push(path);
          const entry = entries.find((candidate) => candidate.path === path);
          if (!entry) throw new Error("Missing test entry");
          return entry.bytes;
        },
      },
      { maxEntries: 20, maxEntryBytes: 100_000, maxTotalBytes: 1_000_000, maxDiagnostics: 100 },
    )) {
      if (event.kind === "item") items.push(event.item);
      else summary = event.summary;
    }
    expect(items).toEqual(result.items);
    expect(summary?.ok).toBe(false);
    expect(summary?.diagnostics).toEqual(result.diagnostics);
    expect(reads).toEqual(["imsmanifest.xml", "test.xml", "first.xml", "second.xml", "extra.xml"]);
  },
);

it("checks assets in manifest items omitted from the assessment test", () => {
  const xml = simpleChoiceItemXml().replace(
    "<qti-item-body>",
    '<qti-item-body><img src="missing.svg" alt="Missing image"/>',
  );
  const result = parseQtiPackage(createStoredZip(packageEntries(xml)));
  expect(result.ok).toBe(false);
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ severity: "error", message: expect.stringContaining("missing.svg") }),
  );
});

import { describe, expect, it } from "vitest";
import {
  parseQtiPackage,
  parseQtiPackageStream,
  type QtiPackageSource,
  type QtiPackageStreamSummary,
} from "./index.js";
import { choiceItemXml, createStoredZip, simpleChoiceItemXml } from "./qti-package.fixtures.js";

const streamLimits = {
  maxEntries: 10_000,
  maxEntryBytes: 8 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxDiagnostics: 10_000,
};

function packageSource(entries: Record<string, string | Uint8Array>): QtiPackageSource {
  const bytes = new Map(
    Object.entries(entries).map(
      ([path, content]) =>
        [path, typeof content === "string" ? Buffer.from(content) : content] as const,
    ),
  );
  return {
    entries: [...bytes].map(([path, value]) => ({ path, size: value.byteLength })),
    async readEntry(path, maxBytes) {
      const value = bytes.get(path);
      if (!value || value.byteLength > maxBytes) throw new Error("Invalid fixture entry");
      return value;
    },
  };
}

function streamManifest(count: number): string {
  return `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="bank"><resources>${Array.from(
    { length: count },
    (_, i) =>
      `<resource identifier="i${i}" type="imsqti_item_xmlv3p0" href="i${i}.xml"><file href="i${i}.xml"/></resource>`,
  ).join("")}</resources></manifest>`;
}

describe("incremental QTI package parsing", () => {
  it.each([
    ["ordinary items", simpleChoiceItemXml()],
    ["missing content assets", choiceItemXml()],
    ["malformed XML", "<qti-assessment-item>"],
    [
      "unsupported interaction",
      simpleChoiceItemXml().replaceAll("qti-choice-interaction", "qti-unknown-interaction"),
    ],
  ])("matches canonical package results for %s", async (_name, xml) => {
    const entries = {
      "imsmanifest.xml": streamManifest(2),
      "i0.xml": xml!,
      "i1.xml": simpleChoiceItemXml(),
    };
    const expected = parseQtiPackage(createStoredZip(entries));
    const items = [];
    let summary: QtiPackageStreamSummary | undefined;
    for await (const event of parseQtiPackageStream(packageSource(entries), streamLimits)) {
      if (event.kind === "item") items.push(event.item);
      else summary = event.summary;
    }
    expect(items).toEqual(expected.items);
    const { items: expectedItems, entries: _entries, ...metadata } = expected;
    expect(summary).toEqual({ ...metadata, itemCount: expectedItems.length });
  });

  it("matches test structure, repeated references, assets and manifest dependencies", async () => {
    const entries = {
      "imsmanifest.xml": `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg"><resources>
      <resource identifier="test" type="imsqti_test_xmlv3p0" href="test.xml"><file href="test.xml"/><dependency identifierref="media"/></resource>
      <resource identifier="media" type="webcontent"><file href="image.png"/></resource>
      </resources></manifest>`,
      "test.xml": `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Test"><qti-test-part identifier="p" navigation-mode="linear" submission-mode="individual"><qti-assessment-section identifier="s" title="Section" visible="true"><qti-assessment-item-ref identifier="a" href="i0.xml"/><qti-assessment-item-ref identifier="b" href="i0.xml"/></qti-assessment-section></qti-test-part></qti-assessment-test>`,
      "i0.xml": simpleChoiceItemXml(),
      "image.png": new Uint8Array([1, 2]),
    };
    const expected = parseQtiPackage(createStoredZip(entries));
    const events = await collectStream(parseQtiPackageStream(packageSource(entries), streamLimits));
    expect(events.filter((e) => e.kind === "item").map((e) => e.item)).toEqual(expected.items);
    const { items, entries: _entries, ...metadata } = expected;
    expect(events.at(-1)).toEqual({
      kind: "summary",
      summary: { ...metadata, itemCount: items.length },
    });
  });

  it("reads 7787 questions sequentially without reading assets or retaining item events", async () => {
    const question = Buffer.from(simpleChoiceItemXml());
    const manifest = Buffer.from(streamManifest(7787));
    let reads = 0;
    let yielded = 0;
    let summary: QtiPackageStreamSummary | undefined;
    const source: QtiPackageSource = {
      entries: [
        { path: "imsmanifest.xml", size: manifest.length },
        ...Array.from({ length: 7787 }, (_, i) => ({ path: `i${i}.xml`, size: question.length })),
        { path: "unused.bin", size: 1 },
      ],
      async readEntry(path) {
        if (path === "imsmanifest.xml") return manifest;
        expect(path).toBe(`i${reads}.xml`);
        expect(reads).toBe(yielded);
        reads += 1;
        return question;
      },
    };
    for await (const event of parseQtiPackageStream(source, streamLimits)) {
      if (event.kind === "item") {
        expect(event.index).toBe(yielded++);
      } else summary = event.summary;
    }
    expect(yielded).toBe(7787);
    expect(summary?.ok).toBe(true);
    expect(summary?.itemCount).toBe(7787);
  });

  it("stops reads on consumer cancellation and reports late read failures without secrets", async () => {
    const base = packageSource({
      "imsmanifest.xml": streamManifest(2),
      "i0.xml": simpleChoiceItemXml(),
      "i1.xml": simpleChoiceItemXml(),
    });
    const reads: string[] = [];
    const source: QtiPackageSource = {
      ...base,
      async readEntry(path, max) {
        reads.push(path);
        if (path === "i1.xml") throw new Error("secret token");
        return base.readEntry(path, max);
      },
    };
    for await (const event of parseQtiPackageStream(source, streamLimits)) {
      if (event.kind === "item") break;
    }
    expect(reads).toEqual(["imsmanifest.xml", "i0.xml"]);
    const events = await collectStream(parseQtiPackageStream(source, streamLimits));
    const last = events.at(-1);
    expect(last?.kind === "summary" && last.summary.ok).toBe(false);
    expect(JSON.stringify(events)).not.toContain("secret token");
  });

  it.each(["../outside.xml", "/absolute.xml", "./alias.xml", "i0.xml"])(
    "rejects unsafe or duplicate inventory path %s before body reads",
    async (path) => {
      let reads = 0;
      const events = await collectStream(
        parseQtiPackageStream(
          {
            entries: [
              { path: "i0.xml", size: 1 },
              { path, size: 1 },
            ],
            async readEntry() {
              reads++;
              return new Uint8Array(1);
            },
          },
          streamLimits,
        ),
      );
      expect(reads).toBe(0);
      expect(events[0]?.kind === "summary" && events[0].summary.ok).toBe(false);
    },
  );

  it("rejects size mismatches and budgets before accepting item data", async () => {
    const base = packageSource({
      "imsmanifest.xml": streamManifest(1),
      "i0.xml": simpleChoiceItemXml(),
    });
    for (const source of [
      { ...base, entries: base.entries.map((e) => ({ ...e, size: e.size + 1 })) },
      { ...base, entries: [{ path: "huge.bin", size: streamLimits.maxEntryBytes + 1 }] },
    ]) {
      const events = await collectStream(parseQtiPackageStream(source, streamLimits));
      const last = events.at(-1);
      expect(last?.kind === "summary" && last.summary.ok).toBe(false);
    }
  });
});

async function collectStream<T>(values: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const value of values) results.push(value);
  return results;
}

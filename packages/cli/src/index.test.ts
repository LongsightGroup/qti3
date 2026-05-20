import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { elementSupport, interactionSupport, parseQtiXml, processingSupport } from "@qti3/core";
import { canonicalFixtures, interactionFixtures } from "@qti3/fixtures";
import { describe, expect, it, vi } from "vitest";
import { main } from "./index.js";

describe("@qti3/cli", () => {
  it("writes standalone reference XML fixtures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-fixtures-"));
    try {
      await expect(main(["write-fixtures", directory])).resolves.toBe(0);

      for (const fixture of interactionFixtures) {
        const xml = await readFile(join(directory, `${fixture.id}.xml`), "utf8");
        const result = parseQtiXml(xml);
        expect(result.ok, fixture.id).toBe(true);
        expect(result.document?.item.interactions[0]?.type).toBe(fixture.interactionType);
      }

      await expect(main(["validate-dir", directory])).resolves.toBe(0);
      await expect(main(["score-correct-dir", directory])).resolves.toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints the support matrix", async () => {
    await expect(main(["support-matrix"])).resolves.toBe(0);
  });

  it("prints the accessibility proof matrix", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(main(["a11y-proof"])).resolves.toBe(0);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(report.target).toContain("accessibility proof");
      expect(report.interactions).toHaveLength(interactionSupport.length);
      expect(report.manualAssistiveTechnologyScripts).toHaveLength(3);
      expect(report.interactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            interactionType: "order",
            proof: expect.objectContaining({
              automated: expect.arrayContaining([
                "manual harness reference fixture renders without axe-core violations",
              ]),
              manual: expect.arrayContaining(["keyboard-only completion without pointer input"]),
            }),
          }),
        ]),
      );
    } finally {
      log.mockRestore();
    }
  });

  it("runs the canonical conformance fixture suite", async () => {
    await expect(main(["run-fixtures"])).resolves.toBe(0);
  });

  it("keeps checked-in XML fixture artifacts aligned with canonical fixtures", async () => {
    const fixtureDirectory = join(process.cwd(), "packages/fixtures/xml");
    const expectedFiles = canonicalFixtures.map((fixture) => `${fixture.id}.xml`).sort();
    const actualFiles = (await readdir(fixtureDirectory))
      .filter((file) => file.endsWith(".xml"))
      .sort();

    expect(actualFiles).toEqual(expectedFiles);
    for (const fixture of canonicalFixtures) {
      const xml = await readFile(join(fixtureDirectory, `${fixture.id}.xml`), "utf8");
      expect(xml).toBe(`${fixture.xml}\n`);
    }
  });

  it("exposes evidence metadata in support entries", async () => {
    const choice = interactionSupport.find((support) => support.interactionType === "choice");
    expect(choice).toMatchObject({
      parse: true,
      validate: true,
      render: true,
      process: true,
      fixtures: ["packages/fixtures/xml/choice-reference.xml"],
    });
    expect(choice?.tests).toContain("tests/browser/player.spec.ts");
  });

  it("exposes processing elements in the public support matrix metadata", () => {
    expect(elementSupport).toEqual(expect.arrayContaining(interactionSupport));
    expect(elementSupport).toEqual(expect.arrayContaining(processingSupport));

    expect(processingSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          qtiName: "qti-response-processing",
          category: "processing",
          parse: true,
          validate: true,
          render: false,
          process: true,
        }),
        expect.objectContaining({
          qtiName: "qti-round-to",
          category: "processing",
          parse: true,
          validate: true,
          render: false,
          process: true,
        }),
        expect.objectContaining({
          qtiName: "qti-null",
          category: "processing",
          parse: true,
          validate: true,
          render: false,
          process: true,
        }),
        expect.objectContaining({
          qtiName: "qti-duration-lt",
          category: "processing",
          parse: true,
          validate: true,
          render: false,
          process: true,
        }),
      ]),
    );
  });

  it("keeps supported interactions tied to concrete reference fixtures", () => {
    const fixtureIds = new Set(interactionFixtures.map((fixture) => fixture.id));

    for (const support of interactionSupport) {
      expect(support.fixtures, support.interactionType).toEqual([
        `packages/fixtures/xml/${support.interactionType}-reference.xml`,
      ]);
      expect(fixtureIds.has(`${support.interactionType}-reference`), support.interactionType).toBe(
        true,
      );
      expect(support.tests, support.interactionType).toEqual(
        expect.arrayContaining([
          "packages/fixtures/src/fixtures.test.ts",
          "packages/conformance/src/conformance.test.ts",
          "packages/a11y/src/a11y.test.ts",
          "tests/browser/player.spec.ts",
        ]),
      );
    }
  });

  it("scores template-generated correct responses", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-template-"));
    const file = join(directory, "template.xml");
    try {
      await writeFile(
        file,
        `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-cli" title="template-cli" time-dependent="false" xml:lang="en">
  <qti-template-declaration identifier="ANSWER" cardinality="single" base-type="integer"/>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="integer"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-template-processing>
    <qti-set-template-value identifier="ANSWER">
      <qti-random-integer min="4" max="4"/>
    </qti-set-template-value>
    <qti-set-correct-response identifier="RESPONSE">
      <qti-variable identifier="ANSWER"/>
    </qti-set-correct-response>
  </qti-template-processing>
  <qti-item-body>
    <qti-slider-interaction response-identifier="RESPONSE" lower-bound="0" upper-bound="10"/>
  </qti-item-body>
</qti-assessment-item>`,
        "utf8",
      );

      await expect(main(["score-correct", file])).resolves.toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("inspects package zips and enumerates loadable item references", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-"));
    const file = join(directory, "package.zip");
    const choice = interactionFixtures.find((fixture) => fixture.interactionType === "choice");
    const textEntry = interactionFixtures.find(
      (fixture) => fixture.interactionType === "textEntry",
    );
    if (!choice || !textEntry) throw new Error("Missing package fixtures.");

    try {
      await writeFile(
        file,
        createStoredZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0p1">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
          "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Package">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" visible="true">
      <qti-assessment-item-ref identifier="text-ref" href="items/text-entry.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
          "items/choice.xml": choice.xml,
          "items/text-entry.xml": textEntry.xml,
          "items/image.png": Buffer.from([0]),
        }),
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["inspect-package", file])).resolves.toBe(0);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      log.mockRestore();

      expect(report).toMatchObject({
        checked: 2,
        failed: 0,
        discoveredReferences: ["items/choice.xml", "items/text-entry.xml"],
      });
      expect(report.assetFiles).toEqual(["items/image.png"]);
      expect(report.results).toEqual([
        expect.objectContaining({ file: "items/choice.xml", source: "manifest", ok: true }),
        expect.objectContaining({
          file: "items/text-entry.xml",
          source: "assessment-test",
          ok: true,
        }),
      ]);
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("inspects deflated package zips", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-deflated-"));
    const file = join(directory, "package.zip");
    const choice = interactionFixtures.find((fixture) => fixture.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    try {
      await writeFile(
        file,
        createDeflatedZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
          "items/choice.xml": choice.xml,
        }),
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["inspect-package", file])).resolves.toBe(0);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      log.mockRestore();

      expect(report).toMatchObject({
        checked: 1,
        failed: 0,
        discoveredReferences: ["items/choice.xml"],
      });
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects package zip entries that escape the package root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-paths-"));
    const file = join(directory, "package.zip");
    const choice = interactionFixtures.find((fixture) => fixture.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    try {
      await writeFile(
        file,
        createStoredZip({
          "../items/choice.xml": choice.xml,
        }),
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["inspect-package", file])).resolves.toBe(1);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      log.mockRestore();

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        packageErrors: ["ZIP entry ../items/choice.xml escapes the package root."],
      });
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects package item references that escape the package root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-refs-"));
    const file = join(directory, "package.zip");
    const choice = interactionFixtures.find((fixture) => fixture.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    try {
      await writeFile(
        file,
        createStoredZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="../items/choice.xml">
      <file href="../items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
          "items/choice.xml": choice.xml,
        }),
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["inspect-package", file])).resolves.toBe(1);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      log.mockRestore();

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        packageErrors: ["package reference ../items/choice.xml escapes the package root."],
      });
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

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

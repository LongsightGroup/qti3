import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  readQtiPackageZipEntries,
  readQtiPackageZipEntriesAsync,
  type QtiDiagnostic,
  type QtiPackageParseOptions,
} from "./index.js";
import { createDeflatedZip, createStoredZip } from "./qti-package.fixtures.js";

const boundedInflate: NonNullable<QtiPackageParseOptions["inflateRaw"]> = (bytes, context) =>
  inflateRawSync(bytes, { maxOutputLength: context.maxOutputLength });

async function compareReaders(
  zip: Uint8Array,
  options: QtiPackageParseOptions = { inflateRaw: boundedInflate },
) {
  const syncDiagnostics: QtiDiagnostic[] = [];
  const asyncDiagnostics: QtiDiagnostic[] = [];
  const entries = readQtiPackageZipEntries(zip, options, syncDiagnostics);
  const inflateRaw = options.inflateRaw;
  const asyncEntries = await readQtiPackageZipEntriesAsync(
    zip,
    {
      limits: options.limits,
      inflateRaw: inflateRaw
        ? async (bytes, context) => {
            await Promise.resolve();
            return inflateRaw(bytes, context);
          }
        : undefined,
    },
    asyncDiagnostics,
  );
  expect(asyncDiagnostics).toEqual(syncDiagnostics);
  expect(asyncEntries).toEqual(entries);
  return { entries, diagnostics: syncDiagnostics };
}

describe("shared synchronous and asynchronous ZIP policy", () => {
  it.each([createStoredZip, createDeflatedZip])(
    "preserves binary bytes, Unicode paths, empty files, and directory entries",
    async (createZip) => {
      const result = await compareReaders(
        createZip({
          "items/": "",
          "items/é.xml": "<item/>",
          empty: "",
          binary: new Uint8Array([0, 255, 2]),
        }),
      );
      expect(result.diagnostics).toEqual([]);
      expect(result.entries.map((entry) => entry.path)).toEqual(["items/é.xml", "empty", "binary"]);
      expect([...(result.entries[2]?.bytes ?? [])]).toEqual([0, 255, 2]);
    },
  );

  const mutations: readonly [
    string,
    (zip: Buffer, central: number, end: number) => void,
    string,
  ][] = [
    ["local signature", (zip) => zip.writeUInt32LE(0, 0), "package.zip.localHeader"],
    [
      "central signature",
      (zip, central) => zip.writeUInt32LE(0, central),
      "package.zip.centralDirectory.entry",
    ],
    [
      "directory bounds",
      (zip, _, end) => zip.writeUInt32LE(1, end + 12),
      "package.zip.centralDirectory.bounds",
    ],
    [
      "entry count",
      (zip, _, end) => {
        zip.writeUInt16LE(1, end + 8);
        zip.writeUInt16LE(1, end + 10);
      },
      "package.zip.centralDirectory.count",
    ],
    [
      "multi-disk",
      (zip, _, end) => zip.writeUInt16LE(1, end + 4),
      "package.zip.format.unsupported",
    ],
    [
      "ZIP64",
      (zip, central) => zip.writeUInt32LE(0xffffffff, central + 24),
      "package.zip.format.unsupported",
    ],
    [
      "flags",
      (zip, central) => zip.writeUInt16LE(1, central + 8),
      "package.zip.entry.flags.unsupported",
    ],
    [
      "compression",
      (zip, central) => zip.writeUInt16LE(99, central + 10),
      "package.zip.entry.compression.unsupported",
    ],
    ["local sizes", (zip) => zip.writeUInt32LE(2, 22), "package.zip.localHeader.mismatch"],
    ["local name", (zip) => zip.writeUInt8(98, 30), "package.zip.localHeader.mismatch"],
    ["UTF-8", (zip, central) => zip.writeUInt8(255, central + 46), "package.zip.entry.name"],
    [
      "truncated body",
      (zip, central) => zip.writeUInt32LE(1000, central + 20),
      "package.zip.entry.truncated",
    ],
    [
      "duplicate path",
      (zip, central) => zip.writeUInt8(97, central + 47 + 46),
      "package.entry.duplicate",
    ],
    [
      "overlap",
      (zip, central) => {
        zip.writeUInt32LE(33, 18);
        zip.writeUInt32LE(33, 22);
        zip.writeUInt32LE(33, central + 20);
        zip.writeUInt32LE(33, central + 24);
      },
      "package.zip.entry.overlap",
    ],
  ];
  it.each(mutations)(
    "rejects %s with identical diagnostics and partial entries",
    async (_, mutate, code) => {
      const zip = createStoredZip({ a: "1", b: "2" });
      mutate(zip, zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])), zip.length - 22);
      const result = await compareReaders(zip);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code, severity: "error" }),
      );
    },
  );

  it.each(["../a", "/a", "a/../b", "a\\b", "a\0b", "./a"])(
    "rejects ambiguous or unsafe path %s",
    async (path) => {
      const result = await compareReaders(createStoredZip({ [path]: "1" }));
      expect(result.entries).toEqual([]);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ severity: "error" }));
    },
  );

  it.each([
    [{ maxEntries: 1 }, "package.zip.limit.entries"],
    [{ maxEntryUncompressedBytes: 2 }, "package.zip.limit.entrySize"],
    [{ maxTotalUncompressedBytes: 5 }, "package.zip.limit.totalSize"],
    [{ maxEntries: NaN }, "package.limit.invalid"],
  ] as const)("enforces budgets before inflation: %j", async (limits, code) => {
    const result = await compareReaders(createStoredZip({ a: "123", b: "456" }), { limits });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }));
  });

  it("matches ratio, missing-inflater, rejection, and wrong-output diagnostics", async () => {
    const zip = createDeflatedZip({ a: "a".repeat(1000) });
    const ratio = await compareReaders(zip, {
      limits: { maxCompressionRatio: 2 },
      inflateRaw: boundedInflate,
    });
    expect(ratio.diagnostics[0]?.code).toBe("package.zip.limit.compressionRatio");
    expect((await compareReaders(zip, {})).diagnostics[0]?.code).toBe(
      "package.zip.entry.compression.unsupported",
    );
    expect(
      (
        await compareReaders(zip, {
          inflateRaw: () => {
            throw new Error("host detail");
          },
        })
      ).diagnostics[0]?.code,
    ).toBe("package.zip.entry.inflate");
    expect(
      (await compareReaders(zip, { inflateRaw: () => new Uint8Array(1) })).diagnostics[0]?.code,
    ).toBe("package.zip.entry.size");
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(16, 22);
    zip.writeUInt32LE(16, central + 24);
    expect((await compareReaders(zip)).diagnostics[0]?.code).toBe("package.zip.entry.inflate");
  });

  it("accepts ZIP comments and descriptor flags without trusting local sizes", async () => {
    const zip = createDeflatedZip({ a: "abc" });
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt16LE(8, 6);
    zip.writeUInt16LE(8, central + 8);
    zip.writeUInt32LE(0, 18);
    zip.writeUInt32LE(0, 22);
    zip.writeUInt16LE(3, zip.length - 2);
    const result = await compareReaders(Buffer.concat([zip, Buffer.from("zip")]));
    expect(result.diagnostics).toEqual([]);
    expect(Buffer.from(result.entries[0]?.bytes ?? []).toString()).toBe("abc");
  });
});

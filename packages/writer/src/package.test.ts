import { parseQtiPackage } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";

import {
  buildQti3ChoiceItem,
  qti3TrustedXmlFragment,
  validateQti3Package,
  writeQti3PackageFilesResult,
  writeQti3PackageManifestResult,
  writeQti3PackageZip,
  writeQti3PackageZipResult,
  Qti3WriterError,
  type Qti3PackageAuthoringInput,
} from "./index.js";

describe("qti3 package writer", () => {
  it("writes an item-bank manifest for structured authoring items and declared assets", () => {
    const result = writeQti3PackageManifestResult(packageInput());

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Expected package manifest to write.");
    expect(result.xml).toContain(
      '<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg-1">',
    );
    expect(result.xml).toContain("<title>Example Package</title>");
    expect(result.xml).toContain(
      '<resource identifier="choice-1" type="imsqti_item_xmlv3p0" href="items/choice.xml">',
    );
    expect(result.xml).toContain('<file href="items/assets/prompt.png"/>');
  });

  it("writes package files with generated item XML and asset bytes", () => {
    const result = writeQti3PackageFilesResult(packageInput());

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Expected package files to write.");
    expect(result.files.map((file) => file.path)).toEqual([
      "imsmanifest.xml",
      "items/assets/prompt.png",
      "items/choice.xml",
    ]);
    expect(result.files.find((file) => file.path === "items/assets/prompt.png")?.data).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
    expect(String(result.files.find((file) => file.path === "items/choice.xml")?.data)).toContain(
      "<qti-assessment-item",
    );
  });

  it("writes deterministic ZIP packages that round-trip through qti3-core", () => {
    const first = writeQti3PackageZip(packageInput());
    const second = writeQti3PackageZip(packageInput());
    const parsed = parseQtiPackage(first);

    expect(first).toEqual(second);
    expect(parsed.ok).toBe(true);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.packageShape).toBe("manifest-item-resources");
    expect(parsed.items).toEqual([
      expect.objectContaining({
        href: "items/choice.xml",
        identifier: "choice-1",
        title: "Choice One",
        assetHrefs: ["items/assets/prompt.png"],
      }),
    ]);
    expect(parsed.assets).toEqual([
      expect.objectContaining({
        href: "items/assets/prompt.png",
        mediaType: "image/png",
        source: "manifest-resource",
      }),
    ]);
  });

  it("accepts trusted assessment item XML as a package item", () => {
    const xml = buildQti3ChoiceItem({
      identifier: "choice-xml",
      title: "Choice XML",
      responseCardinality: "single",
      choices: [
        { identifier: "A", text: "A" },
        { identifier: "B", text: "B" },
      ],
      correctResponse: ["A"],
    });
    const result = writeQti3PackageZipResult({
      identifier: "pkg-xml",
      items: [{ kind: "xml", path: "items/choice-xml.xml", identifier: "choice-xml", xml }],
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Expected package ZIP to write.");
    expect(parseQtiPackage(result.zip).items[0]).toMatchObject({
      href: "items/choice-xml.xml",
      identifier: "choice-xml",
    });
  });

  it("returns diagnostics for invalid package structure", () => {
    const diagnostics = validateQti3Package({
      identifier: "bad package",
      title: "",
      items: [
        {
          kind: "xml",
          path: "/items/choice.xml",
          identifier: "same",
          xml: "<not-qti/>",
          assets: ["missing.png", "missing.png"],
        },
        {
          kind: "xml",
          path: "/items/choice.xml",
          identifier: "same",
          xml: buildQti3ChoiceItem({
            identifier: "different",
            title: "Different",
            responseCardinality: "single",
            choices: [
              { identifier: "A", text: "A" },
              { identifier: "B", text: "B" },
            ],
            correctResponse: ["A"],
          }),
        },
      ],
      assets: [{ path: "../missing.png", data: "" }],
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "invalid_identifier",
        "missing_package_title",
        "invalid_package_path_absolute",
        "duplicate_package_path",
        "duplicate_package_item_identifier",
        "invalid_package_item_xml_qti.root",
        "duplicate_package_item_asset",
        "missing_package_asset",
        "invalid_package_path_escape",
        "unreferenced_package_asset",
        "package_item_identifier_mismatch",
      ]),
    );
  });

  it("returns authoring item diagnostics instead of throwing from result APIs", () => {
    const result = writeQti3PackageFilesResult({
      identifier: "pkg-invalid-item",
      items: [
        {
          kind: "authoringItem",
          path: "items/bad.xml",
          item: {
            interactionType: "choice",
            identifier: "bad item",
            title: "",
            responseCardinality: "single",
            choices: [],
            correctResponse: [],
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid package files to fail.");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["invalid_identifier", "missing_title", "missing_choices"]),
    );
  });

  it("throwing convenience APIs throw Qti3WriterError for invalid packages", () => {
    expect(() =>
      writeQti3PackageZip({
        identifier: "pkg-empty",
        items: [],
      }),
    ).toThrow(Qti3WriterError);
  });
});

function packageInput(): Qti3PackageAuthoringInput {
  return {
    identifier: "pkg-1",
    title: "Example Package",
    items: [
      {
        kind: "authoringItem",
        path: "items/choice.xml",
        assets: ["items/assets/prompt.png"],
        item: {
          interactionType: "choice",
          identifier: "choice-1",
          title: "Choice One",
          bodyHtml: qti3TrustedXmlFragment('<p><img src="assets/prompt.png" alt="Prompt"/></p>'),
          responseCardinality: "single",
          choices: [
            { identifier: "A", text: "A" },
            { identifier: "B", text: "B" },
          ],
          correctResponse: ["B"],
        },
      },
    ],
    assets: [{ path: "items/assets/prompt.png", data: new Uint8Array([137, 80, 78, 71]) }],
  };
}

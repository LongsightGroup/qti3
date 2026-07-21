import { describe, expect, it } from "vitest";
import { createCatalogSupportResolution, parseQtiXml } from "@longsightgroup/qti3-core";
import { catalogFixtures } from "@longsightgroup/qti3-fixtures";
import { createCatalogDeliveryResolution } from "./catalog-delivery.js";

describe("createCatalogDeliveryResolution", () => {
  it("preserves referenced-file MIME types while resolving package assets", () => {
    const fixture = catalogFixtures.find((candidate) => candidate.id === "catalog-glossary-file");
    const document = parseQtiXml(fixture?.xml ?? "").document;
    expect(document).toBeDefined();

    const delivery = createCatalogDeliveryResolution(
      createCatalogSupportResolution(document!, { supports: "glossary-on-screen" }),
      (url) => `/assets/${url}`,
    );

    expect(delivery.references[0]?.matches[0]?.files).toEqual([
      expect.objectContaining({
        href: "/assets/glossary/grades5_9/harmonica.html",
        mimeType: "text/html",
      }),
    ]);
  });

  it("preserves structured media, MIME types, and fragments through asset resolution", () => {
    const fixture = catalogFixtures.find(
      (candidate) => candidate.id === "catalog-multilingual-supports",
    );
    const document = parseQtiXml(fixture?.xml ?? "").document;
    expect(document).toBeDefined();
    if (!document) return;

    const delivery = createCatalogDeliveryResolution(
      createCatalogSupportResolution(document, { supports: "spoken", languages: "en" }),
      (url) => `/assets/${url}`,
    );
    const support = delivery.references[0]?.matches[0];

    expect(support?.selectionReason).toBe("exact-language");
    const audio = support?.html.find((node) => node.kind === "element" && node.name === "audio");
    expect(audio).toMatchObject({ kind: "element", name: "audio" });
    const sources =
      audio?.kind === "element"
        ? audio.children.filter((node) => node.kind === "element" && node.name === "source")
        : [];
    expect(sources).toMatchObject([
      {
        attributes: {
          src: "/assets/audio/precise.mp3#t=0,2.5",
          type: "audio/mpeg",
        },
      },
      {
        attributes: {
          src: "/assets/audio/precise.ogg#t=0,2.5",
          type: "audio/ogg",
        },
      },
    ]);
  });

  it("drops unsafe elements, attributes, URLs, and unsafe resolver output", () => {
    const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="safe-catalog" title="safe-catalog" time-dependent="false">
      <qti-item-body><p data-catalog-idref="term">Term</p></qti-item-body>
      <qti-catalog-info><qti-catalog id="term">
        <qti-card support="glossary-on-screen"><qti-html-content>
          <script>alert(1)</script>
          <p onclick="alert(1)" style="color:red"><a href="javascript:alert(1)">Unsafe link</a></p>
          <img src="images/safe.png" onerror="alert(1)" alt="Safe image"/>
        </qti-html-content></qti-card>
      </qti-catalog></qti-catalog-info>
    </qti-assessment-item>`;
    const document = parseQtiXml(xml).document;
    expect(document).toBeDefined();

    const delivery = createCatalogDeliveryResolution(
      createCatalogSupportResolution(document!, { supports: "glossary-on-screen" }),
      () => "javascript:alert(1)",
    );
    const serialized = JSON.stringify(delivery.references[0]?.matches[0]?.html);

    expect(serialized).not.toContain("script");
    expect(serialized).not.toContain("onclick");
    expect(serialized).not.toContain("style");
    expect(serialized).not.toContain("javascript:");
    expect(serialized).not.toContain("src");
    expect(serialized).toContain("Safe image");
  });

  it("preserves object URLs returned by the host asset resolver", () => {
    const fixture = catalogFixtures.find(
      (candidate) => candidate.id === "catalog-multilingual-supports",
    );
    const document = parseQtiXml(fixture?.xml ?? "").document;
    expect(document).toBeDefined();
    if (!document) return;

    const delivery = createCatalogDeliveryResolution(
      createCatalogSupportResolution(document, { supports: "spoken", languages: "en" }),
      (url) => `blob:https://package.example/${encodeURIComponent(url)}`,
    );
    const serialized = JSON.stringify(delivery.references[0]?.matches[0]);

    expect(serialized).toContain("blob:https://package.example/");
    expect(serialized).not.toContain('"src":"audio/');
  });
});

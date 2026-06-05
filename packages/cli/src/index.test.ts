import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import {
  elementSupport,
  interactionSupport,
  parseQtiXml,
  processingSupport,
  isEnforcedSharedVocabularyLevel,
  sharedVocabularyClassSupport,
} from "@longsightgroup/qti3-core";
import {
  basicItemPlayerFixtures,
  canonicalFixtures,
  interactionFixtures,
} from "@longsightgroup/qti3-fixtures";
import { describe, expect, it, vi } from "vitest";
import { main } from "./index.js";

describe("@longsightgroup/qti3-cli", () => {
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
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(main(["support-matrix"])).resolves.toBe(0);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(Object.keys(report).slice(0, 2)).toEqual(["target", "sharedVocabularyClasses"]);
      expect(report.sharedVocabularyClasses).toHaveLength(sharedVocabularyClassSupport.length);
      expect(report.sharedVocabularyClasses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            className: "qti-choices-top",
            scope: "interaction",
            interactions: expect.arrayContaining(["order", "match", "gapMatch"]),
            level: "full",
            tests: expect.arrayContaining(["tests/browser/player-dom-behavior.spec.ts"]),
          }),
          expect.objectContaining({
            className: "qti-layout-row",
            scope: "content",
            level: "stylesheet",
          }),
          expect.objectContaining({
            className: "qti-input-width-10",
            scope: "gap",
            interactions: ["gapMatch"],
            level: "full",
          }),
          expect.objectContaining({
            className: "data-qti-media-player-controls",
            scope: "interaction",
            interactions: ["media"],
            level: "full",
            tests: expect.arrayContaining(["tests/browser/player.spec.ts"]),
          }),
          expect.objectContaining({
            className: "data-qti-media-player-pause-delay",
            scope: "interaction",
            interactions: ["media"],
            level: "full",
            tests: expect.arrayContaining(["tests/browser/player.spec.ts"]),
          }),
          expect.objectContaining({
            className: "data-qti-media-player-pause-duration",
            scope: "interaction",
            interactions: ["media"],
            level: "full",
            tests: expect.arrayContaining(["tests/browser/player.spec.ts"]),
          }),
        ]),
      );
    } finally {
      log.mockRestore();
    }
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

  it("fails release support assertions when matrix evidence regresses", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(main(["assert-support"])).resolves.toBe(0);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(report).toMatchObject({
        checked: elementSupport.length + sharedVocabularyClassSupport.length,
        failed: 0,
        failures: [],
      });
    } finally {
      log.mockRestore();
    }
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

  it("keeps checked-in shared-vocabulary Basic item-player XML aligned with fixture metadata", async () => {
    const fixture = basicItemPlayerFixtures.find((item) => item.id === "basic-shared-vocabulary");
    if (!fixture) throw new Error("Missing basic-shared-vocabulary fixture.");
    const path = join(
      process.cwd(),
      "packages/fixtures/packages/basic-item-player/valid-item-only/items",
      "shared-vocabulary.xml",
    );
    const xml = await readFile(path, "utf8");
    expect(xml).toBe(`${fixture.xml}\n`);
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

  it("exposes shared vocabulary class support metadata", () => {
    expect(sharedVocabularyClassSupport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          className: "qti-match-tabular",
          scope: "interaction",
          interactions: ["match"],
          level: "full",
        }),
        expect.objectContaining({
          className: "qti-header-hidden",
          scope: "interaction",
          interactions: ["match"],
          level: "conditional",
        }),
        expect.objectContaining({
          className: "qti-counter-up",
          scope: "interaction",
          interactions: ["extendedText"],
          level: "full",
        }),
      ]),
    );

    for (const support of sharedVocabularyClassSupport) {
      if (isEnforcedSharedVocabularyLevel(support.level)) {
        expect(support.tests?.length, support.className).toBeGreaterThan(0);
      }
    }
  });

  it("ties processing support evidence to public reference fixtures where available", () => {
    const fixturePaths = new Set(
      canonicalFixtures.map((fixture) => `packages/fixtures/xml/${fixture.id}.xml`),
    );
    const expectedFixtureEvidence = new Map([
      ["qti-template-processing", "packages/fixtures/xml/template-processing-reference.xml"],
      ["qti-response-processing", "packages/fixtures/xml/advanced-processing-reference.xml"],
      ["qti-gcd", "packages/fixtures/xml/advanced-processing-reference.xml"],
      ["qti-inside", "packages/fixtures/xml/advanced-processing-reference.xml"],
      ["qti-stats-operator", "packages/fixtures/xml/advanced-processing-reference.xml"],
    ]);

    for (const [qtiName, fixturePath] of expectedFixtureEvidence) {
      const support = processingSupport.find((entry) => entry.qtiName === qtiName);
      expect(support?.fixtures, qtiName).toContain(fixturePath);
    }

    for (const support of processingSupport) {
      for (const fixturePath of support.fixtures) {
        expect(fixturePaths.has(fixturePath), `${support.qtiName} ${fixturePath}`).toBe(true);
      }
    }
  });

  it("keeps supported interactions tied to concrete reference fixtures", () => {
    const fixtureIds = new Set(interactionFixtures.map((fixture) => fixture.id));

    const extraInteractionFixtures: Partial<Record<string, string[]>> = {
      extendedText: ["packages/fixtures/packages/sv-matrix/items/extended-text-pattern-mask.xml"],
      textEntry: ["packages/fixtures/packages/sv-matrix/items/text-entry-pattern-mask-inline.xml"],
    };
    const extraInteractionTests: Partial<Record<string, string[]>> = {
      extendedText: [
        "packages/core/src/pattern-mask.test.ts",
        "tests/browser/player-dom-behavior.spec.ts",
      ],
      textEntry: [
        "packages/core/src/pattern-mask.test.ts",
        "tests/browser/player-dom-behavior.spec.ts",
      ],
    };

    for (const support of interactionSupport) {
      expect(support.fixtures, support.interactionType).toEqual([
        `packages/fixtures/xml/${support.interactionType}-reference.xml`,
        ...(extraInteractionFixtures[support.interactionType] ?? []),
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
          ...(extraInteractionTests[support.interactionType] ?? []),
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
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
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

      const strictLog = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["validate-package", file])).resolves.toBe(0);
      const strictReport = JSON.parse(String(strictLog.mock.calls.at(-1)?.[0]));
      strictLog.mockRestore();
      expect(strictReport).toMatchObject({
        strict: true,
        checked: 2,
        failed: 0,
      });
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

  it("rejects unreadable package zips", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-broken-"));
    const file = join(directory, "package.zip");

    try {
      await writeFile(file, "not a zip");

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["inspect-package", file])).resolves.toBe(1);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      log.mockRestore();

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        packageErrors: ["No ZIP central directory was found."],
      });
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("strict package validation rejects direct item zips without a manifest reference", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-strict-"));
    const file = join(directory, "package.zip");
    const choice = interactionFixtures.find((fixture) => fixture.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    try {
      await writeFile(
        file,
        createStoredZip({
          "items/choice.xml": choice.xml,
        }),
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["validate-package", file])).resolves.toBe(1);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      log.mockRestore();

      expect(report).toMatchObject({
        strict: true,
        checked: 0,
        failed: 3,
        packageErrors: [
          "strict package validation requires imsmanifest.xml.",
          "strict package validation requires manifest or assessment-test item references.",
          "qti-assessment-item items/choice.xml is not referenced by the package manifest or assessment test.",
        ],
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

  it("reports package item references that do not exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-missing-ref-"));
    const file = join(directory, "package.zip");

    try {
      await writeFile(
        file,
        createStoredZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/missing.xml"/>
  </resources>
</manifest>`,
        }),
      );

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await expect(main(["inspect-package", file])).resolves.toBe(1);
      const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      log.mockRestore();

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        discoveredReferences: ["items/missing.xml"],
        packageErrors: ["package reference items/missing.xml was not found."],
      });
    } finally {
      vi.restoreAllMocks();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports Basic item-player readiness from item-only package directories", async () => {
    const { code, report } = await runCliJson([
      "basic-item-player-report",
      "packages/fixtures/packages/basic-item-player",
    ]);

    expect(code).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      failed: 0,
      certificationContext: {
        officialCertification: false,
        profileLevel: "Basic",
        evidenceCapability: "IMPORT - Item Only Packages",
      },
      packageItemCount: 11,
      missingPackageFeatures: [],
      toleranceChecked: 2,
      toleranceFailed: 0,
      tolerance: [
        { fixtureId: "basic-extra-item-feature-tolerance", ok: true, diagnostics: [] },
        { fixtureId: "basic-modal-feedback-tolerance", ok: true, diagnostics: [] },
      ],
      validatorEvidence: [],
      referencedItemResources: [
        "items/choice.xml",
        "items/extended-text.xml",
        "items/match.xml",
        "items/text-entry.xml",
        "items/html-subset.xml",
        "items/template-processing.xml",
        "items/composite.xml",
        "items/mathml.xml",
        "items/shared-vocabulary.xml",
        "items/alt-text.xml",
        "items/tolerance-extra-features.xml",
      ],
    });
    expect(report.basicFeatures).toEqual(
      basicFeatureIds().map((featureId) =>
        expect.objectContaining({
          featureId,
          status: "supported",
          packageEvidence: true,
        }),
      ),
    );
    expect(report.packages[0]!).toMatchObject({
      checked: 11,
      failed: 0,
      assessmentTestFiles: [],
    });
  });

  it("fails Basic item-player package readiness when imsmanifest.xml is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-basic-missing-manifest-"));
    const choice = interactionFixtures.find((fixture) => fixture.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    try {
      await mkdir(join(directory, "items"));
      await writeFile(join(directory, "items/choice.xml"), choice.xml, "utf8");

      const { code, report } = await runCliJson(["basic-item-player-report", directory]);

      expect(code).toBe(1);
      expect(report.ok).toBe(false);
      expect(report.packages[0]!.packageErrors).toEqual(
        expect.arrayContaining(["strict package validation requires imsmanifest.xml."]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails Basic item-player package readiness when a manifest item is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-basic-missing-item-"));
    const file = join(directory, "package.zip");

    try {
      await writeFile(
        file,
        createStoredZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/missing.xml"/>
  </resources>
</manifest>`,
        }),
      );

      const { code, report } = await runCliJson(["basic-item-player-report", file]);

      expect(code).toBe(1);
      expect(report.packages[0]!).toMatchObject({
        checked: 0,
        failed: 1,
        discoveredReferences: ["items/missing.xml"],
        packageErrors: ["package reference items/missing.xml was not found."],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("strict package validation rejects missing XML dependency resources", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-missing-dependency-"));
    const file = join(directory, "package.zip");

    try {
      await writeFile(
        file,
        createStoredZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
    </resource>
  </resources>
</manifest>`,
          "items/choice.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="dependency-missing" title="dependency-missing" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-assessment-stimulus-ref identifier="stimulus" href="../stimuli/missing.xml"/>
  <qti-stylesheet href="../styles/missing.css" type="text/css"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`,
        }),
      );

      const { code, report } = await runCliJson(["validate-package", file]);

      expect(code).toBe(1);
      expect(report.packageErrors).toEqual(
        expect.arrayContaining([
          "package dependency stimuli/missing.xml referenced from items/choice.xml was not found.",
          "package dependency styles/missing.css referenced from items/choice.xml was not found.",
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("strict package validation rejects invalid qti-assessment-item child order", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-child-order-"));
    const file = join(directory, "package.zip");

    try {
      await writeFile(
        file,
        createStoredZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml">
      <file href="items/choice.xml"/>
      <file href="styles/item.css"/>
    </resource>
  </resources>
</manifest>`,
          "styles/item.css": ".fixture { color: currentColor; }",
          "items/choice.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-order" title="bad-order" time-dependent="false">
  <qti-stylesheet href="../styles/item.css" type="text/css"/>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`,
        }),
      );

      const { code, report } = await runCliJson(["validate-package", file]);

      expect(code).toBe(1);
      expect(report.results[0]!.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "package.itemChild.order", severity: "error" }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails Basic item-player package readiness when feature coverage is incomplete", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-basic-incomplete-"));
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
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="items/choice.xml"/>
  </resources>
</manifest>`,
          "items/choice.xml": choice.xml.replace(' max-choices="1"', ""),
        }),
      );

      const { code, report } = await runCliJson(["basic-item-player-report", file]);

      expect(code).toBe(1);
      expect(report.packages[0]!).toMatchObject({ checked: 1, failed: 0 });
      expect(report.missingPackageFeatures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ featureId: "Q-2" }),
          expect.objectContaining({ featureId: "Q-5" }),
          expect.objectContaining({ featureId: "Q-13" }),
          expect.objectContaining({ featureId: "Q-20" }),
          expect.objectContaining({ featureId: "A-1" }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails Basic item-player package readiness for direct unreferenced item XML", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-basic-direct-item-"));
    const file = join(directory, "package.zip");
    const choice = interactionFixtures.find((fixture) => fixture.interactionType === "choice");
    if (!choice) throw new Error("Missing package fixture.");

    try {
      await writeFile(
        file,
        createStoredZip({
          "imsmanifest.xml": `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="pkg">
  <resources/>
</manifest>`,
          "items/choice.xml": choice.xml,
        }),
      );

      const { code, report } = await runCliJson(["basic-item-player-report", file]);

      expect(code).toBe(1);
      expect(report.packages[0]!.packageErrors).toEqual(
        expect.arrayContaining([
          "strict package validation requires manifest or assessment-test item references.",
          "qti-assessment-item items/choice.xml is not referenced by the package manifest or assessment test.",
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("treats assessment-test packages as out of scope for Basic item-player readiness", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-basic-test-package-"));
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
    <resource identifier="test" type="imsqti_test_xmlv3p0" href="assessment.xml"/>
  </resources>
</manifest>`,
          "assessment.xml": `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="test" title="Package">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" visible="true">
      <qti-assessment-item-ref identifier="choice-ref" href="items/choice.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`,
          "items/choice.xml": choice.xml,
        }),
      );

      const { code, report } = await runCliJson(["basic-item-player-report", file]);

      expect(code).toBe(1);
      expect(report.packages[0]!.assessmentTestFiles).toEqual(["assessment.xml"]);
      expect(report.packages[0]!.packageErrors).toEqual(
        expect.arrayContaining([
          "assessment-test packages are out of scope for Basic item-player readiness: assessment.xml.",
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

interface CliPackageJsonReport {
  packageErrors?: unknown;
  checked?: number;
  failed?: number;
  assessmentTestFiles?: unknown;
}

interface CliResultJsonReport {
  diagnostics?: unknown;
}

interface CliJsonReport {
  ok?: boolean;
  target?: unknown;
  interactions?: unknown;
  manualAssistiveTechnologyScripts?: unknown;
  assetFiles?: unknown;
  basicFeatures?: unknown;
  packageErrors?: unknown;
  missingPackageFeatures?: unknown;
  packages: CliPackageJsonReport[];
  results: CliResultJsonReport[];
}

async function runCliJson(args: string[]): Promise<{ code: number; report: CliJsonReport }> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const code = await main(args);
    const payload = JSON.parse(String(log.mock.calls.at(-1)?.[0])) as Partial<CliJsonReport>;
    const report: CliJsonReport = {
      packages: [],
      results: [],
      ...payload,
    };
    return { code, report };
  } finally {
    log.mockRestore();
    vi.restoreAllMocks();
  }
}

function basicFeatureIds(): string[] {
  return [
    "Q-2",
    "Q-5",
    "Q-13",
    "Q-20",
    "I-0",
    "I-1",
    "I-2",
    "I-7",
    "I-8",
    "I-9b",
    "I-17",
    "I-18",
    "I-19",
    "A-1",
    "P-4",
  ];
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

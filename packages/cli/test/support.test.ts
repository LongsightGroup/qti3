import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  elementSupport,
  interactionSupport,
  isEnforcedSharedVocabularyLevel,
  parseQtiXml,
  processingSupport,
  sharedVocabularyClassSupport,
} from "@longsightgroup/qti3-core";
import {
  basicItemPlayerFixtures,
  canonicalFixtures,
  interactionFixtures,
} from "@longsightgroup/qti3-fixtures";
import { describe, expect, it } from "vitest";
import { lastStderr, lastStdout, runCli } from "./cli-harness.js";
import { basicImportTestPackageEntries } from "./package-fixtures.js";
import { createStoredZip } from "./zip-fixtures.js";
import { main } from "../src/index.js";

describe("@longsightgroup/qti3-cli support and certification", () => {
  it("writes standalone reference XML fixtures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-fixtures-"));
    try {
      await expect(main(["write-fixtures", directory])).resolves.toBe(0);

      for (const fixture of interactionFixtures) {
        const xml = await readFile(join(directory, `${fixture.id}.xml`), "utf8");
        const result = parseQtiXml(xml);
        expect(result.ok).toBe(true);
        expect(result.document?.item.interactions[0]?.type).toBe(fixture.interactionType);
      }

      await expect(main(["validate-dir", directory])).resolves.toBe(0);
      await expect(main(["score-correct-dir", directory])).resolves.toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints the support matrix", async () => {
    const { code, output } = await runCli(["support-matrix"]);
    expect(code).toBe(0);
    const report = JSON.parse(lastStdout(output));
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
          tests: expect.arrayContaining(["tests/browser/player-media.spec.ts"]),
        }),
        expect.objectContaining({
          className: "data-qti-media-player-pause-delay",
          scope: "interaction",
          interactions: ["media"],
          level: "full",
          tests: expect.arrayContaining(["tests/browser/player-media.spec.ts"]),
        }),
        expect.objectContaining({
          className: "data-qti-media-player-pause-duration",
          scope: "interaction",
          interactions: ["media"],
          level: "full",
          tests: expect.arrayContaining(["tests/browser/player-media.spec.ts"]),
        }),
      ]),
    );
  });

  it("prints the accessibility proof matrix", async () => {
    const { code, output } = await runCli(["a11y-proof"]);
    expect(code).toBe(0);
    const report = JSON.parse(lastStdout(output));
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
  });

  it("runs the canonical conformance fixture suite", async () => {
    await expect(main(["run-fixtures"])).resolves.toBe(0);
  });

  it("requires explicit inputs for Basic IMPORT item certification evidence", async () => {
    const { code, output } = await runCli(["certification", "import-basic-items"]);
    expect(code).toBe(1);
    expect(lastStderr(output)).toContain("--qti-root");
  });

  it("requires explicit inputs for Basic IMPORT test certification evidence", async () => {
    const { code, output } = await runCli(["certification", "import-basic-tests"]);
    expect(code).toBe(1);
    expect(lastStderr(output)).toContain("--qti-root");
  });

  it("prints a Basic IMPORT item certification report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-certification-"));
    try {
      const { code, output } = await runCli([
        "certification",
        "import-basic-items",
        "--qti-root",
        directory,
      ]);
      expect(code).toBe(1);
      const report = JSON.parse(lastStdout(output));
      expect(report).toMatchObject({
        targetCapability: "IMPORT",
        targetLevel: "Basic",
        targetScope: "Item Only Packages",
      });
      expect(report.failed).toBeGreaterThan(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints a failing Basic IMPORT test certification report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-certification-"));
    try {
      const { code, output } = await runCli([
        "certification",
        "import-basic-tests",
        "--qti-root",
        directory,
      ]);
      expect(code).toBe(1);
      const report = JSON.parse(lastStdout(output));
      expect(report).toMatchObject({
        targetCapability: "IMPORT",
        targetLevel: "Basic",
        targetScope: "Test Structure Packages",
      });
      expect(report.failed).toBeGreaterThan(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints a passing Basic IMPORT test certification report", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-certification-"));
    const packagePath = join(directory, "Basic/T4 and T7 - Test Structures/T4T7TestStructures.zip");
    try {
      await mkdir(join(directory, "Basic/T4 and T7 - Test Structures"), { recursive: true });
      await writeFile(packagePath, createStoredZip(basicImportTestPackageEntries()));

      const { code, output } = await runCli([
        "certification",
        "import-basic-tests",
        "--qti-root",
        directory,
      ]);
      expect(code).toBe(0);
      const report = JSON.parse(lastStdout(output));
      expect(report).toMatchObject({
        checked: 4,
        failed: 0,
        ok: true,
        packageEvidence: {
          testResourceHref: "assessment.xml",
          itemRefHrefs: [
            "items/choice-single-cardinality.xml",
            "items/choice-multiple-cardinality.xml",
            "items/text-entry.xml",
            "items/extended-text.xml",
          ],
        },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails release support assertions when matrix evidence regresses", async () => {
    const { code, output } = await runCli(["assert-support"]);
    expect(code).toBe(0);
    const report = JSON.parse(lastStdout(output));
    expect(report).toMatchObject({
      checked: elementSupport.length + sharedVocabularyClassSupport.length,
      failed: 0,
      failures: [],
    });
  });

  it("keeps checked-in XML fixture artifacts aligned with canonical fixtures", async () => {
    const fixtureDirectory = join(process.cwd(), "packages/fixtures/xml");
    const expectedFiles = canonicalFixtures.map((fixture) => `${fixture.id}.xml`).toSorted();
    const actualFiles = (await readdir(fixtureDirectory))
      .filter((file) => file.endsWith(".xml"))
      .toSorted();

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

  it("keeps checked-in template-processing Basic item-player XML aligned with fixture metadata", async () => {
    const fixture = basicItemPlayerFixtures.find((item) => item.id === "basic-template-processing");
    if (!fixture) throw new Error("Missing basic-template-processing fixture.");
    const path = join(
      process.cwd(),
      "packages/fixtures/packages/basic-item-player/valid-item-only/items",
      "template-processing.xml",
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
    expect(choice?.tests).toContain("tests/browser/player-interaction-sweep.spec.ts");
    expect(choice?.tests).toContain("tests/browser/player-choice.spec.ts");
    expect(choice?.tests).toContain("tests/browser/player-dom-behavior.spec.ts");

    const hottext = interactionSupport.find((support) => support.interactionType === "hottext");
    expect(hottext?.tests).toContain("tests/browser/player-hottext.spec.ts");

    const match = interactionSupport.find((support) => support.interactionType === "match");
    expect(match?.tests).toContain("tests/browser/player-match.spec.ts");
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
        expect(support.tests?.length).toBeGreaterThan(0);
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
      ["qti-random-integer", "packages/fixtures/xml/random-integer-template-reference.xml"],
      ["qti-gcd", "packages/fixtures/xml/advanced-processing-reference.xml"],
      ["qti-inside", "packages/fixtures/xml/advanced-processing-reference.xml"],
      ["qti-stats-operator", "packages/fixtures/xml/advanced-processing-reference.xml"],
    ]);

    for (const [qtiName, fixturePath] of expectedFixtureEvidence) {
      const support = processingSupport.find((entry) => entry.qtiName === qtiName);
      expect(support?.fixtures).toContain(fixturePath);
    }

    for (const support of processingSupport) {
      for (const fixturePath of support.fixtures) {
        expect(fixturePaths.has(fixturePath)).toBe(true);
      }
    }
  });

  it("keeps supported interactions tied to concrete reference fixtures", () => {
    const fixtureIds = new Set(interactionFixtures.map((fixture) => fixture.id));

    for (const support of interactionSupport) {
      expect(support.fixtures).toContain(
        `packages/fixtures/xml/${support.interactionType}-reference.xml`,
      );
      expect(fixtureIds.has(`${support.interactionType}-reference`)).toBe(true);
      expect(support.tests).toContain("packages/fixtures/src/fixtures.test.ts");
      expect(support.tests).toContain("packages/conformance/src/conformance.test.ts");
      expect(support.tests).toContain("packages/a11y/src/a11y.test.ts");
      expect(support.tests).toContain("tests/browser/player-interaction-sweep.spec.ts");
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
});

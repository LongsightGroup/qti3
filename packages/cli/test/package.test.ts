import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interactionFixtures } from "@longsightgroup/qti3-fixtures";
import { describe, expect, it } from "vitest";
import { lastStderr, lastStdout, runCli, runCliJson } from "./cli-harness.js";
import { basicFeatureIds } from "./package-fixtures.js";
import { createDeflatedZip, createStoredZip } from "./zip-fixtures.js";

describe("@longsightgroup/qti3-cli package handling", () => {
  it("reports a missing Basic item-player target without a stack trace", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-missing-package-"));
    const target = join(directory, "missing");
    try {
      const { code, output } = await runCli(["basic-item-player-report", target]);

      expect(code).toBe(1);
      expect(output.stdout).toEqual([]);
      expect(lastStderr(output)).toContain(target);
      expect(lastStderr(output)).not.toContain("\n    at ");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(["inspect-package", "validate-package"])(
    "reports a missing target for %s on stderr",
    async (command) => {
      const directory = await mkdtemp(join(tmpdir(), "qti3-missing-package-"));
      const target = join(directory, "missing");
      try {
        const { code, output } = await runCli([command, target]);

        expect(code).toBe(1);
        expect(output.stdout).toEqual([]);
        expect(lastStderr(output)).toContain(target);
        expect(lastStderr(output)).not.toContain("\n    at ");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

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

      const { code, report } = await runCliJson(["inspect-package", file]);
      expect(code).toBe(0);

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

      const { code: strictCode, report: strictReport } = await runCliJson([
        "validate-package",
        file,
      ]);
      expect(strictCode).toBe(0);
      expect(strictReport).toMatchObject({
        strict: true,
        checked: 2,
        failed: 0,
      });
    } finally {
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

      const { code, report } = await runCliJson(["inspect-package", file]);
      expect(code).toBe(0);

      expect(report).toMatchObject({
        checked: 1,
        failed: 0,
        discoveredReferences: ["items/choice.xml"],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: "a POSIX absolute path",
      href: "/items/choice.xml",
      error: "package reference /items/choice.xml must be a package-relative path.",
    },
    {
      name: "a Windows absolute path",
      href: "C:/items/choice.xml",
      error: "package reference C:/items/choice.xml must be a package-relative path.",
    },
    {
      name: "a URI-like path",
      href: "https://example.com/choice.xml",
      error: "package reference https://example.com/choice.xml must be a package-relative path.",
    },
    {
      name: "a package-root escape",
      href: "../items/choice.xml",
      error: "package reference ../items/choice.xml escapes the package root.",
    },
    { name: "dot segments", href: "items/./choice.xml", normalized: "items/choice.xml" },
    { name: "repeated separators", href: "items//choice.xml", normalized: "items/choice.xml" },
    { name: "a valid relative path", href: "items/choice.xml", normalized: "items/choice.xml" },
  ])("normalizes package references containing $name", async ({ href, error, normalized }) => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-normalization-"));
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
    <resource identifier="choice" type="imsqti_item_xmlv3p0" href="${href}"/>
  </resources>
</manifest>`,
          "items/choice.xml": choice.xml,
        }),
      );

      const { code, report } = await runCliJson(["inspect-package", file]);
      if (error !== undefined) {
        expect(code).toBe(1);
        expect(report).toMatchObject({
          checked: 0,
          failed: 1,
          packageErrors: [error],
        });
      } else {
        expect(code).toBe(0);
        expect(report).toMatchObject({
          checked: 1,
          failed: 0,
          packageErrors: [],
          discoveredReferences: [normalized],
        });
      }
    } finally {
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

      const { code, output } = await runCli(["inspect-package", file]);
      expect(code).toBe(1);
      expect(output.stderr).toEqual([]);
      const report = JSON.parse(lastStdout(output));

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        packageErrors: ["ZIP entry ../items/choice.xml escapes the package root."],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects unreadable package zips", async () => {
    const directory = await mkdtemp(join(tmpdir(), "qti3-package-broken-"));
    const file = join(directory, "package.zip");

    try {
      await writeFile(file, "not a zip");

      const { code, report } = await runCliJson(["inspect-package", file]);
      expect(code).toBe(1);

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        packageErrors: ["No ZIP central directory was found."],
      });
    } finally {
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

      const { code, report } = await runCliJson(["validate-package", file]);
      expect(code).toBe(1);

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

      const { code, report } = await runCliJson(["inspect-package", file]);
      expect(code).toBe(1);

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        packageErrors: ["package reference ../items/choice.xml escapes the package root."],
      });
    } finally {
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

      const { code, report } = await runCliJson(["inspect-package", file]);
      expect(code).toBe(1);

      expect(report).toMatchObject({
        checked: 0,
        failed: 1,
        discoveredReferences: ["items/missing.xml"],
        packageErrors: ["package reference items/missing.xml was not found."],
      });
    } finally {
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
      expect(requiredEntry(report.packages).packageErrors).toEqual(
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
      expect(requiredEntry(report.results).diagnostics).toEqual(
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
      expect(requiredEntry(report.packages).packageErrors).toEqual(
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
      expect(requiredEntry(report.packages).assessmentTestFiles).toEqual(["assessment.xml"]);
      expect(requiredEntry(report.packages).packageErrors).toEqual(
        expect.arrayContaining([
          "assessment-test packages are out of scope for Basic item-player readiness: assessment.xml.",
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function requiredEntry<T>(entries: T[]): T {
  const entry = entries[0];
  if (entry === undefined) throw new Error("Expected CLI report entry.");
  return entry;
}

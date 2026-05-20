import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interactionSupport, parseQtiXml } from "@qti3/core";
import { interactionFixtures } from "@qti3/fixtures";
import { describe, expect, it } from "vitest";
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

  it("runs the canonical conformance fixture suite", async () => {
    await expect(main(["run-fixtures"])).resolves.toBe(0);
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
});

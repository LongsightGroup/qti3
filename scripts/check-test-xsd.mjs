#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseQtiTest } from "../packages/core/dist/index.js";
import {
  buildQti3RubricBlock,
  buildQti3ExtendedTextItem,
  writeQti3AssessmentTest,
  writeQti3FixedAssessmentTest,
  qti3TrustedXmlFragment,
} from "../packages/writer/dist/index.js";

import { migrateQtiItemToQti3 } from "../packages/migrator/dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const closure = JSON.parse(
  await readFile(join(root, "packages/conformance/schemas/qti3/sources.json"), "utf8"),
);
const directory = await mkdtemp(join(tmpdir(), "qti3-test-xsd-"));
try {
  for (const [url, source] of Object.entries(closure.sources)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Schema download failed: ${url} (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== source.sha256)
      throw new Error(`Official schema changed: ${url}. Review and update the pinned digest.`);
    const encoding =
      bytes[0] === 255 && bytes[1] === 254
        ? "utf-16le"
        : bytes[0] === 254 && bytes[1] === 255
          ? "utf-16be"
          : "utf-8";
    let xml = new TextDecoder(encoding)
      .decode(bytes)
      .replace(/encoding=['"]UTF-16['"]/gi, 'encoding="UTF-8"');
    xml = xml.replace(/schemaLocation=(['"])([^'"]+)\1/g, (_match, quote, location) => {
      const target = closure.sources[new URL(location, url).href];
      if (!target) throw new Error(`Unpinned schema dependency: ${location}.`);
      return `schemaLocation=${quote}${target.file}${quote}`;
    });
    await writeFile(join(directory, source.file), xml);
  }
  const fixture = await readFile(join(root, "tests/fixtures/staged-assessment-test.xml"), "utf8");
  const parsed = parseQtiTest(fixture);
  if (!parsed.ok) throw new Error("Staged test fixture did not parse.");
  const written = writeQti3AssessmentTest(parsed.value);
  if (!written.ok) throw new Error("Staged test fixture did not serialize.");
  const fixed = writeQti3FixedAssessmentTest({
    identifier: "fixed",
    title: "Fixed options",
    parts: [
      {
        identifier: "part",
        title: "Part",
        navigationMode: "nonlinear",
        submissionMode: "simultaneous",
        timeLimits: { minTime: 5, maxTime: 300 },
        instructions: qti3TrustedXmlFragment("<p>Read carefully.</p>"),
        sections: [
          {
            identifier: "section",
            title: "Questions",
            items: [{ identifier: "ref", href: "items/one.xml", categories: [] }],
          },
        ],
        feedback: [
          {
            identifier: "feedback",
            access: "atEnd",
            showHide: "show",
            outcomeIdentifier: "FEEDBACK",
            content: qti3TrustedXmlFragment("<p>Finished.</p>"),
          },
        ],
      },
    ],
  });
  if (!fixed.ok) throw new Error("Fixed test fixture did not serialize.");
  const fixedInstance = join(directory, "fixed.xml");
  await writeFile(fixedInstance, fixed.value);
  execFileSync(
    "xmllint",
    ["--nonet", "--noout", "--schema", join(directory, closure.main), fixedInstance],
    { stdio: "inherit" },
  );
  const instance = join(directory, "test.xml");
  await writeFile(instance, written.value);
  execFileSync(
    "xmllint",
    ["--nonet", "--noout", "--schema", join(directory, closure.main), instance],
    { stdio: "inherit" },
  );
  // QTI 3.0.1 §5.120: independently check the writer/migrator, not only our parser.
  const rubricXml = buildQti3ExtendedTextItem({
    identifier: "rubric",
    title: "Rubric",
    bodyHtml: buildQti3RubricBlock({
      view: ["candidate"],
      use: "instructions",
      placement: "inline",
      content: qti3TrustedXmlFragment("<p>Read carefully.</p>"),
    }),
  });
  const migrated = migrateQtiItemToQti3({
    xml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="rubric" title="Rubric" adaptive="false" timeDependent="false"><responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration><outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/><itemBody><rubricBlock view="candidate scorer"><p>Read carefully.</p></rubricBlock><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction></itemBody><responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/></assessmentItem>`,
  });
  if (!migrated.xml) throw new Error("Rubric migration failed.");
  for (const [name, xml] of [
    ["rubric", rubricXml],
    ["migrated-rubric", migrated.xml],
  ]) {
    const path = join(directory, `${name}.xml`);
    await writeFile(path, xml);
    execFileSync(
      "xmllint",
      ["--nonet", "--noout", "--schema", join(directory, closure.main), path],
      { stdio: "inherit" },
    );
  }
  // These are the exact independent XML inputs consumed by the execution-boundary regressions.
  for (const fixtureDirectory of [
    "test-delivery",
    "rubric-content",
    "media-assets",
    "test-profile",
    "semantic-pilots",
  ]) {
    const fixtures = join(root, "tests/fixtures", fixtureDirectory);
    for (const name of (await readdir(fixtures)).filter((entry) => entry.endsWith(".xml"))) {
      execFileSync(
        "xmllint",
        ["--nonet", "--noout", "--schema", join(directory, closure.main), join(fixtures, name)],
        { stdio: "inherit" },
      );
    }
  }
  // Validate the exact positive XML used by these tests, including generated cases.
  // Intentionally invalid inputs do not use validQtiDocument and remain diagnostic tests.
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "packages/core/src/processing-boundaries.test.ts",
      "packages/core/src/test-ordering.test.ts",
      "packages/writer/src/assessment-test-ordering.test.ts",
      "packages/writer/src/modal-feedback-schema.test.ts",
      "packages/core/src/qti-package-media-assets.test.ts",
      "packages/core/src/processing-type-contracts.test.ts",
      "packages/core/src/scoring-boundary-regressions.test.ts",
      "packages/core/src/challenge-items.test.ts",
      "packages/fixtures/src/challenges.test.ts",
      "packages/migrator/src/qti20-fidelity.test.ts",
      "packages/migrator/src/item-preservation-regressions.test.ts",
      "packages/migrator/src/graphic-and-composite-fidelity.test.ts",
      "packages/migrator/src/material-content-fidelity.test.ts",
    ],
    {
      cwd: root,
      env: { ...process.env, QTI3_TEST_XSD_SCHEMA: join(directory, closure.main) },
      stdio: "inherit",
    },
  );
  console.log("QTI 3 fixtures: official ASI schema validation passed (pinned source hashes).");
} finally {
  await rm(directory, { recursive: true, force: true });
}

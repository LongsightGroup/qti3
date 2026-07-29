#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { deprecatedInteractionSupport, interactionSupport } from "../packages/core/dist/index.js";
import { qti3TrustedXmlFragment, writeQti3AssessmentItem } from "../packages/writer/dist/index.js";
import { qtiTranscodeProfiles, transcodeQti3Item } from "../packages/transcoder/dist/index.js";
import { serializeTargetAssessmentTest } from "../packages/transcoder/dist/package.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const schemaRoot = join(root, "packages", "conformance", "schemas", "legacy");
const temporaryRoot = await mkdtemp(join(tmpdir(), "qti3-transcoder-xsd-"));
const targets = [
  ["blackboard-question-banks@1", join(schemaRoot, "qti21", "main.xsd")],
  ["brightspace-course-import@1", join(schemaRoot, "qti21", "main.xsd")],
  ["canvas-classic-quizzes@1", join(schemaRoot, "qti12", "main.xsd")],
  ["canvas-new-quizzes@1", join(schemaRoot, "qti12", "main.xsd")],
  ["qti12-standard@1", join(schemaRoot, "qti12", "main.xsd")],
  ["qti21-standard@1", join(schemaRoot, "qti21", "main.xsd")],
  ["qti22-standard@1", join(schemaRoot, "qti22", "main.xsd")],
];
const failures = [];
const passedCases = [];
const passedVariantCases = [];

try {
  const compilation = spawnSync(
    "javac",
    ["-d", temporaryRoot, join(root, "scripts", "ValidateXml.java")],
    { encoding: "utf8" },
  );
  if (compilation.status !== 0) {
    throw new Error(`Unable to compile XSD validator:\n${compilation.stderr.trim()}`);
  }
  for (const [profile, schema] of targets) {
    await readFile(schema);
    for (const interaction of [...interactionSupport, ...deprecatedInteractionSupport]) {
      const xml = await fixtureXml(interaction.interactionType);
      const result = transcodeQti3Item({ kind: "xml", xml }, { profile });
      if (!result.ok) {
        failures.push(`${profile}/${interaction.interactionType} failed conversion.`);
        continue;
      }
      const instance = join(
        temporaryRoot,
        `${profile.replaceAll(/[^a-z0-9]/gi, "_")}-${interaction.interactionType}.xml`,
      );
      await writeFile(instance, result.xml, "utf8");
      const validation = spawnSync(
        "java",
        ["-cp", temporaryRoot, "ValidateXml", schema, instance],
        { encoding: "utf8" },
      );
      if (validation.status !== 0) {
        failures.push(
          `${profile}/${interaction.interactionType} failed XSD validation:\n${validation.stderr.trim()}`,
        );
      } else {
        passedCases.push(`${profile}/${interaction.interactionType}`);
      }
    }
    const accessibilityCase = `${profile}/variant/accessibility-choice`;
    const accessibilityResult = transcodeQti3Item(
      { kind: "xml", xml: accessibilityVariantXml() },
      { profile },
    );
    if (!accessibilityResult.ok) {
      failures.push(`${accessibilityCase} failed conversion.`);
    } else {
      const accessibilityInstance = join(
        temporaryRoot,
        `${profile.replaceAll(/[^a-z0-9]/gi, "_")}-accessibility-choice.xml`,
      );
      await writeFile(accessibilityInstance, accessibilityResult.xml, "utf8");
      const accessibilityValidation = spawnSync(
        "java",
        ["-cp", temporaryRoot, "ValidateXml", schema, accessibilityInstance],
        { encoding: "utf8" },
      );
      if (accessibilityValidation.status !== 0) {
        failures.push(
          `${accessibilityCase} failed XSD validation:\n${accessibilityValidation.stderr.trim()}`,
        );
      } else {
        passedVariantCases.push(accessibilityCase);
      }
    }
    const target = qtiTranscodeProfiles[profile].target;
    const assessmentInstance = join(
      temporaryRoot,
      `${profile.replaceAll(/[^a-z0-9]/gi, "_")}-assessment-test.xml`,
    );
    await writeFile(
      assessmentInstance,
      serializeTargetAssessmentTest(assessmentTestModel(), target),
      "utf8",
    );
    const assessmentValidation = spawnSync(
      "java",
      ["-cp", temporaryRoot, "ValidateXml", schema, assessmentInstance],
      { encoding: "utf8" },
    );
    if (assessmentValidation.status !== 0) {
      failures.push(
        `${profile}/assessment-test failed XSD validation:\n${assessmentValidation.stderr.trim()}`,
      );
    } else {
      passedCases.push(`${profile}/assessment-test`);
    }
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  const receiptRoot = join(root, ".cache", "transcoder-evidence");
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(
    join(receiptRoot, "xsd.json"),
    `${JSON.stringify(
      {
        schema: "qti3.transcoder.xsd-evidence.v1",
        cases: passedCases.filter((entry) => !entry.endsWith("/assessment-test")).toSorted(),
        variantCases: passedVariantCases.toSorted(),
        packageCases: passedCases.filter((entry) => entry.endsWith("/assessment-test")).toSorted(),
      },
      undefined,
      2,
    )}\n`,
    "utf8",
  );
  console.log(
    `All ${String(
      targets.length * [...interactionSupport, ...deprecatedInteractionSupport].length,
    )} profile/interaction instances, all ${String(passedVariantCases.length)} variants, and all ${String(
      targets.length,
    )} assessment-test serializers pass XSD validation.`,
  );
}

function assessmentTestModel() {
  return {
    href: "tests/assessment.xml",
    identifier: "ASSESSMENT",
    title: "Assessment",
    itemRefs: [
      {
        identifier: "ITEM_REF",
        href: "items/item.xml",
        testPartIdentifier: "PART",
        sectionIdentifier: "SECTION",
        attributes: {},
      },
    ],
    testParts: [
      {
        identifier: "PART",
        navigationMode: "nonlinear",
        submissionMode: "individual",
        sections: [
          {
            identifier: "SECTION",
            title: "Section",
            visible: true,
            testPartIdentifier: "PART",
            itemRefs: [
              {
                identifier: "ITEM_REF",
                href: "items/item.xml",
                testPartIdentifier: "PART",
                sectionIdentifier: "SECTION",
                attributes: {},
              },
            ],
            sections: [],
            attributes: {},
          },
        ],
        attributes: {},
      },
    ],
    standards: [],
    assetHrefs: [],
    diagnostics: [],
    attributes: {},
    xml: "",
  };
}

async function fixtureXml(interactionType) {
  if (interactionType === "custom") {
    return writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-reference",
      title: "Custom reference",
      interactionMarkupHtml: qti3TrustedXmlFragment("<div>Ready</div>"),
    });
  }
  return readFile(
    join(root, "packages", "fixtures", "xml", `${interactionType}-reference.xml`),
    "utf8",
  );
}

function accessibilityVariantXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="accessibility-choice" title="Accessibility choice" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"><qti-default-value><qti-value>0</qti-value></qti-default-value></qti-outcome-declaration>
  <qti-item-body><qti-choice-interaction response-identifier="RESPONSE" aria-label="Choose accessibly"><qti-simple-choice identifier="A" aria-label="Accessible Alpha">Alpha</qti-simple-choice><qti-simple-choice identifier="B">Beta</qti-simple-choice></qti-choice-interaction></qti-item-body>
  <qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;
}

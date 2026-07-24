#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { deprecatedInteractionSupport, interactionSupport } from "../packages/core/dist/index.js";
import { migrateQtiItemToQti3 } from "../packages/migrator/dist/index.js";
import { qti3TrustedXmlFragment, writeQti3AssessmentItem } from "../packages/writer/dist/index.js";
import {
  qtiTranscodeProfiles,
  qtiTranscoderSupportMatrix,
  requiresXsdEvidence,
} from "../packages/transcoder/dist/index.js";
import { runTranscoderEvidenceMatrix } from "../packages/transcoder/dist/evidence.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const lockPath = join(root, "packages", "transcoder", "evidence-lock.json");
const reportPath = join(root, "packages", "transcoder", "SUPPORT.md");
const interactions = [...interactionSupport, ...deprecatedInteractionSupport];
const profiles = Object.keys(qtiTranscodeProfiles);
const failures = [];

if (qtiTranscoderSupportMatrix.length !== profiles.length * interactions.length) {
  failures.push("The support matrix is not the registry/profile cross product.");
}

const { observations, failures: caseFailures } = runTranscoderEvidenceMatrix({
  interactions: interactions.map((entry) => entry.interactionType),
  fixtureXml,
  reverseMigration: (xml, fidelity) => {
    const reverse = migrateQtiItemToQti3(
      { kind: "xml", xml, filename: "item.xml" },
      {
        repairPolicy: fidelity === "lossy" ? "safe" : "none",
        unsupportedPolicy: "stub",
      },
    );
    return {
      ok:
        Boolean(reverse.xml) &&
        !reverse.diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    };
  },
});

for (const failure of caseFailures) {
  failures.push(`${failure.caseId}: ${failure.message}`);
}

if (process.argv.includes("--write")) {
  await writeFile(lockPath, `${JSON.stringify(observations, undefined, 2)}\n`, "utf8");
  await writeFile(reportPath, supportReport(observations), "utf8");
} else {
  let locked = [];
  try {
    locked = JSON.parse(await readFile(lockPath, "utf8"));
  } catch {
    failures.push("packages/transcoder/evidence-lock.json is missing or invalid.");
  }
  if (JSON.stringify(locked) !== JSON.stringify(observations)) {
    failures.push("Executable evidence differs from packages/transcoder/evidence-lock.json.");
  }
  const committedReport = await readFile(reportPath, "utf8").catch(() => "");
  for (const entry of observations) {
    const section = committedReport.split(`## \`${entry.caseId}\``).at(1)?.split("\n## ").at(0);
    if (!section?.includes(`\`${entry.sha256}\``)) {
      failures.push(`packages/transcoder/SUPPORT.md is stale for executable case ${entry.caseId}.`);
    }
  }
}

if (process.argv.includes("--release")) {
  const receiptPath = join(root, ".cache", "transcoder-evidence", "xsd.json");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8").catch(() => "null"));
  const xsdProfiles = Object.values(qtiTranscodeProfiles)
    .filter(requiresXsdEvidence)
    .map((profile) => profile.id);
  const expectedCases = observations
    .filter((entry) => xsdProfiles.some((profile) => entry.caseId.startsWith(`${profile}/`)))
    .map((entry) => entry.caseId)
    .toSorted();
  const expectedVariantCases = xsdProfiles
    .map((profile) => `${profile}/variant/accessibility-choice`)
    .toSorted();
  if (
    !receipt ||
    receipt.schema !== "qti3.transcoder.xsd-evidence.v1" ||
    JSON.stringify(receipt.cases?.toSorted()) !== JSON.stringify(expectedCases) ||
    JSON.stringify(receipt.variantCases?.toSorted()) !== JSON.stringify(expectedVariantCases) ||
    JSON.stringify(receipt.packageCases?.toSorted()) !==
      JSON.stringify(xsdProfiles.map((profile) => `${profile}/assessment-test`).toSorted())
  ) {
    failures.push("Current full-matrix XSD evidence receipt is missing.");
  }
  for (const profile of Object.values(qtiTranscodeProfiles)) {
    if (!profile.vendorEvidence) continue;
    const vendorReceiptPath = join(
      root,
      "packages",
      "transcoder",
      "evidence",
      "vendor-import",
      `${profile.id}-import.json`,
    );
    const vendorReceipt = JSON.parse(await readFile(vendorReceiptPath, "utf8").catch(() => "null"));
    const expectedVendorCases = observations
      .filter((entry) => entry.caseId.startsWith(`${profile.id}/`))
      .map((entry) => entry.caseId)
      .toSorted();
    const importedCases = Array.isArray(vendorReceipt?.cases)
      ? vendorReceipt.cases
          .filter((entry) => entry?.status === "imported")
          .map((entry) => entry.caseId)
          .toSorted()
      : [];
    if (
      vendorReceipt?.schema !== "qti3.transcoder.vendor-import-evidence.v1" ||
      vendorReceipt?.profile !== profile.id ||
      vendorReceipt?.product !== profile.vendorEvidence.product ||
      vendorReceipt?.sourceRevision !== profile.vendorEvidence.sourceRevision ||
      typeof vendorReceipt?.productVersion !== "string" ||
      vendorReceipt.productVersion.trim() === "" ||
      Number.isNaN(Date.parse(vendorReceipt?.recordedAt ?? "")) ||
      JSON.stringify(importedCases) !== JSON.stringify(expectedVendorCases)
    ) {
      failures.push(
        `${profile.id}: current full-matrix ${profile.vendorEvidence.product} import evidence receipt is missing.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${String(observations.length)} executable profile/interaction evidence cases${
      process.argv.includes("--release") ? " including XSD receipts" : ""
    }.`,
  );
}

function supportReport(entries) {
  const cases = entries.map(
    (entry) => `## \`${entry.caseId}\`

- Fidelity: ${entry.fidelity}
- Scoring policy: ${entry.scoring}
- Fallback: ${entry.fallback}
- Golden SHA-256: \`${entry.sha256}\`
- Executed evidence: ${entry.evidence.join(", ")}
`,
  );
  const renderedCases = cases.join("\n").trimEnd();
  return `# Transcoder support report

Generated by executing every registry/profile mapping. XSD evidence is generated separately during
\`release:check\`; this report does not claim an XSD pass without that release receipt.

${renderedCases}
`;
}

function fixtureXml(interactionType) {
  if (interactionType === "custom") {
    return writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-reference",
      title: "Custom reference",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the widget.</p>"),
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
    });
  }
  return readFileSync(
    join(root, "packages", "fixtures", "xml", `${interactionType}-reference.xml`),
    "utf8",
  );
}

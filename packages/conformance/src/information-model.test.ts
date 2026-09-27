import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  auditQtiInformationModel,
  checkQtiRequirementResults,
  type QtiInformationModelRequirement,
} from "./information-model.js";
import {
  qtiInformationModelInventory,
  qtiInformationModelSource,
} from "./information-model-inventory.js";
import { qtiInformationModelRequirements } from "./information-model-requirements.js";

it("pins the 3.0.1 document and keeps every inventoried heading visible", () => {
  expect(qtiInformationModelSource.date).toBe("1st September 2024");
  expect(qtiInformationModelSource.url).toContain("imsqti_asi_v3p0p1_infomodel_v1p0.html");
  expect(qtiInformationModelSource.sha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(qtiInformationModelInventory).toHaveLength(1921);
  expect(
    createHash("sha256").update(JSON.stringify(qtiInformationModelInventory)).digest("hex"),
  ).toBe(qtiInformationModelSource.inventorySha256);
  const audit = auditQtiInformationModel(
    qtiInformationModelInventory,
    qtiInformationModelRequirements,
  );
  expect(audit.violations).toEqual([]);
  // No inherited attribute coverage: an order test does not prove shuffle or orientation.
  expect(audit.unauditedSections).toContain("5.97.1");
  expect(audit.unauditedSections).toContain("5.97.4");
  expect(audit.sectionsWithReviewedRequirements + audit.unauditedSections.length).toBe(1921);
  expect(
    qtiInformationModelRequirements.find((rule) => rule.id === "fixed-acceptance-profile")
      ?.disposition,
  ).toBe("implemented");
});

const requirement: QtiInformationModelRequirement = {
  id: "sample",
  sections: ["5.97.2"],
  elements: ["qti-order-interaction"],
  boundary: "validate",
  rule: "A full order contains each choice once.",
  disposition: "implemented",
  limitation: "Response validation only.",
  evidence: [{ path: "packages/core/src/order.test.ts", marker: "[ASI-SAMPLE]", cases: 2 }],
};

it("rejects unsupported traceability claims", () => {
  for (const mutation of [
    { ...requirement, sections: [] },
    { ...requirement, sections: ["999"] },
    { ...requirement, evidence: [] },
    { ...requirement, limitation: "" },
    { ...requirement, evidence: [{ path: "docs/claim.md", marker: "[ASI-SAMPLE]", cases: 2 }] },
    {
      ...requirement,
      evidence: [{ path: "packages/core/src/order.test.ts", marker: "[ASI-SAMPLE]", cases: 0 }],
    },
  ]) {
    expect(
      auditQtiInformationModel(qtiInformationModelInventory, [mutation]).violations.length,
    ).toBeGreaterThan(0);
  }
  expect(
    auditQtiInformationModel(qtiInformationModelInventory, [requirement, requirement]).violations,
  ).toContain("Duplicate requirement: sample");
});

it("requires matching executed assertions rather than a file or citation", () => {
  const passing = [1, 2].map((index) => ({
    path: "packages/core/src/order.test.ts",
    name: `[ASI-SAMPLE] case ${index}`,
    status: "passed",
  }));
  expect(checkQtiRequirementResults([requirement], passing)).toEqual([]);
  for (const results of [
    [],
    passing.slice(0, 1),
    [...passing, ...passing],
    passing.map((test) => ({ ...test, path: "packages/core/src/other.test.ts" })),
    passing.map((test) => ({ ...test, name: "Unrelated passing test" })),
    passing.map((test) => ({ ...test, status: "pending" })),
    passing.map((test) => ({ ...test, status: "failed" })),
  ])
    expect(checkQtiRequirementResults([requirement], results).length).toBeGreaterThan(0);
});

// ASI markers are reserved for ledger evidence. Find orphans even when deleting a row
// would otherwise remove its file from the selected evidence run.
it("keeps every tagged regression bound to a requirement", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const ownPath = fileURLToPath(import.meta.url);
  const declared = new Set(
    qtiInformationModelRequirements.flatMap((rule) =>
      rule.evidence.map((entry) => `${entry.path}:${entry.marker}`),
    ),
  );
  const found = new Set<string>();
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (["node_modules", "dist", "coverage"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (path !== ownPath && path.endsWith(".test.ts")) {
        for (const match of readFileSync(path, "utf8").matchAll(/\[ASI-[A-Z0-9-]+\]/gu)) {
          found.add(`${relative(root, path).replaceAll("\\", "/")}:${match[0]}`);
        }
      }
    }
  }
  visit(join(root, "packages"));
  expect([...found].toSorted()).toEqual([...declared].toSorted());
});

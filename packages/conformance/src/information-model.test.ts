import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { elementSupport } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import { reviewPublishedQtiInformationModel } from "./information-model-current.js";
import {
  qtiInformationModelSource,
  qtiInformationModelInventory,
} from "./information-model-inventory.js";
import {
  collectQtiInformationModelReferences,
  findQtiInformationModelReviewViolations,
  informationModelReviewRow,
  qtiInformationModelEvidence,
  qtiNameFromInformationModelTitle,
  reviewQtiInformationModel,
  summarizeQtiInformationModelReview,
} from "./information-model.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

describe("QTI information-model review", () => {
  it("normalizes spec titles, including the published typos", () => {
    expect(qtiNameFromInformationModelTitle("Choice Interaction")).toBe("qti-choice-interaction");
    expect(qtiNameFromInformationModelTitle('"OrderInteraction" Class Description')).toBe(
      "qti-order-interaction",
    );
    expect(qtiNameFromInformationModelTitle('"HotTextInteraction" Class Description')).toBe(
      "qti-hottext-interaction",
    );
    expect(qtiNameFromInformationModelTitle("Text Interaction")).toBe("qti-text-entry-interaction");
    expect(qtiNameFromInformationModelTitle("Portable Custiom Interaction (PCI)")).toBe(
      "qti-portable-custom-interaction",
    );
    expect(qtiNameFromInformationModelTitle("Map Response Exprssion")).toBe("qti-map-response");
    expect(qtiNameFromInformationModelTitle("Sum Expression")).toBe("qti-sum");
    expect(qtiNameFromInformationModelTitle("Hot Text Interaction")).toBe(
      "qti-hottext-interaction",
    );
    expect(qtiNameFromInformationModelTitle("Alternative Ways to End an Attempt")).toBe(
      "qti-end-attempt-interaction",
    );
  });

  it("reads QTI 3 section citations without taking other specifications", () => {
    const references = collectQtiInformationModelReferences([
      {
        path: "sample.ts",
        text: [
          "QTI 2.1 §5.2 stays in the QTI 2 model.",
          "QTI 1.2 §5.7.24 stays in the QTI 1 model.",
          "QTI 3 §§5.97.2,5.61 and QTI 2.1 §8.2.",
          "QTI 3 §7.19.2–3: feedback visibility.",
          "QTI 3.0.1 §5.120 and implementation guide §3.7.5.",
          "QTI Shared Vocabulary §1.1.3.",
          "See https://www.imsglobal.org/sites/default/files/spec/qti/v3/info/index.html#OpSum.",
        ].join("\n"),
      },
    ]);
    expect(references).toEqual([
      { type: "section", path: "sample.ts", sectionId: "5.97.2" },
      { type: "section", path: "sample.ts", sectionId: "5.61" },
      { type: "section", path: "sample.ts", sectionId: "7.19.2" },
      { type: "section", path: "sample.ts", sectionId: "7.19.3" },
      { type: "section", path: "sample.ts", sectionId: "5.120" },
      { type: "anchor", path: "sample.ts", anchor: "OpSum" },
    ]);
  });

  it("keeps a cited characteristic mentioned and inherits the element tests otherwise", () => {
    const review = reviewQtiInformationModel({
      inventory: [
        {
          id: "5.97",
          title: '"OrderInteraction" Class Description',
          kind: "class",
          anchor: "Order",
        },
        {
          id: "5.97.1",
          title: '"shuffle" Characteristic Description',
          kind: "characteristic",
          anchor: "Shuffle",
        },
        {
          id: "5.97.2",
          title: '"min-choices" Characteristic Description',
          kind: "characteristic",
          anchor: "MinChoices",
        },
      ],
      evidence: [
        {
          qtiName: "qti-order-interaction",
          category: "interaction",
          support: "supported",
          tests: ["packages/core/src/order-response-contracts.test.ts"],
        },
      ],
      references: [
        {
          type: "section",
          path: "packages/core/src/order-response-contracts.test.ts",
          sectionId: "5.97.2",
        },
      ],
    });
    expect(informationModelReviewRow(review, "5.97")?.claim).toMatchObject({
      type: "element-tested",
      qtiName: "qti-order-interaction",
    });
    expect(informationModelReviewRow(review, "5.97.1")?.claim).toEqual({
      type: "with-element",
      qtiName: "qti-order-interaction",
      tests: ["packages/core/src/order-response-contracts.test.ts"],
    });
    expect(informationModelReviewRow(review, "5.97.2")?.claim).toEqual({
      type: "mentioned",
      paths: ["packages/core/src/order-response-contracts.test.ts"],
    });
    expect(review.unmatchedEvidence).toEqual([]);
  });

  it("keeps outcome processing and outcome-only expressions out of the item claim", () => {
    const review = reviewPublishedQtiInformationModel([]);
    expect(informationModelReviewRow(review, "2.9")?.claim.type).toBe("out-of-scope");
    expect(informationModelReviewRow(review, "2.11.2.1")?.claim.type).toBe("out-of-scope");
    expect(informationModelReviewRow(review, "2.4.4.5")?.claim).toMatchObject({
      type: "diagnostic",
      qtiName: "qti-custom-interaction",
    });
    expect(informationModelReviewRow(review, "2.11.3.40")?.claim).toMatchObject({
      type: "element-tested",
      qtiName: "qti-sum",
    });
  });

  it("binds the published inventory to the support matrix and recorded citations", () => {
    expect(qtiInformationModelInventory).toHaveLength(qtiInformationModelSource.entryCount);
    const references = collectQtiInformationModelReferences(readReviewSources(repoRoot));
    const review = reviewPublishedQtiInformationModel(references);
    const summary = summarizeQtiInformationModelReview(review);
    expect(review.unmatchedEvidence).toEqual([]);
    expect(review.unresolvedReferences).toEqual([]);
    expect(
      findQtiInformationModelReviewViolations({
        inventory: qtiInformationModelInventory,
        review,
      }),
    ).toEqual([]);
    expect(missingEvidenceFiles(review, repoRoot)).toEqual([]);
    expect(qtiInformationModelEvidence(elementSupport).length).toBeGreaterThan(0);
    expect(summary.openBehavior).toEqual([]);
    expect(summary.openTestedClassDetails).toBe(0);
  });
});

function missingEvidenceFiles(
  review: ReturnType<typeof reviewPublishedQtiInformationModel>,
  root: string,
): string[] {
  const missing: string[] = [];
  for (const row of review.rows) {
    const tests =
      row.claim.type === "element-tested" ||
      row.claim.type === "diagnostic" ||
      row.claim.type === "with-element"
        ? row.claim.tests
        : row.claim.type === "mentioned"
          ? row.claim.paths
          : row.claim.type === "test-tooling"
            ? row.claim.tests
            : [];
    for (const testPath of tests) {
      if (!exists(join(root, testPath))) missing.push(`${row.id} -> ${testPath}`);
    }
  }
  return missing;
}

function exists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readReviewSources(root: string): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  const skipped = new Set(["information-model.test.ts", "information-model-inventory.ts"]);
  for (const directory of ["packages", "tests", "docs", "examples", "scripts"]) {
    walk(join(root, directory), root, skipped, files);
  }
  return files;
}

function walk(
  directory: string,
  root: string,
  skipped: ReadonlySet<string>,
  files: { path: string; text: string }[],
): void {
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === "dist" || name === "coverage") continue;
    const absolute = join(directory, name);
    const info = statSync(absolute);
    if (info.isDirectory()) {
      walk(absolute, root, skipped, files);
      continue;
    }
    if (skipped.has(name)) continue;
    if (!/\.(?:ts|tsx|md|mjs)$/u.test(name)) continue;
    files.push({
      path: absolute.slice(root.length).replaceAll("\\", "/").replace(/^\//u, ""),
      text: readFileSync(absolute, "utf8"),
    });
  }
}

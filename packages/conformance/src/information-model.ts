/** A heading in the pinned ASI document, not necessarily one normative requirement. */
export interface QtiInformationModelEntry {
  readonly id: string;
  readonly title: string;
  readonly kind: "part" | "behavior" | "class" | "characteristic" | "attribute" | "vocabulary";
  readonly anchor: string;
}

/** The boundary at which the recorded requirement has been reviewed. */
export type QtiRequirementBoundary =
  | "parse"
  | "validate"
  | "process"
  | "restore"
  | "migrate"
  | "deliver";

/** A named group of assertions that must execute successfully, not just a test file. */
export interface QtiRequirementEvidence {
  readonly path: string;
  readonly marker: string;
  readonly cases: number;
}

/** A narrow, reviewed claim. Other requirements in the same section remain unaudited. */
export interface QtiInformationModelRequirement {
  readonly id: string;
  readonly sections: readonly string[];
  readonly elements: readonly string[];
  readonly boundary: QtiRequirementBoundary;
  readonly rule: string;
  readonly disposition: "implemented" | "rejected" | "open";
  readonly limitation: string;
  readonly evidence: readonly QtiRequirementEvidence[];
}

/** Inventory coverage never implies that all requirements within a heading have been reviewed. */
export interface QtiInformationModelAudit {
  readonly totalSections: number;
  readonly sectionsWithReviewedRequirements: number;
  readonly unauditedSections: readonly string[];
  readonly implementedRequirements: number;
  readonly rejectedRequirements: number;
  readonly openRequirements: readonly string[];
  readonly violations: readonly string[];
}

/** Validate traceability without promoting parent-element tests into attribute evidence. */
export function auditQtiInformationModel(
  inventory: readonly QtiInformationModelEntry[],
  requirements: readonly QtiInformationModelRequirement[],
): QtiInformationModelAudit {
  const violations: string[] = [];
  const sections = new Set<string>();
  for (const entry of inventory) {
    if (sections.has(entry.id)) violations.push(`Duplicate section: ${entry.id}`);
    sections.add(entry.id);
  }
  for (const entry of inventory) {
    const parent = entry.id.slice(0, entry.id.lastIndexOf("."));
    if (entry.id.includes(".") && !sections.has(parent))
      violations.push(`Missing parent section: ${entry.id}`);
  }
  const ids = new Set<string>();
  const reviewed = new Set<string>();
  const markers = new Set<string>();
  for (const requirement of requirements) {
    if (ids.has(requirement.id)) violations.push(`Duplicate requirement: ${requirement.id}`);
    ids.add(requirement.id);
    if (!requirement.rule.trim() || !requirement.limitation.trim())
      violations.push(`Missing rule or scope limitation: ${requirement.id}`);
    if (!requirement.sections.length) violations.push(`Missing citation: ${requirement.id}`);
    for (const section of requirement.sections) {
      if (!sections.has(section))
        violations.push(`Unknown section: ${requirement.id} -> ${section}`);
      if (requirement.disposition !== "open") reviewed.add(section);
    }
    if (requirement.disposition !== "open" && !requirement.evidence.length)
      violations.push(`Missing executable evidence: ${requirement.id}`);
    if (requirement.disposition === "open" && requirement.evidence.length)
      violations.push(`Open requirement claims evidence: ${requirement.id}`);
    for (const evidence of requirement.evidence) {
      if (!/^\[ASI-[A-Z0-9-]+\]$/u.test(evidence.marker) || markers.has(evidence.marker))
        violations.push(`Invalid or reused evidence marker: ${evidence.marker}`);
      markers.add(evidence.marker);
      if (!Number.isInteger(evidence.cases) || evidence.cases < 1)
        violations.push(`Invalid case count: ${requirement.id}`);
      if (!/^packages\/.+\.test\.ts$/u.test(evidence.path) || evidence.path.includes(".."))
        violations.push(`Invalid Node evidence path: ${evidence.path}`);
    }
  }
  return {
    totalSections: inventory.length,
    sectionsWithReviewedRequirements: reviewed.size,
    unauditedSections: inventory
      .filter((entry) => !reviewed.has(entry.id))
      .map((entry) => entry.id),
    implementedRequirements: requirements.filter((entry) => entry.disposition === "implemented")
      .length,
    rejectedRequirements: requirements.filter((entry) => entry.disposition === "rejected").length,
    openRequirements: requirements
      .filter((entry) => entry.disposition === "open")
      .map((entry) => entry.id),
    violations,
  };
}

/** An actual test result supplied by the test runner, including failed and skipped assertions. */
export interface QtiRequirementTestResult {
  readonly path: string;
  readonly name: string;
  readonly status: string;
}

/** Require every declared assertion group to run, pass, and retain its reviewed case count. */
export function checkQtiRequirementResults(
  requirements: readonly QtiInformationModelRequirement[],
  results: readonly QtiRequirementTestResult[],
): string[] {
  return requirements.flatMap((requirement) =>
    requirement.evidence.flatMap((evidence) => {
      const matches = results.filter(
        (result) => result.path === evidence.path && result.name.includes(evidence.marker),
      );
      const errors: string[] = [];
      if (matches.length !== evidence.cases)
        errors.push(
          `${requirement.id}: expected ${evidence.cases} cases for ${evidence.marker}, found ${matches.length}`,
        );
      if (matches.some((result) => result.status !== "passed"))
        errors.push(`${requirement.id}: evidence did not pass: ${evidence.marker}`);
      return errors;
    }),
  );
}

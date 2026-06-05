import type { SharedVocabularyClassSupport } from "./types.js";
import {
  matrixCoverageFamilyForClass,
  sharedVocabularyMatrixCoverageFamilies,
} from "./shared-vocabulary-generated-families.js";
import { isEnforcedSharedVocabularyLevel } from "./shared-vocabulary-levels.js";

export interface SharedVocabularyCoverageViolation {
  message: string;
}

export function findSharedVocabularyCoverageViolations(input: {
  matrixClasses: ReadonlySet<string>;
  support: readonly SharedVocabularyClassSupport[];
  matrixTestPath: string;
}): SharedVocabularyCoverageViolation[] {
  const violations: SharedVocabularyCoverageViolation[] = [];
  const { matrixClasses, support, matrixTestPath } = input;

  const exceptionIds = sharedVocabularyMatrixCoverageFamilies.map((family) => family.id);
  if (new Set(exceptionIds).size !== exceptionIds.length) {
    violations.push({ message: "shared vocabulary matrix coverage family ids must be unique" });
  }

  for (const family of sharedVocabularyMatrixCoverageFamilies) {
    if (family.rationale.trim().length === 0) {
      violations.push({ message: `${family.id} must include a coverage rationale` });
    }
    if (family.coveredBy.length === 0) {
      violations.push({ message: `${family.id} must list representative covered classes` });
    }
    for (const coveredClass of family.coveredBy) {
      if (!matrixClasses.has(coveredClass)) {
        violations.push({
          message: `${family.id} coveredBy class ${coveredClass} must appear in the matrix manifest`,
        });
      }
    }
  }

  const supportByClass = new Map<string, SharedVocabularyClassSupport[]>();
  for (const entry of support) {
    if (!isEnforcedSharedVocabularyLevel(entry.level)) {
      continue;
    }
    const existing = supportByClass.get(entry.className) ?? [];
    existing.push(entry);
    supportByClass.set(entry.className, existing);
  }

  const gatedSupportClasses = [...supportByClass.keys()].sort();
  if (gatedSupportClasses.length === 0) {
    violations.push({ message: "expected at least one enforced shared vocabulary class" });
  }

  for (const className of gatedSupportClasses) {
    const supportEntries = supportByClass.get(className) ?? [];
    const directlyCovered = matrixClasses.has(className);
    if (!directlyCovered) {
      for (const entry of supportEntries) {
        const exception = matrixCoverageFamilyForClass(className, entry.level);
        if (!exception) {
          violations.push({
            message: `${className} requires matrix coverage or a documented generated-family exception`,
          });
        }
      }
    }
    for (const entry of supportEntries) {
      if (!(entry.tests ?? []).includes(matrixTestPath)) {
        violations.push({
          message: `${className} must list ${matrixTestPath} in shared vocabulary test evidence`,
        });
      }
    }
  }

  return violations;
}

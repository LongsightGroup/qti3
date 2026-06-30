import type { QtiPackageXmlNode } from "./package-xml.js";
import { parseXmlBoolean } from "./parser-values.js";
import { packageDescendants } from "./qti-package-xml.js";
import type {
  QtiAssessmentTestPackageModel,
  QtiPackageItem,
  QtiStandardAlignment,
  QtiTimingMetadata,
} from "./qti-package-types.js";

/** Known QTI / IMS CP alignment element names plus attribute-driven manifest metadata. */
const STANDARD_ALIGNMENT_ELEMENT_NAMES = new Set([
  "standard-alignment",
  "qti-standard-alignment",
  "alignment-objective",
]);

const STANDARD_ALIGNMENT_ATTRIBUTE_NAMES = new Set([
  "standard-id",
  "standardIdentifier",
  "standard-framework",
  "standardFramework",
  "target-id",
  "targetIdentifier",
]);

export function parseTimingMetadata(
  root: QtiPackageXmlNode,
  sourcePath: string,
): QtiTimingMetadata | undefined {
  const timeLimits = packageDescendants(root, "qti-time-limits")[0];
  const timeDependent = parseXmlBoolean(root.attributes["time-dependent"]);
  if (!timeLimits && timeDependent === undefined) return undefined;

  return {
    sourcePath,
    timeDependent,
    minTime: timeLimits?.attributes["min-time"],
    maxTime: timeLimits?.attributes["max-time"],
    allowLateSubmission: parseXmlBoolean(timeLimits?.attributes["allow-late-submission"]),
    attributes: timeLimits ? { ...timeLimits.attributes } : {},
  };
}

export function parseStandardAlignments(
  root: QtiPackageXmlNode,
  sourcePath: string,
): QtiStandardAlignment[] {
  const alignments: QtiStandardAlignment[] = [];
  for (const node of packageDescendants(root)) {
    if (!isStandardAlignmentNode(node)) continue;
    const text = node.text.trim();
    alignments.push({
      sourcePath,
      qtiName: node.localName,
      identifier: firstAttribute(node, [
        "identifier",
        "id",
        "standard-id",
        "standardIdentifier",
        "target-id",
        "targetIdentifier",
      ]),
      framework: firstAttribute(node, [
        "framework",
        "standard-framework",
        "standardFramework",
        "educational-framework",
        "educationalFramework",
      ]),
      targetName:
        firstAttribute(node, ["target-name", "targetName", "name"]) ??
        (text.length > 0 ? text : undefined),
      targetUrl: firstAttribute(node, ["href", "url", "uri", "target-url", "targetUrl"]),
      text: text.length > 0 ? text : undefined,
      attributes: { ...node.attributes },
    });
  }
  return alignments;
}

function isStandardAlignmentNode(node: QtiPackageXmlNode): boolean {
  if (STANDARD_ALIGNMENT_ELEMENT_NAMES.has(node.localName)) return true;
  return Object.keys(node.attributes).some((name) => STANDARD_ALIGNMENT_ATTRIBUTE_NAMES.has(name));
}

function firstAttribute(node: QtiPackageXmlNode, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = node.attributes[name];
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

export function uniqueStandards(
  standards: readonly QtiStandardAlignment[],
): QtiStandardAlignment[] {
  const seen = new Set<string>();
  const unique: QtiStandardAlignment[] = [];
  for (const standard of standards) {
    const key = [
      standard.sourcePath,
      standard.qtiName,
      standard.identifier ?? "",
      standard.framework ?? "",
      standard.targetName ?? "",
      standard.targetUrl ?? "",
      standard.text ?? "",
    ].join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(standard);
  }
  return unique;
}

export function primaryTiming(
  assessmentTest: QtiAssessmentTestPackageModel | undefined,
  items: readonly QtiPackageItem[],
): QtiTimingMetadata | undefined {
  if (assessmentTest?.timing) return assessmentTest.timing;
  const timedItems = items.filter((item) => item.timing !== undefined);
  return timedItems.length === 1 ? timedItems[0]?.timing : undefined;
}

export function packageTitle(
  manifestRoot: QtiPackageXmlNode | undefined,
  assessmentTest: QtiAssessmentTestPackageModel | undefined,
  items: readonly QtiPackageItem[],
): string {
  const manifestTitle = manifestRoot
    ? packageDescendants(manifestRoot, "title")
        .map((node) => node.text.trim())
        .find((text) => text.length > 0)
    : undefined;
  return (
    assessmentTest?.title ??
    manifestTitle ??
    items.find((item) => item.title !== undefined)?.title ??
    manifestRoot?.attributes.identifier ??
    ""
  );
}

import type { QtiPackageXmlNode } from "./package-xml.js";
import { parseXmlBoolean } from "./parser-values.js";
import { pushPackageDiagnostic } from "./qti-package-paths.js";
import { childPackageElements, packageDescendants } from "./qti-package-xml.js";
import type {
  QtiAssessmentTestPackageModel,
  QtiPackageItem,
  QtiItemSessionControl,
  QtiStandardAlignment,
  QtiTimeLimits,
  QtiTimingMetadata,
} from "./qti-package-types.js";
import type { QtiDiagnostic } from "./types.js";

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
  diagnostics: QtiDiagnostic[],
  parsedTimeLimits?: QtiTimeLimits,
): QtiTimingMetadata | undefined {
  const timeLimitsNode = childPackageElements(root, "qti-time-limits")[0];
  const timeLimits = parsedTimeLimits ?? parseTimeLimits(timeLimitsNode, sourcePath, diagnostics);
  const timeDependent = parseXmlBoolean(root.attributes["time-dependent"]);
  if (!timeLimitsNode && timeDependent === undefined) return undefined;

  return {
    sourcePath,
    timeDependent,
    minTime: timeLimitsNode?.attributes["min-time"],
    maxTime: timeLimitsNode?.attributes["max-time"],
    allowLateSubmission: timeLimits?.allowLateSubmission,
    attributes: timeLimitsNode ? { ...timeLimitsNode.attributes } : {},
  };
}

export function parseTimeLimits(
  node: QtiPackageXmlNode | undefined,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): QtiTimeLimits | undefined {
  if (!node) return undefined;

  const minTimeSeconds = parseNonNegativeNumberAttribute(node, "min-time", sourcePath, diagnostics);
  const maxTimeSeconds = parseNonNegativeNumberAttribute(node, "max-time", sourcePath, diagnostics);
  const allowLateSubmission = parseBooleanAttribute(
    node,
    "allow-late-submission",
    sourcePath,
    diagnostics,
  );

  if (
    minTimeSeconds !== undefined &&
    maxTimeSeconds !== undefined &&
    minTimeSeconds > maxTimeSeconds
  ) {
    pushPackageDiagnostic(
      diagnostics,
      "package.timing.range.invalid",
      "error",
      `qti-time-limits min-time ${minTimeSeconds} exceeds max-time ${maxTimeSeconds}.`,
      sourcePath,
    );
  }

  return {
    minTimeSeconds,
    maxTimeSeconds,
    allowLateSubmission,
    attributes: { ...node.attributes },
  };
}

export function parseItemSessionControl(
  node: QtiPackageXmlNode | undefined,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): QtiItemSessionControl | undefined {
  if (!node) return undefined;

  return {
    maxAttempts: parseNonNegativeNumberAttribute(node, "max-attempts", sourcePath, diagnostics),
    showFeedback: parseBooleanAttribute(node, "show-feedback", sourcePath, diagnostics),
    allowReview: parseBooleanAttribute(node, "allow-review", sourcePath, diagnostics),
    showSolution: parseBooleanAttribute(node, "show-solution", sourcePath, diagnostics),
    allowComment: parseBooleanAttribute(node, "allow-comment", sourcePath, diagnostics),
    allowSkipping: parseBooleanAttribute(node, "allow-skipping", sourcePath, diagnostics),
    validateResponses: parseBooleanAttribute(node, "validate-responses", sourcePath, diagnostics),
    attributes: { ...node.attributes },
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
  alignments.push(...parseCurriculumStandardsMetadata(root, sourcePath));
  return alignments;
}

function parseCurriculumStandardsMetadata(
  root: QtiPackageXmlNode,
  sourcePath: string,
): QtiStandardAlignment[] {
  const alignments: QtiStandardAlignment[] = [];
  for (const metadataSet of packageDescendants(root, "curriculumStandardsMetadataSet")) {
    const resourceLabel = firstAttribute(metadataSet, ["resourceLabel"]);
    const resourcePartIdentifier = firstAttribute(metadataSet, ["resourcePartId"]);
    const weight = optionalFiniteNumber(firstAttribute(metadataSet, ["weight"]));

    for (const metadata of childPackageElements(metadataSet, "curriculumStandardsMetadata")) {
      const providerIdentifier = firstAttribute(metadata, [
        "providerId",
        "providerID",
        "domainId",
        "domainID",
      ]);
      for (const labelledGuid of packageDescendants(metadata, "labelledGUID")) {
        const identifier = childText(labelledGuid, "GUID");
        const targetName = childText(labelledGuid, "label");
        const targetUrl =
          childText(labelledGuid, "caseItemURI") ??
          childText(labelledGuid, "uri") ??
          childText(labelledGuid, "URI");
        if (!identifier && !targetName && !targetUrl) continue;

        alignments.push({
          sourcePath,
          qtiName: "curriculumStandardsMetadata",
          identifier,
          targetName,
          targetUrl,
          text: targetName,
          providerIdentifier,
          resourceLabel,
          resourcePartIdentifier,
          weight,
          attributes: { ...metadataSet.attributes, ...metadata.attributes },
        });
      }
    }
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
      standard.providerIdentifier ?? "",
      standard.resourceLabel ?? "",
      standard.resourcePartIdentifier ?? "",
      standard.weight?.toString() ?? "",
    ].join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(standard);
  }
  return unique;
}

function parseNonNegativeNumberAttribute(
  node: QtiPackageXmlNode,
  name: string,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): number | undefined {
  const raw = node.attributes[name];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isFinite(value) && value >= 0) return value;

  pushPackageDiagnostic(
    diagnostics,
    `package.attribute.${name}.number`,
    "error",
    `${node.localName} ${name} must be a non-negative number, found ${raw}.`,
    sourcePath,
  );
  return undefined;
}

function parseBooleanAttribute(
  node: QtiPackageXmlNode,
  name: string,
  sourcePath: string,
  diagnostics: QtiDiagnostic[],
): boolean | undefined {
  const raw = node.attributes[name];
  if (raw === undefined) return undefined;
  const value = parseXmlBoolean(raw);
  if (value !== undefined) return value;

  pushPackageDiagnostic(
    diagnostics,
    `package.attribute.${name}.boolean`,
    "error",
    `${node.localName} ${name} must be an XML boolean, found ${raw}.`,
    sourcePath,
  );
  return undefined;
}

function childText(node: QtiPackageXmlNode, localName: string): string | undefined {
  const text = childPackageElements(node, localName)[0]?.text.trim();
  return text ? text : undefined;
}

function optionalFiniteNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
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

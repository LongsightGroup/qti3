import type {
  QtiAssessmentSectionPackageModel,
  QtiAssessmentTestPackageModel,
} from "@longsightgroup/qti3-core";

import { relativePackagePath } from "./package-manifest.js";
import { escapeXml } from "./xml.js";

/** Internal conformance seam for validating the assessment-test wire serializers. */
export function serializeTargetAssessmentTest(
  test: QtiAssessmentTestPackageModel,
  target: "qti12" | "qti21" | "qti22",
  manifestIdentifiersByHref: ReadonlyMap<string, string> = new Map(),
): string {
  if (target === "qti12") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="${escapeXml(test.identifier)}" title="${escapeXml(test.title ?? test.identifier)}">
    ${test.testParts
      .flatMap((part) => part.sections)
      .map((section) => serializeQti12Section(section, manifestIdentifiersByHref))
      .join("\n    ")}
  </assessment>
</questestinterop>`;
  }
  const namespace =
    target === "qti21"
      ? "http://www.imsglobal.org/xsd/imsqti_v2p1"
      : "http://www.imsglobal.org/xsd/imsqti_v2p2";
  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="${namespace}" identifier="${escapeXml(test.identifier)}" title="${escapeXml(
    test.title ?? test.identifier,
  )}">
  ${serializeTimeLimits(test.timeLimits)}
  ${test.testParts
    .map(
      (part) => `<testPart identifier="${escapeXml(part.identifier)}" navigationMode="${
        part.navigationMode ?? "linear"
      }" submissionMode="${part.submissionMode ?? "individual"}">
    ${serializeTimeLimits(part.timeLimits)}
    ${part.sections.map((section) => serializeQti2Section(section, test.href)).join("\n    ")}
  </testPart>`,
    )
    .join("\n  ")}
</assessmentTest>`;
}

function serializeQti12Section(
  section: QtiAssessmentSectionPackageModel,
  manifestIdentifiersByHref: ReadonlyMap<string, string>,
): string {
  return `<section ident="${escapeXml(section.identifier)}" title="${escapeXml(
    section.title ?? section.identifier,
  )}">
${section.itemRefs
  .map(
    (itemRef) =>
      `  <itemref linkrefid="${escapeXml(
        manifestIdentifiersByHref.get(itemRef.href) ?? itemRef.identifier ?? itemRef.href,
      )}"></itemref>`,
  )
  .join("\n")}
${section.sections
  .map((child) => serializeQti12Section(child, manifestIdentifiersByHref))
  .join("\n")}
</section>`;
}

function serializeQti2Section(section: QtiAssessmentSectionPackageModel, testPath: string): string {
  return `<assessmentSection identifier="${escapeXml(section.identifier)}" title="${escapeXml(
    section.title ?? section.identifier,
  )}" visible="${String(section.visible ?? true)}">
${serializeTimeLimits(section.timeLimits)}
${section.itemRefs
  .map(
    (itemRef) =>
      `  <assessmentItemRef identifier="${escapeXml(
        itemRef.identifier ?? itemRef.href.replace(/[^A-Za-z0-9_.-]/g, "_"),
      )}" href="${escapeXml(relativePackagePath(testPath, itemRef.href))}">${serializeTimeLimits(
        itemRef.timeLimits,
      )}${serializeItemSessionControl(itemRef.itemSessionControl)}</assessmentItemRef>`,
  )
  .join("\n")}
${section.sections.map((child) => serializeQti2Section(child, testPath)).join("\n")}
</assessmentSection>`;
}

function serializeTimeLimits(
  limits:
    | {
        readonly minTimeSeconds?: number | undefined;
        readonly maxTimeSeconds?: number | undefined;
        readonly allowLateSubmission?: boolean | undefined;
      }
    | undefined,
): string {
  if (!limits) return "";
  const attrs = [
    limits.minTimeSeconds === undefined ? "" : ` minTime="${String(limits.minTimeSeconds)}"`,
    limits.maxTimeSeconds === undefined ? "" : ` maxTime="${String(limits.maxTimeSeconds)}"`,
    limits.allowLateSubmission === undefined
      ? ""
      : ` allowLateSubmission="${String(limits.allowLateSubmission)}"`,
  ].join("");
  return `<timeLimits${attrs}></timeLimits>`;
}

function serializeItemSessionControl(
  control:
    | {
        readonly maxAttempts?: number | undefined;
        readonly showFeedback?: boolean | undefined;
        readonly allowReview?: boolean | undefined;
        readonly showSolution?: boolean | undefined;
        readonly allowComment?: boolean | undefined;
        readonly allowSkipping?: boolean | undefined;
        readonly validateResponses?: boolean | undefined;
      }
    | undefined,
): string {
  if (!control) return "";
  const pairs = [
    ["maxAttempts", control.maxAttempts],
    ["showFeedback", control.showFeedback],
    ["allowReview", control.allowReview],
    ["showSolution", control.showSolution],
    ["allowComment", control.allowComment],
    ["allowSkipping", control.allowSkipping],
    ["validateResponses", control.validateResponses],
  ] as const;
  return `<itemSessionControl${pairs
    .filter((pair) => pair[1] !== undefined)
    .map(([name, value]) => ` ${name}="${String(value)}"`)
    .join("")}></itemSessionControl>`;
}

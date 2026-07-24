import type { QtiAssessmentItem, QtiInteractionType } from "@longsightgroup/qti3-core";
import { parseQtiXml } from "@longsightgroup/qti3-core";
import { createHash } from "node:crypto";

import { transcodeQti3Item } from "./item.js";
import { qtiTranscodeProfiles, requiresReverseMigrationEvidence } from "./profiles.js";
import type { QtiTranscodeItemResult, QtiTranscodeProfileId } from "./types.js";
import { escapeXml } from "./xml.js";

export interface TranscoderEvidenceCase {
  readonly caseId: string;
  readonly profile: QtiTranscodeProfileId;
  readonly interaction: QtiInteractionType;
}

export interface TranscoderEvidenceObservation {
  readonly caseId: string;
  readonly fidelity: string;
  readonly scoring: string;
  readonly fallback: string;
  readonly sha256: string;
  readonly evidence: readonly string[];
}

export interface TranscoderEvidenceFailure {
  readonly caseId: string;
  readonly message: string;
}

export interface TranscoderEvidenceRunResult {
  readonly observations: readonly TranscoderEvidenceObservation[];
  readonly failures: readonly TranscoderEvidenceFailure[];
}

export function transcoderEvidenceCases(
  profiles: readonly QtiTranscodeProfileId[],
  interactions: readonly QtiInteractionType[],
): readonly TranscoderEvidenceCase[] {
  return profiles.flatMap((profile) =>
    interactions.map((interaction) => ({
      caseId: `${profile}/${interaction}`,
      profile,
      interaction,
    })),
  );
}

export function runTranscoderEvidenceCase(
  sourceXml: string,
  evidenceCase: TranscoderEvidenceCase,
): { readonly result: QtiTranscodeItemResult; readonly source: QtiAssessmentItem } | undefined {
  const source = parseQtiXml(sourceXml);
  if (!source.ok || !source.document) return undefined;
  const result = transcodeQti3Item(
    { kind: "xml", xml: sourceXml, sourcePath: `${evidenceCase.interaction}.xml` },
    { profile: evidenceCase.profile },
  );
  return { result, source: source.document.item };
}

export function validateTranscoderEvidenceCase(
  evidenceCase: TranscoderEvidenceCase,
  result: QtiTranscodeItemResult,
  sourceItem: QtiAssessmentItem,
): readonly TranscoderEvidenceFailure[] {
  const failures: TranscoderEvidenceFailure[] = [];
  const push = (message: string): void => {
    failures.push({ caseId: evidenceCase.caseId, message });
  };

  if (!result.ok) {
    push(`target generation failed (${result.code}).`);
    return failures;
  }
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    push("target semantic validation emitted an error.");
  }
  if (
    result.report.mappings.length !== sourceItem.interactions.length ||
    !result.report.mappings.every(
      (mapping) => mapping.sourceInteraction === evidenceCase.interaction,
    )
  ) {
    push("behavior report does not cover every source interaction.");
  }

  assertScoring(evidenceCase, result, sourceItem, push);
  assertAccessibility(evidenceCase, result.xml, sourceItem, push);
  assertAssets(result, sourceItem, push);
  assertKeyboardRepresentation(evidenceCase, result, push);
  assertCustomPayload(evidenceCase, result.xml, push);

  return failures;
}

export function observeTranscoderEvidenceCase(
  evidenceCase: TranscoderEvidenceCase,
  result: Extract<QtiTranscodeItemResult, { ok: true }>,
): TranscoderEvidenceObservation {
  return {
    caseId: evidenceCase.caseId,
    fidelity: result.report.fidelity,
    scoring: [...new Set(result.report.mappings.map((mapping) => mapping.scoring))].join("+"),
    fallback:
      [...new Set(result.report.mappings.flatMap((mapping) => mapping.fallback ?? []))].join("+") ||
      "—",
    sha256: sha256(
      JSON.stringify({
        xml: result.xml,
        report: result.report,
        diagnostics: result.diagnostics,
      }),
    ),
    evidence: [
      "source-semantic",
      "target-semantic",
      "golden-fixture",
      ...(requiresReverseMigrationEvidence(qtiTranscodeProfiles[evidenceCase.profile])
        ? ["reverse-migration"]
        : []),
      "behavior",
      "visible-content",
      "assets",
      "keyboard",
      "accessibility",
    ],
  };
}

export function runTranscoderEvidenceMatrix(input: {
  readonly profiles?: readonly QtiTranscodeProfileId[];
  readonly interactions: readonly QtiInteractionType[];
  readonly fixtureXml: (interaction: QtiInteractionType) => string;
  readonly reverseMigration?: (
    xml: string,
    fidelity: string,
  ) => { readonly ok: boolean; readonly message?: string | undefined };
}): TranscoderEvidenceRunResult {
  const profiles =
    input.profiles ?? Object.values(qtiTranscodeProfiles).map((profile) => profile.id);
  const observations: TranscoderEvidenceObservation[] = [];
  const failures: TranscoderEvidenceFailure[] = [];

  for (const evidenceCase of transcoderEvidenceCases(profiles, input.interactions)) {
    const sourceXml = input.fixtureXml(evidenceCase.interaction);
    const run = runTranscoderEvidenceCase(sourceXml, evidenceCase);
    if (!run) {
      failures.push({
        caseId: evidenceCase.caseId,
        message: "source semantic validation failed.",
      });
      continue;
    }
    failures.push(...validateTranscoderEvidenceCase(evidenceCase, run.result, run.source));
    if (run.result.ok) {
      observations.push(observeTranscoderEvidenceCase(evidenceCase, run.result));
      const reverse = requiresReverseMigrationEvidence(qtiTranscodeProfiles[evidenceCase.profile])
        ? input.reverseMigration?.(run.result.xml, run.result.report.fidelity)
        : undefined;
      if (reverse && !reverse.ok) {
        failures.push({
          caseId: evidenceCase.caseId,
          message: reverse.message ?? "reverse migration failed.",
        });
      }
    } else {
      failures.push({
        caseId: evidenceCase.caseId,
        message: `target generation failed (${run.result.code}).`,
      });
    }
  }

  observations.sort((left, right) => left.caseId.localeCompare(right.caseId));
  return { observations, failures };
}

function assertScoring(
  evidenceCase: TranscoderEvidenceCase,
  result: Extract<QtiTranscodeItemResult, { ok: true }>,
  item: QtiAssessmentItem,
  push: (message: string) => void,
): void {
  for (const mapping of result.report.mappings) {
    if (mapping.scoring !== "automatic") continue;
    const interaction = item.interactions[mapping.index];
    const declaration = item.responseDeclarations.find(
      (entry) => entry.identifier === interaction?.responseIdentifier,
    );
    if (declaration?.correctResponse === null || declaration === undefined) {
      push("automatic scoring lacks a source correct response.");
    }
    if (
      result.target === "qti12" &&
      (!result.xml.includes("<respcondition") || !result.xml.includes("<setvar"))
    ) {
      push("QTI 1.2 promises automatic scoring without scoring rules.");
    }
    if (
      (result.target === "qti21" || result.target === "qti22") &&
      !result.xml.includes("<responseProcessing")
    ) {
      push("QTI 2.x promises automatic scoring without response processing.");
    }
    if (
      result.target === "moodle-xml" &&
      !/<question type="(?:matching|multichoice|numerical|shortanswer)">/.test(result.xml)
    ) {
      push("Moodle XML promises automatic scoring without a gradable question type.");
    }
  }
  if (
    (result.target === "qti12" || result.target === "moodle-xml") &&
    (evidenceCase.caseId.endsWith("/selectPoint") ||
      evidenceCase.caseId.endsWith("/positionObject")) &&
    (!result.xml.includes("x,y coordinates") ||
      (result.target === "qti12" &&
        /\b\d+\s+\d+\b/.test(result.xml.match(/<varequal[^>]*>([^<]+)<\/varequal>/)?.[1] ?? "")))
  ) {
    push("learner point encoding and scoring encoding disagree.");
  }
}

function assertAccessibility(
  evidenceCase: TranscoderEvidenceCase,
  xml: string,
  item: QtiAssessmentItem,
  push: (message: string) => void,
): void {
  const labels = item.interactions.flatMap((interaction) =>
    interaction.choices.flatMap((choice) => {
      const explicit =
        choice.attributes["hotspot-label"] ??
        choice.attributes["aria-label"] ??
        choice.attributes.label;
      if (explicit) return [explicit];
      return choice.role === "hotspot" || choice.role === "gap" ? [] : [choice.text];
    }),
  );
  const required = [item.prompt, item.bodyText, ...labels].filter((value): value is string =>
    Boolean(value?.trim()),
  );
  const missing = required.filter((value) => {
    const significantWords = value
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
      .filter((word) => word.length >= 4)
      .slice(0, 4);
    const represented =
      xml.includes(escapeXml(value.trim())) ||
      significantWords.some((word) => xml.includes(escapeXml(word)));
    return !represented;
  });
  if (missing.length > 0) {
    push(`essential accessible content did not survive: ${missing.join(", ")}`);
  }
}

function assertCustomPayload(
  evidenceCase: TranscoderEvidenceCase,
  xml: string,
  push: (message: string) => void,
): void {
  const interaction = evidenceCase.interaction;
  if (
    (interaction === "custom" || interaction === "portableCustom") &&
    !(
      xml.includes("qti3-transcoder:custom:v1") ||
      ((xml.includes("response_str") || xml.includes('<question type="essay">')) &&
        xml.includes("Provide the requested response"))
    )
  ) {
    push("custom configuration or usable manual fallback is missing.");
  }
}

function assertAssets(
  result: Extract<QtiTranscodeItemResult, { ok: true }>,
  item: QtiAssessmentItem,
  push: (message: string) => void,
): void {
  const hrefs = item.interactions
    .flatMap((interaction) => [
      interaction.object?.data,
      interaction.positionObjectStage?.data,
      ...interaction.choices.map((choice) => choice.asset?.data),
      interaction.portableCustom?.interactionModules?.primaryConfiguration,
      interaction.portableCustom?.interactionModules?.secondaryConfiguration,
      ...(interaction.portableCustom?.interactionModules?.modules.flatMap((module) => [
        module.primaryPath,
        module.fallbackPath,
      ]) ?? []),
      ...(interaction.portableCustom?.stylesheets.map((stylesheet) => stylesheet.href) ?? []),
    ])
    .concat(contentAssetHrefs(item.body));
  for (const href of hrefs.filter((value): value is string =>
    Boolean(value && !value.startsWith("data:")),
  )) {
    if (!result.xml.includes(escapeXml(href))) {
      push(`referenced interaction asset ${href} was not preserved.`);
    }
  }
  for (const asset of result.assets) {
    if (!/^assets\/generated\/[a-f0-9]{64}\.[a-z0-9]+$/i.test(asset.path)) {
      push(`generated asset path is not content-addressed: ${asset.path}`);
    }
    if (!result.xml.includes(escapeXml(asset.path))) {
      push(`generated asset ${asset.path} is not referenced by target XML.`);
    }
  }
  const generatedReferences = [
    ...result.xml.matchAll(/assets\/generated\/[a-f0-9]{64}\.[a-z0-9]+/gi),
  ].map((match) => match[0]);
  const emittedPaths = new Set(result.assets.map((asset) => asset.path));
  for (const path of generatedReferences) {
    if (!emittedPaths.has(path)) {
      push(`target XML references missing generated asset ${path}.`);
    }
  }
}

function contentAssetHrefs(nodes: QtiAssessmentItem["body"]): (string | undefined)[] {
  return nodes.flatMap((node) => {
    if (node.kind !== "element" && node.kind !== "feedback") return [];
    const current = node.kind === "element" ? [node.attributes.src, node.attributes.data] : [];
    return [...current, ...contentAssetHrefs(node.children)];
  });
}

function assertKeyboardRepresentation(
  evidenceCase: TranscoderEvidenceCase,
  result: Extract<QtiTranscodeItemResult, { ok: true }>,
  push: (message: string) => void,
): void {
  const qti12Controls = new Set(["response_lid", "response_str", "response_grp"]);
  for (const mapping of result.report.mappings) {
    const canvasUpload =
      evidenceCase.caseId === "canvas-classic-quizzes@1/upload" &&
      mapping.emittedInteraction === "presentation";
    if (
      result.target === "qti12" &&
      !canvasUpload &&
      !qti12Controls.has(mapping.emittedInteraction)
    ) {
      push("QTI 1.2 fallback lacks a standard keyboard-operable control.");
    }
    if (
      result.target === "moodle-xml" &&
      !["essay", "matching", "multichoice", "numerical", "shortanswer"].includes(
        mapping.emittedInteraction,
      )
    ) {
      push("Moodle XML fallback lacks a core keyboard-operable question type.");
    }
    if (
      result.target !== "qti12" &&
      result.target !== "moodle-xml" &&
      !(
        mapping.emittedInteraction.endsWith("Interaction") ||
        mapping.emittedInteraction === "customInteraction"
      )
    ) {
      push("QTI 2.x output lacks a standard interaction contract.");
    }
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

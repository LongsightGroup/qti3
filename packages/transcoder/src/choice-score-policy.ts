import type { QtiAssessmentItem, QtiInteraction } from "@longsightgroup/qti3-core";

import { itemMaximumScore } from "./item-score.js";
import type { QtiTranscodeDiagnostic, QtiTranscodeScoringDisposition } from "./types.js";

/** Native profiles that rebuild choice scoring instead of copying response processing. */
export type NativeChoiceScoreProfile = "qti12" | "canvas" | "moodle";

const choiceRebuildWarning = {
  qti12: {
    code: "profile.qti12.scoring.choice_rebuilt",
    message:
      "QTI 1.2 choice scoring is rebuilt as all-or-nothing: a fully correct answer set earns one point. Authored point maxima, partial-credit mappings and custom response processing are not copied. Review scoring in the destination.",
  },
  canvas: {
    code: "profile.canvas.scoring.choice_rebuilt",
    message:
      "Canvas choice scoring is rebuilt as all-or-nothing: a fully correct answer set earns 100% of the exported question maximum. Authored partial-credit mappings and custom response processing are not copied. Review scoring in the destination.",
  },
  moodle: {
    code: "profile.moodle.xml.scoring.choice_rebuilt",
    message:
      "Moodle choice scoring is rebuilt from the answer key: correct answers receive equal point fractions, and multiple-answer wrong answers deduct points. Authored mappings and custom response processing are not copied. Review scoring in the destination.",
  },
} as const satisfies Record<
  NativeChoiceScoreProfile,
  { readonly code: string; readonly message: string }
>;

/**
 * Warn when an automatic native choice export replaces authored scoring.
 * Standard one-point match_correct is reproducible. Moodle multiple-answer is not:
 * wrong answers are rebuilt as point deductions.
 */
export function choiceScoreReconstructionWarnings(input: {
  readonly item: QtiAssessmentItem;
  readonly interaction: QtiInteraction | undefined;
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly profile: NativeChoiceScoreProfile;
  readonly path?: string | undefined;
}): readonly QtiTranscodeDiagnostic[] {
  const interaction = input.interaction;
  if (
    interaction?.type !== "choice" ||
    input.scoring !== "automatic" ||
    reproducesNativeChoiceScore(input.item, interaction, input.profile)
  )
    return [];
  const warning = choiceRebuildWarning[input.profile];
  return [{ code: warning.code, severity: "warning", message: warning.message, path: input.path }];
}

function reproducesNativeChoiceScore(
  item: QtiAssessmentItem,
  interaction: QtiInteraction,
  profile: NativeChoiceScoreProfile,
): boolean {
  if (profile === "moodle" && interaction.responseCardinality === "multiple") return false;
  return usesStandardUnitChoiceScore(item);
}

/** Recognize the standard one-point match policy native choice scoring can reproduce. */
function usesStandardUnitChoiceScore(item: QtiAssessmentItem): boolean {
  const processing = item.responseProcessing;
  return (
    item.interactions.length === 1 &&
    item.interactions[0]?.responseIdentifier === "RESPONSE" &&
    item.responseDeclarations.length === 1 &&
    item.responseDeclarations[0]?.identifier === "RESPONSE" &&
    itemMaximumScore(item) === 1 &&
    processing !== undefined &&
    (processing.template === "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct" ||
      processing.template ===
        "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml") &&
    processing.rules.length === 0 &&
    processing.conditions.length === 0 &&
    (processing.expressions?.length ?? 0) === 0
  );
}

import {
  deprecatedInteractionSupport,
  interactionSupport,
  type QtiInteractionType,
} from "@longsightgroup/qti3-core";

import { interactionPolicyFallback, qtiTranscodeProfiles } from "./profiles.js";
import type {
  QtiTranscodeFidelity,
  QtiTranscodeProfileId,
  QtiTranscodeScoringDisposition,
} from "./types.js";

export type QtiTranscoderEvidenceKind =
  | "source-semantic"
  | "target-semantic"
  | "xsd"
  | "golden-fixture"
  | "reverse-migration"
  | "behavior"
  | "visible-content"
  | "assets"
  | "keyboard"
  | "accessibility";

export interface QtiTranscoderSupportEntry {
  readonly profile: QtiTranscodeProfileId;
  readonly interaction: QtiInteractionType;
  readonly fidelity: QtiTranscodeFidelity;
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: string | undefined;
  /** Stable executable case consumed by the publication evidence runner. */
  readonly evidenceCaseId: string;
}

/** Generated support contract used by conformance tests and publication checks. */
export const qtiTranscoderSupportMatrix: readonly QtiTranscoderSupportEntry[] = Object.values(
  qtiTranscodeProfiles,
).flatMap((profile) =>
  [...interactionSupport, ...deprecatedInteractionSupport].map((interaction) => {
    const policy = profile.interactions[interaction.interactionType];
    return {
      profile: profile.id,
      interaction: interaction.interactionType,
      fidelity: policy.fidelity,
      scoring: policy.scoring,
      fallback: interactionPolicyFallback(policy),
      evidenceCaseId: `${profile.id}/${interaction.interactionType}`,
    };
  }),
);

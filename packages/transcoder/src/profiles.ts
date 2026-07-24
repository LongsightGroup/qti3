import type { QtiInteractionType } from "@longsightgroup/qti3-core";

import type {
  QtiTranscodeFidelity,
  QtiTranscodeProfileId,
  QtiTranscodeScoringDisposition,
  QtiTranscodeTarget,
} from "./types.js";

export interface QtiTranscodeInteractionPolicy {
  readonly emittedInteraction: string;
  readonly fidelity: QtiTranscodeFidelity;
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: "choice" | "text-entry" | "extended-text" | undefined;
}

export interface QtiTranscodeProfile {
  readonly id: QtiTranscodeProfileId;
  readonly target: QtiTranscodeTarget;
  readonly schemaVersion: "1.2" | "2.1" | "2.2";
  readonly namespace: string;
  readonly schemaLocation: string;
  readonly manifestResourceType: string;
  readonly attributePolicy: "qti12-accessible-fallback" | "qti21-equivalent" | "qti22-preserve";
  readonly wireDialect: "canvas-classic" | "standard";
  readonly packageDialect: "canvas-classic-quiz" | "standard";
  readonly vendorEvidence?: {
    readonly product: "Canvas Classic Quizzes";
    readonly sourceRevision: string;
    readonly sources: readonly string[];
  };
  readonly interactions: Readonly<Record<QtiInteractionType, QtiTranscodeInteractionPolicy>>;
}

const QTI2_INTERACTIONS: Readonly<Record<QtiInteractionType, QtiTranscodeInteractionPolicy>> = {
  associate: native("associateInteraction"),
  choice: native("choiceInteraction"),
  custom: normalized("customInteraction", "unscored"),
  drawing: native("drawingInteraction", "unscored"),
  endAttempt: native("endAttemptInteraction"),
  extendedText: native("extendedTextInteraction"),
  gapMatch: native("gapMatchInteraction"),
  graphicAssociate: native("graphicAssociateInteraction"),
  graphicGapMatch: native("graphicGapMatchInteraction"),
  graphicOrder: native("graphicOrderInteraction"),
  hotspot: native("hotspotInteraction"),
  hottext: native("hottextInteraction"),
  inlineChoice: native("inlineChoiceInteraction"),
  match: native("matchInteraction"),
  media: native("mediaInteraction"),
  order: native("orderInteraction"),
  portableCustom: normalized("customInteraction"),
  positionObject: native("positionObjectInteraction"),
  selectPoint: native("selectPointInteraction"),
  slider: native("sliderInteraction"),
  textEntry: native("textEntryInteraction"),
  upload: native("uploadInteraction"),
};

const QTI12_INTERACTIONS: Readonly<Record<QtiInteractionType, QtiTranscodeInteractionPolicy>> = {
  associate: nativeManual("response_grp"),
  choice: native("response_lid"),
  custom: manual("response_str"),
  drawing: manual("response_str"),
  endAttempt: manual("response_str"),
  extendedText: native("response_str", "manual"),
  gapMatch: choiceFallback(),
  graphicAssociate: choiceFallback(),
  graphicGapMatch: choiceFallback(),
  graphicOrder: native("response_lid"),
  hotspot: native("response_lid"),
  hottext: choiceFallback(),
  inlineChoice: choiceFallback(),
  match: native("response_lid"),
  media: manual("response_str"),
  order: native("response_lid"),
  portableCustom: manual("response_str"),
  positionObject: textFallback(),
  selectPoint: textFallback(),
  slider: textFallback(),
  textEntry: native("response_str"),
  upload: manual("response_str"),
};

const CANVAS_CLASSIC_INTERACTIONS: Readonly<
  Record<QtiInteractionType, QtiTranscodeInteractionPolicy>
> = {
  ...QTI12_INTERACTIONS,
  associate: manual("response_str"),
  graphicOrder: matchingFallback(),
  order: matchingFallback(),
  upload: normalized("presentation", "manual"),
};

export const qtiTranscodeProfiles: Readonly<Record<QtiTranscodeProfileId, QtiTranscodeProfile>> = {
  "canvas-classic-quizzes@1": {
    id: "canvas-classic-quizzes@1",
    target: "qti12",
    schemaVersion: "1.2",
    namespace: "http://www.imsglobal.org/xsd/ims_qtiasiv1p2",
    schemaLocation:
      "http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd",
    manifestResourceType: "imsqti_xmlv1p2",
    attributePolicy: "qti12-accessible-fallback",
    wireDialect: "canvas-classic",
    packageDialect: "canvas-classic-quiz",
    vendorEvidence: {
      product: "Canvas Classic Quizzes",
      sourceRevision: "instructure/canvas-lms@1c9f0bb8013ed69c4f2efe11fd483025469b7e6c",
      sources: [
        "lib/cc/qti/qti_generator.rb",
        "lib/cc/qti/qti_items.rb",
        "lib/cc/qti/qti_manifest.rb",
        "gems/plugins/qti_exporter/spec_canvas/lib/qti/canvas_questions_spec.rb",
      ],
    },
    interactions: CANVAS_CLASSIC_INTERACTIONS,
  },
  "qti12-standard@1": {
    id: "qti12-standard@1",
    target: "qti12",
    schemaVersion: "1.2",
    namespace: "http://www.imsglobal.org/xsd/ims_qtiasiv1p2",
    schemaLocation:
      "http://www.imsglobal.org/xsd/ims_qtiasiv1p2 https://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd",
    manifestResourceType: "imsqti_item_xmlv1p2",
    attributePolicy: "qti12-accessible-fallback",
    wireDialect: "standard",
    packageDialect: "standard",
    interactions: QTI12_INTERACTIONS,
  },
  "qti21-standard@1": {
    id: "qti21-standard@1",
    target: "qti21",
    schemaVersion: "2.1",
    namespace: "http://www.imsglobal.org/xsd/imsqti_v2p1",
    schemaLocation:
      "http://www.imsglobal.org/xsd/imsqti_v2p1 https://www.imsglobal.org/xsd/imsqti_v2p1p2.xsd",
    manifestResourceType: "imsqti_item_xmlv2p1",
    attributePolicy: "qti21-equivalent",
    wireDialect: "standard",
    packageDialect: "standard",
    interactions: QTI2_INTERACTIONS,
  },
  "qti22-standard@1": {
    id: "qti22-standard@1",
    target: "qti22",
    schemaVersion: "2.2",
    namespace: "http://www.imsglobal.org/xsd/imsqti_v2p2",
    schemaLocation:
      "http://www.imsglobal.org/xsd/imsqti_v2p2 https://purl.imsglobal.org/spec/qti/v2p2/schema/xsd/imsqti_v2p2p4.xsd",
    manifestResourceType: "imsqti_item_xmlv2p2",
    attributePolicy: "qti22-preserve",
    wireDialect: "standard",
    packageDialect: "standard",
    interactions: QTI2_INTERACTIONS,
  },
};

function native(
  emittedInteraction: string,
  scoring: QtiTranscodeScoringDisposition = "automatic",
): QtiTranscodeInteractionPolicy {
  return { emittedInteraction, fidelity: "exact", scoring };
}

function normalized(
  emittedInteraction: string,
  scoring: QtiTranscodeScoringDisposition = "automatic",
): QtiTranscodeInteractionPolicy {
  return { emittedInteraction, fidelity: "normalized", scoring };
}

function choiceFallback(): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction: "response_lid",
    fidelity: "lossy",
    scoring: "automatic",
    fallback: "choice",
  };
}

function textFallback(): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction: "response_str",
    fidelity: "lossy",
    scoring: "automatic",
    fallback: "text-entry",
  };
}

function matchingFallback(): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction: "response_lid",
    fidelity: "lossy",
    scoring: "automatic",
  };
}

function manual(emittedInteraction: string): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction,
    fidelity: "lossy",
    scoring: "manual",
    fallback: "extended-text",
  };
}

function nativeManual(emittedInteraction: string): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction,
    fidelity: "lossy",
    scoring: "manual",
  };
}

/** Resolve a required, versioned profile without fallback or detection. */
export function qtiTranscodeProfile(id: QtiTranscodeProfileId): QtiTranscodeProfile {
  return qtiTranscodeProfiles[id];
}

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

interface QtiTranscodeProfileBase {
  readonly id: QtiTranscodeProfileId;
  readonly target: QtiTranscodeTarget;
  readonly evidence: {
    readonly xsd: "not-applicable" | "required";
    readonly reverseMigration: "not-applicable" | "required";
  };
  readonly interactions: Readonly<Record<QtiInteractionType, QtiTranscodeInteractionPolicy>>;
}

interface QtiStandardProfileBase extends QtiTranscodeProfileBase {
  readonly kind: "qti-standard";
}

type Qti12StandardProfile = QtiStandardProfileBase & {
  readonly id: "qti12-standard@1";
  readonly target: "qti12";
  readonly package: {
    readonly schemaVersion: "1.2";
    readonly manifestResourceType: "imsqti_item_xmlv1p2";
  };
};

type Qti21StandardProfile = QtiStandardProfileBase & {
  readonly id: "qti21-standard@1";
  readonly target: "qti21";
  readonly package: {
    readonly schemaVersion: "2.1";
    readonly manifestResourceType: "imsqti_item_xmlv2p1";
  };
};

type Qti22StandardProfile = QtiStandardProfileBase & {
  readonly id: "qti22-standard@1";
  readonly target: "qti22";
  readonly package: {
    readonly schemaVersion: "2.2";
    readonly manifestResourceType: "imsqti_item_xmlv2p2";
  };
};

type QtiStandardProfile = Qti12StandardProfile | Qti21StandardProfile | Qti22StandardProfile;

interface VendorProfileEvidence {
  readonly product: "Canvas Classic Quizzes" | "Moodle LMS";
  readonly sourceRevision: string;
  readonly sources: readonly string[];
}

interface CanvasClassicProfile extends QtiTranscodeProfileBase {
  readonly kind: "canvas-classic";
  readonly id: "canvas-classic-quizzes@1";
  readonly target: "qti12";
  readonly vendorEvidence: VendorProfileEvidence & {
    readonly product: "Canvas Classic Quizzes";
  };
}

interface MoodleXmlProfile extends QtiTranscodeProfileBase {
  readonly kind: "moodle-xml";
  readonly id: "moodle-xml@1";
  readonly target: "moodle-xml";
  readonly vendorEvidence: VendorProfileEvidence & {
    readonly product: "Moodle LMS";
  };
}

/** A legal, versioned output profile with target-specific capabilities. */
export type QtiTranscodeProfile = QtiStandardProfile | CanvasClassicProfile | MoodleXmlProfile;

interface QtiTranscodeProfileById {
  readonly "canvas-classic-quizzes@1": CanvasClassicProfile;
  readonly "moodle-xml@1": MoodleXmlProfile;
  readonly "qti12-standard@1": Qti12StandardProfile;
  readonly "qti21-standard@1": Qti21StandardProfile;
  readonly "qti22-standard@1": Qti22StandardProfile;
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

const MOODLE_XML_INTERACTIONS: Readonly<Record<QtiInteractionType, QtiTranscodeInteractionPolicy>> =
  {
    associate: manual("essay"),
    choice: native("multichoice"),
    custom: manual("essay"),
    drawing: manual("essay"),
    endAttempt: manual("essay"),
    extendedText: native("essay", "manual"),
    gapMatch: moodleChoiceFallback(),
    graphicAssociate: manual("essay"),
    graphicGapMatch: moodleChoiceFallback(),
    graphicOrder: moodleMatchingFallback(),
    hotspot: moodleChoiceFallback(),
    hottext: moodleChoiceFallback(),
    inlineChoice: moodleChoiceFallback(),
    match: native("matching"),
    media: manual("essay"),
    order: moodleMatchingFallback(),
    portableCustom: manual("essay"),
    positionObject: moodleTextFallback("shortanswer"),
    selectPoint: moodleTextFallback("shortanswer"),
    slider: moodleTextFallback("numerical"),
    textEntry: native("shortanswer"),
    upload: normalized("essay", "manual"),
  };

export const qtiTranscodeProfiles: Readonly<QtiTranscodeProfileById> = {
  "canvas-classic-quizzes@1": {
    kind: "canvas-classic",
    id: "canvas-classic-quizzes@1",
    target: "qti12",
    evidence: { xsd: "required", reverseMigration: "required" },
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
  "moodle-xml@1": {
    kind: "moodle-xml",
    id: "moodle-xml@1",
    target: "moodle-xml",
    evidence: { xsd: "not-applicable", reverseMigration: "not-applicable" },
    vendorEvidence: {
      product: "Moodle LMS",
      sourceRevision: "moodle/moodle@dd5063e52685f2b77e147619bbdbc75663b36097",
      sources: [
        "public/question/format/xml/format.php",
        "public/question/format/xml/tests/qformat_xml_import_export_test.php",
        "public/question/format/xml/tests/xmlformat_test.php",
        "public/question/format/xml/tests/fixtures",
      ],
    },
    interactions: MOODLE_XML_INTERACTIONS,
  },
  "qti12-standard@1": {
    kind: "qti-standard",
    id: "qti12-standard@1",
    target: "qti12",
    package: { schemaVersion: "1.2", manifestResourceType: "imsqti_item_xmlv1p2" },
    evidence: { xsd: "required", reverseMigration: "required" },
    interactions: QTI12_INTERACTIONS,
  },
  "qti21-standard@1": {
    kind: "qti-standard",
    id: "qti21-standard@1",
    target: "qti21",
    package: { schemaVersion: "2.1", manifestResourceType: "imsqti_item_xmlv2p1" },
    evidence: { xsd: "required", reverseMigration: "required" },
    interactions: QTI2_INTERACTIONS,
  },
  "qti22-standard@1": {
    kind: "qti-standard",
    id: "qti22-standard@1",
    target: "qti22",
    package: { schemaVersion: "2.2", manifestResourceType: "imsqti_item_xmlv2p2" },
    evidence: { xsd: "required", reverseMigration: "required" },
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

function moodleChoiceFallback(): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction: "multichoice",
    fidelity: "lossy",
    scoring: "automatic",
    fallback: "choice",
  };
}

function moodleMatchingFallback(): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction: "matching",
    fidelity: "lossy",
    scoring: "automatic",
  };
}

function moodleTextFallback(
  emittedInteraction: "numerical" | "shortanswer",
): QtiTranscodeInteractionPolicy {
  return {
    emittedInteraction,
    fidelity: "lossy",
    scoring: "automatic",
    fallback: "text-entry",
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
export function qtiTranscodeProfile<Id extends QtiTranscodeProfileId>(
  id: Id,
): QtiTranscodeProfileById[Id] {
  return qtiTranscodeProfiles[id];
}

/** Whether the profile participates in the target XSD evidence gate. */
export function requiresXsdEvidence(profile: QtiTranscodeProfile): boolean {
  return profile.evidence.xsd === "required";
}

/** Whether the profile participates in reverse-migration evidence. */
export function requiresReverseMigrationEvidence(profile: QtiTranscodeProfile): boolean {
  return profile.evidence.reverseMigration === "required";
}

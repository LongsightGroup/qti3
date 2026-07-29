import {
  deprecatedInteractionSupport,
  interactionSupport,
  type QtiInteractionType,
} from "@longsightgroup/qti3-core";

import type {
  QtiTranscodeFidelity,
  QtiTranscodeProfileId,
  QtiTranscodeScoringDisposition,
  QtiTranscodeTarget,
} from "./types.js";

export type QtiTranscodeFallback = "choice" | "text-entry" | "extended-text" | "matching";

interface QtiTranscodeInteractionPolicyBase {
  readonly diagnostic?:
    | {
        readonly code: string;
        readonly message: string;
      }
    | undefined;
}

/**
 * A target mapping plan. The transformation discriminant is the serializer contract;
 * fallback report metadata is derived from it rather than independently configured.
 */
type NativeInteractionPolicy = QtiTranscodeInteractionPolicyBase & {
  readonly transformation: "native";
  readonly fidelity: QtiTranscodeFidelity;
  readonly scoring: QtiTranscodeScoringDisposition;
};

type ChoiceFallbackInteractionPolicy = QtiTranscodeInteractionPolicyBase & {
  readonly transformation: "choice-fallback";
  readonly fidelity: "lossy";
  readonly scoring: "automatic";
};

type TextEntryFallbackInteractionPolicy = QtiTranscodeInteractionPolicyBase & {
  readonly transformation: "text-entry-fallback";
  readonly fidelity: "lossy";
  readonly scoring: "automatic";
};

type ExtendedTextFallbackInteractionPolicy = QtiTranscodeInteractionPolicyBase & {
  readonly transformation: "extended-text-fallback";
  readonly fidelity: "lossy";
  readonly scoring: "manual";
};

type MatchingFallbackInteractionPolicy = QtiTranscodeInteractionPolicyBase & {
  readonly transformation: "matching-fallback";
  readonly fidelity: "lossy";
  readonly scoring: "automatic";
};

type PresentationInteractionPolicy = QtiTranscodeInteractionPolicyBase & {
  readonly transformation: "presentation";
  readonly fidelity: "normalized";
  readonly scoring: "manual";
};

/** Interaction plans accepted by QTI 2.x serializers. */
export type Qti2InteractionPolicy =
  | NativeInteractionPolicy
  | TextEntryFallbackInteractionPolicy
  | ExtendedTextFallbackInteractionPolicy;

/** Interaction plans accepted by QTI 1.2 serializers. */
export type Qti12InteractionPolicy =
  | Qti2InteractionPolicy
  | ChoiceFallbackInteractionPolicy
  | MatchingFallbackInteractionPolicy
  | PresentationInteractionPolicy;

/** Interaction plans accepted by the Moodle XML serializer. */
export type MoodleInteractionPolicy =
  | NativeInteractionPolicy
  | ChoiceFallbackInteractionPolicy
  | TextEntryFallbackInteractionPolicy
  | ExtendedTextFallbackInteractionPolicy;

/** Any legal target-specific interaction plan. */
export type QtiTranscodeInteractionPolicy =
  | NativeInteractionPolicy
  | ChoiceFallbackInteractionPolicy
  | TextEntryFallbackInteractionPolicy
  | ExtendedTextFallbackInteractionPolicy
  | MatchingFallbackInteractionPolicy
  | PresentationInteractionPolicy;

interface QtiTranscodeProfileBase<Policy extends QtiTranscodeInteractionPolicy> {
  readonly id: QtiTranscodeProfileId;
  readonly target: QtiTranscodeTarget;
  readonly evidence: {
    readonly xsd: "not-applicable" | "required";
    readonly reverseMigration: "not-applicable" | "required";
  };
  readonly interactions: Readonly<Record<QtiInteractionType, Policy>>;
}

interface QtiStandardProfileBase<
  Policy extends QtiTranscodeInteractionPolicy,
> extends QtiTranscodeProfileBase<Policy> {
  readonly kind: "qti-standard";
}

type Qti12StandardProfile = QtiStandardProfileBase<Qti12InteractionPolicy> & {
  readonly id: "qti12-standard@1";
  readonly target: "qti12";
  readonly package: {
    readonly schemaVersion: "1.2";
    readonly manifestResourceType: "imsqti_item_xmlv1p2";
  };
};

type Qti21StandardProfile = QtiStandardProfileBase<Qti2InteractionPolicy> & {
  readonly id: "qti21-standard@1";
  readonly target: "qti21";
  readonly responseProcessing: { readonly mode: "preserve" };
  readonly package: {
    readonly schemaVersion: "2.1";
    readonly manifestResourceType: "imsqti_item_xmlv2p1";
  };
};

type Qti22StandardProfile = QtiStandardProfileBase<Qti2InteractionPolicy> & {
  readonly id: "qti22-standard@1";
  readonly target: "qti22";
  readonly package: {
    readonly schemaVersion: "2.2";
    readonly manifestResourceType: "imsqti_item_xmlv2p2";
  };
};

type QtiStandardProfile = Qti12StandardProfile | Qti21StandardProfile | Qti22StandardProfile;

interface VendorProfileEvidence {
  readonly product:
    | "Blackboard Learn question banks"
    | "Brightspace course import"
    | "Canvas Classic Quizzes"
    | "Canvas New Quizzes"
    | "Moodle LMS";
  readonly sourceRevision: string;
  readonly sources: readonly string[];
  readonly compatibility: {
    readonly basis: "source-derived" | "vendor-documentation";
    readonly productImport: "unverified";
  };
  readonly additionalSources?:
    | readonly {
        readonly sourceRevision: string;
        readonly sources: readonly string[];
      }[]
    | undefined;
}

interface CanvasProfile extends QtiTranscodeProfileBase<Qti12InteractionPolicy> {
  readonly kind: "canvas";
  readonly id: "canvas-classic-quizzes@1" | "canvas-new-quizzes@1";
  readonly target: "qti12";
  readonly vendorEvidence: VendorProfileEvidence & {
    readonly product: "Canvas Classic Quizzes" | "Canvas New Quizzes";
  };
}

interface MoodleXmlProfile extends QtiTranscodeProfileBase<MoodleInteractionPolicy> {
  readonly kind: "moodle-xml";
  readonly id: "moodle-xml@1";
  readonly target: "moodle-xml";
  readonly vendorEvidence: VendorProfileEvidence & {
    readonly product: "Moodle LMS";
  };
}

interface VendorQti21Profile extends QtiStandardProfileBase<Qti2InteractionPolicy> {
  readonly id: "blackboard-question-banks@1" | "brightspace-course-import@1";
  readonly target: "qti21";
  readonly package: {
    readonly schemaVersion: "2.1";
    readonly manifestResourceType: "imsqti_item_xmlv2p1";
  };
  readonly responseProcessing:
    | { readonly mode: "preserve" }
    | {
        readonly mode: "omit";
        readonly diagnostic: {
          readonly code: string;
          readonly message: string;
        };
      };
  readonly vendorEvidence: VendorProfileEvidence & {
    readonly product: "Blackboard Learn question banks" | "Brightspace course import";
  };
}

/** A legal, versioned output profile with target-specific capabilities. */
export type QtiTranscodeProfile =
  | QtiStandardProfile
  | VendorQti21Profile
  | CanvasProfile
  | MoodleXmlProfile;

interface QtiTranscodeProfileById {
  readonly "blackboard-question-banks@1": VendorQti21Profile & {
    readonly id: "blackboard-question-banks@1";
  };
  readonly "brightspace-course-import@1": VendorQti21Profile & {
    readonly id: "brightspace-course-import@1";
  };
  readonly "canvas-classic-quizzes@1": CanvasProfile & { readonly id: "canvas-classic-quizzes@1" };
  readonly "canvas-new-quizzes@1": CanvasProfile & { readonly id: "canvas-new-quizzes@1" };
  readonly "moodle-xml@1": MoodleXmlProfile;
  readonly "qti12-standard@1": Qti12StandardProfile;
  readonly "qti21-standard@1": Qti21StandardProfile;
  readonly "qti22-standard@1": Qti22StandardProfile;
}

const CANVAS_CLASSIC_SEQUENCE_MATCHING = {
  code: "profile.canvas.classic.sequence_matching",
  message:
    "Converted the sequencing task to a Canvas Classic matching question with one row per position.",
} as const;

const CANVAS_CLASSIC_UPLOAD = {
  code: "profile.canvas.classic.upload",
  message: "Mapped the QTI upload task to a Canvas Classic file-upload question.",
} as const;

const CANVAS_NEW_QUIZZES_SEQUENCE_MATCHING = {
  code: "profile.canvas.new_quizzes.graphic_sequence_matching",
  message:
    "Converted the graphic sequencing task to a Canvas New Quizzes matching question with one row per position.",
} as const;

const CANVAS_NEW_QUIZZES_UPLOAD = {
  code: "profile.canvas.new_quizzes.upload",
  message: "Mapped the QTI upload task to a Canvas New Quizzes file-upload question.",
} as const;

const BLACKBOARD_RESPONSE_PROCESSING_OMIT = {
  code: "profile.blackboard.response_processing.omitted",
  message:
    "Removed optional QTI response processing because Blackboard skips items that include it. Review scoring after import.",
} as const;

const QTI_INTERACTION_TYPES: readonly QtiInteractionType[] = [
  ...interactionSupport,
  ...deprecatedInteractionSupport,
].map((entry) => entry.interactionType);

const VENDOR_QTI21_NATIVE_INTERACTIONS = new Set<QtiInteractionType>(["choice", "textEntry"]);

const VENDOR_QTI21_TEXT_ENTRY_FALLBACK_INTERACTIONS = new Set<QtiInteractionType>(["inlineChoice"]);

const QTI_INTERACTION_WIRE_NAME_OVERRIDES: Partial<Record<QtiInteractionType, string>> = {
  hottext: "hot-text",
};

function qtiInteractionWireName(type: QtiInteractionType): string {
  return QTI_INTERACTION_WIRE_NAME_OVERRIDES[type] ?? type.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function native(scoring: QtiTranscodeScoringDisposition = "automatic"): NativeInteractionPolicy {
  return { transformation: "native", fidelity: "exact", scoring };
}

function normalized(
  scoring: QtiTranscodeScoringDisposition = "automatic",
): NativeInteractionPolicy {
  return { transformation: "native", fidelity: "normalized", scoring };
}

function choiceFallback(): ChoiceFallbackInteractionPolicy {
  return {
    transformation: "choice-fallback",
    fidelity: "lossy",
    scoring: "automatic",
  };
}

function textFallback(): TextEntryFallbackInteractionPolicy {
  return {
    transformation: "text-entry-fallback",
    fidelity: "lossy",
    scoring: "automatic",
  };
}

function matchingFallback(diagnostic: {
  readonly code: string;
  readonly message: string;
}): MatchingFallbackInteractionPolicy {
  return {
    transformation: "matching-fallback",
    fidelity: "lossy",
    scoring: "automatic",
    diagnostic,
  };
}

function canvasUpload(diagnostic: {
  readonly code: string;
  readonly message: string;
}): PresentationInteractionPolicy {
  return {
    transformation: "presentation",
    fidelity: "normalized",
    scoring: "manual",
    diagnostic,
  };
}

function moodleChoiceFallback(): ChoiceFallbackInteractionPolicy {
  return {
    transformation: "choice-fallback",
    fidelity: "lossy",
    scoring: "automatic",
  };
}

function moodleMatchingFallback(): NativeInteractionPolicy {
  return {
    transformation: "native",
    fidelity: "lossy",
    scoring: "automatic",
  };
}

function moodleTextFallback(): TextEntryFallbackInteractionPolicy {
  return {
    transformation: "text-entry-fallback",
    fidelity: "lossy",
    scoring: "automatic",
  };
}

function manual(): ExtendedTextFallbackInteractionPolicy {
  return {
    transformation: "extended-text-fallback",
    fidelity: "lossy",
    scoring: "manual",
  };
}

function nativeManual(): NativeInteractionPolicy {
  return {
    transformation: "native",
    fidelity: "lossy",
    scoring: "manual",
  };
}

function qti21TextEntryFallback(
  interaction: string,
  codeSegment: "blackboard" | "brightspace",
  destination: string,
): TextEntryFallbackInteractionPolicy {
  return {
    transformation: "text-entry-fallback",
    fidelity: "lossy",
    scoring: "automatic",
    diagnostic: {
      code: `profile.${codeSegment}.${interaction.replaceAll("-", "_")}.text_entry_fallback`,
      message: `Converted the ${interaction} interaction to an exact text entry for the ${destination}. Review the accepted answer after import.`,
    },
  };
}

function qti21ManualFallback(
  interaction: string,
  codeSegment: "blackboard" | "brightspace",
  destination: string,
): ExtendedTextFallbackInteractionPolicy {
  return {
    transformation: "extended-text-fallback",
    fidelity: "lossy",
    scoring: "manual",
    diagnostic: {
      code: `profile.${codeSegment}.${interaction.replaceAll("-", "_")}.manual_fallback`,
      message: `Converted the ${interaction} interaction to a written response for the ${destination}. Review the prompt and score the response manually.`,
    },
  };
}

const QTI2_INTERACTIONS: Readonly<Record<QtiInteractionType, Qti2InteractionPolicy>> = {
  associate: native(),
  choice: native(),
  custom: normalized("unscored"),
  drawing: native("unscored"),
  endAttempt: native(),
  extendedText: native(),
  gapMatch: native(),
  graphicAssociate: native(),
  graphicGapMatch: native(),
  graphicOrder: native(),
  hotspot: native(),
  hottext: native(),
  inlineChoice: native(),
  match: native(),
  media: native(),
  order: native(),
  portableCustom: normalized(),
  positionObject: native(),
  selectPoint: native(),
  slider: native(),
  textEntry: native(),
  upload: native(),
};

const QTI12_INTERACTIONS: Readonly<Record<QtiInteractionType, Qti12InteractionPolicy>> = {
  associate: nativeManual(),
  choice: native(),
  custom: manual(),
  drawing: manual(),
  endAttempt: manual(),
  extendedText: native("manual"),
  gapMatch: choiceFallback(),
  graphicAssociate: choiceFallback(),
  graphicGapMatch: choiceFallback(),
  graphicOrder: native(),
  hotspot: native(),
  hottext: choiceFallback(),
  inlineChoice: choiceFallback(),
  match: native(),
  media: manual(),
  order: native(),
  portableCustom: manual(),
  positionObject: textFallback(),
  selectPoint: textFallback(),
  slider: textFallback(),
  textEntry: native(),
  upload: manual(),
};

const CANVAS_CLASSIC_INTERACTIONS: Readonly<Record<QtiInteractionType, Qti12InteractionPolicy>> = {
  ...QTI12_INTERACTIONS,
  associate: manual(),
  graphicOrder: matchingFallback(CANVAS_CLASSIC_SEQUENCE_MATCHING),
  order: matchingFallback(CANVAS_CLASSIC_SEQUENCE_MATCHING),
  upload: canvasUpload(CANVAS_CLASSIC_UPLOAD),
};

const CANVAS_NEW_QUIZZES_INTERACTIONS: Readonly<
  Record<QtiInteractionType, Qti12InteractionPolicy>
> = {
  ...CANVAS_CLASSIC_INTERACTIONS,
  order: native(),
  graphicOrder: matchingFallback(CANVAS_NEW_QUIZZES_SEQUENCE_MATCHING),
  upload: canvasUpload(CANVAS_NEW_QUIZZES_UPLOAD),
};

const MOODLE_XML_INTERACTIONS: Readonly<Record<QtiInteractionType, MoodleInteractionPolicy>> = {
  associate: manual(),
  choice: native(),
  custom: manual(),
  drawing: manual(),
  endAttempt: manual(),
  extendedText: native("manual"),
  gapMatch: moodleChoiceFallback(),
  graphicAssociate: manual(),
  graphicGapMatch: moodleChoiceFallback(),
  graphicOrder: moodleMatchingFallback(),
  hotspot: moodleChoiceFallback(),
  hottext: moodleChoiceFallback(),
  inlineChoice: moodleChoiceFallback(),
  match: native(),
  media: manual(),
  order: moodleMatchingFallback(),
  portableCustom: manual(),
  positionObject: moodleTextFallback(),
  selectPoint: moodleTextFallback(),
  slider: moodleTextFallback(),
  textEntry: native(),
  upload: normalized("manual"),
};

function vendorQti21Interactions(
  codeSegment: "blackboard" | "brightspace",
  destination: string,
): Readonly<Record<QtiInteractionType, Qti2InteractionPolicy>> {
  const overrides: Partial<Record<QtiInteractionType, Qti2InteractionPolicy>> = {
    extendedText: native("manual"),
  };

  for (const type of QTI_INTERACTION_TYPES) {
    if (VENDOR_QTI21_NATIVE_INTERACTIONS.has(type) || type === "extendedText") {
      continue;
    }

    const wireName = qtiInteractionWireName(type);
    if (VENDOR_QTI21_TEXT_ENTRY_FALLBACK_INTERACTIONS.has(type)) {
      overrides[type] = qti21TextEntryFallback(wireName, codeSegment, destination);
      continue;
    }

    overrides[type] = qti21ManualFallback(wireName, codeSegment, destination);
  }

  return { ...QTI2_INTERACTIONS, ...overrides };
}

function defineVendorQti21Profile<const Id extends VendorQti21Profile["id"]>(
  id: Id,
  vendorEvidence: VendorQti21Profile["vendorEvidence"],
  responseProcessing: VendorQti21Profile["responseProcessing"],
  codeSegment: "blackboard" | "brightspace",
  destination: string,
): VendorQti21Profile & { readonly id: Id } {
  return {
    kind: "qti-standard",
    id,
    target: "qti21",
    package: { schemaVersion: "2.1", manifestResourceType: "imsqti_item_xmlv2p1" },
    responseProcessing,
    evidence: { xsd: "required", reverseMigration: "required" },
    vendorEvidence,
    interactions: vendorQti21Interactions(codeSegment, destination),
  };
}

function defineCanvasProfile<const Id extends CanvasProfile["id"]>(
  id: Id,
  vendorEvidence: CanvasProfile["vendorEvidence"],
  interactions: Readonly<Record<QtiInteractionType, Qti12InteractionPolicy>>,
): CanvasProfile & { readonly id: Id } {
  return {
    kind: "canvas",
    id,
    target: "qti12",
    evidence: { xsd: "required", reverseMigration: "required" },
    vendorEvidence,
    interactions,
  };
}

function defineMoodleXmlProfile(
  vendorEvidence: MoodleXmlProfile["vendorEvidence"],
  interactions: MoodleXmlProfile["interactions"],
): MoodleXmlProfile {
  return {
    kind: "moodle-xml",
    id: "moodle-xml@1",
    target: "moodle-xml",
    evidence: { xsd: "not-applicable", reverseMigration: "not-applicable" },
    vendorEvidence,
    interactions,
  };
}

export const qtiTranscodeProfiles: Readonly<QtiTranscodeProfileById> = {
  "blackboard-question-banks@1": defineVendorQti21Profile(
    "blackboard-question-banks@1",
    {
      product: "Blackboard Learn question banks",
      sourceRevision: "retrieved-2026-07-28",
      sources: [
        "https://help.anthology.com/blackboard/instructor/en/assessments/questions/reuse-questions/qti-packages.html",
      ],
      compatibility: { basis: "vendor-documentation", productImport: "unverified" },
    },
    { mode: "omit", diagnostic: BLACKBOARD_RESPONSE_PROCESSING_OMIT },
    "blackboard",
    "Blackboard question-bank importer",
  ),
  "brightspace-course-import@1": defineVendorQti21Profile(
    "brightspace-course-import@1",
    {
      product: "Brightspace course import",
      sourceRevision: "retrieved-2026-07-28",
      sources: [
        "https://community.d2l.com/brightspace/kb/articles/5040-delete-and-copy-questions-from-question-library-in-a-quiz",
        "https://community.d2l.com/brightspace/kb/articles/16788-import-export-or-copy-course-components",
      ],
      compatibility: { basis: "vendor-documentation", productImport: "unverified" },
    },
    { mode: "preserve" },
    "brightspace",
    "Brightspace course importer",
  ),
  "canvas-classic-quizzes@1": defineCanvasProfile(
    "canvas-classic-quizzes@1",
    {
      product: "Canvas Classic Quizzes",
      sourceRevision: "instructure/canvas-lms@1c9f0bb8013ed69c4f2efe11fd483025469b7e6c",
      sources: [
        "lib/cc/qti/qti_generator.rb",
        "lib/cc/qti/qti_items.rb",
        "lib/cc/qti/qti_manifest.rb",
        "gems/plugins/qti_exporter/spec_canvas/lib/qti/canvas_questions_spec.rb",
      ],
      compatibility: { basis: "source-derived", productImport: "unverified" },
    },
    CANVAS_CLASSIC_INTERACTIONS,
  ),
  "canvas-new-quizzes@1": defineCanvasProfile(
    "canvas-new-quizzes@1",
    {
      product: "Canvas New Quizzes",
      sourceRevision: "instructure/canvas-lms@1c9f0bb8013ed69c4f2efe11fd483025469b7e6c",
      sources: [
        "lib/cc/qti/new_quizzes_generator.rb",
        "spec/lib/cc/qti/new_quizzes_generator_spec.rb",
        "spec/lib/cc/qti/fixtures/nq_common_cartridge_export.zip",
      ],
      compatibility: { basis: "source-derived", productImport: "unverified" },
      additionalSources: [
        {
          sourceRevision: "instructure/qti@f58eed273fd79060260dc18599378a36562389a4",
          sources: [
            "lib/qti/v1/models/interactions.rb",
            "lib/qti/v1/models/interactions/ordering_interaction.rb",
            "lib/qti/v1/models/interactions/categorization_interaction.rb",
          ],
        },
      ],
    },
    CANVAS_NEW_QUIZZES_INTERACTIONS,
  ),
  "moodle-xml@1": defineMoodleXmlProfile(
    {
      product: "Moodle LMS",
      sourceRevision: "moodle/moodle@dd5063e52685f2b77e147619bbdbc75663b36097",
      sources: [
        "public/question/format/xml/format.php",
        "public/question/format/xml/tests/qformat_xml_import_export_test.php",
        "public/question/format/xml/tests/xmlformat_test.php",
        "public/question/format/xml/tests/fixtures",
      ],
      compatibility: { basis: "source-derived", productImport: "unverified" },
    },
    MOODLE_XML_INTERACTIONS,
  ),
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
    responseProcessing: { mode: "preserve" },
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

/** Report metadata derived from the executable transformation plan. */
export function interactionPolicyFallback(
  policy: QtiTranscodeInteractionPolicy,
): QtiTranscodeFallback | undefined {
  switch (policy.transformation) {
    case "choice-fallback":
      return "choice";
    case "text-entry-fallback":
      return "text-entry";
    case "extended-text-fallback":
      return "extended-text";
    case "matching-fallback":
      return "matching";
    case "native":
    case "presentation":
      return undefined;
    default: {
      const unexpected: never = policy;
      throw new Error(`Unsupported interaction transformation: ${JSON.stringify(unexpected)}`);
    }
  }
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

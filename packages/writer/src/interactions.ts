import { assertNever } from "@longsightgroup/qti3-core";
import type { QtiInteractionType } from "@longsightgroup/qti3-core";

import { renderQti3AssociateItem, validateQti3AssociateItem } from "./associate.js";
import { renderQti3ChoiceItem, validateQti3ChoiceItem } from "./choice.js";
import { renderQti3ExtendedTextItem, validateQti3ExtendedTextItem } from "./extended-text.js";
import { renderQti3GapMatchItem, validateQti3GapMatchItem } from "./gap-match.js";
import {
  renderQti3GraphicAssociateItem,
  validateQti3GraphicAssociateItem,
} from "./graphic-associate.js";
import {
  renderQti3GraphicGapMatchItem,
  validateQti3GraphicGapMatchItem,
} from "./graphic-gap-match.js";
import { renderQti3GraphicOrderItem, validateQti3GraphicOrderItem } from "./graphic-order.js";
import { renderQti3HotspotItem, validateQti3HotspotItem } from "./hotspot.js";
import { renderQti3HottextItem, validateQti3HottextItem } from "./hottext.js";
import { renderQti3InlineChoiceItem, validateQti3InlineChoiceItem } from "./inline-choice.js";
import { renderQti3MatchItem, validateQti3MatchItem } from "./match.js";
import { renderQti3MediaItem, validateQti3MediaItem } from "./media.js";
import { renderQti3OrderItem, validateQti3OrderItem } from "./order.js";
import { renderQti3TextEntryItem, validateQti3TextEntryItem } from "./text-entry.js";
import type { Qti3AuthoringItem, Qti3WriterDiagnostic } from "./types.js";
import { renderQti3UploadItem, validateQti3UploadItem } from "./upload.js";

type Qti3WriterInteractionType = Qti3AuthoringItem["interactionType"];

export interface Qti3WriterInteractionDefinition {
  readonly qtiName: string;
  readonly interactionType: Qti3WriterInteractionType;
  readonly tests: readonly string[];
  readonly notes?: string | undefined;
}

export const qti3WriterInteractions: Record<
  Qti3WriterInteractionType,
  Qti3WriterInteractionDefinition
> = {
  choice: {
    qtiName: "qti-choice-interaction",
    interactionType: "choice",
    tests: ["packages/writer/src/choice.test.ts", "packages/writer/src/validation.test.ts"],
  },
  order: {
    qtiName: "qti-order-interaction",
    interactionType: "order",
    tests: ["packages/writer/src/order.test.ts", "packages/writer/src/validation.test.ts"],
  },
  inlineChoice: {
    qtiName: "qti-inline-choice-interaction",
    interactionType: "inlineChoice",
    tests: ["packages/writer/src/inline-choice.test.ts", "packages/writer/src/validation.test.ts"],
    notes:
      "Replaces empty inline-choice placeholders in trusted bodyHtml with generated interactions.",
  },
  hottext: {
    qtiName: "qti-hottext-interaction",
    interactionType: "hottext",
    tests: ["packages/writer/src/hottext.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Replaces empty qti-hottext placeholders in trusted bodyHtml with generated choices.",
  },
  gapMatch: {
    qtiName: "qti-gap-match-interaction",
    interactionType: "gapMatch",
    tests: ["packages/writer/src/gap-match.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes and validates gap choices, qti-gap body targets, and directed-pair responses.",
  },
  extendedText: {
    qtiName: "qti-extended-text-interaction",
    interactionType: "extendedText",
    tests: ["packages/writer/src/extended-text.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes constructed-response extended text interactions and rubric blocks.",
  },
  upload: {
    qtiName: "qti-upload-interaction",
    interactionType: "upload",
    tests: ["packages/writer/src/upload.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes single-file response declarations and host upload metadata attributes.",
  },
  media: {
    qtiName: "qti-media-interaction",
    interactionType: "media",
    tests: ["packages/writer/src/media.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes audio, video, and object media interactions with playback metadata.",
  },
  associate: {
    qtiName: "qti-associate-interaction",
    interactionType: "associate",
    tests: ["packages/writer/src/associate.test.ts", "packages/writer/src/validation.test.ts"],
  },
  textEntry: {
    qtiName: "qti-text-entry-interaction",
    interactionType: "textEntry",
    tests: ["packages/writer/src/text-entry.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "The writer validates trusted body fragments contain matching text-entry interactions.",
  },
  match: {
    qtiName: "qti-match-interaction",
    interactionType: "match",
    tests: ["packages/writer/src/match.test.ts", "packages/writer/src/validation.test.ts"],
  },
  hotspot: {
    qtiName: "qti-hotspot-interaction",
    interactionType: "hotspot",
    tests: ["packages/writer/src/hotspot.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Requires accessible object metadata and referentially valid hotspot choices.",
  },
  graphicOrder: {
    qtiName: "qti-graphic-order-interaction",
    interactionType: "graphicOrder",
    tests: ["packages/writer/src/graphic-order.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes and validates object metadata, hotspot choices, and ordered responses.",
  },
  graphicAssociate: {
    qtiName: "qti-graphic-associate-interaction",
    interactionType: "graphicAssociate",
    tests: [
      "packages/writer/src/graphic-associate.test.ts",
      "packages/writer/src/validation.test.ts",
    ],
    notes: "Writes and validates object metadata, associable hotspots, and pair responses.",
  },
  graphicGapMatch: {
    qtiName: "qti-graphic-gap-match-interaction",
    interactionType: "graphicGapMatch",
    tests: [
      "packages/writer/src/graphic-gap-match.test.ts",
      "packages/writer/src/validation.test.ts",
    ],
    notes: "Supports hotspot targets and inline qti-gap targets in trusted bodyHtml.",
  },
};

export function validateQti3AuthoringItem(item: Qti3AuthoringItem): Qti3WriterDiagnostic[] {
  switch (item.interactionType) {
    case "choice":
      return validateQti3ChoiceItem(item);
    case "order":
      return validateQti3OrderItem(item);
    case "inlineChoice":
      return validateQti3InlineChoiceItem(item);
    case "hottext":
      return validateQti3HottextItem(item);
    case "gapMatch":
      return validateQti3GapMatchItem(item);
    case "extendedText":
      return validateQti3ExtendedTextItem(item);
    case "upload":
      return validateQti3UploadItem(item);
    case "media":
      return validateQti3MediaItem(item);
    case "associate":
      return validateQti3AssociateItem(item);
    case "textEntry":
      return validateQti3TextEntryItem(item);
    case "match":
      return validateQti3MatchItem(item);
    case "hotspot":
      return validateQti3HotspotItem(item);
    case "graphicOrder":
      return validateQti3GraphicOrderItem(item);
    case "graphicAssociate":
      return validateQti3GraphicAssociateItem(item);
    case "graphicGapMatch":
      return validateQti3GraphicGapMatchItem(item);
    default:
      return assertNever(item);
  }
}

export function renderQti3AuthoringItem(item: Qti3AuthoringItem): string {
  switch (item.interactionType) {
    case "choice":
      return renderQti3ChoiceItem(item);
    case "order":
      return renderQti3OrderItem(item);
    case "inlineChoice":
      return renderQti3InlineChoiceItem(item);
    case "hottext":
      return renderQti3HottextItem(item);
    case "gapMatch":
      return renderQti3GapMatchItem(item);
    case "extendedText":
      return renderQti3ExtendedTextItem(item);
    case "upload":
      return renderQti3UploadItem(item);
    case "media":
      return renderQti3MediaItem(item);
    case "associate":
      return renderQti3AssociateItem(item);
    case "textEntry":
      return renderQti3TextEntryItem(item);
    case "match":
      return renderQti3MatchItem(item);
    case "hotspot":
      return renderQti3HotspotItem(item);
    case "graphicOrder":
      return renderQti3GraphicOrderItem(item);
    case "graphicAssociate":
      return renderQti3GraphicAssociateItem(item);
    case "graphicGapMatch":
      return renderQti3GraphicGapMatchItem(item);
    default:
      return assertNever(item);
  }
}

export type Qti3WriterInteractionSupport = {
  readonly qtiName: string;
  readonly interactionType: QtiInteractionType;
  readonly writes: true;
  readonly validates: true;
  readonly tests: readonly string[];
  readonly notes?: string | undefined;
};

export const qti3WriterInteractionSupport: readonly Qti3WriterInteractionSupport[] = Object.values(
  qti3WriterInteractions,
).map((interaction) => ({
  qtiName: interaction.qtiName,
  interactionType: interaction.interactionType,
  writes: true as const,
  validates: true as const,
  tests: interaction.tests,
  notes: interaction.notes,
}));

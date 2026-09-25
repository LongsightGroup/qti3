import { validatePreparedItem, writePreparedItem } from "./item-preparation.js";
import type { RenderedItemSections } from "./item-preparation.js";
import { assertNever } from "@longsightgroup/qti3-core";
import type { QtiInteractionType } from "@longsightgroup/qti3-core";

import { renderQti3AssociateItem, validateQti3AssociateItemStructure } from "./associate.js";
import {
  renderQti3ChoiceItem,
  validateQti3ChoiceItemStructure,
  validateQti3ChoiceItem,
  writeQti3ChoiceItemResult,
} from "./choice.js";
import {
  renderQti3CustomInteractionItem,
  validateQti3CustomInteractionItemStructure,
} from "./custom-interaction.js";
import { renderQti3DrawingItem, validateQti3DrawingItemStructure } from "./drawing.js";
import { renderQti3EndAttemptItem, validateQti3EndAttemptItemStructure } from "./end-attempt.js";
import {
  renderQti3ExtendedTextItem,
  validateQti3ExtendedTextItemStructure,
} from "./extended-text.js";
import { renderQti3GapMatchItem, validateQti3GapMatchItemStructure } from "./gap-match.js";
import {
  renderQti3GraphicAssociateItem,
  validateQti3GraphicAssociateItemStructure,
} from "./graphic-associate.js";
import {
  renderQti3GraphicGapMatchItem,
  validateQti3GraphicGapMatchItemStructure,
} from "./graphic-gap-match.js";
import {
  renderQti3GraphicOrderItem,
  validateQti3GraphicOrderItemStructure,
} from "./graphic-order.js";
import { renderQti3HotspotItem, validateQti3HotspotItemStructure } from "./hotspot.js";
import { renderQti3HottextItem, validateQti3HottextItemStructure } from "./hottext.js";
import {
  renderQti3InlineChoiceItem,
  validateQti3InlineChoiceItemStructure,
} from "./inline-choice.js";
import { renderQti3MatchItem, validateQti3MatchItemStructure } from "./match.js";
import { renderQti3MediaItem, validateQti3MediaItemStructure } from "./media.js";
import { renderQti3OrderItem, validateQti3OrderItemStructure } from "./order.js";
import {
  renderQti3PositionObjectItem,
  validateQti3PositionObjectItemStructure,
} from "./position-object.js";
import {
  renderQti3PortableCustomItem,
  validateQti3PortableCustomItemStructure,
} from "./portable-custom.js";
import { renderQti3SelectPointItem, validateQti3SelectPointItemStructure } from "./select-point.js";
import { renderQti3SliderItem, validateQti3SliderItemStructure } from "./slider.js";
import { renderQti3TextEntryItem, validateQti3TextEntryItemStructure } from "./text-entry.js";
import type { Qti3AuthoringItem, Qti3WriterDiagnostic } from "./types.js";
import { renderQti3UploadItem, validateQti3UploadItemStructure } from "./upload.js";

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
    notes: "Writes single-file response declarations and application upload metadata attributes.",
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
  selectPoint: {
    qtiName: "qti-select-point-interaction",
    interactionType: "selectPoint",
    tests: ["packages/writer/src/select-point.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes and validates point responses, area mappings, and object metadata.",
  },
  positionObject: {
    qtiName: "qti-position-object-interaction",
    interactionType: "positionObject",
    tests: [
      "packages/writer/src/position-object.test.ts",
      "packages/writer/src/validation.test.ts",
    ],
    notes:
      "Writes and validates stage objects, movable objects, point responses, and area mappings.",
  },
  slider: {
    qtiName: "qti-slider-interaction",
    interactionType: "slider",
    tests: ["packages/writer/src/slider.test.ts", "packages/writer/src/validation.test.ts"],
    notes:
      "Writes and validates numeric slider bounds, responses, mappings, and presentation attributes.",
  },
  custom: {
    qtiName: "qti-custom-interaction",
    interactionType: "custom",
    tests: [
      "packages/writer/src/custom-interaction.test.ts",
      "packages/writer/src/validation.test.ts",
    ],
    notes:
      "Writes legacy custom interactions from trusted widget markup and response processing fragments.",
  },
  portableCustom: {
    qtiName: "qti-portable-custom-interaction",
    interactionType: "portableCustom",
    tests: [
      "packages/writer/src/portable-custom.test.ts",
      "packages/writer/src/validation.test.ts",
    ],
    notes: "Writes portable custom interactions with launch metadata, modules, and trusted markup.",
  },
  drawing: {
    qtiName: "qti-drawing-interaction",
    interactionType: "drawing",
    tests: ["packages/writer/src/drawing.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes drawing interactions with accessible canvas object metadata.",
  },
  endAttempt: {
    qtiName: "qti-end-attempt-interaction",
    interactionType: "endAttempt",
    tests: ["packages/writer/src/end-attempt.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Writes end-attempt controls with single boolean response declarations.",
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

function validateAuthoringStructure(item: Qti3AuthoringItem): Qti3WriterDiagnostic[] {
  switch (item.interactionType) {
    case "choice":
      return validateQti3ChoiceItemStructure(item);
    case "order":
      return validateQti3OrderItemStructure(item);
    case "inlineChoice":
      return validateQti3InlineChoiceItemStructure(item);
    case "hottext":
      return validateQti3HottextItemStructure(item);
    case "gapMatch":
      return validateQti3GapMatchItemStructure(item);
    case "extendedText":
      return validateQti3ExtendedTextItemStructure(item);
    case "upload":
      return validateQti3UploadItemStructure(item);
    case "media":
      return validateQti3MediaItemStructure(item);
    case "associate":
      return validateQti3AssociateItemStructure(item);
    case "textEntry":
      return validateQti3TextEntryItemStructure(item);
    case "match":
      return validateQti3MatchItemStructure(item);
    case "hotspot":
      return validateQti3HotspotItemStructure(item);
    case "graphicOrder":
      return validateQti3GraphicOrderItemStructure(item);
    case "selectPoint":
      return validateQti3SelectPointItemStructure(item);
    case "positionObject":
      return validateQti3PositionObjectItemStructure(item);
    case "slider":
      return validateQti3SliderItemStructure(item);
    case "custom":
      return validateQti3CustomInteractionItemStructure(item);
    case "portableCustom":
      return validateQti3PortableCustomItemStructure(item);
    case "drawing":
      return validateQti3DrawingItemStructure(item);
    case "endAttempt":
      return validateQti3EndAttemptItemStructure(item);
    case "graphicAssociate":
      return validateQti3GraphicAssociateItemStructure(item);
    case "graphicGapMatch":
      return validateQti3GraphicGapMatchItemStructure(item);
    default:
      return assertNever(item);
  }
}

function renderQti3AuthoringItem(item: Qti3AuthoringItem): RenderedItemSections {
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
    case "selectPoint":
      return renderQti3SelectPointItem(item);
    case "positionObject":
      return renderQti3PositionObjectItem(item);
    case "slider":
      return renderQti3SliderItem(item);
    case "custom":
      return renderQti3CustomInteractionItem(item);
    case "portableCustom":
      return renderQti3PortableCustomItem(item);
    case "drawing":
      return renderQti3DrawingItem(item);
    case "endAttempt":
      return renderQti3EndAttemptItem(item);
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

export function validateQti3AuthoringItem(item: Qti3AuthoringItem): Qti3WriterDiagnostic[] {
  if (item.interactionType === "choice") return validateQti3ChoiceItem(item);
  return validatePreparedItem(item, validateAuthoringStructure);
}

export function writeQti3AuthoringItemResult(item: Qti3AuthoringItem) {
  if (item.interactionType === "choice") return writeQti3ChoiceItemResult(item);
  return writePreparedItem(item, validateAuthoringStructure, renderQti3AuthoringItem);
}

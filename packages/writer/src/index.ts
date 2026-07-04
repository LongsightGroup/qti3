export { buildQti3AssociateItem, validateQti3AssociateItem } from "./associate.js";
export { buildQti3ChoiceItem, validateQti3ChoiceItem } from "./choice.js";
export {
  buildQti3GraphicAssociateItem,
  validateQti3GraphicAssociateItem,
} from "./graphic-associate.js";
export {
  buildQti3GraphicGapMatchItem,
  validateQti3GraphicGapMatchItem,
} from "./graphic-gap-match.js";
export { buildQti3HotspotItem, validateQti3HotspotItem } from "./hotspot.js";
export { buildQti3HottextItem, validateQti3HottextItem } from "./hottext.js";
export { buildQti3InlineChoiceItem, validateQti3InlineChoiceItem } from "./inline-choice.js";
export { buildQti3MatchItem, validateQti3MatchItem } from "./match.js";
export { buildQti3OrderItem, validateQti3OrderItem } from "./order.js";
export { buildQti3TextEntryItem, validateQti3TextEntryItem } from "./text-entry.js";
export {
  qti3WriterInteractionSupport,
  qti3WriterInteractions,
  validateQti3AuthoringItem,
} from "./interactions.js";
export { qti3WriterPlannedInteractionMigrationOrder } from "./planned-interactions.js";
export type { Qti3WriterInteractionSupport } from "./interactions.js";
export type { Qti3WriterPlannedInteractionMigration } from "./planned-interactions.js";
export type {
  Qti3AuthoringChoice,
  Qti3AuthoringItem,
  Qti3AuthoringItemBase,
  Qti3AssociateAuthoringItem,
  Qti3AssociateBuilderInput,
  Qti3AssociateChoice,
  Qti3AssociatePair,
  Qti3ChoiceAuthoringItem,
  Qti3ChoiceBuilderInput,
  Qti3GraphicObject,
  Qti3GraphicAssociateAuthoringItem,
  Qti3GraphicAssociateBuilderInput,
  Qti3GraphicAssociateHotspot,
  Qti3GraphicAssociateObject,
  Qti3GraphicAssociatePair,
  Qti3GraphicAssociateShape,
  Qti3GraphicGapChoice,
  Qti3GraphicGapHotspotTarget,
  Qti3GraphicGapImageChoice,
  Qti3GraphicGapInlineTarget,
  Qti3GraphicGapMatchAuthoringItem,
  Qti3GraphicGapMatchBuilderInput,
  Qti3GraphicGapPair,
  Qti3GraphicGapTarget,
  Qti3GraphicGapTextChoice,
  Qti3HotspotAuthoringItem,
  Qti3HotspotBuilderInput,
  Qti3HotspotChoice,
  Qti3HotspotObject,
  Qti3HotspotShape,
  Qti3HottextAuthoringItem,
  Qti3HottextBuilderInput,
  Qti3HottextChoice,
  Qti3InlineChoiceAuthoringItem,
  Qti3InlineChoiceBuilderInput,
  Qti3InlineChoiceOption,
  Qti3InlineChoiceScoring,
  Qti3InlineChoiceSlot,
  Qti3MatchAuthoringItem,
  Qti3MatchBuilderInput,
  Qti3MatchChoice,
  Qti3MatchPair,
  Qti3OrderAuthoringItem,
  Qti3OrderBuilderInput,
  Qti3ResponseProcessingTemplate,
  Qti3TextEntryAnswer,
  Qti3TextEntryAuthoringItem,
  Qti3TextEntryBaseType,
  Qti3TextEntryBuilderInput,
  Qti3TextEntryResponse,
  Qti3TrustedXmlFragment,
  Qti3WriterDiagnostic,
  Qti3WriterResult,
} from "./types.js";
export { qti3TrustedXmlFragment, Qti3WriterError } from "./types.js";

import { throwIfDiagnostics, writerResult } from "./diagnostics.js";
import { renderQti3AuthoringItem, validateQti3AuthoringItem } from "./interactions.js";
import type { Qti3AuthoringItem, Qti3WriterResult } from "./types.js";

export function writeQti3AssessmentItem(item: Qti3AuthoringItem): string {
  throwIfDiagnostics(validateQti3AuthoringItem(item));
  return renderQti3AuthoringItem(item);
}

export function writeQti3AssessmentItemResult(item: Qti3AuthoringItem): Qti3WriterResult {
  const diagnostics = validateQti3AuthoringItem(item);
  if (diagnostics.length) return writerResult("", diagnostics);
  return writerResult(renderQti3AuthoringItem(item), []);
}

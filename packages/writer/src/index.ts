export { buildQti3AssociateItem, validateQti3AssociateItem } from "./associate.js";
export { buildQti3ChoiceItem, validateQti3ChoiceItem } from "./choice.js";
export {
  buildQti3CustomInteractionItem,
  validateQti3CustomInteractionItem,
} from "./custom-interaction.js";
export { buildQti3DrawingItem, validateQti3DrawingItem } from "./drawing.js";
export { buildQti3EndAttemptItem, validateQti3EndAttemptItem } from "./end-attempt.js";
export { buildQti3ExtendedTextItem, validateQti3ExtendedTextItem } from "./extended-text.js";
export { buildQti3GapMatchItem, validateQti3GapMatchItem } from "./gap-match.js";
export {
  buildQti3GraphicAssociateItem,
  validateQti3GraphicAssociateItem,
} from "./graphic-associate.js";
export {
  buildQti3GraphicGapMatchItem,
  validateQti3GraphicGapMatchItem,
} from "./graphic-gap-match.js";
export { buildQti3GraphicOrderItem, validateQti3GraphicOrderItem } from "./graphic-order.js";
export { buildQti3HotspotItem, validateQti3HotspotItem } from "./hotspot.js";
export { buildQti3HottextItem, validateQti3HottextItem } from "./hottext.js";
export { buildQti3InlineChoiceItem, validateQti3InlineChoiceItem } from "./inline-choice.js";
export { buildQti3MatchItem, validateQti3MatchItem } from "./match.js";
export { buildQti3MediaItem, validateQti3MediaItem } from "./media.js";
export { buildQti3OrderItem, validateQti3OrderItem } from "./order.js";
export { buildQti3PositionObjectItem, validateQti3PositionObjectItem } from "./position-object.js";
export {
  validateQti3Package,
  writeQti3PackageFiles,
  writeQti3PackageFilesResult,
  writeQti3PackageManifest,
  writeQti3PackageManifestResult,
  writeQti3PackageZip,
  writeQti3PackageZipResult,
} from "./package.js";
export type {
  Qti3PackageAsset,
  Qti3PackageAuthoringInput,
  Qti3PackageAuthoringItem,
  Qti3PackageFile,
  Qti3PackageFilesResult,
  Qti3PackageItem,
  Qti3PackageManifestResult,
  Qti3PackageXmlItem,
  Qti3PackageZipResult,
} from "./package.js";
export { buildQti3PortableCustomItem, validateQti3PortableCustomItem } from "./portable-custom.js";
export { buildQti3SelectPointItem, validateQti3SelectPointItem } from "./select-point.js";
export { buildQti3SliderItem, validateQti3SliderItem } from "./slider.js";
export { buildQti3TextEntryItem, validateQti3TextEntryItem } from "./text-entry.js";
export { buildQti3UploadItem, validateQti3UploadItem } from "./upload.js";
export {
  qti3WriterInteractionSupport,
  qti3WriterInteractions,
  validateQti3AuthoringItem,
} from "./interactions.js";
export type { Qti3WriterInteractionSupport } from "./interactions.js";
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
  Qti3CustomInteractionAttribute,
  Qti3CustomInteractionAuthoringItem,
  Qti3CustomInteractionBaseType,
  Qti3CustomInteractionBuilderInput,
  Qti3CustomInteractionCardinality,
  Qti3DrawingAuthoringItem,
  Qti3DrawingBuilderInput,
  Qti3DrawingObject,
  Qti3EndAttemptAuthoringItem,
  Qti3EndAttemptBuilderInput,
  Qti3ExtendedTextAuthoringItem,
  Qti3ExtendedTextBuilderInput,
  Qti3ExtendedTextFormat,
  Qti3ExtendedTextResponseBaseType,
  Qti3ExtendedTextResponseCardinality,
  Qti3GraphicObject,
  Qti3GraphicOrderAuthoringItem,
  Qti3GraphicOrderBuilderInput,
  Qti3GraphicOrderHotspot,
  Qti3GraphicOrderObject,
  Qti3GraphicOrderShape,
  Qti3GraphicAssociateAuthoringItem,
  Qti3GraphicAssociateBuilderInput,
  Qti3GraphicAssociateHotspot,
  Qti3GraphicAssociateObject,
  Qti3GraphicAssociatePair,
  Qti3GraphicAssociateShape,
  Qti3GapImageChoice,
  Qti3GapMatchAuthoringItem,
  Qti3GapMatchBuilderInput,
  Qti3GapMatchChoice,
  Qti3GapMatchPair,
  Qti3GapMatchScoring,
  Qti3GapTarget,
  Qti3GapTextChoice,
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
  Qti3MediaAuthoringItem,
  Qti3MediaBuilderInput,
  Qti3MediaKind,
  Qti3MediaSource,
  Qti3OrderAuthoringItem,
  Qti3OrderBuilderInput,
  Qti3PortableCustomAuthoringItem,
  Qti3PortableCustomBuilderInput,
  Qti3PortableCustomDataAttribute,
  Qti3PortableCustomInteractionModule,
  Qti3PortableCustomInteractionModules,
  Qti3ResponseProcessingTemplate,
  Qti3PointResponseProcessingTemplate,
  Qti3PositionObjectAuthoringItem,
  Qti3PositionObjectBuilderInput,
  Qti3PositionObjectMovableObject,
  Qti3PositionObjectShape,
  Qti3PositionObjectStageObject,
  Qti3PositionObjectTarget,
  Qti3SelectPointAuthoringItem,
  Qti3SelectPointBuilderInput,
  Qti3SelectPointObject,
  Qti3SelectPointShape,
  Qti3SelectPointTarget,
  Qti3SliderAuthoringItem,
  Qti3SliderBaseType,
  Qti3SliderBuilderInput,
  Qti3SliderMappingEntry,
  Qti3SliderOrientation,
  Qti3SliderScoring,
  Qti3TextEntryAnswer,
  Qti3TextEntryAuthoringItem,
  Qti3TextEntryBaseType,
  Qti3TextEntryBuilderInput,
  Qti3TextEntryResponse,
  Qti3TrustedXmlFragment,
  Qti3UploadAuthoringItem,
  Qti3UploadBuilderInput,
  Qti3UploadScoring,
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

import {
  mapAssociate,
  mapChoice,
  mapExtendedText,
  mapGapMatch,
  mapHottext,
  mapInlineChoiceItem,
  mapMatch,
  mapOrder,
  mapTextEntryItem,
} from "./qti2-interactions-basic.js";
import {
  mapCustom,
  mapDrawing,
  mapEndAttempt,
  mapMedia,
  mapPositionObject,
  mapSelectPoint,
  mapSlider,
  mapUpload,
} from "./qti2-interactions-extended.js";
import {
  mapGraphicAssociate,
  mapGraphicGapMatch,
  mapGraphicOrder,
  mapHotspot,
} from "./qti2-interactions-graphic.js";
import type { Qti2InteractionMapper, Qti2ItemMapper } from "./qti2-context.js";

export const qti2ItemMappers: Record<string, Qti2ItemMapper | undefined> = {
  textentryinteraction: mapTextEntryItem,
  inlinechoiceinteraction: mapInlineChoiceItem,
};

export const qti2InteractionMappers: Record<string, Qti2InteractionMapper | undefined> = {
  choiceinteraction: mapChoice,
  orderinteraction: mapOrder,
  matchinteraction: mapMatch,
  associateinteraction: mapAssociate,
  extendedtextinteraction: mapExtendedText,
  hottextinteraction: mapHottext,
  gapmatchinteraction: mapGapMatch,
  hotspotinteraction: mapHotspot,
  graphicorderinteraction: mapGraphicOrder,
  graphicassociateinteraction: mapGraphicAssociate,
  graphicgapmatchinteraction: mapGraphicGapMatch,
  drawinginteraction: mapDrawing,
  endattemptinteraction: mapEndAttempt,
  mediainteraction: mapMedia,
  positionobjectinteraction: mapPositionObject,
  selectpointinteraction: mapSelectPoint,
  sliderinteraction: mapSlider,
  uploadinteraction: mapUpload,
  custominteraction: mapCustom,
};

export const qti2MultiSlotInteractionNames = new Set(Object.keys(qti2ItemMappers));

export const supportedQti2InteractionNames = new Set([
  ...Object.keys(qti2ItemMappers),
  ...Object.keys(qti2InteractionMappers),
]);

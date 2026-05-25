export interface QtiPlayerRemoveMessageParams {
  label: string;
}

export interface QtiPlayerAssociationPairLabelParams {
  source: string;
  target: string;
}

export type QtiPlayerMovementDirection = "up" | "down" | "left" | "right";

export interface QtiPlayerExtendedTextCounterParams {
  characters: number;
  words: number;
}

export interface QtiPlayerHotspotSelectionSummaryParams {
  selection: string;
  count: number;
}

export interface QtiPlayerInteractionTypeParams {
  type: string;
}

export interface QtiPlayerInteractionTypeLabelParams {
  type: string;
}

export interface QtiPlayerGapStateParams {
  label: string;
  assigned: string;
}

export interface QtiPlayerOrderedItemPositionParams {
  label: string;
  position: number;
  total: number;
}

export interface QtiPlayerOrderedItemMoveStepParams {
  label: string;
  direction: "up" | "down";
}

export interface QtiPlayerCoordinatesParams {
  coordinates: string;
}

export interface QtiPlayerInteractionCoordinateAreaParams {
  type: string;
  coordinates: string;
}

export interface QtiPlayerInteractionPlacementStageAtParams {
  type: string;
  coordinates: string;
}

export interface QtiPlayerSelectedPointsSummaryParams {
  count: number;
  coordinates: string;
}

export interface QtiPlayerCountParams {
  count: number;
}

export interface QtiPlayerGapIndexParams {
  index: number;
}

export interface QtiPlayerMessages {
  remove: () => string;
  removePair: (params: QtiPlayerRemoveMessageParams) => string;
  clearDrawing: () => string;
  clearPoints: () => string;
  endAttempt: () => string;
  uploadResponse: () => string;
  movableObject: () => string;
  placeObject: () => string;
  inlineChoicePrompt: () => string;
  extendedTextCounter: (params: QtiPlayerExtendedTextCounterParams) => string;
  hotspotSelectionSummary: (params: QtiPlayerHotspotSelectionSummaryParams) => string;
  noPointSelected: () => string;
  noRegionSelected: () => string;
  noAssociationsMade: () => string;
  associationsMade: (params: QtiPlayerCountParams) => string;
  associationPairLabel: (params: QtiPlayerAssociationPairLabelParams) => string;
  hotspotSelectedChooseAnother: (params: { label: string }) => string;
  moveChoice: (params: { label: string; direction: QtiPlayerMovementDirection }) => string;
  movePoint: (params: { direction: QtiPlayerMovementDirection }) => string;
  moveObject: (params: { direction: QtiPlayerMovementDirection }) => string;
  interactionType: (params: QtiPlayerInteractionTypeParams) => string;
  matchSourcesBank: () => string;
  matchTargetsBank: () => string;
  matchSelectedPairsList: () => string;
  interactionSourcesBank: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionTargetsBank: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionSelectedPairsList: (params: QtiPlayerInteractionTypeLabelParams) => string;
  associateFirstConceptRegion: () => string;
  associatePairWithRegion: () => string;
  matchPromptRegion: () => string;
  matchMatchRegion: () => string;
  genericSourceRegion: () => string;
  genericTargetRegion: () => string;
  interactionHotspots: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionImageAlt: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionCurrentOrderList: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionSelectedOrderList: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionChoicesBank: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionGapTargets: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionTargetImage: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionOptionsList: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionCoordinateResponse: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionCoordinateArea: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionCoordinateAreaSelected: (params: QtiPlayerInteractionCoordinateAreaParams) => string;
  interactionPlacementResponse: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionPlacementStage: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionPlacementStageEmpty: (params: QtiPlayerInteractionTypeLabelParams) => string;
  interactionPlacementStageAt: (params: QtiPlayerInteractionPlacementStageAtParams) => string;
  interactionDrawingResponse: (params: QtiPlayerInteractionTypeLabelParams) => string;
  drawingSurface: () => string;
  drawingSurfaceEmpty: () => string;
  drawingSurfaceStrokeCount: (params: QtiPlayerCountParams) => string;
  drawingStatusEmpty: () => string;
  drawingStatusStrokeCount: (params: QtiPlayerCountParams) => string;
  gapLabel: (params: QtiPlayerGapIndexParams) => string;
  graphicGapTargetLabel: (params: QtiPlayerGapIndexParams) => string;
  gapEmptyState: (params: { label: string }) => string;
  gapAssignedState: (params: QtiPlayerGapStateParams) => string;
  gapLabelsPlacedCount: (params: QtiPlayerCountParams) => string;
  gapNoLabelsPlaced: () => string;
  orderedItemAtPosition: (params: QtiPlayerOrderedItemPositionParams) => string;
  orderedItemMovedOneStep: (params: QtiPlayerOrderedItemMoveStepParams) => string;
  orderedItemMovedToPosition: (params: QtiPlayerOrderedItemPositionParams) => string;
  graphicOrderRegionsSelected: (params: QtiPlayerCountParams) => string;
  graphicOrderNoRegionsSelected: () => string;
  objectNotPlaced: () => string;
  objectPositionedAt: (params: QtiPlayerCoordinatesParams) => string;
  selectedPointAt: (params: QtiPlayerCoordinatesParams) => string;
  selectedPointsSummary: (params: QtiPlayerSelectedPointsSummaryParams) => string;
  extendedTextResponseLabel: () => string;
  textResponseLabel: () => string;
  sliderResponseLabel: () => string;
}

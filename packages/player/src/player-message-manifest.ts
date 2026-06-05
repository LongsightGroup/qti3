/**
 * Single source of truth for player chrome message ids and resolver behavior.
 * Default copy lives in `defaultPlayerMessageCatalog.strings`; hosts override via JSON catalogs.
 */
export type PlayerMessageResolverKind =
  | "plain"
  | "template"
  | "plural"
  | "typeLabel"
  | "typeTemplate"
  | "directionTemplate"
  | "extendedTextCounter";

export interface PlayerMessageManifestEntry {
  readonly key: string;
  readonly resolver: PlayerMessageResolverKind;
  readonly params?: readonly string[];
}

export const PLAYER_MESSAGE_MANIFEST = [
  { key: "remove", resolver: "plain" },
  { key: "removePair", resolver: "template", params: ["label"] },
  { key: "removeOrderedChoice", resolver: "template", params: ["label"] },
  { key: "clearDrawing", resolver: "plain" },
  { key: "clearPoints", resolver: "plain" },
  { key: "endAttempt", resolver: "plain" },
  { key: "uploadResponse", resolver: "plain" },
  { key: "movableObject", resolver: "plain" },
  { key: "placeObject", resolver: "plain" },
  { key: "inlineChoicePrompt", resolver: "plain" },
  { key: "extendedTextCounter", resolver: "extendedTextCounter", params: ["characters", "words"] },
  { key: "hotspotSelectionSummary", resolver: "plural", params: ["selection", "count"] },
  { key: "noPointSelected", resolver: "plain" },
  { key: "noRegionSelected", resolver: "plain" },
  { key: "noAssociationsMade", resolver: "plain" },
  { key: "associationsMade", resolver: "plural", params: ["count"] },
  { key: "associationPairLabel", resolver: "template", params: ["source", "target"] },
  { key: "hotspotSelectedChooseAnother", resolver: "template", params: ["label"] },
  { key: "moveChoice", resolver: "directionTemplate", params: ["label", "direction"] },
  { key: "movePoint", resolver: "directionTemplate", params: ["direction"] },
  { key: "moveObject", resolver: "directionTemplate", params: ["direction"] },
  { key: "interactionType", resolver: "typeLabel", params: ["type"] },
  { key: "matchSourcesBank", resolver: "plain" },
  { key: "matchTargetsBank", resolver: "plain" },
  { key: "matchSelectedPairsList", resolver: "plain" },
  { key: "interactionSourcesBank", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionTargetsBank", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionSelectedPairsList", resolver: "typeTemplate", params: ["type"] },
  { key: "associateFirstConceptRegion", resolver: "plain" },
  { key: "associatePairWithRegion", resolver: "plain" },
  { key: "matchPromptRegion", resolver: "plain" },
  { key: "matchMatchRegion", resolver: "plain" },
  { key: "genericSourceRegion", resolver: "plain" },
  { key: "genericTargetRegion", resolver: "plain" },
  { key: "interactionHotspots", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionImageAlt", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionCurrentOrderList", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionSelectedOrderList", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionChoicesBank", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionGapTargets", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionTargetImage", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionOptionsList", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionCoordinateResponse", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionCoordinateArea", resolver: "typeTemplate", params: ["type"] },
  {
    key: "interactionCoordinateAreaSelected",
    resolver: "typeTemplate",
    params: ["type", "coordinates"],
  },
  { key: "interactionPlacementResponse", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionPlacementStage", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionPlacementStageEmpty", resolver: "typeTemplate", params: ["type"] },
  { key: "interactionPlacementStageAt", resolver: "typeTemplate", params: ["type", "coordinates"] },
  { key: "interactionDrawingResponse", resolver: "typeTemplate", params: ["type"] },
  { key: "drawingSurface", resolver: "plain" },
  { key: "drawingSurfaceEmpty", resolver: "plain" },
  { key: "drawingSurfaceStrokeCount", resolver: "plural", params: ["count"] },
  { key: "drawingStatusEmpty", resolver: "plain" },
  { key: "drawingStatusStrokeCount", resolver: "plural", params: ["count"] },
  { key: "gapLabel", resolver: "template", params: ["index"] },
  { key: "graphicGapTargetLabel", resolver: "template", params: ["index"] },
  { key: "gapEmptyState", resolver: "template", params: ["label"] },
  { key: "gapAssignedState", resolver: "template", params: ["label", "assigned"] },
  { key: "gapLabelsPlacedCount", resolver: "plural", params: ["count"] },
  { key: "gapNoLabelsPlaced", resolver: "plain" },
  { key: "orderedItemAtPosition", resolver: "template", params: ["label", "position", "total"] },
  { key: "orderedItemMovedOneStep", resolver: "directionTemplate", params: ["label", "direction"] },
  {
    key: "orderedItemMovedToPosition",
    resolver: "template",
    params: ["label", "position", "total"],
  },
  {
    key: "orderedItemAddedToPosition",
    resolver: "template",
    params: ["label", "position", "total"],
  },
  { key: "orderedItemRemoved", resolver: "template", params: ["label"] },
  { key: "orderTargetLabel", resolver: "template", params: ["index"] },
  { key: "orderTargetEmptyState", resolver: "plain" },
  { key: "orderTargetEmpty", resolver: "template", params: ["label"] },
  { key: "graphicOrderRegionsSelected", resolver: "plural", params: ["count"] },
  { key: "graphicOrderNoRegionsSelected", resolver: "plain" },
  { key: "objectNotPlaced", resolver: "plain" },
  { key: "objectPositionedAt", resolver: "template", params: ["coordinates"] },
  { key: "selectedPointAt", resolver: "template", params: ["coordinates"] },
  { key: "selectedPointsSummary", resolver: "plural", params: ["count", "coordinates"] },
  { key: "extendedTextResponseLabel", resolver: "plain" },
  { key: "textResponseLabel", resolver: "plain" },
  { key: "sliderResponseLabel", resolver: "plain" },
] as const satisfies readonly PlayerMessageManifestEntry[];

export type PlayerMessageKey = (typeof PLAYER_MESSAGE_MANIFEST)[number]["key"];

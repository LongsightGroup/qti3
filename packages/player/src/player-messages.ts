export interface QtiPlayerRemoveMessageParams {
  label: string;
}

export type QtiPlayerMovementDirection = "up" | "down" | "left" | "right";

export interface QtiPlayerMessages {
  remove: () => string;
  removePair: (params: QtiPlayerRemoveMessageParams) => string;
  clearDrawing: () => string;
  clearPoints: () => string;
  endAttempt: () => string;
  uploadResponse: () => string;
  movableObject: () => string;
  placeObject: () => string;
  moveChoice: (params: { label: string; direction: QtiPlayerMovementDirection }) => string;
  movePoint: (params: { direction: QtiPlayerMovementDirection }) => string;
  moveObject: (params: { direction: QtiPlayerMovementDirection }) => string;
}

export interface QtiPlayerRemoveMessageParams {
  label: string;
}

export interface QtiPlayerMessages {
  remove: () => string;
  removePair: (params: QtiPlayerRemoveMessageParams) => string;
}

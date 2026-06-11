import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { createMatchDirectedPairList } from "./match-directed-pair-list.js";
import {
  createMatchDirectedPairState,
  type MatchDirectedPairState,
} from "./match-directed-pair-state.js";

export { directedPairKey, parseDirectedPair } from "./match-directed-pair-state.js";

export type MatchDirectedPairSelection = MatchDirectedPairState & {
  pairList: HTMLUListElement;
  renderPairs: () => void;
};

export function createMatchDirectedPairSelection(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  selectedPairs: string[],
  sources: QtiChoice[],
  targets: QtiChoice[],
  messages: PlayerMessageResolver,
  pairListAriaLabel: string,
  afterPairsChange?: () => void,
): MatchDirectedPairSelection {
  const list = createMatchDirectedPairList(
    pairListAriaLabel,
    messages,
    sources,
    targets,
    selectedPairs,
  );

  const state = createMatchDirectedPairState({
    interaction,
    update,
    selectedPairs,
    validationHost: list.pairList,
    onChanged: () => {
      afterPairsChange?.();
      list.render(state);
    },
  });

  const renderPairs = () => list.render(state);

  return {
    ...state,
    pairList: list.pairList,
    renderPairs,
  };
}

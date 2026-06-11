import type { QtiChoice } from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { createAssociationPairChip } from "./pair-chip.js";
import { parseDirectedPair, type MatchDirectedPairState } from "./match-directed-pair-state.js";

export function createMatchDirectedPairList(
  pairListAriaLabel: string,
  messages: PlayerMessageResolver,
  sources: QtiChoice[],
  targets: QtiChoice[],
  selectedPairs: string[],
): {
  pairList: HTMLUListElement;
  render: (state: Pick<MatchDirectedPairState, "removePair">) => void;
} {
  const pairList = document.createElement("ul");
  pairList.className = "qti3-pair-list";
  pairList.setAttribute("aria-label", pairListAriaLabel);

  const render = (state: Pick<MatchDirectedPairState, "removePair">) => {
    pairList.replaceChildren(
      ...selectedPairs.map((pair) => {
        const [source, target] = parseDirectedPair(pair);
        const sourceChoice = sources.find((choice) => choice.identifier === source);
        const targetChoice = targets.find((choice) => choice.identifier === target);
        return createAssociationPairChip({
          source: {
            choice: sourceChoice,
            label: sourceChoice?.text || source,
          },
          target: {
            choice: targetChoice,
            label: targetChoice?.text || target,
          },
          messages,
          onRemove: () => {
            state.removePair(pair);
          },
        });
      }),
    );
  };

  return { pairList, render };
}

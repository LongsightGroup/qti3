import type { QtiChoice } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { choiceText } from "./shared.js";
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
        const label = messages.message("associationPairLabel", {
          source: choiceText(sources, source),
          target: choiceText(targets, target),
        });
        const item = document.createElement("li");
        item.className = "qti3-pair-chip";
        const text = document.createElement("span");
        text.textContent = label;
        const remove = removeButton(label, messages);
        remove.addEventListener("click", () => {
          state.removePair(pair);
        });
        item.append(text, remove);
        return item;
      }),
    );
  };

  return { pairList, render };
}

import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { parseUnlimitedMaximum } from "../response-limits.js";
import { choiceText } from "./shared.js";

export function directedPairKey(source: QtiChoice, target: QtiChoice): string {
  return `${source.identifier} ${target.identifier}`;
}

export function parseDirectedPair(pair: string): [string, string] {
  const [source, target] = pair.split(" ");
  return [source ?? "", target ?? ""];
}

export type MatchDirectedPairSelection = {
  pairList: HTMLUListElement;
  commit: () => void;
  removePair: (pair: string) => void;
  removePairsForSource: (source: QtiChoice) => void;
  removePairsForTarget: (target: QtiChoice) => void;
  togglePair: (source: QtiChoice, target: QtiChoice) => void;
  renderPairs: () => void;
  pairFor: (source: QtiChoice, target: QtiChoice) => string;
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
  const pairList = document.createElement("ul");
  pairList.className = "qti3-pair-list";
  pairList.setAttribute("aria-label", pairListAriaLabel);

  const commit = () => {
    if (interaction.responseCardinality === "single") update(selectedPairs[0] ?? null);
    else update([...selectedPairs]);
  };

  const pairFor = (source: QtiChoice, target: QtiChoice) => directedPairKey(source, target);

  const removePair = (pair: string) => {
    const index = selectedPairs.indexOf(pair);
    if (index >= 0) selectedPairs.splice(index, 1);
  };

  const removePairsForSource = (source: QtiChoice) => {
    for (const existing of selectedPairs.filter((pair) =>
      pair.startsWith(`${source.identifier} `),
    )) {
      removePair(existing);
    }
  };

  const removePairsForTarget = (target: QtiChoice) => {
    for (const existing of selectedPairs.filter((pair) => pair.endsWith(` ${target.identifier}`))) {
      removePair(existing);
    }
  };

  const renderPairs = () => {
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
          removePair(pair);
          afterPairsChange?.();
          renderPairs();
          commit();
        });
        item.append(text, remove);
        return item;
      }),
    );
  };

  const togglePair = (source: QtiChoice, target: QtiChoice) => {
    const pair = pairFor(source, target);
    if (selectedPairs.includes(pair)) {
      removePair(pair);
    } else {
      if (interaction.responseCardinality === "single") selectedPairs.splice(0);
      if (parseUnlimitedMaximum(source.attributes["match-max"]) === 1) {
        removePairsForSource(source);
      }
      if (parseUnlimitedMaximum(target.attributes["match-max"]) === 1) {
        removePairsForTarget(target);
      }
      selectedPairs.push(pair);
    }
    afterPairsChange?.();
    renderPairs();
    commit();
  };

  return {
    pairList,
    commit,
    removePair,
    removePairsForSource,
    removePairsForTarget,
    togglePair,
    renderPairs,
    pairFor,
  };
}

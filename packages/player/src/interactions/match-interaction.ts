import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import { missingChoicesMessage, responseGroup, valueToStrings } from "../interaction-support.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { parseUnlimitedMaximum } from "../response-limits.js";
import { choiceText, sourceChoices, targetChoices, tokenButton, tokenRegion } from "./shared.js";
import {
  appendSharedVocabularyChoicesLayout,
  sharedVocabularyChoicesLayout,
} from "./shared-vocabulary.js";

export function renderMatchResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = responseGroup();

  const sources = sourceChoices(interaction);
  const targets = targetChoices(interaction);
  if (sources.length === 0 || targets.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const selectedPairs: string[] = valueToStrings(currentValue);
  let selectedSource: QtiChoice | undefined;
  let selectedTarget: QtiChoice | undefined;
  let draggedSource: string | undefined;

  const selector = document.createElement("div");
  selector.className = "qti3-match-selector";
  const sharedVocabularyLayout = sharedVocabularyChoicesLayout(interaction);
  const sourceRegion = tokenRegion(messages.message("matchSourcesBank"));
  sourceRegion.classList.add("qti3-match-source-bank");
  const targetRegion = tokenRegion(messages.message("matchTargetsBank"));
  targetRegion.classList.add("qti3-match-target-bank");
  const pairList = document.createElement("ul");
  pairList.className = "qti3-pair-list";
  pairList.setAttribute("aria-label", messages.message("matchSelectedPairsList"));

  const commit = () => {
    if (interaction.responseCardinality === "single") update(selectedPairs[0] ?? null);
    else update([...selectedPairs]);
  };
  const removePair = (pair: string) => {
    const index = selectedPairs.indexOf(pair);
    if (index >= 0) selectedPairs.splice(index, 1);
  };
  const syncPressed = () => {
    for (const button of sourceRegion.querySelectorAll<HTMLButtonElement>("button")) {
      const identifier = button.dataset.choiceIdentifier ?? "";
      button.setAttribute(
        "aria-pressed",
        identifier === selectedSource?.identifier ||
          selectedPairs.some((pair) => pair.startsWith(`${identifier} `))
          ? "true"
          : "false",
      );
    }
    for (const button of targetRegion.querySelectorAll<HTMLButtonElement>("button")) {
      const identifier = button.dataset.choiceIdentifier ?? "";
      button.setAttribute(
        "aria-pressed",
        identifier === selectedTarget?.identifier ||
          selectedPairs.some((pair) => pair.endsWith(` ${identifier}`))
          ? "true"
          : "false",
      );
    }
  };
  const renderPairs = () => {
    pairList.replaceChildren(
      ...selectedPairs.map((pair) => {
        const [source, target] = pair.split(" ");
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
          syncPressed();
          renderPairs();
          commit();
        });
        item.append(text, remove);
        return item;
      }),
    );
  };
  const clearSelection = () => {
    selectedSource = undefined;
    selectedTarget = undefined;
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
  const togglePair = (source: QtiChoice, target: QtiChoice) => {
    const pair = `${source.identifier} ${target.identifier}`;
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
    clearSelection();
    syncPressed();
    renderPairs();
    commit();
  };
  const addSelectedPair = () => {
    if (!selectedSource || !selectedTarget) return;
    togglePair(selectedSource, selectedTarget);
  };
  const addPair = (sourceIdentifier: string | undefined, targetIdentifier: string): void => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    const target = targets.find((choice) => choice.identifier === targetIdentifier);
    if (!source || !target) return;
    togglePair(source, target);
  };

  for (const source of sources) {
    const button = tokenButton(source);
    button.classList.add("qti3-match-source");
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      draggedSource = source.identifier;
      event.dataTransfer?.setData("text/plain", source.identifier);
      event.dataTransfer?.setDragImage(button, 8, 8);
    });
    button.addEventListener("dragend", () => {
      draggedSource = undefined;
      syncPressed();
    });
    button.addEventListener("click", () => {
      selectedSource = source;
      syncPressed();
      addSelectedPair();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      removePairsForSource(source);
      clearSelection();
      syncPressed();
      renderPairs();
      commit();
    });
    sourceRegion.append(button);
  }

  for (const target of targets) {
    const button = tokenButton(target);
    button.classList.add("qti3-match-target");
    button.addEventListener("dragover", (event) => {
      event.preventDefault();
      button.classList.add("qti3-drop-target");
    });
    button.addEventListener("dragleave", () => button.classList.remove("qti3-drop-target"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("qti3-drop-target");
      addPair(event.dataTransfer?.getData("text/plain") || draggedSource, target.identifier);
    });
    button.addEventListener("click", () => {
      selectedTarget = target;
      syncPressed();
      addSelectedPair();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      removePairsForTarget(target);
      clearSelection();
      syncPressed();
      renderPairs();
      commit();
    });
    targetRegion.append(button);
  }

  appendSharedVocabularyChoicesLayout(selector, sourceRegion, targetRegion, sharedVocabularyLayout);
  syncPressed();
  renderPairs();
  group.append(selector, pairList);
  return group;
}

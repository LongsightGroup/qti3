import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { missingChoicesMessage, responseGroup, valueToStrings } from "../interaction-support.js";
import { reportMaximumResponseExceeded } from "../inline-validation.js";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { associationMaximumResponses } from "../response-limits.js";
import { createAssociationPairChip } from "./pair-chip.js";
import {
  pairRegionLabels,
  sourceChoices,
  targetChoices,
  tokenButton,
  tokenRegion,
} from "./shared.js";

export function renderPairResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = responseGroup();
  const regions = createQtiInteractionRegionMarkers(interaction);

  const sources = sourceChoices(interaction);
  const targets = targetChoices(interaction);
  if (sources.length === 0 || targets.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const selectedPairs: string[] = valueToStrings(currentValue);
  const maximum = associationMaximumResponses(interaction);
  let selectedSource: QtiChoice | undefined;
  let selectedTarget: QtiChoice | undefined;
  const labels = pairRegionLabels(interaction, messages);

  const sourceRegion = tokenRegion(
    messages.message("interactionSourcesBank", { type: interaction.type }),
    labels.source,
  );
  const targetRegion = tokenRegion(
    messages.message("interactionTargetsBank", { type: interaction.type }),
    labels.target,
  );
  const selector = document.createElement("div");
  selector.className = "qti3-pair-selector";
  const pairList = document.createElement("ul");
  pairList.className = "qti3-pair-list";
  pairList.setAttribute(
    "aria-label",
    messages.message("interactionSelectedPairsList", { type: interaction.type }),
  );
  let draggedSource: string | undefined;

  const commit = () => {
    if (interaction.responseCardinality === "single") update(selectedPairs[0] ?? null);
    else update([...selectedPairs]);
  };
  const syncPressed = () => {
    for (const button of sourceRegion.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.choiceIdentifier === selectedSource?.identifier ? "true" : "false",
      );
    }
    for (const button of targetRegion.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.choiceIdentifier === selectedTarget?.identifier ? "true" : "false",
      );
    }
  };
  const addSelectedPair = () => {
    if (!selectedSource || !selectedTarget) return;
    const pair = `${selectedSource.identifier} ${selectedTarget.identifier}`;
    if (!selectedPairs.includes(pair)) {
      if (
        maximum !== undefined &&
        selectedPairs.length >= maximum &&
        interaction.responseCardinality !== "single"
      ) {
        selectedSource = undefined;
        selectedTarget = undefined;
        reportMaximumResponseExceeded(group, interaction, maximum);
        syncPressed();
        return;
      }
      selectedPairs.push(pair);
    }
    selectedSource = undefined;
    selectedTarget = undefined;
    syncPressed();
    renderPairs();
    commit();
  };
  const addPair = (sourceIdentifier: string | undefined, targetIdentifier: string): void => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    const target = targets.find((choice) => choice.identifier === targetIdentifier);
    if (!source || !target) return;
    selectedSource = source;
    selectedTarget = target;
    addSelectedPair();
  };
  const renderPairs = () => {
    pairList.replaceChildren(
      ...selectedPairs.map((pair) => {
        const [source = "", target = ""] = pair.split(" ");
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
            const index = selectedPairs.indexOf(pair);
            if (index >= 0) selectedPairs.splice(index, 1);
            renderPairs();
            commit();
          },
        });
      }),
    );
  };

  for (const choice of sources) {
    const button = tokenButton(choice);
    regions.source(button, choice);
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      draggedSource = choice.identifier;
      event.dataTransfer?.setData("text/plain", choice.identifier);
      event.dataTransfer?.setDragImage(button, 8, 8);
    });
    button.addEventListener("dragend", () => {
      draggedSource = undefined;
      syncPressed();
    });
    button.addEventListener("click", () => {
      selectedSource = choice;
      syncPressed();
      addSelectedPair();
    });
    sourceRegion.append(button);
  }
  for (const choice of targets) {
    const button = tokenButton(choice);
    regions.target(button, choice.identifier);
    button.addEventListener("dragover", (event) => {
      event.preventDefault();
      button.classList.add("qti3-drop-target");
    });
    button.addEventListener("dragleave", () => button.classList.remove("qti3-drop-target"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("qti3-drop-target");
      addPair(event.dataTransfer?.getData("text/plain") || draggedSource, choice.identifier);
    });
    button.addEventListener("click", () => {
      selectedTarget = choice;
      syncPressed();
      addSelectedPair();
    });
    targetRegion.append(button);
  }

  selector.append(sourceRegion, targetRegion);
  renderPairs();
  group.append(selector, pairList);
  return group;
}

import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { missingChoicesMessage, responseGroup, valueToStrings } from "../interaction-support.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import {
  appendChoiceVisual,
  sourceChoices,
  targetChoices,
  tokenButton,
  tokenRegion,
} from "./shared.js";
import { createMatchDirectedPairSelection } from "./match-directed-pairs.js";
import {
  appendSharedVocabularyChoicesLayout,
  interactionClassNames,
  sharedVocabularyChoicesLayout,
} from "./shared-vocabulary.js";

export function renderMatchResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const sources = sourceChoices(interaction);
  const targets = targetChoices(interaction);
  if (sources.length === 0 || targets.length === 0) {
    const group = responseGroup();
    group.append(missingChoicesMessage(interaction));
    return group;
  }

  const selectedPairs: string[] = valueToStrings(currentValue);
  if (interactionClassNames(interaction).includes("qti-match-tabular")) {
    return renderTabularMatchResponse(
      interaction,
      update,
      selectedPairs,
      messages,
      sources,
      targets,
    );
  }

  return renderTokenBankMatchResponse(
    interaction,
    update,
    selectedPairs,
    messages,
    sources,
    targets,
  );
}

function renderTokenBankMatchResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  selectedPairs: string[],
  messages: PlayerMessageResolver,
  sources: QtiChoice[],
  targets: QtiChoice[],
): HTMLElement {
  const group = responseGroup();
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

  const clearSelection = () => {
    selectedSource = undefined;
    selectedTarget = undefined;
  };

  const pairs = createMatchDirectedPairSelection(
    interaction,
    update,
    selectedPairs,
    sources,
    targets,
    messages,
    messages.message("matchSelectedPairsList"),
    () => {
      clearSelection();
      syncPressed();
    },
  );

  const addSelectedPair = () => {
    if (!selectedSource || !selectedTarget) return;
    pairs.togglePair(selectedSource, selectedTarget);
  };
  const addPair = (sourceIdentifier: string | undefined, targetIdentifier: string): void => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    const target = targets.find((choice) => choice.identifier === targetIdentifier);
    if (!source || !target) return;
    pairs.togglePair(source, target);
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
      pairs.removePairsForSource(source);
      clearSelection();
      syncPressed();
      pairs.renderPairs();
      pairs.commit();
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
      pairs.removePairsForTarget(target);
      clearSelection();
      syncPressed();
      pairs.renderPairs();
      pairs.commit();
    });
    targetRegion.append(button);
  }

  appendSharedVocabularyChoicesLayout(selector, sourceRegion, targetRegion, sharedVocabularyLayout);
  syncPressed();
  pairs.renderPairs();
  group.append(selector, pairs.pairList);
  return group;
}

function renderTabularMatchResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  selectedPairs: string[],
  messages: PlayerMessageResolver,
  sources: QtiChoice[],
  targets: QtiChoice[],
): HTMLElement {
  const group = responseGroup();
  const classNames = new Set(interactionClassNames(interaction));
  const headerHidden = classNames.has("qti-header-hidden");
  const firstColumnHeader = interaction.attributes["data-first-column-header"] ?? "";
  const tableId = stableDomId(interaction.responseIdentifier ?? "match");

  const table = document.createElement("table");
  table.className = "qti3-match-table";
  if (headerHidden) table.classList.add("qti-header-hidden");

  const syncPressed = () => {
    for (const button of table.querySelectorAll<HTMLButtonElement>(".qti3-match-table-cell")) {
      const sourceIdentifier = button.dataset.sourceIdentifier ?? "";
      const targetIdentifier = button.dataset.targetIdentifier ?? "";
      button.setAttribute(
        "aria-pressed",
        selectedPairs.includes(`${sourceIdentifier} ${targetIdentifier}`) ? "true" : "false",
      );
    }
  };

  const pairs = createMatchDirectedPairSelection(
    interaction,
    update,
    selectedPairs,
    sources,
    targets,
    messages,
    messages.message("matchSelectedPairsList"),
    syncPressed,
  );

  if (!headerHidden) {
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.scope = "col";
    corner.textContent = firstColumnHeader;
    headerRow.append(corner);
    targets.forEach((target, index) => {
      const header = document.createElement("th");
      header.scope = "col";
      header.id = `${tableId}-target-${index}`;
      header.setAttribute("aria-label", target.text);
      appendChoiceVisual(header, target);
      headerRow.append(header);
    });
    thead.append(headerRow);
    table.append(thead);
  }

  const tbody = document.createElement("tbody");
  sources.forEach((source, sourceIndex) => {
    const row = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.scope = "row";
    rowHeader.id = `${tableId}-source-${sourceIndex}`;
    rowHeader.setAttribute("aria-label", source.text);
    appendChoiceVisual(rowHeader, source);
    row.append(rowHeader);

    targets.forEach((target, targetIndex) => {
      const cell = document.createElement("td");
      cell.setAttribute(
        "headers",
        headerHidden ? rowHeader.id : `${rowHeader.id} ${tableId}-target-${targetIndex}`,
      );
      const button = document.createElement("button");
      button.type = "button";
      button.className = "qti3-token qti3-match-table-cell";
      button.dataset.sourceIdentifier = source.identifier;
      button.dataset.targetIdentifier = target.identifier;
      button.setAttribute(
        "aria-label",
        messages.message("associationPairLabel", {
          source: source.text,
          target: target.text,
        }),
      );
      button.addEventListener("click", () => pairs.togglePair(source, target));
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        event.preventDefault();
        pairs.removePair(pairs.pairFor(source, target));
        syncPressed();
        pairs.renderPairs();
        pairs.commit();
      });
      cell.append(button);
      row.append(cell);
    });
    tbody.append(row);
  });
  table.append(tbody);

  syncPressed();
  pairs.renderPairs();
  group.append(table, pairs.pairList);
  return group;
}

function stableDomId(value: string): string {
  return `qti3-match-${value.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

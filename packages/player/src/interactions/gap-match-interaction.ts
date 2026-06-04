import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import {
  applyGraphicSurfaceLayout,
  appendGraphicObjectImage,
  missingChoicesMessage,
  objectHeight,
  objectWidth,
  placeHotspotButton,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { parseUnlimitedMaximum } from "../response-limits.js";
import { appendGraphicContext } from "./graphic-context.js";
import { appendInlineControl, normalizeInlineSegmentText } from "./inline-controls.js";
import {
  appendChoiceVisual,
  sourceChoices,
  targetChoices,
  tokenButton,
  tokenRegion,
} from "./shared.js";
import {
  appendSharedVocabularyChoicesLayout,
  sharedVocabularyChoicesLayout,
} from "./shared-vocabulary.js";

function positivePixelValue(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function graphicGapLabelBlockSize(sources: QtiChoice[]): number {
  const maxLength = Math.max(
    0,
    ...sources.map((source) => (source.text || source.identifier).trim().length),
  );
  const estimatedLines = Math.max(1, Math.ceil(maxLength / 22));
  const textBlockSize = estimatedLines * 0.95 + 0.9;
  const imageBlockSize = Math.max(
    0,
    ...sources.map((source) => {
      const height = positivePixelValue(source.asset?.height);
      return height === undefined ? 0 : height / 16 + 0.9;
    }),
  );
  return Number(Math.max(textBlockSize, imageBlockSize).toFixed(2));
}

export function renderGapMatchResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  if (
    interaction.type === "graphicGapMatch" &&
    interaction.object &&
    interaction.choices.some((choice) => choice.role === "hotspot")
  ) {
    return renderGraphicGapMatchResponse(interaction, update, currentValue, messages);
  }

  const group = responseGroup();
  appendGraphicContext(group, interaction);
  const sources = sourceChoices(interaction);
  const gaps = targetChoices(interaction);
  if (sources.length === 0 || gaps.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const assignments = new Map<string, QtiChoice>();
  let selectedSource: QtiChoice | undefined;
  let draggedSource: string | undefined;
  const sharedVocabularyLayout = sharedVocabularyChoicesLayout(interaction);

  const sourceRegion = tokenRegion(
    messages.message("interactionChoicesBank", { type: interaction.type }),
  );
  sourceRegion.classList.add("qti3-gap-source-region");
  const gapRegion = document.createElement("div");
  gapRegion.className = "qti3-gap-region qti3-gap-passage";
  gapRegion.role = "group";
  gapRegion.setAttribute(
    "aria-label",
    messages.message("interactionGapTargets", { type: interaction.type }),
  );
  for (const pair of valueToStrings(currentValue)) {
    const [sourceIdentifier, gapIdentifier] = pair.split(/\s+/);
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    if (source && gapIdentifier) assignments.set(gapIdentifier, source);
  }

  const commit = () => {
    update(
      [...assignments.entries()].map(
        ([gapIdentifier, source]) => `${source.identifier} ${gapIdentifier}`,
      ),
    );
  };
  const syncSources = () => {
    for (const button of sourceRegion.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.choiceIdentifier === selectedSource?.identifier ? "true" : "false",
      );
    }
  };
  const assign = (gap: QtiChoice, sourceIdentifier: string | undefined) => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    if (!source) return;
    assignments.set(gap.identifier, source);
    selectedSource = undefined;
    syncSources();
    renderGaps();
    commit();
  };
  const gapControl = (gap: QtiChoice, index: number) => {
    const assigned = assignments.get(gap.identifier);
    const gapLabel = messages.message("gapLabel", { index: index + 1 });
    const target = document.createElement("span");
    target.className = "qti3-gap-target";
    target.dataset.gapIdentifier = gap.identifier;
    target.addEventListener("dragover", (event) => {
      event.preventDefault();
      target.classList.add("qti3-drop-target");
    });
    target.addEventListener("dragleave", () => target.classList.remove("qti3-drop-target"));
    target.addEventListener("drop", (event) => {
      event.preventDefault();
      target.classList.remove("qti3-drop-target");
      assign(gap, event.dataTransfer?.getData("text/plain") || draggedSource);
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-gap-button";
    button.textContent = assigned ? assigned.text : "";
    button.setAttribute(
      "aria-label",
      assigned
        ? messages.message("gapAssignedState", { label: gapLabel, assigned: assigned.text })
        : messages.message("gapEmptyState", { label: gapLabel }),
    );
    button.addEventListener("click", () => assign(gap, selectedSource?.identifier));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!assignments.has(gap.identifier)) return;
      event.preventDefault();
      assignments.delete(gap.identifier);
      renderGaps();
      commit();
    });
    target.append(button);
    return target;
  };
  const renderGaps = () => {
    const segments = interaction.gapMatchSegments ?? [];
    const hasInlineGaps = segments.some((segment) => segment.kind === "gap");
    if (!hasInlineGaps) {
      gapRegion.replaceChildren(...gaps.map((gap, index) => gapControl(gap, index)));
      return;
    }

    const content: Array<Node | string> = [];
    for (const [segmentIndex, segment] of segments.entries()) {
      if (segment.kind === "text") {
        content.push(document.createTextNode(normalizeInlineSegmentText(segment.text)));
        continue;
      }

      const gapIndex = gaps.findIndex((gap) => gap.identifier === segment.identifier);
      const gap = gaps[gapIndex];
      if (gap) {
        appendInlineControl(content, gapControl(gap, gapIndex), segments[segmentIndex + 1]);
      }
    }
    gapRegion.replaceChildren(...content);
  };

  for (const source of sources) {
    const button = tokenButton(source);
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      draggedSource = source.identifier;
      event.dataTransfer?.setData("text/plain", source.identifier);
    });
    button.addEventListener("click", () => {
      selectedSource = source;
      syncSources();
    });
    sourceRegion.append(button);
  }

  const layout = document.createElement("div");
  layout.className = "qti3-gap-match-layout";
  renderGaps();
  appendSharedVocabularyChoicesLayout(layout, sourceRegion, gapRegion, sharedVocabularyLayout);
  group.append(layout);
  return group;
}

function renderGraphicGapMatchResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const group = responseGroup();
  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  const sources = sourceChoices(interaction);
  const gaps = targetChoices(interaction).filter((choice) => choice.role === "hotspot");
  if (sources.length === 0 || gaps.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const assignments = new Map<string, QtiChoice>();
  let selectedSource: QtiChoice | undefined;
  let draggedSource: string | undefined;

  for (const pair of valueToStrings(currentValue)) {
    const [sourceIdentifier, gapIdentifier] = pair.split(/\s+/);
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    if (source && gapIdentifier) assignments.set(gapIdentifier, source);
  }

  const surface = document.createElement("div");
  applyGraphicSurfaceLayout(
    surface,
    width,
    height,
    "qti3-graphic-context",
    "qti3-graphic-gap-match-surface",
  );
  surface.role = "group";
  surface.setAttribute(
    "aria-label",
    messages.message("interactionTargetImage", { type: interaction.type }),
  );
  surface.style.overflow = "visible";
  surface.style.setProperty(
    "--qti3-graphic-gap-label-block-size",
    `${graphicGapLabelBlockSize(sources)}rem`,
  );

  if (interaction.object) {
    appendGraphicObjectImage(
      surface,
      interaction.object,
      interaction.object.text ||
        messages.message("interactionImageAlt", { type: interaction.type }),
    );
  }

  const sourceRegion = tokenRegion(
    messages.message("interactionChoicesBank", { type: interaction.type }),
  );
  sourceRegion.classList.add("qti3-graphic-gap-source-region");
  const sharedVocabularyLayout = sharedVocabularyChoicesLayout(interaction);

  const summary = document.createElement("p");
  summary.className = "qti3-selection-summary";
  summary.setAttribute("aria-live", "polite");

  const commit = () => {
    update(
      [...assignments.entries()].map(
        ([gapIdentifier, source]) => `${source.identifier} ${gapIdentifier}`,
      ),
    );
  };
  const syncSources = () => {
    for (const button of sourceRegion.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.choiceIdentifier === selectedSource?.identifier ? "true" : "false",
      );
    }
  };
  const clearSourceIfSingleUse = (source: QtiChoice, keepGapIdentifier: string) => {
    if (parseUnlimitedMaximum(source.attributes["match-max"]) !== 1) return;
    for (const [gapIdentifier, assigned] of assignments.entries()) {
      if (gapIdentifier !== keepGapIdentifier && assigned.identifier === source.identifier) {
        assignments.delete(gapIdentifier);
      }
    }
  };
  const assign = (gap: QtiChoice, sourceIdentifier: string | undefined) => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    if (!source) return;
    clearSourceIfSingleUse(source, gap.identifier);
    assignments.set(gap.identifier, source);
    selectedSource = undefined;
    syncSources();
    renderTargets();
    commit();
  };
  const targetLabel = (gap: QtiChoice, index: number) =>
    gap.attributes["aria-label"] ||
    gap.attributes["hotspot-label"] ||
    messages.message("graphicGapTargetLabel", { index: index + 1 });
  const renderTargetButton = (gap: QtiChoice, index: number): HTMLButtonElement => {
    const assigned = assignments.get(gap.identifier);
    const label = targetLabel(gap, index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-hotspot-button qti3-graphic-gap-hotspot";
    button.dataset.gapIdentifier = gap.identifier;
    button.dataset.selected = assigned ? "true" : "false";
    button.setAttribute(
      "aria-label",
      assigned
        ? messages.message("gapAssignedState", { label, assigned: assigned.text })
        : messages.message("gapEmptyState", { label }),
    );
    button.addEventListener("dragover", (event) => {
      event.preventDefault();
      button.classList.add("qti3-drop-target");
    });
    button.addEventListener("dragleave", () => button.classList.remove("qti3-drop-target"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("qti3-drop-target");
      assign(gap, event.dataTransfer?.getData("text/plain") || draggedSource);
    });
    button.addEventListener("click", () => assign(gap, selectedSource?.identifier));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!assignments.has(gap.identifier)) return;
      event.preventDefault();
      assignments.delete(gap.identifier);
      renderTargets();
      commit();
    });
    placeHotspotButton(button, gap, width, height);
    if (assigned) {
      const assignedLabel = document.createElement("span");
      assignedLabel.className = "qti3-graphic-gap-label";
      appendChoiceVisual(assignedLabel, assigned);
      button.append(assignedLabel);
    }
    return button;
  };
  const renderTargets = () => {
    surface.querySelectorAll(".qti3-graphic-gap-hotspot").forEach((target) => target.remove());
    for (const [index, gap] of gaps.entries()) {
      surface.append(renderTargetButton(gap, index));
    }
    summary.textContent =
      assignments.size > 0
        ? messages.message("gapLabelsPlacedCount", { count: assignments.size })
        : messages.message("gapNoLabelsPlaced");
  };

  for (const source of sources) {
    const button = tokenButton(source);
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      draggedSource = source.identifier;
      event.dataTransfer?.setData("text/plain", source.identifier);
      event.dataTransfer?.setDragImage(button, 8, 8);
    });
    button.addEventListener("dragend", () => {
      draggedSource = undefined;
      syncSources();
    });
    button.addEventListener("click", () => {
      selectedSource = source;
      syncSources();
    });
    sourceRegion.append(button);
  }

  const layout = document.createElement("div");
  layout.className = "qti3-graphic-gap-layout";
  renderTargets();
  if (sharedVocabularyLayout === undefined) {
    layout.append(surface, sourceRegion);
  } else {
    appendSharedVocabularyChoicesLayout(layout, sourceRegion, surface, sharedVocabularyLayout);
  }
  group.append(layout, summary);
  return group;
}

import {
  numericTuple3,
  numericTuple4,
  parsePositiveNumber,
  type QtiChoice,
  type QtiInteraction,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import {
  applyGraphicSurfaceLayout,
  appendGraphicObjectImage,
  hotspotRectBounds,
  missingChoicesMessage,
  objectHeight,
  objectWidth,
  parseHotspotCoords,
  placeHotspotButton,
  percent,
  responseGroup,
  valueToStrings,
} from "../interaction-support.js";
import { reportMaximumResponseExceeded } from "../inline-validation.js";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { maximumAllowedResponses } from "../response-limits.js";
import { appendGraphicContext } from "./graphic-context.js";
import {
  applyGapMatchAssignments,
  gapMatchResponseValue,
  tryGapMatchAssignment,
} from "./gap-match-assignment.js";
import { syncGapMatchSourceBank } from "./gap-match-source-bank.js";
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
  gapMatchUsesPlacement,
  inputWidth,
  sharedVocabularyChoicesLayout,
} from "./shared-vocabulary.js";

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
      const height = parsePositiveNumber(source.asset?.height);
      return height === undefined ? 0 : height / 16 + 0.9;
    }),
  );
  return Number(Math.max(textBlockSize, imageBlockSize).toFixed(2));
}

function isGraphicGapImageChoice(choice: QtiChoice): boolean {
  return Boolean(choice.asset?.data);
}

function graphicGapImageFitsRectHotspot(assigned: QtiChoice, gap: QtiChoice): boolean {
  const bounds = hotspotRectBounds(gap);
  if (!bounds || !isGraphicGapImageChoice(assigned)) return false;
  const imageWidth = parsePositiveNumber(assigned.asset?.width);
  const imageHeight = parsePositiveNumber(assigned.asset?.height);
  return (
    imageWidth !== undefined &&
    imageHeight !== undefined &&
    imageWidth <= bounds.inlineSize &&
    imageHeight <= bounds.blockSize
  );
}

function placeGraphicGapLabelBelow(
  label: HTMLElement,
  gap: QtiChoice,
  width: number,
  height: number,
) {
  const coords = parseHotspotCoords(gap);
  const shape = gap.attributes.shape;
  let x = width / 2;
  let y = height;

  if (shape === "circle" && coords.length >= 3) {
    const tuple = numericTuple3(coords);
    if (!tuple) return;
    const [centerX, centerY, radius] = tuple;
    x = centerX;
    y = centerY + radius;
  } else if (shape === "rect" && coords.length >= 4) {
    const tuple = numericTuple4(coords);
    if (!tuple) return;
    const [left, , right, bottom] = tuple;
    x = (left + right) / 2;
    y = bottom;
  } else if (shape === "poly" && coords.length >= 6) {
    const xs = coords.filter((_, index) => index % 2 === 0);
    const ys = coords.filter((_, index) => index % 2 === 1);
    x = (Math.min(...xs) + Math.max(...xs)) / 2;
    y = Math.max(...ys);
  }

  label.style.setProperty("--qti3-graphic-gap-label-inline-start", `${percent(x, width)}%`);
  label.style.setProperty("--qti3-graphic-gap-label-block-start", `${percent(y, height)}%`);
  label.style.removeProperty("--qti3-graphic-gap-label-inline-size");
  label.style.removeProperty("--qti3-graphic-gap-label-block-size");
}

function placeGraphicGapAssignedLabel(
  label: HTMLElement,
  assigned: QtiChoice,
  gap: QtiChoice,
  width: number,
  height: number,
) {
  const inSlot = graphicGapImageFitsRectHotspot(assigned, gap);
  label.classList.toggle("qti3-graphic-gap-label-in-slot", inSlot);
  if (inSlot) {
    const bounds = hotspotRectBounds(gap);
    if (!bounds) return;
    label.style.setProperty(
      "--qti3-graphic-gap-label-inline-start",
      `${percent(bounds.left, width)}%`,
    );
    label.style.setProperty(
      "--qti3-graphic-gap-label-block-start",
      `${percent(bounds.top, height)}%`,
    );
    label.style.setProperty(
      "--qti3-graphic-gap-label-inline-size",
      `${percent(bounds.inlineSize, width)}%`,
    );
    label.style.setProperty(
      "--qti3-graphic-gap-label-block-size",
      `${percent(bounds.blockSize, height)}%`,
    );
    return;
  }
  placeGraphicGapLabelBelow(label, gap, width, height);
}

type GraphicGapDragPayload = {
  sourceId: string;
  originGapId?: string;
};

function startGraphicGapDrag(
  event: DragEvent,
  payload: GraphicGapDragPayload,
  dragImage: HTMLElement,
  onBegin: (sourceId: string, originGapId?: string) => void,
): void {
  onBegin(payload.sourceId, payload.originGapId);
  event.dataTransfer?.setData("text/plain", payload.sourceId);
  if (payload.originGapId !== undefined) {
    event.dataTransfer?.setData("application/x-qti3-origin-gap", payload.originGapId);
  }
  event.dataTransfer?.setDragImage(dragImage, 8, 8);
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
  const regions = createQtiInteractionRegionMarkers(interaction);
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
  const maximumAssignments = maximumAllowedResponses(interaction);
  const sharedVocabularyLayout = sharedVocabularyChoicesLayout(interaction);
  const usesGapPlacement = gapMatchUsesPlacement(interaction);
  const gapSegmentAttributes = new Map(
    (interaction.gapMatchSegments ?? [])
      .filter((segment) => segment.kind === "gap")
      .map((segment) => [segment.identifier, segment.attributes]),
  );

  const sourceRegion = tokenRegion(
    messages.message("interactionChoicesBank", { type: interaction.type }),
  );
  sourceRegion.classList.add("qti3-gap-source-region");
  const gapRegion = document.createElement("div");
  gapRegion.className = "qti3-gap-region";
  if (usesGapPlacement) gapRegion.classList.add("qti3-gap-placement");
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
    update(gapMatchResponseValue(assignments));
  };
  const syncSources = () => {
    syncGapMatchSourceBank(sourceRegion, sources, assignments, selectedSource?.identifier);
  };
  const assign = (gap: QtiChoice, sourceIdentifier: string | undefined) => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    if (!source) return;
    const result = tryGapMatchAssignment(
      assignments,
      gap.identifier,
      source,
      maximumAssignments === undefined ? {} : { maximumAssignments },
    );
    if (!result.accepted) {
      if (maximumAssignments !== undefined) {
        reportMaximumResponseExceeded(group, interaction, maximumAssignments);
      }
      syncSources();
      return;
    }
    applyGapMatchAssignments(assignments, result.next);
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
    regions.target(target, gap.identifier);
    const width = inputWidth({
      ...gap.attributes,
      ...gapSegmentAttributes.get(gap.identifier),
    });
    if (width !== undefined) {
      target.dataset.qtiGapInputWidth = String(width);
      target.style.setProperty("--qti3-gap-input-width", `${width}ch`);
    }
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
      syncSources();
      renderGaps();
      commit();
    });
    target.append(button);
    return target;
  };
  const renderGaps = () => {
    const segments = interaction.gapMatchSegments ?? [];
    const hasInlineGaps = segments.some((segment) => segment.kind === "gap");
    gapRegion.classList.toggle("qti3-gap-passage", hasInlineGaps);
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
    regions.source(button, source);
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
  syncSources();
  const layout = document.createElement("div");
  layout.className = "qti3-gap-match-layout";
  if (usesGapPlacement) layout.classList.add("qti3-gap-placement");
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
  const regions = createQtiInteractionRegionMarkers(interaction);
  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  const sources = sourceChoices(interaction);
  const gaps = targetChoices(interaction).filter((choice) => choice.role === "hotspot");
  const maximumAssignments = maximumAllowedResponses(interaction);
  if (sources.length === 0 || gaps.length === 0) {
    group.append(missingChoicesMessage(interaction));
    return group;
  }
  const assignments = new Map<string, QtiChoice>();
  let selectedSource: QtiChoice | undefined;
  let draggedSource: string | undefined;
  let draggedOriginGap: string | undefined;

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
  regions.surface(surface);
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
    update(gapMatchResponseValue(assignments));
  };
  const syncSources = () => {
    syncGapMatchSourceBank(sourceRegion, sources, assignments, selectedSource?.identifier);
  };
  const resetDrag = () => {
    draggedSource = undefined;
    draggedOriginGap = undefined;
    syncSources();
  };
  const beginDrag = (sourceId: string, originGapId?: string) => {
    draggedSource = sourceId;
    draggedOriginGap = originGapId;
  };
  const assign = (
    gap: QtiChoice,
    sourceIdentifier: string | undefined,
    originGapIdentifier?: string,
  ) => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    if (!source) return;
    const result = tryGapMatchAssignment(assignments, gap.identifier, source, {
      ...(originGapIdentifier === undefined ? {} : { originGapIdentifier }),
      ...(maximumAssignments === undefined ? {} : { maximumAssignments }),
    });
    selectedSource = undefined;
    if (!result.accepted) {
      if (maximumAssignments !== undefined) {
        reportMaximumResponseExceeded(group, interaction, maximumAssignments);
      }
      syncSources();
      return;
    }
    applyGapMatchAssignments(assignments, result.next);
    syncSources();
    renderTargets();
    commit();
  };
  const clearAssignment = (gapIdentifier: string) => {
    if (!assignments.has(gapIdentifier)) return;
    assignments.delete(gapIdentifier);
    resetDrag();
    renderTargets();
    commit();
  };
  sourceRegion.addEventListener("dragover", (event) => {
    const dragTypes = Array.from(event.dataTransfer?.types ?? []);
    if (!draggedOriginGap && !dragTypes.includes("application/x-qti3-origin-gap")) return;
    event.preventDefault();
    sourceRegion.classList.add("qti3-drop-target");
  });
  sourceRegion.addEventListener("dragleave", () =>
    sourceRegion.classList.remove("qti3-drop-target"),
  );
  sourceRegion.addEventListener("drop", (event) => {
    const originGapIdentifier =
      event.dataTransfer?.getData("application/x-qti3-origin-gap") || draggedOriginGap;
    if (!originGapIdentifier) return;
    event.preventDefault();
    sourceRegion.classList.remove("qti3-drop-target");
    clearAssignment(originGapIdentifier);
  });
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
    regions.target(button, gap.identifier);
    button.setAttribute(
      "aria-label",
      assigned
        ? messages.message("gapAssignedState", { label, assigned: assigned.text })
        : messages.message("gapEmptyState", { label }),
    );
    if (assigned) {
      button.draggable = true;
      button.addEventListener("dragstart", (event) => {
        startGraphicGapDrag(
          event,
          { sourceId: assigned.identifier, originGapId: gap.identifier },
          button,
          beginDrag,
        );
      });
      button.addEventListener("dragend", resetDrag);
    }
    button.addEventListener("dragover", (event) => {
      event.preventDefault();
      button.classList.add("qti3-drop-target");
    });
    button.addEventListener("dragleave", () => button.classList.remove("qti3-drop-target"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("qti3-drop-target");
      const sourceIdentifier = event.dataTransfer?.getData("text/plain") || draggedSource;
      const originGapIdentifier =
        event.dataTransfer?.getData("application/x-qti3-origin-gap") || draggedOriginGap;
      assign(gap, sourceIdentifier, originGapIdentifier);
      resetDrag();
    });
    button.addEventListener("click", () => {
      if (selectedSource) {
        assign(gap, selectedSource.identifier);
        return;
      }
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!assignments.has(gap.identifier)) return;
      event.preventDefault();
      clearAssignment(gap.identifier);
    });
    placeHotspotButton(button, gap, width, height);
    return button;
  };
  const renderAssignedLabel = (gap: QtiChoice, assigned: QtiChoice): HTMLElement => {
    const assignedLabel = document.createElement("span");
    assignedLabel.className = "qti3-graphic-gap-label";
    assignedLabel.dataset.choiceIdentifier = assigned.identifier;
    assignedLabel.dataset.originGapIdentifier = gap.identifier;
    regions.placement(assignedLabel, assigned.identifier);
    assignedLabel.draggable = true;
    assignedLabel.setAttribute("aria-hidden", "true");
    assignedLabel.addEventListener("dragstart", (event) => {
      startGraphicGapDrag(
        event,
        { sourceId: assigned.identifier, originGapId: gap.identifier },
        assignedLabel,
        beginDrag,
      );
    });
    assignedLabel.addEventListener("dragend", resetDrag);
    placeGraphicGapAssignedLabel(assignedLabel, assigned, gap, width, height);
    appendChoiceVisual(assignedLabel, assigned);
    return assignedLabel;
  };
  const renderTargetNodes = (gap: QtiChoice, index: number): HTMLElement[] => {
    const button = renderTargetButton(gap, index);
    const assigned = assignments.get(gap.identifier);
    if (assigned) {
      return [button, renderAssignedLabel(gap, assigned)];
    }
    return [button];
  };
  const renderTargets = () => {
    surface
      .querySelectorAll(".qti3-graphic-gap-hotspot, .qti3-graphic-gap-label")
      .forEach((target) => target.remove());
    for (const [index, gap] of gaps.entries()) {
      surface.append(...renderTargetNodes(gap, index));
    }
    summary.textContent =
      assignments.size > 0
        ? messages.message("gapLabelsPlacedCount", { count: assignments.size })
        : messages.message("gapNoLabelsPlaced");
  };

  for (const source of sources) {
    const button = tokenButton(source);
    regions.source(button, source);
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      startGraphicGapDrag(event, { sourceId: source.identifier }, button, beginDrag);
    });
    button.addEventListener("dragend", resetDrag);
    button.addEventListener("click", () => {
      selectedSource = source;
      syncSources();
    });
    sourceRegion.append(button);
  }
  syncSources();

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

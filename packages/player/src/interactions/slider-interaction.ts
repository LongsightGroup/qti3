import {
  parseQtiSliderDefinition,
  type QtiInteraction,
  type QtiSliderDefinition,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { errorView } from "../player-validation.js";
import {
  sliderHasUnalignedUpper,
  sliderKeyboardValue,
  sliderRatio,
  sliderTicks,
  snapSliderValue,
} from "./slider-scale.js";
import { scalarString } from "./text-value.js";

const SLIDER_SELECTION_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
]);

function createSliderVisual(definition: QtiSliderDefinition): HTMLElement {
  const visual = document.createElement("div");
  visual.className = "qti3-slider-visual";
  visual.setAttribute("aria-hidden", "true");

  const track = document.createElement("div");
  track.className = "qti3-slider-track";
  const rail = document.createElement("div");
  rail.className = "qti3-slider-rail";
  const fill = document.createElement("div");
  fill.className = "qti3-slider-fill";
  const thumb = document.createElement("div");
  thumb.className = "qti3-slider-thumb";

  const scale = document.createElement("div");
  scale.className = "qti3-slider-scale";
  const tickModel = sliderTicks(definition);
  scale.dataset.labelDensity = tickModel.density;
  for (const tickModelEntry of tickModel.ticks) {
    const tick = document.createElement("span");
    tick.className = "qti3-slider-tick";
    tick.dataset.kind = tickModelEntry.kind;
    tick.style.setProperty("--qti3-slider-tick-ratio", `${tickModelEntry.ratio * 100}%`);
    const mark = document.createElement("span");
    mark.className = "qti3-slider-tick-mark";
    const label = document.createElement("span");
    label.className = "qti3-slider-tick-label";
    label.textContent = tickModelEntry.label;
    tick.append(mark, label);
    scale.append(tick);
  }

  track.append(rail, fill, scale, thumb);
  visual.append(track);
  return visual;
}

function hasCurrentSliderResponse(value: QtiValue): boolean {
  return scalarString(value) !== "";
}

function invalidSliderView(interaction: QtiInteraction): HTMLElement {
  const alert = errorView(
    interaction.responseIdentifier
      ? `Slider interaction (${interaction.responseIdentifier}) has invalid authored attributes.`
      : "Slider interaction has invalid authored attributes.",
  );
  alert.classList.add("qti3-slider-invalid");
  return alert;
}

/** Renders a native range input beneath the QTI slider presentation layer. */
export function renderSliderResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const parsedDefinition = parseQtiSliderDefinition(interaction);
  if (!parsedDefinition.ok) return invalidSliderView(interaction);
  const definition = parsedDefinition.value;
  const noResponseMessage = messages.message("sliderNoResponse");
  const regions = createQtiInteractionRegionMarkers(interaction);

  const group = document.createElement("div");
  group.className = "qti3-slider-response";
  group.dataset.orientation = definition.orientation;
  group.dataset.reverse = String(definition.reverse);
  group.dataset.stepLabels = String(definition.stepLabels);

  const control = document.createElement("div");
  control.className = "qti3-slider-control";
  const visual = createSliderVisual(definition);
  const input = document.createElement("input");
  input.className = "qti3-slider-input";
  input.type = "range";
  input.min = String(definition.lowerBound);
  input.max = String(definition.upperBound);
  const hasUnalignedUpper = sliderHasUnalignedUpper(definition);
  input.step =
    definition.step.kind === "continuous" || hasUnalignedUpper
      ? "any"
      : String(definition.step.value);
  input.value = hasCurrentSliderResponse(currentValue)
    ? scalarString(currentValue)
    : String(definition.lowerBound);
  input.setAttribute("aria-label", interaction.prompt ?? messages.message("sliderResponseLabel"));
  if (definition.orientation === "vertical") input.setAttribute("aria-orientation", "vertical");
  regions.control(input);

  const output = document.createElement("output");
  output.className = "qti3-slider-output";
  let committedValue = hasCurrentSliderResponse(currentValue) ? input.value : undefined;

  const present = (value: string | undefined): void => {
    const isSet = value !== undefined;
    const presentedValue = value ?? input.value;
    group.style.setProperty(
      "--qti3-slider-ratio",
      `${sliderRatio(Number(presentedValue), definition) * 100}%`,
    );
    group.dataset.responseState = isSet ? "set" : "unset";
    output.dataset.responseState = isSet ? "set" : "unset";
    output.value = isSet ? presentedValue : "";
    output.textContent = isSet ? presentedValue : noResponseMessage;
    if (isSet) {
      input.removeAttribute("aria-valuetext");
      return;
    }
    input.setAttribute("aria-valuetext", noResponseMessage);
  };

  const commit = (): void => {
    if (hasUnalignedUpper) input.value = String(snapSliderValue(input.valueAsNumber, definition));
    const nextValue = input.value;
    if (committedValue === nextValue) return;
    committedValue = nextValue;
    present(committedValue);
    update(Number(nextValue));
  };

  input.addEventListener("input", commit);
  input.addEventListener("change", commit);
  input.addEventListener("keydown", (event) => {
    const nextValue = sliderKeyboardValue(event.key, input.valueAsNumber, definition);
    if (nextValue === undefined) return;
    event.preventDefault();
    input.value = String(nextValue);
    commit();
  });
  input.addEventListener("pointerup", (event) => {
    if (event.isPrimary) commit();
  });
  input.addEventListener("keyup", (event) => {
    if (SLIDER_SELECTION_KEYS.has(event.key)) commit();
  });

  present(committedValue);
  control.append(visual, input);
  group.append(control, output);
  return group;
}

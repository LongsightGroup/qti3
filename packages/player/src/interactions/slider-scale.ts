import type { QtiSliderDefinition } from "@longsightgroup/qti3-core";

type SliderLabelDensity = "endpoints" | "all" | "sampled";
type SliderTickKind = "endpoint" | "step";

interface SliderTick {
  readonly kind: SliderTickKind;
  readonly label: string;
  readonly ratio: number;
}

interface SliderTicks {
  readonly density: SliderLabelDensity;
  readonly ticks: readonly SliderTick[];
}

const MAX_VISIBLE_STEP_LABELS = 9;
const MAX_INTERVAL_COUNT = Number.MAX_SAFE_INTEGER - 1;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function decimalPlaces(value: number): number {
  const [coefficient = "", exponentText] = String(value).toLowerCase().split("e");
  const fractionLength = coefficient.split(".")[1]?.length ?? 0;
  const exponent = Number(exponentText ?? "0");
  return Math.max(0, fractionLength - exponent);
}

function steppedValue(lowerBound: number, step: number, index: number): number {
  const precision = Math.min(100, Math.max(decimalPlaces(lowerBound), decimalPlaces(step)));
  return Number((lowerBound + index * step).toFixed(precision));
}

function discreteIntervals(definition: QtiSliderDefinition): {
  readonly alignedUpper: boolean;
  readonly regularCount: number;
} {
  if (definition.step.kind === "continuous") {
    return { alignedUpper: true, regularCount: 1 };
  }

  const intervalRatio = (definition.upperBound - definition.lowerBound) / definition.step.value;
  const nearestInteger = Math.round(intervalRatio);
  const alignedUpper =
    steppedValue(definition.lowerBound, definition.step.value, nearestInteger) ===
    definition.upperBound;
  return {
    alignedUpper,
    regularCount: Math.min(
      alignedUpper ? nearestInteger : Math.floor(intervalRatio),
      MAX_INTERVAL_COUNT,
    ),
  };
}

function discreteValue(definition: QtiSliderDefinition, index: number): number {
  if (definition.step.kind === "continuous") return definition.lowerBound;
  return steppedValue(definition.lowerBound, definition.step.value, index);
}

function lowerRegularValue(definition: QtiSliderDefinition): number {
  const intervals = discreteIntervals(definition);
  return discreteValue(definition, intervals.regularCount);
}

function keyboardDirection(key: string, definition: QtiSliderDefinition): -1 | 1 | undefined {
  if (key === "PageDown") return -1;
  if (key === "PageUp") return 1;
  if (definition.orientation === "vertical") {
    if (key === "ArrowDown") return definition.reverse ? 1 : -1;
    if (key === "ArrowUp") return definition.reverse ? -1 : 1;
    return undefined;
  }
  if (key === "ArrowLeft") return definition.reverse ? 1 : -1;
  if (key === "ArrowRight") return definition.reverse ? -1 : 1;
  return undefined;
}

function endpointTick(value: number, ratio: number): SliderTick {
  return { kind: "endpoint", label: String(value), ratio };
}

/** Returns the normalized visual position for a selected slider value. */
export function sliderRatio(value: number, definition: QtiSliderDefinition): number {
  return clamp(
    (value - definition.lowerBound) / (definition.upperBound - definition.lowerBound),
    0,
    1,
  );
}

/** Returns whether the authored upper endpoint falls outside the regular step sequence. */
export function sliderHasUnalignedUpper(definition: QtiSliderDefinition): boolean {
  return definition.step.kind === "discrete" && !discreteIntervals(definition).alignedUpper;
}

/** Snaps a raw native range value to the closest authored slider value. */
export function snapSliderValue(value: number, definition: QtiSliderDefinition): number {
  const clampedValue = clamp(value, definition.lowerBound, definition.upperBound);
  if (definition.step.kind === "continuous") return clampedValue;

  const intervals = discreteIntervals(definition);
  const regularIndex = clamp(
    Math.round((clampedValue - definition.lowerBound) / definition.step.value),
    0,
    intervals.regularCount,
  );
  const regularValue = discreteValue(definition, regularIndex);
  if (intervals.alignedUpper) return regularValue;
  return Math.abs(definition.upperBound - clampedValue) < Math.abs(regularValue - clampedValue)
    ? definition.upperBound
    : regularValue;
}

/** Returns the authored value reached by a physical slider navigation key. */
export function sliderKeyboardValue(
  key: string,
  currentValue: number,
  definition: QtiSliderDefinition,
): number | undefined {
  if (key === "Home") return definition.lowerBound;
  if (key === "End") return definition.upperBound;
  const direction = keyboardDirection(key, definition);
  if (direction === undefined) return undefined;

  const multiplier = key === "PageDown" || key === "PageUp" ? 10 : 1;
  if (definition.step.kind === "continuous") {
    const keyboardStep = (definition.upperBound - definition.lowerBound) / 100;
    return clamp(
      currentValue + direction * keyboardStep * multiplier,
      definition.lowerBound,
      definition.upperBound,
    );
  }
  const snapped = snapSliderValue(currentValue, definition);
  const lastRegularValue = lowerRegularValue(definition);
  if (direction > 0 && snapped >= lastRegularValue) return definition.upperBound;
  if (direction < 0 && snapped === definition.upperBound) return lastRegularValue;
  return snapSliderValue(snapped + direction * definition.step.value * multiplier, definition);
}

/** Builds bounded endpoint and requested step labels for a refined slider definition. */
export function sliderTicks(definition: QtiSliderDefinition): SliderTicks {
  const endpoints: readonly SliderTick[] = [
    endpointTick(definition.lowerBound, 0),
    endpointTick(definition.upperBound, 1),
  ];
  if (!definition.stepLabels || definition.step.kind === "continuous") {
    return { density: "endpoints", ticks: endpoints };
  }

  const intervals = discreteIntervals(definition);
  const candidateCount = intervals.regularCount + 1 + (intervals.alignedUpper ? 0 : 1);
  const visibleCount = Math.min(candidateCount, MAX_VISIBLE_STEP_LABELS);
  const ticks: SliderTick[] = [];

  for (let visibleIndex = 0; visibleIndex < visibleCount; visibleIndex += 1) {
    const candidateIndex = Math.round(
      (visibleIndex * (candidateCount - 1)) / Math.max(1, visibleCount - 1),
    );
    const isLowerEndpoint = candidateIndex === 0;
    const isUnalignedUpperEndpoint =
      !intervals.alignedUpper && candidateIndex > intervals.regularCount;
    const isAlignedUpperEndpoint =
      intervals.alignedUpper && candidateIndex === intervals.regularCount;

    if (isLowerEndpoint) {
      ticks.push(endpointTick(definition.lowerBound, 0));
      continue;
    }
    if (isUnalignedUpperEndpoint || isAlignedUpperEndpoint) {
      ticks.push(endpointTick(definition.upperBound, 1));
      continue;
    }

    const value = steppedValue(definition.lowerBound, definition.step.value, candidateIndex);
    ticks.push({
      kind: "step",
      label: String(value),
      ratio: sliderRatio(value, definition),
    });
  }

  return {
    density: candidateCount > MAX_VISIBLE_STEP_LABELS ? "sampled" : "all",
    ticks,
  };
}

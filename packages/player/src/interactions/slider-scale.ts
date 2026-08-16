import {
  qtiSliderDiscreteValue,
  qtiSliderRatio,
  snapQtiSliderValue,
  type QtiSliderDefinition,
} from "@longsightgroup/qti3-core";

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

function keyboardDirection(key: string, reverse: boolean): -1 | 1 | undefined {
  if (key === "PageDown") return -1;
  if (key === "PageUp") return 1;
  if (key === "ArrowLeft" || key === "ArrowDown") return reverse ? 1 : -1;
  if (key === "ArrowRight" || key === "ArrowUp") return reverse ? -1 : 1;
  return undefined;
}

function endpointTick(value: number, ratio: number): SliderTick {
  return { kind: "endpoint", label: String(value), ratio };
}

/** Returns the authored value reached by a physical slider navigation key. */
export function sliderKeyboardValue(
  key: string,
  currentValue: number,
  definition: QtiSliderDefinition,
): number | undefined {
  if (key === "Home") return definition.lowerBound;
  if (key === "End") return definition.upperBound;
  const direction = keyboardDirection(key, definition.reverse);
  if (direction === undefined) return undefined;

  const multiplier = key === "PageDown" || key === "PageUp" ? 10 : 1;
  if (definition.step.kind === "continuous") {
    const keyboardStep = (definition.upperBound - definition.lowerBound) / 100;
    return snapQtiSliderValue(currentValue + direction * keyboardStep * multiplier, definition);
  }
  const snapped = snapQtiSliderValue(currentValue, definition);
  if (definition.step.kind === "detachedUpper") {
    const lastRegularValue = qtiSliderDiscreteValue(
      definition,
      definition.step.regularIntervalCount,
    );
    if (direction > 0 && snapped >= lastRegularValue) return definition.upperBound;
    if (direction < 0 && snapped === definition.upperBound) return lastRegularValue;
  }
  return snapQtiSliderValue(snapped + direction * definition.step.value * multiplier, definition);
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

  const regularIntervalCount =
    definition.step.kind === "aligned"
      ? definition.step.intervalCount
      : definition.step.regularIntervalCount;
  const hasDetachedUpper = definition.step.kind === "detachedUpper";
  const candidateCount = regularIntervalCount + 1 + (hasDetachedUpper ? 1 : 0);
  const visibleCount = Math.min(candidateCount, MAX_VISIBLE_STEP_LABELS);
  const ticks: SliderTick[] = [];

  for (let visibleIndex = 0; visibleIndex < visibleCount; visibleIndex += 1) {
    const candidateIndex = Math.round(
      (visibleIndex * (candidateCount - 1)) / Math.max(1, visibleCount - 1),
    );
    const isLowerEndpoint = candidateIndex === 0;
    const isDetachedUpperEndpoint = hasDetachedUpper && candidateIndex > regularIntervalCount;
    const isAlignedUpperEndpoint = !hasDetachedUpper && candidateIndex === regularIntervalCount;

    if (isLowerEndpoint) {
      ticks.push(endpointTick(definition.lowerBound, 0));
      continue;
    }
    if (isDetachedUpperEndpoint || isAlignedUpperEndpoint) {
      ticks.push(endpointTick(definition.upperBound, 1));
      continue;
    }

    const value = qtiSliderDiscreteValue(definition, candidateIndex);
    ticks.push({
      kind: "step",
      label: String(value),
      ratio: qtiSliderRatio(value, definition),
    });
  }

  return {
    density: candidateCount > MAX_VISIBLE_STEP_LABELS ? "sampled" : "all",
    ticks,
  };
}

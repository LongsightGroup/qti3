import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { reportMaximumResponseExceeded } from "../inline-validation.js";
import {
  associationMaximumResponses,
  choiceMatchLimitExceeded,
  choiceMatchMaximum,
  directedPairChoiceUseCount,
} from "../response-limits.js";

export function directedPairKey(source: QtiChoice, target: QtiChoice): string {
  return `${source.identifier} ${target.identifier}`;
}

export function parseDirectedPair(pair: string): [string, string] {
  const [source, target] = pair.split(" ");
  return [source ?? "", target ?? ""];
}

export type TogglePairResult =
  | { accepted: true }
  | { accepted: false; reason: "maximum" | "matchMax" };

export type MatchDirectedPairState = {
  removePair: (pair: string) => void;
  removePairsForSource: (source: QtiChoice) => void;
  removePairsForTarget: (target: QtiChoice) => void;
  togglePair: (source: QtiChoice, target: QtiChoice) => TogglePairResult;
  pairFor: (source: QtiChoice, target: QtiChoice) => string;
};

export type CreateMatchDirectedPairStateOptions = {
  interaction: QtiInteraction;
  update: (value: QtiValue) => void;
  selectedPairs: string[];
  validationHost: HTMLElement;
  onChanged?: () => void;
};

export function createMatchDirectedPairState(
  options: CreateMatchDirectedPairStateOptions,
): MatchDirectedPairState {
  const { interaction, update, selectedPairs, validationHost, onChanged } = options;
  const maximum = associationMaximumResponses(interaction);

  const commit = () => {
    if (interaction.responseCardinality === "single") update(selectedPairs[0] ?? null);
    else update([...selectedPairs]);
  };

  const finishMutation = () => {
    onChanged?.();
    commit();
  };

  const replacePairs = (nextPairs: string[]) => {
    selectedPairs.splice(0, selectedPairs.length, ...nextPairs);
  };

  const pairFor = (source: QtiChoice, target: QtiChoice) => directedPairKey(source, target);

  const removePairFromArray = (pair: string): boolean => {
    const index = selectedPairs.indexOf(pair);
    if (index < 0) return false;
    selectedPairs.splice(index, 1);
    return true;
  };

  const removePair = (pair: string) => {
    if (removePairFromArray(pair)) finishMutation();
  };

  const removePairsForSource = (source: QtiChoice) => {
    let removed = false;
    for (const existing of selectedPairs.filter((pair) =>
      pair.startsWith(`${source.identifier} `),
    )) {
      removePairFromArray(existing);
      removed = true;
    }
    if (removed) finishMutation();
  };

  const removePairsForTarget = (target: QtiChoice) => {
    let removed = false;
    for (const existing of selectedPairs.filter((pair) => pair.endsWith(` ${target.identifier}`))) {
      removePairFromArray(existing);
      removed = true;
    }
    if (removed) finishMutation();
  };

  const togglePair = (source: QtiChoice, target: QtiChoice) => {
    const pair = pairFor(source, target);
    if (selectedPairs.includes(pair)) {
      removePairFromArray(pair);
    } else {
      let nextPairs = interaction.responseCardinality === "single" ? [] : [...selectedPairs];
      if (choiceMatchMaximum(source) === 1) {
        nextPairs = nextPairs.filter((entry) => !entry.startsWith(`${source.identifier} `));
      }
      if (choiceMatchMaximum(target) === 1) {
        nextPairs = nextPairs.filter((entry) => !entry.endsWith(` ${target.identifier}`));
      }
      if (
        maximum !== undefined &&
        nextPairs.length >= maximum &&
        interaction.responseCardinality !== "single"
      ) {
        reportMaximumResponseExceeded(validationHost, interaction, maximum);
        return { accepted: false, reason: "maximum" };
      }
      nextPairs.push(pair);
      if (
        choiceMatchLimitExceeded(source, directedPairChoiceUseCount(source, nextPairs, "either")) ||
        choiceMatchLimitExceeded(target, directedPairChoiceUseCount(target, nextPairs, "either"))
      ) {
        return { accepted: false, reason: "matchMax" };
      }
      replacePairs(nextPairs);
    }
    finishMutation();
    return { accepted: true };
  };

  return {
    removePair,
    removePairsForSource,
    removePairsForTarget,
    togglePair,
    pairFor,
  };
}

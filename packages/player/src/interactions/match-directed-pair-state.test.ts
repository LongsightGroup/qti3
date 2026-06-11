import type { QtiChoice, QtiInteraction } from "@longsightgroup/qti3-core";
import { describe, expect, it, vi } from "vitest";
import { QTI3_INLINE_VALIDATION_EVENT } from "../inline-validation.js";
import { createMatchDirectedPairState } from "./match-directed-pair-state.js";

function choice(identifier: string, matchMax?: string): QtiChoice {
  return {
    identifier,
    text: identifier,
    role: "associableChoice",
    qtiName: "qti-simple-associable-choice",
    attributes: matchMax === undefined ? {} : { "match-max": matchMax },
  };
}

function interaction(overrides: Partial<QtiInteraction> = {}): QtiInteraction {
  return {
    type: "match",
    responseIdentifier: "RESPONSE",
    responseCardinality: "multiple",
    attributes: {},
    ...overrides,
  } as QtiInteraction;
}

function validationHost(): { host: HTMLElement; events: CustomEvent[] } {
  const events: CustomEvent[] = [];
  const host = {
    dispatchEvent(event: Event) {
      events.push(event as CustomEvent);
      return true;
    },
  } as HTMLElement;
  return { host, events };
}

describe("createMatchDirectedPairState", () => {
  it("toggles directed pairs and commits the updated response", () => {
    const selectedPairs: string[] = [];
    const updates: unknown[] = [];
    const onChanged = vi.fn();
    const source = choice("A");
    const target = choice("C");
    const state = createMatchDirectedPairState({
      interaction: interaction(),
      update: (value) => updates.push(value),
      selectedPairs,
      validationHost: validationHost().host,
      onChanged,
    });

    state.togglePair(source, target);

    expect(selectedPairs).toEqual(["A C"]);
    expect(updates).toEqual([["A C"]]);
    expect(onChanged).toHaveBeenCalledTimes(1);

    state.togglePair(source, target);

    expect(selectedPairs).toEqual([]);
    expect(updates).toEqual([["A C"], []]);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("ignores removePair when the pair is not selected", () => {
    const selectedPairs: string[] = [];
    const updates: unknown[] = [];
    const onChanged = vi.fn();
    const state = createMatchDirectedPairState({
      interaction: interaction(),
      update: (value) => updates.push(value),
      selectedPairs,
      validationHost: validationHost().host,
      onChanged,
    });

    state.removePair("A C");

    expect(selectedPairs).toEqual([]);
    expect(updates).toEqual([]);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("replaces an existing source pairing when match-max is one", () => {
    const selectedPairs: string[] = [];
    const updates: unknown[] = [];
    const capulet = choice("C", "1");
    const midsummer = choice("M", "1");
    const romeo = choice("R", "1");
    const state = createMatchDirectedPairState({
      interaction: interaction(),
      update: (value) => updates.push(value),
      selectedPairs,
      validationHost: validationHost().host,
    });

    state.togglePair(capulet, romeo);
    state.togglePair(capulet, midsummer);

    expect(selectedPairs).toEqual(["C M"]);
    expect(updates).toEqual([["C R"], ["C M"]]);
  });

  it("rejects selections beyond authored max-associations without committing", () => {
    const selectedPairs = ["A C"];
    const updates: unknown[] = [];
    const onChanged = vi.fn();
    const { host, events } = validationHost();
    const state = createMatchDirectedPairState({
      interaction: interaction({
        attributes: {
          "max-associations": "1",
          "data-max-selections-message": "Only one match.",
        },
      }),
      update: (value) => updates.push(value),
      selectedPairs,
      validationHost: host,
      onChanged,
    });

    state.togglePair(choice("B"), choice("D"));

    expect(selectedPairs).toEqual(["A C"]);
    expect(updates).toEqual([]);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe(QTI3_INLINE_VALIDATION_EVENT);
    expect(events[0]!.detail).toMatchObject({
      responseIdentifier: "RESPONSE",
      diagnostic: {
        code: "response.maximum",
        message: "Only one match.",
      },
    });
  });

  it("removes all pairings for a source and commits once", () => {
    const selectedPairs = ["A C", "A D"];
    const updates: unknown[] = [];
    const onChanged = vi.fn();
    const state = createMatchDirectedPairState({
      interaction: interaction(),
      update: (value) => updates.push(value),
      selectedPairs,
      validationHost: validationHost().host,
      onChanged,
    });

    state.removePairsForSource(choice("A"));

    expect(selectedPairs).toEqual([]);
    expect(updates).toEqual([[]]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});

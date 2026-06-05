import type { QtiChoice } from "@longsightgroup/qti3-core";
import { describe, expect, it } from "vitest";
import {
  createOrderSlots,
  firstEmptyOrderSlot,
  orderSlotChoiceIdentifiers,
  placeChoiceInOrderSlot,
  removeChoiceFromOrderSlot,
  restoreOrderSlotsFromValue,
  serializeOrderSlots,
  swapOrderSlots,
} from "./order-slots.js";

const choices: QtiChoice[] = [
  {
    identifier: "A",
    text: "First",
    role: "simpleChoice",
    qtiName: "qti-simple-choice",
    attributes: {},
  },
  {
    identifier: "B",
    text: "Second",
    role: "simpleChoice",
    qtiName: "qti-simple-choice",
    attributes: {},
  },
  {
    identifier: "C",
    text: "Third",
    role: "simpleChoice",
    qtiName: "qti-simple-choice",
    attributes: {},
  },
];

function choice(identifier: string): QtiChoice {
  const match = choices.find((entry) => entry.identifier === identifier);
  if (!match) throw new Error(`Missing choice ${identifier}.`);
  return match;
}

describe("order slot state", () => {
  it("restores compact values into prefix slots", () => {
    const slots = restoreOrderSlotsFromValue(choices, ["C", "A"]);
    expect(serializeOrderSlots(slots)).toEqual(["C", "A"]);
    expect(slots[0]?.identifier).toBe("C");
    expect(slots[1]?.identifier).toBe("A");
    expect(slots[2]).toBeUndefined();
  });

  it("serializes session holes out of the wire format", () => {
    const slots = createOrderSlots(3);
    placeChoiceInOrderSlot(slots, choice("A"), 2);
    expect(serializeOrderSlots(slots)).toEqual(["A"]);
    expect(restoreOrderSlotsFromValue(choices, serializeOrderSlots(slots))[0]?.identifier).toBe(
      "A",
    );
  });

  it("places bank choices into empty slots", () => {
    const slots = createOrderSlots(3);
    expect(placeChoiceInOrderSlot(slots, choice("B"), 1)).toBe("from-bank");
    expect(slots[1]?.identifier).toBe("B");
    expect(firstEmptyOrderSlot(slots)).toBe(0);
  });

  it("swaps occupants when moving between occupied slots", () => {
    const slots = createOrderSlots(3);
    placeChoiceInOrderSlot(slots, choice("A"), 0);
    placeChoiceInOrderSlot(slots, choice("C"), 2);
    expect(placeChoiceInOrderSlot(slots, choice("A"), 2)).toBe("swapped");
    expect(slots[0]?.identifier).toBe("C");
    expect(slots[2]?.identifier).toBe("A");
    expect(serializeOrderSlots(slots)).toEqual(["C", "A"]);
  });

  it("returns displaced choices to the bank when dropping from bank onto occupied slots", () => {
    const slots = createOrderSlots(3);
    placeChoiceInOrderSlot(slots, choice("A"), 0);
    expect(placeChoiceInOrderSlot(slots, choice("B"), 0)).toBe("from-bank");
    expect(slots[0]?.identifier).toBe("B");
    expect(orderSlotChoiceIdentifiers(slots)).toEqual(new Set(["B"]));
  });

  it("removes choices and swaps with keyboard-style moves", () => {
    const slots = restoreOrderSlotsFromValue(choices, ["A", "B", "C"]);
    expect(removeChoiceFromOrderSlot(slots, "B")?.identifier).toBe("B");
    expect(slots[1]).toBeUndefined();
    expect(swapOrderSlots(slots, 0, 2)).toBe(true);
    expect(slots[0]?.identifier).toBe("C");
    expect(slots[2]?.identifier).toBe("A");
  });
});

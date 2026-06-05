import type { QtiChoice, QtiValue } from "@longsightgroup/qti3-core";
import { valueToStrings } from "../interaction-support.js";

export type OrderSlotState = Array<QtiChoice | undefined>;

export type OrderSlotPlacement = "noop" | "from-bank" | "swapped";

// QTI ordered responses are dense identifier arrays. Shared-vocabulary order UI uses
// fixed visual slots that may contain temporary holes during a session. Serialization
// compacts occupied slots left-to-right; restore maps compact indices back to slot 0..n-1.
// Labeled slot positions are therefore not round-tripped when holes exist at commit time.

export function createOrderSlots(choiceCount: number): OrderSlotState {
  return Array.from({ length: choiceCount });
}

export function restoreOrderSlotsFromValue(choices: QtiChoice[], value: QtiValue): OrderSlotState {
  const byIdentifier = new Map(choices.map((choice) => [choice.identifier, choice]));
  const slots = createOrderSlots(choices.length);
  const restoredIdentifiers = new Set<string>();
  for (const [index, identifier] of valueToStrings(value).entries()) {
    const choice = byIdentifier.get(identifier);
    if (!choice || restoredIdentifiers.has(choice.identifier)) continue;
    restoredIdentifiers.add(choice.identifier);
    slots[index] = choice;
  }
  return slots;
}

export function serializeOrderSlots(slots: OrderSlotState): string[] {
  return slots.flatMap((choice) => (choice ? [choice.identifier] : []));
}

export function orderSlotChoiceIdentifiers(slots: OrderSlotState): Set<string> {
  const identifiers = new Set<string>();
  for (const choice of slots) {
    if (choice) identifiers.add(choice.identifier);
  }
  return identifiers;
}

export function firstEmptyOrderSlot(slots: OrderSlotState): number {
  const index = slots.findIndex((choice) => choice === undefined);
  return index >= 0 ? index : slots.length;
}

export function placeChoiceInOrderSlot(
  slots: OrderSlotState,
  choice: QtiChoice,
  targetIndex: number,
): OrderSlotPlacement {
  if (targetIndex < 0 || targetIndex >= slots.length) return "noop";
  const from = slots.findIndex((entry) => entry?.identifier === choice.identifier);
  if (from >= 0) {
    if (from === targetIndex) return "noop";
    // Slot-to-slot moves swap with the occupant; an empty target clears the source slot.
    const displaced = slots[targetIndex];
    slots[targetIndex] = choice;
    slots[from] = displaced;
    return "swapped";
  }
  slots[targetIndex] = choice;
  return "from-bank";
}

export function removeChoiceFromOrderSlot(
  slots: OrderSlotState,
  identifier: string,
): QtiChoice | undefined {
  const index = slots.findIndex((entry) => entry?.identifier === identifier);
  const choice = index >= 0 ? slots[index] : undefined;
  if (!choice) return undefined;
  slots[index] = undefined;
  return choice;
}

export function swapOrderSlots(slots: OrderSlotState, from: number, to: number): boolean {
  if (from === to || from < 0 || from >= slots.length || to < 0 || to >= slots.length) {
    return false;
  }
  const choice = slots[from];
  if (!choice) return false;
  slots[from] = slots[to];
  slots[to] = choice;
  return true;
}

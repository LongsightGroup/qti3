import { assertNever } from "@longsightgroup/qti3-core";
import type { QtiInteractionType } from "@longsightgroup/qti3-core";

import { renderQti3AssociateItem, validateQti3AssociateItem } from "./associate.js";
import { renderQti3ChoiceItem, validateQti3ChoiceItem } from "./choice.js";
import {
  renderQti3GraphicAssociateItem,
  validateQti3GraphicAssociateItem,
} from "./graphic-associate.js";
import { renderQti3HotspotItem, validateQti3HotspotItem } from "./hotspot.js";
import { renderQti3MatchItem, validateQti3MatchItem } from "./match.js";
import { renderQti3OrderItem, validateQti3OrderItem } from "./order.js";
import { renderQti3TextEntryItem, validateQti3TextEntryItem } from "./text-entry.js";
import type { Qti3AuthoringItem, Qti3WriterDiagnostic } from "./types.js";

type Qti3WriterInteractionType = Qti3AuthoringItem["interactionType"];

export interface Qti3WriterInteractionDefinition {
  readonly qtiName: string;
  readonly interactionType: Qti3WriterInteractionType;
  readonly tests: readonly string[];
  readonly notes?: string | undefined;
}

export const qti3WriterInteractions: Record<
  Qti3WriterInteractionType,
  Qti3WriterInteractionDefinition
> = {
  choice: {
    qtiName: "qti-choice-interaction",
    interactionType: "choice",
    tests: ["packages/writer/src/choice.test.ts", "packages/writer/src/validation.test.ts"],
  },
  order: {
    qtiName: "qti-order-interaction",
    interactionType: "order",
    tests: ["packages/writer/src/order.test.ts", "packages/writer/src/validation.test.ts"],
  },
  associate: {
    qtiName: "qti-associate-interaction",
    interactionType: "associate",
    tests: ["packages/writer/src/associate.test.ts", "packages/writer/src/validation.test.ts"],
  },
  textEntry: {
    qtiName: "qti-text-entry-interaction",
    interactionType: "textEntry",
    tests: ["packages/writer/src/text-entry.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "The writer validates trusted body fragments contain matching text-entry interactions.",
  },
  match: {
    qtiName: "qti-match-interaction",
    interactionType: "match",
    tests: ["packages/writer/src/match.test.ts", "packages/writer/src/validation.test.ts"],
  },
  hotspot: {
    qtiName: "qti-hotspot-interaction",
    interactionType: "hotspot",
    tests: ["packages/writer/src/hotspot.test.ts", "packages/writer/src/validation.test.ts"],
    notes: "Requires accessible object metadata and referentially valid hotspot choices.",
  },
  graphicAssociate: {
    qtiName: "qti-graphic-associate-interaction",
    interactionType: "graphicAssociate",
    tests: [
      "packages/writer/src/graphic-associate.test.ts",
      "packages/writer/src/validation.test.ts",
    ],
    notes: "Writes and validates object metadata, associable hotspots, and pair responses.",
  },
};

export function validateQti3AuthoringItem(item: Qti3AuthoringItem): Qti3WriterDiagnostic[] {
  switch (item.interactionType) {
    case "choice":
      return validateQti3ChoiceItem(item);
    case "order":
      return validateQti3OrderItem(item);
    case "associate":
      return validateQti3AssociateItem(item);
    case "textEntry":
      return validateQti3TextEntryItem(item);
    case "match":
      return validateQti3MatchItem(item);
    case "hotspot":
      return validateQti3HotspotItem(item);
    case "graphicAssociate":
      return validateQti3GraphicAssociateItem(item);
    default:
      return assertNever(item);
  }
}

export function renderQti3AuthoringItem(item: Qti3AuthoringItem): string {
  switch (item.interactionType) {
    case "choice":
      return renderQti3ChoiceItem(item);
    case "order":
      return renderQti3OrderItem(item);
    case "associate":
      return renderQti3AssociateItem(item);
    case "textEntry":
      return renderQti3TextEntryItem(item);
    case "match":
      return renderQti3MatchItem(item);
    case "hotspot":
      return renderQti3HotspotItem(item);
    case "graphicAssociate":
      return renderQti3GraphicAssociateItem(item);
    default:
      return assertNever(item);
  }
}

export type Qti3WriterInteractionSupport = {
  readonly qtiName: string;
  readonly interactionType: QtiInteractionType;
  readonly writes: true;
  readonly validates: true;
  readonly tests: readonly string[];
  readonly notes?: string | undefined;
};

export const qti3WriterInteractionSupport: readonly Qti3WriterInteractionSupport[] = Object.values(
  qti3WriterInteractions,
).map((interaction) => ({
  qtiName: interaction.qtiName,
  interactionType: interaction.interactionType,
  writes: true as const,
  validates: true as const,
  tests: interaction.tests,
  notes: interaction.notes,
}));

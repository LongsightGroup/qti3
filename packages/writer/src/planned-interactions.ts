import type { QtiInteractionType } from "@longsightgroup/qti3-core";

export type Qti3WriterPlannedInteractionMigration = {
  readonly interactionType: QtiInteractionType;
  readonly qtiName: string;
  readonly priority: number;
  readonly source: "qflow";
  readonly status: "planned";
  readonly notes?: string | undefined;
};

export const qti3WriterPlannedInteractionMigrationOrder: readonly Qti3WriterPlannedInteractionMigration[] =
  [
    {
      priority: 1,
      interactionType: "inlineChoice",
      qtiName: "qti-inline-choice-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 2,
      interactionType: "hottext",
      qtiName: "qti-hottext-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 3,
      interactionType: "gapMatch",
      qtiName: "qti-gap-match-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 4,
      interactionType: "extendedText",
      qtiName: "qti-extended-text-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 5,
      interactionType: "upload",
      qtiName: "qti-upload-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 6,
      interactionType: "media",
      qtiName: "qti-media-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 7,
      interactionType: "graphicOrder",
      qtiName: "qti-graphic-order-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 8,
      interactionType: "graphicGapMatch",
      qtiName: "qti-graphic-gap-match-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 9,
      interactionType: "selectPoint",
      qtiName: "qti-select-point-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 10,
      interactionType: "positionObject",
      qtiName: "qti-position-object-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 11,
      interactionType: "slider",
      qtiName: "qti-slider-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 12,
      interactionType: "custom",
      qtiName: "qti-custom-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 13,
      interactionType: "portableCustom",
      qtiName: "qti-portable-custom-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 14,
      interactionType: "drawing",
      qtiName: "qti-drawing-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 15,
      interactionType: "endAttempt",
      qtiName: "qti-end-attempt-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
  ];

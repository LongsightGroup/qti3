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
      interactionType: "graphicOrder",
      qtiName: "qti-graphic-order-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 2,
      interactionType: "selectPoint",
      qtiName: "qti-select-point-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 3,
      interactionType: "positionObject",
      qtiName: "qti-position-object-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 4,
      interactionType: "slider",
      qtiName: "qti-slider-interaction",
      source: "qflow",
      status: "planned",
    },
    {
      priority: 5,
      interactionType: "custom",
      qtiName: "qti-custom-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 6,
      interactionType: "portableCustom",
      qtiName: "qti-portable-custom-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 7,
      interactionType: "drawing",
      qtiName: "qti-drawing-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 8,
      interactionType: "endAttempt",
      qtiName: "qti-end-attempt-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
  ];

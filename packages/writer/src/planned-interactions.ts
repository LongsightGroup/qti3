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
      interactionType: "portableCustom",
      qtiName: "qti-portable-custom-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 2,
      interactionType: "drawing",
      qtiName: "qti-drawing-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
    {
      priority: 3,
      interactionType: "endAttempt",
      qtiName: "qti-end-attempt-interaction",
      source: "qflow",
      status: "planned",
      notes: "Specialist migration after the common built-in interactions.",
    },
  ];

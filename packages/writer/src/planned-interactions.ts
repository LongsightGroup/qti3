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
  [];

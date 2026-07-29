import type { QtiInteraction, QtiResponseDeclaration } from "@longsightgroup/qti3-core";

import type { Qti12InteractionPolicy } from "../profiles.js";
import type { NormalizedQti3Item } from "../source.js";
import { dispatchQti12Interaction } from "./dispatch.js";
import { qti12Identifier, values } from "./shared.js";
import { isCanvasQti12Dialect, type Qti12MapContext, type Qti12WireDialect } from "./types.js";

export function mapQti12Interaction(
  interaction: QtiInteraction,
  declaration: QtiResponseDeclaration | undefined,
  policy: Qti12InteractionPolicy,
  index: number,
  sourcePath: string | undefined,
  dialect: Qti12WireDialect,
) {
  const identifier = isCanvasQti12Dialect(dialect)
    ? index === 0
      ? "response1"
      : `response${String(index + 1)}`
    : qti12Identifier(interaction.responseIdentifier ?? `RESPONSE_${index + 1}`);
  const correct = values(declaration?.correctResponse ?? null);
  const context: Qti12MapContext = {
    interaction,
    identifier,
    correct,
    policy,
    sourcePath,
    dialect,
    fallbackDiagnostic: (fallback) => ({
      code: `profile.qti12.fallback.${fallback}`,
      severity: "warning",
      message: `Converted ${interaction.type} to a QTI 1.2 ${fallback} representation.`,
      path: sourcePath,
    }),
  };

  return dispatchQti12Interaction(context);
}

export function declarationFor(
  source: NormalizedQti3Item,
  interaction: QtiInteraction,
): QtiResponseDeclaration | undefined {
  return source.item.responseDeclarations.find(
    (declaration) => declaration.identifier === interaction.responseIdentifier,
  );
}

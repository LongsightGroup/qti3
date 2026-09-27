import {
  QTI_RUBRIC_USES,
  QTI_RUBRIC_VIEWS,
  validateQtiRubricFragment,
} from "@longsightgroup/qti3-core";
import { Qti3WriterError, qti3TrustedXmlFragment, type Qti3TrustedXmlFragment } from "./types.js";
import { xmlAttributes } from "./xml.js";

/** Rubric content for bodyHtml/itemBodyHtml, in source order. Scoped resources are unsupported. */
export interface Qti3RubricBlockInput {
  readonly view: readonly (typeof QTI_RUBRIC_VIEWS)[number][];
  readonly use: (typeof QTI_RUBRIC_USES)[number] | `ext:${string}`;
  readonly placement?: "inline" | "discretionary" | undefined;
  readonly content: Qti3TrustedXmlFragment;
}

export function buildQti3RubricBlock(input: Qti3RubricBlockInput): Qti3TrustedXmlFragment {
  const xml = `<qti-rubric-block${xmlAttributes({ view: input.view.join(" "), use: input.use, class: input.placement === "inline" ? "qti-rubric-inline" : input.placement === "discretionary" ? "qti-rubric-discretionary-placement" : undefined })}><qti-content-body>${input.content}</qti-content-body></qti-rubric-block>`;
  const diagnostics = validateQtiRubricFragment(xml)
    .filter((entry) => entry.severity === "error")
    .map((entry) => ({ code: entry.code, message: entry.message, path: entry.path ?? "rubric" }));
  if (diagnostics.length) throw new Qti3WriterError(diagnostics);
  return qti3TrustedXmlFragment(xml);
}

import { parseQtiXml, type QtiAssessmentItem } from "@longsightgroup/qti3-core";
import { writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";

import type {
  Qti3TranscodeItemSource,
  QtiTranscodeDiagnostic,
  QtiTranscodeFailureCode,
} from "./types.js";
export interface NormalizedQti3Item {
  readonly xml: string;
  readonly item: QtiAssessmentItem;
  readonly sourcePath?: string | undefined;
}

export type NormalizeQti3ItemResult =
  | {
      readonly ok: true;
      readonly item: NormalizedQti3Item;
      readonly diagnostics: readonly QtiTranscodeDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly code: QtiTranscodeFailureCode;
      readonly diagnostics: readonly QtiTranscodeDiagnostic[];
    };

export function normalizeQti3Item(source: Qti3TranscodeItemSource): NormalizeQti3ItemResult {
  const rendered =
    source.kind === "authoringItem" ? writeQti3AssessmentItemResult(source.item) : undefined;
  if (rendered && !rendered.ok) {
    return {
      ok: false,
      code: "invalid_source",
      diagnostics: rendered.diagnostics.map((entry) => ({
        code: `source.writer.${entry.code}`,
        severity: "error",
        message: entry.message,
        path: entry.path,
      })),
    };
  }
  const xml = rendered?.xml ?? (source.kind === "xml" ? source.xml : "");
  const parsed = parseQtiXml(xml);
  const diagnostics = parsed.diagnostics.map<QtiTranscodeDiagnostic>((entry) => ({
    code: `source.${entry.code}`,
    severity: entry.severity,
    message: entry.message,
    path: entry.path,
  }));
  if (!parsed.ok || !parsed.document) {
    return {
      ok: false,
      code: "invalid_source",
      diagnostics:
        diagnostics.length > 0
          ? diagnostics
          : [
              {
                code: "source.xml.invalid",
                severity: "error",
                message: "Source assessment item is not well-formed QTI 3 XML.",
                path: source.sourcePath,
              },
            ],
    };
  }
  const interactions = parsed.document.item.interactions;
  if (interactions.length === 0) {
    return {
      ok: false,
      code: "invalid_source",
      diagnostics: [
        ...diagnostics,
        {
          code: "source.interaction.missing",
          severity: "error",
          message: "Source assessment item does not contain an interaction.",
          path: source.sourcePath,
        },
      ],
    };
  }
  return {
    ok: true,
    item: {
      xml,
      item: parsed.document.item,
      sourcePath: source.sourcePath,
    },
    diagnostics,
  };
}

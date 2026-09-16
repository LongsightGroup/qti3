import { migrateQtiToQti3 } from "@longsightgroup/qti3-migrator";
import { transcodeQti3Item } from "@longsightgroup/qti3-transcoder";
import { qti3TrustedXmlFragment, writeQti3AssessmentItemResult } from "@longsightgroup/qti3-writer";

/** Common display shape for the packages' typed diagnostics. */
export interface ConversionDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly path?: string | undefined;
}

/** A conversion outcome; failed operations never carry downloadable XML. */
export type ConversionResult =
  | {
      readonly ok: true;
      readonly xml: string;
      readonly diagnostics: readonly ConversionDiagnostic[];
      readonly report?: string;
    }
  | { readonly ok: false; readonly diagnostics: readonly ConversionDiagnostic[] };

/** Escapes plain prompt text before crossing the writer's trusted XML boundary. */
function promptFragment(text: string) {
  return qti3TrustedXmlFragment(
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  );
}

/** Reads text controls without treating uploaded files as strings. */
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

/** Writes the manual's plain-text choice form through the public writer API. */
export function writeChoice(data: FormData): ConversionResult {
  const text = (name: string) => formText(data, name);
  const result = writeQti3AssessmentItemResult({
    interactionType: "choice",
    identifier: text("identifier"),
    title: text("title"),
    promptHtml: promptFragment(text("prompt")),
    responseCardinality: "single",
    maxChoices: 1,
    choices: ["A", "B", "C"].map((identifier) => ({
      identifier,
      text: text(`choice-${identifier}`),
    })),
    correctResponse: [text("correct")],
  });
  if (result.ok) return result;
  return {
    ok: false,
    diagnostics: result.diagnostics.map((entry) => ({ ...entry, severity: "error" })),
  };
}

/** Converts exactly one legacy item using strict migration and its writer finalization. */
export async function migrateItem(xml: string): Promise<ConversionResult> {
  const migration = await migrateQtiToQti3({ xml, filename: "item.xml" });
  const diagnostics: ConversionDiagnostic[] = [...migration.diagnostics];
  for (const item of migration.items) {
    for (const entry of item.diagnostics) {
      diagnostics.push(
        entry,
        ...(entry.writerDiagnostics ?? []).map(
          (diagnostic): ConversionDiagnostic => ({ ...diagnostic, severity: "error" }),
        ),
      );
    }
  }
  if (migration.items.length !== 1) {
    diagnostics.push({
      code: "demo.single_item_required",
      severity: "error",
      message:
        "This demo accepts one item. Use the package APIs for assessments or multiple items.",
    });
  }
  const item = migration.items[0];
  if (!item?.xml || diagnostics.some((entry) => entry.severity === "error")) {
    return { ok: false, diagnostics };
  }
  return { ok: true, xml: item.xml, diagnostics };
}

/** Transcodes only the standards profiles offered by the manual's target selector. */
export function transcodeItem(xml: string, profile: string): ConversionResult {
  if (
    profile !== "qti12-standard@1" &&
    profile !== "qti21-standard@1" &&
    profile !== "qti22-standard@1"
  ) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "demo.profile_required",
          severity: "error",
          message: "Choose a supported target format.",
        },
      ],
    };
  }
  const result = transcodeQti3Item({ kind: "xml", xml }, { profile });
  if (!result.ok) return result;
  return {
    ok: true,
    xml: result.xml,
    diagnostics: result.diagnostics,
    report: JSON.stringify(result.report, null, 2),
  };
}

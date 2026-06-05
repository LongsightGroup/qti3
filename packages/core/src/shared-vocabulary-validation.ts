import {
  formatSupportedInputWidthClasses,
  isSupportedInputWidthClassName,
  supportedInputWidthClassNames,
} from "./shared-vocabulary.js";
import type { QtiDiagnostic, QtiSourceLocation } from "./types.js";

export interface SharedVocabularyInputWidthValidationOptions {
  classNames: string[];
  subjectQtiName: string;
  path?: string | undefined;
  source?: QtiSourceLocation | undefined;
  conflictCode: string;
  invalidCode: string;
}

export function validateSharedVocabularyInputWidth(
  options: SharedVocabularyInputWidthValidationOptions,
): QtiDiagnostic[] {
  const { classNames, subjectQtiName, path, source, conflictCode, invalidCode } = options;
  const diagnostics: QtiDiagnostic[] = [];
  const supportedWidths = supportedInputWidthClassNames(classNames);
  if (new Set(supportedWidths).size > 1) {
    diagnostics.push({
      code: conflictCode,
      severity: "warning",
      message: `${subjectQtiName} should not include multiple supported qti-input-width-* classes: ${[...new Set(supportedWidths)].join(", ")}. The first class in class attribute order takes precedence at runtime.`,
      path,
      source,
    });
  }

  for (const className of classNames) {
    if (!className.startsWith("qti-input-width-")) continue;
    if (isSupportedInputWidthClassName(className)) continue;
    diagnostics.push({
      code: invalidCode,
      severity: "warning",
      message: `${subjectQtiName} shared vocabulary class ${className} is not supported; expected ${formatSupportedInputWidthClasses()}.`,
      path,
      source,
    });
  }
  return diagnostics;
}

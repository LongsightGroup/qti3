import {
  formatSupportedExtendedTextCounterClasses,
  formatSupportedExtendedTextHeightLinesClasses,
  formatSupportedInputWidthClasses,
  formatSupportedMediaPlayerControlsTokens,
  isSupportedExtendedTextCounterClassName,
  isSupportedExtendedTextHeightLinesClassName,
  isSupportedInputWidthClassName,
  supportedExtendedTextCounterClassNames,
  supportedExtendedTextHeightLinesClassNames,
  supportedInputWidthClassNames,
  unsupportedMediaPlayerControlsTokens,
} from "./shared-vocabulary.js";
import type { QtiDiagnostic, QtiSourceLocation } from "./types.js";

export interface SharedVocabularyNumericPrefixValidationOptions {
  classNames: string[];
  subjectQtiName: string;
  path?: string | undefined;
  source?: QtiSourceLocation | undefined;
  classPrefix: string;
  supportedClassNames: (classNames: string[]) => string[];
  isSupportedClassName: (className: string) => boolean;
  formatSupportedClasses: () => string;
  conflictCode: string;
  invalidCode: string;
}

export function validateSharedVocabularyNumericPrefix(
  options: SharedVocabularyNumericPrefixValidationOptions,
): QtiDiagnostic[] {
  const {
    classNames,
    subjectQtiName,
    path,
    source,
    classPrefix,
    supportedClassNames,
    isSupportedClassName,
    formatSupportedClasses,
    conflictCode,
    invalidCode,
  } = options;
  const diagnostics: QtiDiagnostic[] = [];
  const supported = supportedClassNames(classNames);
  if (new Set(supported).size > 1) {
    diagnostics.push({
      code: conflictCode,
      severity: "warning",
      message: `${subjectQtiName} should not include multiple supported ${classPrefix}* classes: ${[...new Set(supported)].join(", ")}. The first class in class attribute order takes precedence at runtime.`,
      path,
      source,
    });
  }

  for (const className of classNames) {
    if (!className.startsWith(classPrefix)) continue;
    if (isSupportedClassName(className)) continue;
    diagnostics.push({
      code: invalidCode,
      severity: "warning",
      message: `${subjectQtiName} shared vocabulary class ${className} is not supported; expected ${formatSupportedClasses()}.`,
      path,
      source,
    });
  }
  return diagnostics;
}

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
  return validateSharedVocabularyNumericPrefix({
    classNames,
    subjectQtiName,
    path,
    source,
    classPrefix: "qti-input-width-",
    supportedClassNames: supportedInputWidthClassNames,
    isSupportedClassName: isSupportedInputWidthClassName,
    formatSupportedClasses: formatSupportedInputWidthClasses,
    conflictCode,
    invalidCode,
  });
}

export interface SharedVocabularyExtendedTextValidationOptions {
  classNames: string[];
  subjectQtiName: string;
  path?: string | undefined;
  source?: QtiSourceLocation | undefined;
}

export function validateSharedVocabularyExtendedTextHeightLines(
  options: SharedVocabularyExtendedTextValidationOptions,
): QtiDiagnostic[] {
  const { classNames, subjectQtiName, path, source } = options;
  return validateSharedVocabularyNumericPrefix({
    classNames,
    subjectQtiName,
    path,
    source,
    classPrefix: "qti-height-lines-",
    supportedClassNames: supportedExtendedTextHeightLinesClassNames,
    isSupportedClassName: isSupportedExtendedTextHeightLinesClassName,
    formatSupportedClasses: formatSupportedExtendedTextHeightLinesClasses,
    conflictCode: "interaction.sharedVocabulary.extendedTextHeightLinesConflict",
    invalidCode: "interaction.sharedVocabulary.extendedTextHeightLinesInvalid",
  });
}

export function validateSharedVocabularyExtendedTextCounter(
  options: SharedVocabularyExtendedTextValidationOptions,
): QtiDiagnostic[] {
  const { classNames, subjectQtiName, path, source } = options;
  const diagnostics: QtiDiagnostic[] = [];
  const counterClasses = supportedExtendedTextCounterClassNames(classNames);
  if (new Set(counterClasses).size > 1) {
    diagnostics.push({
      code: "interaction.sharedVocabulary.extendedTextCounterConflict",
      severity: "warning",
      message: `${subjectQtiName} should not include multiple qti-counter-* classes: ${[...new Set(counterClasses)].join(", ")}. The first class in class attribute order takes precedence at runtime.`,
      path,
      source,
    });
  }

  for (const className of classNames) {
    if (!className.startsWith("qti-counter-")) continue;
    if (isSupportedExtendedTextCounterClassName(className)) continue;
    diagnostics.push({
      code: "interaction.sharedVocabulary.extendedTextCounterInvalid",
      severity: "warning",
      message: `${subjectQtiName} shared vocabulary class ${className} is not supported; expected ${formatSupportedExtendedTextCounterClasses()}.`,
      path,
      source,
    });
  }
  return diagnostics;
}

export function validateSharedVocabularyExtendedText(
  options: SharedVocabularyExtendedTextValidationOptions,
): QtiDiagnostic[] {
  return [
    ...validateSharedVocabularyExtendedTextHeightLines(options),
    ...validateSharedVocabularyExtendedTextCounter(options),
  ];
}

export interface SharedVocabularyMediaPlayerControlsValidationOptions {
  value: string | undefined;
  subjectQtiName: string;
  path?: string | undefined;
  source?: QtiSourceLocation | undefined;
}

export function validateSharedVocabularyMediaPlayerControls(
  options: SharedVocabularyMediaPlayerControlsValidationOptions,
): QtiDiagnostic[] {
  const unsupported = unsupportedMediaPlayerControlsTokens(options.value);
  if (unsupported.length === 0) return [];
  return [
    {
      code: "interaction.sharedVocabulary.mediaPlayerControlsInvalid",
      severity: "warning",
      message: `${options.subjectQtiName} data-qti-media-player-controls token ${[...new Set(unsupported)].join(", ")} is not supported; expected ${formatSupportedMediaPlayerControlsTokens()}.`,
      path: options.path,
      source: options.source,
    },
  ];
}

import { assertQtiIdentifier } from "./identifier.js";
import {
  classAttribute,
  validateCustomFamilyResponseDeclaration,
  validateXmlAttributeName,
} from "./custom-interaction-common.js";
import {
  duplicateDiagnostics,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import {
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { trustedResponseProcessingXml } from "./response-processing.js";
import { assessmentItemShell } from "./shell.js";
import type {
  Qti3PortableCustomBuilderInput,
  Qti3PortableCustomInteractionModules,
  Qti3WriterDiagnostic,
} from "./types.js";
import { indentXml, xmlAttributeList, xmlEscape, xmlLines } from "./xml.js";

export function buildQti3PortableCustomItem(input: Qti3PortableCustomBuilderInput): string {
  const diagnostics = validateQti3PortableCustomItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3PortableCustomItem(input);
}

export function renderQti3PortableCustomItem(input: Qti3PortableCustomBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Portable custom response identifier",
  );
  const escapedResponseIdentifier = xmlEscape(responseIdentifier);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="${
    input.responseCardinality ?? "single"
  }" base-type="${input.responseBaseType ?? "string"}"/>`;
  const interactionAttrs = portableCustomAttributes(input, escapedResponseIdentifier);
  const promptSection = optionalPromptSection(input.promptHtml);
  const bodyXml = xmlLines([
    optionalBodySection(input.bodyHtml).trimEnd(),
    `    <qti-portable-custom-interaction ${interactionAttrs}>`,
    promptSection.trimEnd(),
    interactionModulesXml(input.interactionModules),
    interactionMarkupXml(input.interactionMarkupHtml),
    `    </qti-portable-custom-interaction>`,
  ]);

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: trustedResponseProcessingXml(input.responseProcessingXml),
    scoreDefaultZero: true,
  });
}

export function validateQti3PortableCustomItem(
  input: Qti3PortableCustomBuilderInput,
): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Portable custom response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);
  validateCustomFamilyResponseDeclaration(
    {
      responseBaseType: input.responseBaseType,
      responseCardinality: input.responseCardinality,
      codePrefix: "portable_custom",
      label: "Portable custom interaction",
    },
    diagnostics,
  );
  validateTypeIdentifier(input, diagnostics);
  validateModuleReference(input, diagnostics);
  validateDataAttributes(input, diagnostics);
  return diagnostics;
}

function portableCustomAttributes(
  input: Qti3PortableCustomBuilderInput,
  escapedResponseIdentifier: string,
): string {
  return xmlAttributeList([
    `response-identifier="${escapedResponseIdentifier}"`,
    `custom-interaction-type-identifier="${xmlEscape(
      input.customInteractionTypeIdentifier.trim(),
    )}"`,
    input.module?.trim()
      ? `module="${xmlEscape(assertQtiIdentifier(input.module, "Portable custom module"))}"`
      : "",
    classAttribute(input.classNames ?? []),
    input.label?.trim() ? `label="${xmlEscape(input.label.trim())}"` : "",
    ...(input.dataAttributes ?? []).map(
      (attribute) => `${attribute.name.trim()}="${xmlEscape(attribute.value.trim())}"`,
    ),
  ]);
}

function interactionModulesXml(
  interactionModules: Qti3PortableCustomInteractionModules | undefined,
): string {
  if (!interactionModules) return "";
  if (
    !interactionModules.modules.length &&
    !interactionModules.primaryConfiguration?.trim() &&
    !interactionModules.secondaryConfiguration?.trim()
  ) {
    return "";
  }
  const attrs = xmlAttributeList([
    interactionModules.primaryConfiguration?.trim()
      ? `primary-configuration="${xmlEscape(interactionModules.primaryConfiguration.trim())}"`
      : "",
    interactionModules.secondaryConfiguration?.trim()
      ? `secondary-configuration="${xmlEscape(interactionModules.secondaryConfiguration.trim())}"`
      : "",
  ]);
  const attrsText = attrs ? ` ${attrs}` : "";
  const modulesXml = interactionModules.modules
    .map((module) => {
      const id = xmlEscape(assertQtiIdentifier(module.id, "Portable custom interaction module id"));
      const primaryPath = module.primaryPath?.trim()
        ? ` primary-path="${xmlEscape(module.primaryPath.trim())}"`
        : "";
      const fallbackPath = module.fallbackPath?.trim()
        ? ` fallback-path="${xmlEscape(module.fallbackPath.trim())}"`
        : "";
      return `        <qti-interaction-module id="${id}"${primaryPath}${fallbackPath}/>`;
    })
    .join("\n");
  return `      <qti-interaction-modules${attrsText}>
${modulesXml}
      </qti-interaction-modules>`;
}

function interactionMarkupXml(markup: string | undefined): string {
  const body = markup?.trim() ? `\n${indentXml(markup.trim(), 8)}\n      ` : "";
  return `      <qti-interaction-markup>${body}</qti-interaction-markup>`;
}

function validateTypeIdentifier(
  input: Qti3PortableCustomBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.customInteractionTypeIdentifier.trim()) return;
  diagnostics.push(
    writerDiagnostic(
      "missing_portable_custom_type_identifier",
      "customInteractionTypeIdentifier",
      "Portable custom interaction type identifier is required.",
    ),
  );
}

function validateModuleReference(
  input: Qti3PortableCustomBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.module?.trim()) {
    const moduleDiagnostic = validateQtiIdentifier(
      "module",
      "Portable custom module",
      input.module,
    );
    if (moduleDiagnostic) diagnostics.push(moduleDiagnostic);
  }

  const modules = input.interactionModules?.modules ?? [];
  if (!input.module?.trim() && !modules.length) {
    diagnostics.push(
      writerDiagnostic(
        "missing_portable_custom_module",
        "module|interactionModules.modules",
        "Portable custom interaction requires a module attribute or at least one interaction module.",
      ),
    );
  }
  if (
    input.interactionModules &&
    !modules.length &&
    (input.interactionModules.primaryConfiguration?.trim() ||
      input.interactionModules.secondaryConfiguration?.trim())
  ) {
    diagnostics.push(
      writerDiagnostic(
        "missing_portable_custom_modules",
        "interactionModules.modules",
        "Portable custom module configuration requires at least one interaction module.",
      ),
    );
  }
  diagnostics.push(
    ...duplicateDiagnostics(
      modules.map((module) => module.id),
      "interactionModules.modules",
      "Portable custom interaction module id",
    ),
  );
  for (const [index, module] of modules.entries()) {
    const id = module.id.trim();
    if (!id) {
      diagnostics.push(
        writerDiagnostic(
          "missing_portable_custom_module_id",
          `interactionModules.modules.${index}.id`,
          "Portable custom interaction modules require an id.",
        ),
      );
      continue;
    }
    const moduleDiagnostic = validateQtiIdentifier(
      `interactionModules.modules.${index}.id`,
      "Portable custom interaction module id",
      id,
    );
    if (moduleDiagnostic) diagnostics.push(moduleDiagnostic);
  }
}

function validateDataAttributes(
  input: Qti3PortableCustomBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  diagnostics.push(
    ...duplicateDiagnostics(
      (input.dataAttributes ?? []).map((attribute) => attribute.name),
      "dataAttributes",
      "Portable custom data attribute",
    ),
  );
  for (const [index, attribute] of (input.dataAttributes ?? []).entries()) {
    const name = attribute.name.trim();
    if (!name) {
      diagnostics.push(
        writerDiagnostic(
          "missing_portable_custom_data_attribute_name",
          `dataAttributes.${index}.name`,
          "Portable custom data attribute names must not be empty.",
        ),
      );
      continue;
    }
    validateXmlAttributeName(
      name,
      `dataAttributes.${index}.name`,
      "invalid_portable_custom_data_attribute_name",
      "Portable custom data attribute",
      diagnostics,
    );
    if (!name.startsWith("data-")) {
      diagnostics.push(
        writerDiagnostic(
          "invalid_portable_custom_data_attribute_prefix",
          `dataAttributes.${index}.name`,
          `Portable custom data attribute "${name}" must start with "data-".`,
          name,
        ),
      );
    }
  }
}

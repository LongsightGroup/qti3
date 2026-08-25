#!/usr/bin/env node
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { inflateRawSync } from "node:zlib";
import {
  accessibilityProofMatrix,
  manualAssistiveTechnologyScripts,
} from "@longsightgroup/qti3-a11y";
import {
  basicItemPlayerProfile,
  runBasicItemPlayerReadiness,
  runQti3BasicImportItemOnlyCertification,
  runQti3BasicImportTestCertification,
  runFixture,
  type QtiBasicItemPlayerPackageEvidence,
} from "@longsightgroup/qti3-conformance";
import {
  createItemSession,
  decodeUtf8,
  deprecatedInteractionSupport,
  elementSupport,
  interactionSupport,
  itemMetadataSupport,
  isQtiValue,
  normalizePackagePath,
  parseQtiPackageXmlTree,
  parseQtiXml,
  prepareQtiDeliveryXml,
  processingSupport,
  readQtiPackageZipEntries,
  scoreQtiItemServerSide,
  isEnforcedSharedVocabularyLevel,
  sharedVocabularyClassSupport,
  validateAssessmentItem,
  type QtiPackageXmlNode,
  type QtiDiagnostic,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { canonicalFixtures } from "@longsightgroup/qti3-fixtures";

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

interface PackageXmlFile {
  path: string;
  xml: string;
  root: QtiPackageXmlNode | undefined;
  errors: string[];
}

const SCORE_USAGE = "Usage: qti3 score <item.xml> --responses <responses.json>";
const PREPARE_DELIVERY_USAGE =
  "Usage: qti3 prepare-delivery <item.xml> [--mode static|server-materialized-adaptive] [--state <state.json>] [--out <candidate.xml>]";

export async function main(args = process.argv.slice(2)): Promise<number> {
  const [command, file] = args;
  if (command === "certification" && file === "import-basic-items") {
    const options = parseCertificationImportBasicItemsArgs(args.slice(2));
    if (!options.ok) {
      console.error(options.message);
      return 1;
    }
    const report = await runQti3BasicImportItemOnlyCertification({
      qtiRoot: options.qtiRoot,
      validatorReport: options.validatorReport,
    });
    console.log(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  }
  if (command === "certification" && file === "import-basic-tests") {
    const options = parseCertificationImportBasicTestsArgs(args.slice(2));
    if (!options.ok) {
      console.error(options.message);
      return 1;
    }
    const report = await runQti3BasicImportTestCertification({
      qtiRoot: options.qtiRoot,
    });
    console.log(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  }

  if (command === "parse" && file) {
    const xml = await readFile(file, "utf8");
    const result = parseQtiXml(xml);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "parse-dir" && file) {
    const report = await parseDirectory(file);
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "validate" && file) {
    const result = await validateFile(file);
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "validate-dir" && file) {
    const report = await validateDirectory(file);
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "score-correct" && file) {
    const result = await scoreCorrectFile(file);
    console.log(JSON.stringify(result, null, 2));
    return result.ok && (!result.scorable || result.scorePositive) ? 0 : 1;
  }

  if (command === "score-correct-dir" && file) {
    const report = await scoreCorrectDirectory(file);
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "score") {
    return scoreFile(args.slice(1));
  }

  if (command === "prepare-delivery") {
    return prepareDeliveryFile(args.slice(1));
  }

  if (command === "inspect-package" && file) {
    const report = await inspectPackageSafely(file, { strict: false });
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "validate-package" && file) {
    const report = await inspectPackageSafely(file, { strict: true });
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "basic-item-player-report") {
    const report = await basicItemPlayerReport(args.slice(1));
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "write-fixtures" && file) {
    await mkdir(file, { recursive: true });
    const written: string[] = [];
    for (const fixture of canonicalFixtures) {
      const filename = `${fixture.id}.xml`;
      const path = join(file, filename);
      await writeFile(path, `${fixture.xml}\n`, "utf8");
      written.push(path);
    }
    console.log(JSON.stringify({ written: written.length, files: written }, null, 2));
    return 0;
  }

  if (command === "support-matrix") {
    console.log(
      JSON.stringify(
        {
          target: "QTI 3.0.1 ASI item profile",
          sharedVocabularyClasses: sharedVocabularyClassSupport,
          elements: elementSupport,
          interactions: [...interactionSupport, ...deprecatedInteractionSupport],
          processing: processingSupport,
          itemMetadata: itemMetadataSupport,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (command === "a11y-proof") {
    console.log(
      JSON.stringify(
        {
          target: "QTI 3.0.1 ASI item interaction accessibility proof",
          interactions: accessibilityProofMatrix,
          manualAssistiveTechnologyScripts,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (command === "assert-support") {
    const report = assertSupportMatrix();
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  if (command === "run-fixtures") {
    const report = runCanonicalFixtures();
    console.log(JSON.stringify(report, null, 2));
    return report.failed === 0 ? 0 : 1;
  }

  console.log(
    "Usage: qti3 parse <item.xml> | qti3 parse-dir <directory> | qti3 validate <item.xml> | qti3 validate-dir <directory> | qti3 score <item.xml> --responses <responses.json> | qti3 score-correct <item.xml> | qti3 score-correct-dir <directory> | qti3 prepare-delivery <item.xml> [--mode static|server-materialized-adaptive] [--state <state.json>] [--out <candidate.xml>] | qti3 inspect-package <package.zip|directory> | qti3 validate-package <package.zip|directory> | qti3 basic-item-player-report [package.zip|directory ...] | qti3 certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <validator-report.json>] | qti3 certification import-basic-tests --qti-root <qti-conformance/qti3.0> | qti3 write-fixtures <directory> | qti3 support-matrix | qti3 a11y-proof | qti3 assert-support | qti3 run-fixtures",
  );
  return 1;
}

interface ScoreCommandOptions {
  itemFile: string;
  responsesFile: string;
}

type PrepareDeliveryCommandOptions =
  | {
      itemFile: string;
      mode: "static";
      outputFile?: string | undefined;
    }
  | {
      itemFile: string;
      mode: "server-materialized-adaptive";
      stateFile: string;
      outputFile?: string | undefined;
    };

type CommandOptionsResult<T> =
  | { readonly ok: true; readonly options: T }
  | { readonly ok: false; readonly message: string };

function parseScoreArgs(args: string[]): CommandOptionsResult<ScoreCommandOptions> {
  const [itemFile, ...flags] = args;
  if (itemFile === undefined || itemFile.length === 0 || itemFile.startsWith("--")) {
    return { ok: false, message: SCORE_USAGE };
  }

  let responsesFile: string | undefined;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (
      flag !== "--responses" ||
      value === undefined ||
      value.length === 0 ||
      value.startsWith("--") ||
      responsesFile !== undefined
    ) {
      return { ok: false, message: SCORE_USAGE };
    }
    responsesFile = value;
    index += 1;
  }

  return responsesFile === undefined
    ? { ok: false, message: SCORE_USAGE }
    : { ok: true, options: { itemFile, responsesFile } };
}

function parsePrepareDeliveryArgs(
  args: string[],
): CommandOptionsResult<PrepareDeliveryCommandOptions> {
  const [itemFile, ...flags] = args;
  if (itemFile === undefined || itemFile.length === 0 || itemFile.startsWith("--")) {
    return { ok: false, message: PREPARE_DELIVERY_USAGE };
  }

  let mode: PrepareDeliveryCommandOptions["mode"] = "static";
  let modeSeen = false;
  let stateFile: string | undefined;
  let outputFile: string | undefined;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith("--")) {
      return { ok: false, message: PREPARE_DELIVERY_USAGE };
    }
    if (flag === "--mode" && !modeSeen) {
      if (value !== "static" && value !== "server-materialized-adaptive") {
        return { ok: false, message: PREPARE_DELIVERY_USAGE };
      }
      mode = value;
      modeSeen = true;
    } else if (flag === "--state" && stateFile === undefined) {
      stateFile = value;
    } else if (flag === "--out" && outputFile === undefined) {
      outputFile = value;
    } else {
      return { ok: false, message: PREPARE_DELIVERY_USAGE };
    }
    index += 1;
  }

  if (mode === "static") {
    return stateFile === undefined
      ? { ok: true, options: { itemFile, mode, outputFile } }
      : { ok: false, message: PREPARE_DELIVERY_USAGE };
  }
  if (stateFile === undefined) {
    return { ok: false, message: PREPARE_DELIVERY_USAGE };
  }
  return { ok: true, options: { itemFile, mode, stateFile, outputFile } };
}

async function scoreFile(args: string[]): Promise<number> {
  const parsed = parseScoreArgs(args);
  if (!parsed.ok) {
    console.error(parsed.message);
    return 1;
  }

  const itemXml = await readTextInput(parsed.options.itemFile, "QTI item");
  if (!itemXml.ok) {
    console.error(itemXml.message);
    return 1;
  }
  const responses = await readJsonObject(parsed.options.responsesFile, "Responses");
  if (!responses.ok) {
    console.error(responses.message);
    return 1;
  }

  const result = scoreQtiItemServerSide({
    itemXml: itemXml.value,
    trustedResponses: responses.value,
  });
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

async function prepareDeliveryFile(args: string[]): Promise<number> {
  const parsed = parsePrepareDeliveryArgs(args);
  if (!parsed.ok) {
    console.error(parsed.message);
    return 1;
  }

  const itemXml = await readTextInput(parsed.options.itemFile, "QTI item");
  if (!itemXml.ok) {
    console.error(itemXml.message);
    return 1;
  }

  const prepared =
    parsed.options.mode === "static"
      ? { ok: true as const, value: prepareQtiDeliveryXml(itemXml.value, { mode: "static" }) }
      : await prepareAdaptiveDelivery(itemXml.value, parsed.options.stateFile);
  if (!prepared.ok) {
    console.error(prepared.message);
    return 1;
  }
  const result = prepared.value;

  if (parsed.options.outputFile === undefined) {
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  const { candidateSafeXml: _candidateSafeXml, ...summary } = result;
  if (!result.ok || result.candidateSafeXml === undefined) {
    console.log(JSON.stringify(summary, null, 2));
    return 1;
  }
  try {
    await writeFile(parsed.options.outputFile, result.candidateSafeXml, "utf8");
  } catch (error) {
    console.error(
      fileErrorMessage("Candidate XML output", parsed.options.outputFile, "write", error),
    );
    return 1;
  }
  console.log(JSON.stringify({ ...summary, outputFile: parsed.options.outputFile }, null, 2));
  return 0;
}

async function prepareAdaptiveDelivery(
  itemXml: string,
  stateFile: string,
): Promise<
  | { readonly ok: true; readonly value: ReturnType<typeof prepareQtiDeliveryXml> }
  | { readonly ok: false; readonly message: string }
> {
  const state = await readJsonObject(stateFile, "Adaptive delivery state");
  if (!state.ok) return state;
  const keys = Object.keys(state.value);
  if (keys.some((key) => key !== "outcomes" && key !== "templateValues")) {
    return {
      ok: false,
      message: `Adaptive delivery state file "${stateFile}" may contain only outcomes and templateValues.`,
    };
  }
  const outcomes = readQtiValueRecord(state.value.outcomes);
  if (outcomes === undefined) {
    return {
      ok: false,
      message: `Adaptive delivery state file "${stateFile}" must contain an outcomes object of QTI values.`,
    };
  }
  const templateValues =
    state.value.templateValues === undefined
      ? undefined
      : readQtiValueRecord(state.value.templateValues);
  if (state.value.templateValues !== undefined && templateValues === undefined) {
    return {
      ok: false,
      message: `Adaptive delivery state file "${stateFile}" templateValues must be an object of QTI values.`,
    };
  }
  return {
    ok: true,
    value: prepareQtiDeliveryXml(itemXml, {
      mode: "server-materialized-adaptive",
      outcomes,
      ...(templateValues === undefined ? {} : { templateValues }),
    }),
  };
}

function readQtiValueRecord(value: unknown): Record<string, QtiValue> | undefined {
  if (!isJsonObject(value)) return undefined;
  const result: Record<string, QtiValue> = {};
  for (const [identifier, entry] of Object.entries(value)) {
    if (!isQtiValue(entry)) return undefined;
    result[identifier] = entry;
  }
  return result;
}

async function readJsonObject(
  file: string,
  label: string,
): Promise<
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly message: string }
> {
  const text = await readTextInput(file, `${label} JSON`);
  if (!text.ok) return text;
  let value: unknown;
  try {
    value = JSON.parse(text.value);
  } catch {
    return { ok: false, message: `${label} file "${file}" is not valid JSON.` };
  }
  return isJsonObject(value)
    ? { ok: true, value }
    : { ok: false, message: `${label} file "${file}" must contain a JSON object.` };
}

async function readTextInput(
  file: string,
  label: string,
): Promise<
  { readonly ok: true; readonly value: string } | { readonly ok: false; readonly message: string }
> {
  try {
    return { ok: true, value: await readFile(file, "utf8") };
  } catch (error) {
    return { ok: false, message: fileErrorMessage(label, file, "read", error) };
  }
}

function fileErrorMessage(
  label: string,
  file: string,
  action: "read" | "write",
  error: unknown,
): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${label} file "${file}" could not be ${action}: ${detail}`;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCertificationImportBasicItemsArgs(
  args: string[],
):
  | { readonly ok: true; readonly qtiRoot: string; readonly validatorReport?: string | undefined }
  | { readonly ok: false; readonly message: string } {
  let qtiRoot: string | undefined;
  let validatorReport: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "--qti-root" && value !== undefined) {
      qtiRoot = value;
      index += 1;
      continue;
    }
    if (arg === "--validator-report" && value !== undefined) {
      validatorReport = value;
      index += 1;
      continue;
    }
    return {
      ok: false,
      message:
        "Usage: qti3 certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <validator-report.json>]",
    };
  }

  if (qtiRoot === undefined) {
    return {
      ok: false,
      message:
        "Usage: qti3 certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <validator-report.json>]",
    };
  }

  return { ok: true, qtiRoot, validatorReport };
}

function parseCertificationImportBasicTestsArgs(
  args: string[],
):
  | { readonly ok: true; readonly qtiRoot: string }
  | { readonly ok: false; readonly message: string } {
  let qtiRoot: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "--qti-root" && value !== undefined) {
      qtiRoot = value;
      index += 1;
      continue;
    }
    return {
      ok: false,
      message: "Usage: qti3 certification import-basic-tests --qti-root <qti-conformance/qti3.0>",
    };
  }

  if (qtiRoot === undefined) {
    return {
      ok: false,
      message: "Usage: qti3 certification import-basic-tests --qti-root <qti-conformance/qti3.0>",
    };
  }

  return { ok: true, qtiRoot };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}

function assertSupportMatrix(): {
  checked: number;
  failed: number;
  failures: string[];
} {
  const failures: string[] = [];
  const requiredInteractionTests = [
    "packages/fixtures/src/fixtures.test.ts",
    "packages/conformance/src/conformance.test.ts",
    "packages/a11y/src/a11y.test.ts",
    "tests/browser/player-interaction-sweep.spec.ts",
  ];

  for (const support of interactionSupport) {
    if (support.support !== "supported") {
      failures.push(`${support.qtiName} must be supported.`);
    }
    for (const flag of ["parse", "validate", "render", "process"] as const) {
      if (!support[flag]) failures.push(`${support.qtiName} must have ${flag}=true.`);
    }
    if (support.fixtures.length === 0) {
      failures.push(`${support.qtiName} must have a reference fixture.`);
    }
    for (const test of requiredInteractionTests) {
      if (!support.tests.includes(test)) {
        failures.push(`${support.qtiName} is missing evidence test ${test}.`);
      }
    }
  }

  for (const support of deprecatedInteractionSupport) {
    if (support.support !== "deprecated") {
      failures.push(`${support.qtiName} must remain explicitly deprecated.`);
    }
    if (!support.notes) failures.push(`${support.qtiName} must explain its deprecated status.`);
  }

  for (const support of processingSupport) {
    if (support.support !== "supported") {
      failures.push(`${support.qtiName} processing entry must be supported.`);
    }
    if (!support.parse || !support.validate || !support.process) {
      failures.push(`${support.qtiName} processing entry must parse, validate, and process.`);
    }
    if (support.render) failures.push(`${support.qtiName} processing entry must not render.`);
    if (support.tests.length === 0) {
      failures.push(`${support.qtiName} processing entry must have test evidence.`);
    }
  }

  for (const support of itemMetadataSupport) {
    if (!support.notes) {
      failures.push(`${support.qtiName} item metadata entry must document its support scope.`);
    }
    if (support.tests.length === 0) {
      failures.push(`${support.qtiName} item metadata entry must have test evidence.`);
    }
    if (support.support === "parsed" && (!support.parse || !support.validate)) {
      failures.push(`${support.qtiName} parsed item metadata entry must parse and validate.`);
    }
    if (support.support === "parsed" && (support.render || support.process)) {
      failures.push(`${support.qtiName} parsed item metadata entry must not render or process.`);
    }
    if (support.support === "unsupported" && support.parse) {
      failures.push(
        `${support.qtiName} unsupported item metadata entry must not claim parse support.`,
      );
    }
  }

  for (const support of sharedVocabularyClassSupport) {
    if (isEnforcedSharedVocabularyLevel(support.level) && (support.tests?.length ?? 0) === 0) {
      failures.push(`${support.className} shared vocabulary entry must have test evidence.`);
    }
  }

  return {
    checked: elementSupport.length + sharedVocabularyClassSupport.length,
    failed: failures.length,
    failures,
  };
}

async function findXmlFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await findXmlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".xml")) files.push(path);
  }
  return files;
}

function runCanonicalFixtures(): {
  checked: number;
  failed: number;
  results: ReturnType<typeof runFixture>[];
} {
  const results = canonicalFixtures.map(runFixture);
  return {
    checked: results.length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}

async function parseDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: {
    file: string;
    ok: boolean;
    diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
    interactions: string[];
  }[];
}> {
  const files = await findXmlFiles(root);
  const results = [];
  let failed = 0;
  for (const xmlFile of files) {
    const xml = await readFile(xmlFile, "utf8");
    if (!xml.includes("qti-assessment-item")) continue;
    const result = parseQtiXml(xml);
    if (!result.ok) failed += 1;
    results.push({
      file: xmlFile,
      ok: result.ok,
      diagnostics: result.diagnostics,
      interactions:
        result.document?.item.interactions.map((interaction) => interaction.qtiName) ?? [],
    });
  }
  return { checked: results.length, failed, results };
}

async function validateDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: Awaited<ReturnType<typeof validateFile>>[];
}> {
  const files = await findXmlFiles(root);
  const results = [];
  let failed = 0;
  for (const xmlFile of files) {
    const xml = await readFile(xmlFile, "utf8");
    if (!xml.includes("qti-assessment-item")) continue;
    const result = await validateFile(xmlFile);
    if (!result.ok) failed += 1;
    results.push(result);
  }
  return { checked: results.length, failed, results };
}

async function validateFile(file: string): Promise<{
  file: string;
  ok: boolean;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
}> {
  const xml = await readFile(file, "utf8");
  const result = parseQtiXml(xml);
  if (!result.document) {
    return { file, ok: false, diagnostics: result.diagnostics };
  }
  const validation = validateAssessmentItem(result.document);
  const diagnostics = uniqueDiagnostics([...result.diagnostics, ...validation.diagnostics]);
  return {
    file,
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    diagnostics,
  };
}

function uniqueDiagnostics(
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"],
): ReturnType<typeof parseQtiXml>["diagnostics"] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}\n${diagnostic.severity}\n${diagnostic.message}\n${diagnostic.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scoreCorrectDirectory(root: string): Promise<{
  checked: number;
  failed: number;
  results: Awaited<ReturnType<typeof scoreCorrectFile>>[];
}> {
  const files = await findXmlFiles(root);
  const results = [];
  let failed = 0;
  for (const xmlFile of files) {
    const xml = await readFile(xmlFile, "utf8");
    if (!xml.includes("qti-assessment-item")) continue;
    const result = await scoreCorrectFile(xmlFile);
    if (!result.ok || (result.scorable && !result.scorePositive)) failed += 1;
    results.push(result);
  }
  return { checked: results.length, failed, results };
}

async function scoreCorrectFile(file: string): Promise<{
  file: string;
  ok: boolean;
  scorable: boolean;
  scorePositive: boolean;
  outcomes: Record<string, QtiValue>;
  diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
}> {
  const xml = await readFile(file, "utf8");
  const result = parseQtiXml(xml);
  if (!result.document || !result.ok) {
    return {
      file,
      ok: false,
      scorable: false,
      scorePositive: false,
      outcomes: {},
      diagnostics: result.diagnostics,
    };
  }

  const session = createItemSession(result.document);
  let scorable = false;
  const correctResponses = session.correctResponses();
  for (const declaration of result.document.item.responseDeclarations) {
    const correctResponse = correctResponses[declaration.identifier] ?? null;
    if (correctResponse !== null) {
      scorable = true;
      session.respond(declaration.identifier, correctResponse);
    }
  }
  const scored = session.score();
  return {
    file,
    ok: scored.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    scorable,
    scorePositive: typeof scored.outcomes.SCORE === "number" && scored.outcomes.SCORE > 0,
    outcomes: scored.outcomes,
    diagnostics: [...result.diagnostics, ...scored.diagnostics],
  };
}

interface InspectPackageOptions {
  strict: boolean;
  itemOnly?: boolean | undefined;
}

async function inspectPackage(
  file: string,
  options: InspectPackageOptions,
): Promise<{
  file: string;
  strict: boolean;
  checked: number;
  failed: number;
  packageErrors: string[];
  xmlFiles: string[];
  assetFiles: string[];
  discoveredReferences: string[];
  assessmentTestFiles: string[];
  results: {
    file: string;
    source: "assessment-test" | "manifest" | "direct";
    ok: boolean;
    diagnostics: ReturnType<typeof parseQtiXml>["diagnostics"];
    interactions: string[];
    basicFeatures: string[];
  }[];
}> {
  const entries = await readPackageEntries(file);
  const xmlFiles = entries
    .filter((entry) => entry.name.toLowerCase().endsWith(".xml"))
    .map((entry) => parsePackageXml(entry));
  const byPath = new Map(xmlFiles.map((entry) => [entry.path, entry]));
  const entryNames = new Set(entries.map((entry) => entry.name));
  const itemSources = new Map<string, "assessment-test" | "manifest" | "direct">();
  const discoveredReferences: string[] = [];
  const directItemPaths: string[] = [];
  const assessmentTestFiles: string[] = [];
  const packageErrors = xmlFiles.flatMap((xmlFile) => {
    return xmlFile.errors.map((error) => `${xmlFile.path}: ${error}`);
  });
  const manifestFiles = xmlFiles.filter((xmlFile) => xmlFile.root?.localName === "manifest");

  if (options.strict) {
    if (!manifestFiles.some((xmlFile) => xmlFile.path === "imsmanifest.xml")) {
      packageErrors.push("strict package validation requires imsmanifest.xml.");
    }
    for (const manifestFile of manifestFiles) {
      for (const ref of manifestFileReferences(manifestFile)) {
        if (!entryNames.has(ref)) {
          packageErrors.push(`manifest file reference ${ref} was not found.`);
        }
      }
    }
  }

  for (const xmlFile of xmlFiles) {
    const rootName = xmlFile.root?.localName;
    if (rootName === "qti-assessment-test") {
      assessmentTestFiles.push(xmlFile.path);
    }
    const refs =
      rootName === "qti-assessment-test" && !options.itemOnly
        ? assessmentItemRefs(xmlFile)
        : rootName === "manifest"
          ? manifestItemResources(xmlFile)
          : [];
    for (const ref of refs) {
      discoveredReferences.push(ref);
      if (byPath.has(ref) && !itemSources.has(ref)) {
        itemSources.set(ref, rootName === "manifest" ? "manifest" : "assessment-test");
      } else if (!byPath.has(ref)) {
        packageErrors.push(`package reference ${ref} was not found.`);
      }
    }
    if (options.strict) {
      for (const ref of packageDependencyReferences(xmlFile)) {
        if (!entryNames.has(ref)) {
          packageErrors.push(
            `package dependency ${ref} referenced from ${xmlFile.path} was not found.`,
          );
        }
      }
    }
    if (rootName === "qti-assessment-item") {
      directItemPaths.push(xmlFile.path);
    }
  }

  if (options.itemOnly && assessmentTestFiles.length > 0) {
    packageErrors.push(
      `assessment-test packages are out of scope for Basic item-player readiness: ${assessmentTestFiles.join(", ")}.`,
    );
  }

  if (options.strict && discoveredReferences.length === 0) {
    packageErrors.push(
      "strict package validation requires manifest or assessment-test item references.",
    );
  }

  for (const path of directItemPaths) {
    if (itemSources.has(path)) continue;
    if (options.strict) {
      packageErrors.push(
        `qti-assessment-item ${path} is not referenced by the package manifest or assessment test.`,
      );
      continue;
    }
    itemSources.set(path, "direct");
  }

  const results = [...itemSources.entries()].map(([path, source]) => {
    const xmlFile = byPath.get(path);
    if (!xmlFile) {
      return {
        file: path,
        source,
        ok: false,
        diagnostics: [],
        interactions: [],
        basicFeatures: [],
      };
    }
    const result = parseQtiXml(xmlFile.xml);
    const validation = result.document
      ? validateAssessmentItem(result.document)
      : { diagnostics: [] };
    const diagnostics = uniqueDiagnostics([
      ...result.diagnostics,
      ...validation.diagnostics,
      ...(options.strict ? packageXmlDiagnostics(xmlFile) : []),
    ]);
    return {
      file: path,
      source,
      ok: result.ok && diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
      diagnostics,
      interactions:
        result.document?.item.interactions.map((interaction) => interaction.qtiName) ?? [],
      basicFeatures: detectBasicItemFeatures(xmlFile.xml, result),
    };
  });

  return {
    file,
    strict: options.strict,
    checked: results.length,
    failed: results.filter((result) => !result.ok).length + packageErrors.length,
    packageErrors,
    xmlFiles: xmlFiles.map((entry) => entry.path),
    assetFiles: entries
      .filter((entry) => !entry.name.toLowerCase().endsWith(".xml"))
      .map((entry) => entry.name),
    discoveredReferences,
    assessmentTestFiles,
    results,
  };
}

async function inspectPackageSafely(
  file: string,
  options: InspectPackageOptions,
): Promise<Awaited<ReturnType<typeof inspectPackage>>> {
  try {
    return await inspectPackage(file, options);
  } catch (error) {
    return {
      file,
      strict: options.strict,
      checked: 0,
      failed: 1,
      packageErrors: [error instanceof Error ? error.message : String(error)],
      xmlFiles: [],
      assetFiles: [],
      discoveredReferences: [],
      assessmentTestFiles: [],
      results: [],
    };
  }
}

async function basicItemPlayerReport(targets: string[]): Promise<{
  target: string;
  packageTargets: string[];
  certificationContext: ReturnType<typeof runBasicItemPlayerReadiness>["certificationContext"];
  checked: number;
  failed: number;
  ok: boolean;
  packageItemCount: number;
  referencedItemResources: string[];
  missingPackageFeatures: { featureId: string; label: string }[];
  toleranceChecked: number;
  toleranceFailed: number;
  tolerance: ReturnType<typeof runBasicItemPlayerReadiness>["tolerance"];
  basicFeatures: {
    featureId: string;
    label: string;
    status: string;
    fixtureIds: string[];
    packageEvidence: boolean;
  }[];
  validatorEvidence: ReturnType<typeof runBasicItemPlayerReadiness>["validatorEvidence"];
  readiness: ReturnType<typeof runBasicItemPlayerReadiness>;
  packages: Awaited<ReturnType<typeof inspectPackage>>[];
}> {
  const packageTargets = await expandBasicPackageTargets(targets);
  const packages = await Promise.all(
    packageTargets.map((target) => inspectPackageSafely(target, { strict: true, itemOnly: true })),
  );
  const packageEvidence = packages.map(toBasicPackageEvidence);
  const readiness = runBasicItemPlayerReadiness({ packageEvidence });
  const packageFeatureIds = aggregateBasicFeatures(packages);
  const packageFailures = packages.filter((report) => report.failed > 0).length;
  const missingPackageFeatures = basicItemPlayerProfile.features.filter((feature) => {
    if (feature.packageEvidenceRequired) {
      return !packageEvidence.some((entry) => entry.ok && entry.itemCount > 0);
    }
    return !packageFeatureIds.has(feature.featureId);
  });
  const failed = readiness.failed + packageFailures + missingPackageFeatures.length;

  return {
    target: "QTI 3 Basic Item Player Readiness",
    packageTargets,
    certificationContext: readiness.certificationContext,
    checked: readiness.checked,
    failed,
    ok: failed === 0,
    packageItemCount: packages.reduce((sum, report) => sum + report.checked, 0),
    referencedItemResources: [
      ...new Set(packages.flatMap((report) => report.discoveredReferences)),
    ],
    missingPackageFeatures: missingPackageFeatures.map((feature) => ({
      featureId: feature.featureId,
      label: feature.label,
    })),
    toleranceChecked: readiness.toleranceChecked,
    toleranceFailed: readiness.toleranceFailed,
    tolerance: readiness.tolerance,
    basicFeatures: basicItemPlayerProfile.features.map((feature) => {
      const result = readiness.features.find((row) => row.featureId === feature.featureId);
      return {
        featureId: feature.featureId,
        label: feature.label,
        status: result?.status ?? "missing",
        fixtureIds: feature.fixtureIds,
        packageEvidence: feature.packageEvidenceRequired
          ? packageEvidence.some((entry) => entry.ok && entry.itemCount > 0)
          : packageFeatureIds.has(feature.featureId),
      };
    }),
    validatorEvidence: readiness.validatorEvidence,
    readiness,
    packages,
  };
}

function toBasicPackageEvidence(
  report: Awaited<ReturnType<typeof inspectPackage>>,
): QtiBasicItemPlayerPackageEvidence {
  const diagnostics: QtiDiagnostic[] = [
    ...report.packageErrors.map((message): QtiDiagnostic => {
      return {
        code: "package.error",
        severity: "error",
        message,
      };
    }),
    ...report.results.flatMap((result) =>
      result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        path: diagnostic.path ? `${result.file}${diagnostic.path}` : result.file,
      })),
    ),
  ];
  return {
    source: report.file,
    ok: report.failed === 0 && report.checked > 0,
    itemCount: report.checked,
    diagnostics,
  };
}

async function expandBasicPackageTargets(targets: string[]): Promise<string[]> {
  const requested = targets.length > 0 ? targets : ["packages/fixtures/packages/basic-item-player"];
  const expanded: string[] = [];

  for (const target of requested) {
    const targetStat = await stat(target);
    if (!targetStat.isDirectory()) {
      expanded.push(target);
      continue;
    }

    if (await hasPackageManifest(target)) {
      expanded.push(target);
      continue;
    }

    const entries = await readdir(target, { withFileTypes: true });
    const packageDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(target, entry.name))
      .toSorted();
    const before = expanded.length;
    for (const directory of packageDirectories) {
      if (await hasPackageManifest(directory)) expanded.push(directory);
    }
    if (expanded.length === before) expanded.push(target);
  }

  return expanded;
}

async function hasPackageManifest(directory: string): Promise<boolean> {
  try {
    return (await stat(join(directory, "imsmanifest.xml"))).isFile();
  } catch {
    return false;
  }
}

function aggregateBasicFeatures(
  packages: Awaited<ReturnType<typeof inspectPackage>>[],
): Set<string> {
  return new Set(
    packages.flatMap((report) => report.results.flatMap((result) => result.basicFeatures)),
  );
}

function detectBasicItemFeatures(xml: string, result: ReturnType<typeof parseQtiXml>): string[] {
  const featureIds = new Set<string>();

  if (/<qti-assessment-item\b/i.test(xml)) featureIds.add("I-0");
  if (/<qti-response-declaration\b/i.test(xml)) featureIds.add("I-1");
  if (/<qti-outcome-declaration\b/i.test(xml)) featureIds.add("I-2");
  if (/<qti-item-body\b/i.test(xml)) featureIds.add("I-7");
  if (/<qti-response-processing\b[^>]*\btemplate\s*=/i.test(xml)) featureIds.add("I-9b");
  if (/<math(?:\s|>)/i.test(xml)) featureIds.add("I-18");
  if (/\bclass\s*=\s*["'][^"']*\bqti-[^"']*["']|\bdata-qti-/i.test(xml)) {
    featureIds.add("I-19");
  }
  if (/<img\b[^>]*\balt\s*=/i.test(xml)) featureIds.add("A-1");
  if (
    /<(?:p|section|div|span|h[1-6]|figure|figcaption|table|caption|thead|tbody|tr|th|td|ul|ol|li|em|strong|img|math)(?:\s|>)/i.test(
      xml,
    )
  ) {
    featureIds.add("I-8");
  }

  const interactions = result.document?.item.interactions ?? [];
  if (interactions.length > 1) featureIds.add("I-17");
  for (const interaction of interactions) {
    const featureId = basicInteractionFeature(interaction.qtiName, xml);
    if (featureId) featureIds.add(featureId);
  }

  const order = new Map(
    basicItemPlayerProfile.features.map((feature, index) => [feature.featureId, index]),
  );
  return [...featureIds].toSorted((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

function basicInteractionFeature(qtiName: string, xml: string): string | undefined {
  if (qtiName === "qti-choice-interaction") {
    return /<qti-choice-interaction\b[^>]*\bmax-choices\s*=/i.test(xml) ? "Q-2" : undefined;
  }
  if (qtiName === "qti-extended-text-interaction") return "Q-5";
  if (qtiName === "qti-match-interaction") return "Q-13";
  if (qtiName === "qti-text-entry-interaction") return "Q-20";
  return undefined;
}

async function readPackageEntries(file: string): Promise<ZipEntry[]> {
  const fileStat = await stat(file);
  if (fileStat.isDirectory()) return readDirectoryPackageEntries(file);
  return readZipEntries(await readFile(file));
}

async function readDirectoryPackageEntries(root: string): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  await collectDirectoryPackageEntries(root, root, entries);
  return entries;
}

async function collectDirectoryPackageEntries(
  root: string,
  directory: string,
  entries: ZipEntry[],
): Promise<void> {
  const directoryEntries = (await readdir(directory, { withFileTypes: true })).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of directoryEntries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectDirectoryPackageEntries(root, path, entries);
      continue;
    }
    if (!entry.isFile()) continue;
    const name = normalizeCliPackagePath(
      relative(root, path).replaceAll("\\", "/"),
      "package file",
    );
    entries.push({ name, bytes: await readFile(path) });
  }
}

function readZipEntries(buffer: Uint8Array): ZipEntry[] {
  const diagnostics: QtiDiagnostic[] = [];
  const entries = readQtiPackageZipEntries(
    buffer,
    { inflateRaw: (bytes) => inflateRawSync(bytes) },
    diagnostics,
  );
  if (entries.length === 0) {
    const message =
      diagnostics.find((diagnostic) => diagnostic.severity === "error")?.message ??
      "No ZIP central directory was found.";
    throw new Error(message);
  }
  return entries.map((entry) => ({ name: entry.path, bytes: entry.bytes }));
}

function parsePackageXml(entry: ZipEntry): PackageXmlFile {
  const xml = decodeUtf8(entry.bytes);
  const parsed = parseQtiPackageXmlTree(xml);
  return { path: entry.name, xml, root: parsed.root, errors: parsed.errors };
}

function assessmentItemRefs(xmlFile: PackageXmlFile): string[] {
  return packageDescendants(xmlFile.root, "qti-assessment-item-ref")
    .map((node) => node.attributes.href ?? "")
    .filter(Boolean)
    .map((href) => resolvePackageHref(xmlFile.path, href));
}

function manifestItemResources(xmlFile: PackageXmlFile): string[] {
  return packageDescendants(xmlFile.root, "resource")
    .filter((node) => isQtiItemResource(node.attributes.type ?? ""))
    .map((node) => resourceHref(node))
    .filter(Boolean)
    .map((href) => resolvePackageHref(xmlFile.path, href));
}

function manifestFileReferences(xmlFile: PackageXmlFile): string[] {
  return packageDescendants(xmlFile.root, "file")
    .map((node) => node.attributes.href ?? "")
    .filter(Boolean)
    .map((href) => resolvePackageHref(xmlFile.path, href));
}

function packageDependencyReferences(xmlFile: PackageXmlFile): string[] {
  const refs: string[] = [];
  collectPackageRelativeAttributeRefs(refs, xmlFile, "qti-stylesheet", "href");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "qti-assessment-stimulus-ref", "href");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "img", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "object", "data");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "audio", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "video", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "source", "src");
  collectPackageRelativeAttributeRefs(refs, xmlFile, "track", "src");
  collectPackageRelativeTextRefs(refs, xmlFile, "qti-file-href");
  collectPackageRelativeTextRefs(refs, xmlFile, "qti-resource-icon");
  return [...new Set(refs)];
}

function collectPackageRelativeAttributeRefs(
  refs: string[],
  xmlFile: PackageXmlFile,
  localName: string,
  attribute: string,
): void {
  for (const node of packageDescendants(xmlFile.root, localName)) {
    const href = node.attributes[attribute];
    if (isPackageRelativeHref(href)) refs.push(resolvePackageHref(xmlFile.path, href.trim()));
  }
}

function collectPackageRelativeTextRefs(
  refs: string[],
  xmlFile: PackageXmlFile,
  localName: string,
): void {
  for (const node of packageDescendants(xmlFile.root, localName)) {
    const href = node.text.trim();
    if (isPackageRelativeHref(href)) refs.push(resolvePackageHref(xmlFile.path, href));
  }
}

function isPackageRelativeHref(href: string | undefined): href is string {
  const trimmed = href?.trim() ?? "";
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(trimmed);
}

function assessmentItemChildOrder(localName: string): number | undefined {
  switch (localName) {
    case "qti-context-declaration":
      return 1;
    case "qti-response-declaration":
      return 2;
    case "qti-outcome-declaration":
      return 3;
    case "qti-template-declaration":
      return 4;
    case "qti-template-processing":
      return 5;
    case "qti-assessment-stimulus-ref":
      return 6;
    case "qti-companion-materials-info":
      return 7;
    case "qti-stylesheet":
      return 8;
    case "qti-item-body":
      return 9;
    case "qti-catalog-info":
      return 10;
    case "qti-response-processing":
      return 11;
    case "qti-modal-feedback":
      return 12;
    default:
      return undefined;
  }
}

function packageXmlDiagnostics(xmlFile: PackageXmlFile): QtiDiagnostic[] {
  if (xmlFile.root?.localName !== "qti-assessment-item") return [];
  const diagnostics: QtiDiagnostic[] = [];
  let lastOrder = 0;

  for (const child of xmlFile.root.children) {
    const order = assessmentItemChildOrder(child.localName);
    if (!order) {
      diagnostics.push({
        code: "package.itemChild.unsupported",
        severity: "error",
        message: `qti-assessment-item contains unsupported child ${child.localName}.`,
        path: xmlFile.path,
      });
      continue;
    }
    if (order < lastOrder) {
      diagnostics.push({
        code: "package.itemChild.order",
        severity: "error",
        message: `${child.localName} appears out of QTI 3 qti-assessment-item child order.`,
        path: xmlFile.path,
      });
      continue;
    }
    lastOrder = order;
  }

  return diagnostics;
}

function isQtiItemResource(type: string): boolean {
  return type.toLowerCase().startsWith("imsqti_item_xmlv3p0");
}

function resourceHref(resource: QtiPackageXmlNode): string {
  const href = resource.attributes.href;
  if (href) return href;
  const file = packageDescendants(resource, "file").find((node) => {
    return (node.attributes.href ?? "").toLowerCase().endsWith(".xml");
  });
  return file?.attributes.href ?? "";
}

function resolvePackageHref(from: string, href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? "";
  return resolveRelativePath(from, path);
}

function packageDescendants(
  node: QtiPackageXmlNode | undefined,
  localName: string,
): QtiPackageXmlNode[] {
  if (!node) return [];
  const found: QtiPackageXmlNode[] = [];
  for (const child of node.children) {
    if (child.localName === localName) found.push(child);
    found.push(...packageDescendants(child, localName));
  }
  return found;
}

function resolveRelativePath(from: string, href: string): string {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return normalizeCliPackagePath(`${base}${href}`, "package reference");
}

function normalizeCliPackagePath(path: string, context: string): string {
  const diagnostics: QtiDiagnostic[] = [];
  const normalized = normalizePackagePath(path, context, diagnostics);
  if (normalized !== undefined) return normalized;
  throw new Error(
    diagnostics.find((diagnostic) => diagnostic.severity === "error")?.message ??
      `${context} ${path} is not a valid package-relative path.`,
  );
}

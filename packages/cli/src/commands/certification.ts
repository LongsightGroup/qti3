import {
  runQti3BasicImportItemOnlyCertification,
  runQti3BasicImportTestCertification,
} from "@longsightgroup/qti3-conformance";
import { errorResult, jsonResult, type CliCommandResult } from "../cli-result.js";

const IMPORT_ITEMS_USAGE =
  "Usage: qti3 certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <validator-report.json>]";
const IMPORT_TESTS_USAGE =
  "Usage: qti3 certification import-basic-tests --qti-root <qti-conformance/qti3.0>";
const CERTIFICATION_USAGE = `${IMPORT_ITEMS_USAGE} | ${IMPORT_TESTS_USAGE}`;

/** Run a QTI Basic IMPORT certification subcommand. */
export async function runCertificationCommand(args: string[]): Promise<CliCommandResult> {
  const [profile, ...optionsArgs] = args;
  if (profile === "import-basic-items") {
    const options = parseImportBasicItemsArgs(optionsArgs);
    if (!options.ok) {
      return errorResult(options.message);
    }
    const report = await runQti3BasicImportItemOnlyCertification({
      qtiRoot: options.qtiRoot,
      validatorReport: options.validatorReport,
    });
    return jsonResult(report, report.ok ? 0 : 1);
  }

  if (profile === "import-basic-tests") {
    const options = parseImportBasicTestsArgs(optionsArgs);
    if (!options.ok) {
      return errorResult(options.message);
    }
    const report = await runQti3BasicImportTestCertification({ qtiRoot: options.qtiRoot });
    return jsonResult(report, report.ok ? 0 : 1);
  }

  return { exitCode: 1, stdout: CERTIFICATION_USAGE };
}

function parseImportBasicItemsArgs(
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
    return { ok: false, message: IMPORT_ITEMS_USAGE };
  }

  return qtiRoot === undefined
    ? { ok: false, message: IMPORT_ITEMS_USAGE }
    : { ok: true, qtiRoot, validatorReport };
}

function parseImportBasicTestsArgs(
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
    return { ok: false, message: IMPORT_TESTS_USAGE };
  }

  return qtiRoot === undefined ? { ok: false, message: IMPORT_TESTS_USAGE } : { ok: true, qtiRoot };
}

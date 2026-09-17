import {
  runQti3BasicImportItemOnlyCertification,
  runQti3BasicImportTestCertification,
  verifyQtiValidatorEvidence,
} from "@longsightgroup/qti3-conformance";
import { errorResult, jsonResult, type CliCommandResult } from "../cli-result.js";

const IMPORT_ITEMS_USAGE =
  "Usage: qti3 certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <report.json>] [--validator-package <package.zip>] [--trusted-report-sha256 <digest>] [--require-validator-evidence]";
const IMPORT_TESTS_USAGE =
  "Usage: qti3 certification import-basic-tests --qti-root <qti-conformance/qti3.0>";
const VALIDATOR_USAGE =
  "Usage: qti3 certification verify-validator --validator-report <report.json> --validator-package <package.zip> --trusted-report-sha256 <download-digest>";
const CERTIFICATION_USAGE = `${IMPORT_ITEMS_USAGE} | ${IMPORT_TESTS_USAGE} | ${VALIDATOR_USAGE}`;

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
      validatorPackage: options.validatorPackage,
      trustedValidatorReportSha256: options.trustedReportSha256,
      requireValidatorEvidence: options.requireValidatorEvidence,
    });
    return jsonResult(report, report.ok ? 0 : 1);
  }

  if (profile === "verify-validator") {
    const options = parseImportBasicItemsArgs(optionsArgs, true);
    if (
      !options.ok ||
      options.validatorReport === undefined ||
      options.validatorPackage === undefined ||
      options.trustedReportSha256 === undefined
    )
      return errorResult(VALIDATOR_USAGE);
    const evidence = await verifyQtiValidatorEvidence({
      report: options.validatorReport,
      package: options.validatorPackage,
      trustedReportSha256: options.trustedReportSha256,
    });
    return jsonResult(evidence, evidence.status === "verified-pass" ? 0 : 1);
  }

  if (profile === "import-basic-tests") {
    const options = parseImportBasicTestsArgs(optionsArgs);
    if (!options.ok) {
      return errorResult(options.message);
    }
    const report = await runQti3BasicImportTestCertification({ qtiRoot: options.qtiRoot });
    return jsonResult(report, report.ok ? 0 : 1);
  }

  return errorResult(CERTIFICATION_USAGE);
}

function parseImportBasicItemsArgs(
  args: string[],
  validatorOnly = false,
):
  | {
      readonly ok: true;
      readonly qtiRoot: string;
      readonly validatorReport?: string | undefined;
      readonly validatorPackage?: string | undefined;
      readonly trustedReportSha256?: string | undefined;
      readonly requireValidatorEvidence: boolean;
    }
  | { readonly ok: false; readonly message: string } {
  let qtiRoot: string | undefined;
  let validatorReport: string | undefined;
  let validatorPackage: string | undefined;
  let trustedReportSha256: string | undefined;
  let requireValidatorEvidence = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (!validatorOnly && arg === "--require-validator-evidence") {
      requireValidatorEvidence = true;
      continue;
    }
    if (!validatorOnly && arg === "--qti-root" && value !== undefined && !value.startsWith("--")) {
      qtiRoot = value;
      index += 1;
      continue;
    }
    if (arg === "--validator-package" && value !== undefined && !value.startsWith("--")) {
      validatorPackage = value;
      index += 1;
      continue;
    }
    if (arg === "--trusted-report-sha256" && value !== undefined && /^[a-f0-9]{64}$/.test(value)) {
      trustedReportSha256 = value;
      index += 1;
      continue;
    }
    if (arg === "--validator-report" && value !== undefined && !value.startsWith("--")) {
      validatorReport = value;
      index += 1;
      continue;
    }
    return { ok: false, message: IMPORT_ITEMS_USAGE };
  }

  return qtiRoot === undefined && !validatorOnly
    ? { ok: false, message: IMPORT_ITEMS_USAGE }
    : {
        ok: true,
        qtiRoot: qtiRoot ?? "",
        validatorReport,
        validatorPackage,
        trustedReportSha256,
        requireValidatorEvidence,
      };
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

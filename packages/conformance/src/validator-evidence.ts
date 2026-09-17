import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { QtiDiagnostic } from "@longsightgroup/qti3-core";
import { certificationDiagnostic } from "./certification-package.js";

/** Manual provenance acceptance is separate from report parsing and artifact verification. */
export interface QtiValidatorEvidenceOptions {
  readonly report: string;
  readonly package?: string | undefined;
  /** SHA-256 recorded when an operator downloaded this report from the member validator. */
  readonly trustedReportSha256?: string | undefined;
}

/** Verified means checked content under the stated operator trust boundary, not external certification. */
export interface QtiValidatorEvidence {
  readonly source: string;
  readonly status: "unverified" | "unavailable" | "rejected" | "verified-pass";
  readonly size: number;
  readonly reportSha256?: string | undefined;
  readonly artifactSha256?: string | undefined;
  readonly trust: "none" | "operator-attested-download";
  readonly scope?:
    | {
        readonly generator: "Qti30Inspector";
        readonly specificationVersion: "3.0";
        readonly capability: "content-validation";
        readonly inputName: string;
        readonly generated: string;
      }
    | undefined;
  readonly diagnostics: readonly QtiDiagnostic[];
}

interface MemberReport {
  readonly id: string;
  readonly generated: string;
  readonly inputName: string;
  readonly outcome: string;
  readonly counts: Readonly<
    Record<
      "fatals" | "errors" | "warnings" | "exceptions" | "notRun" | "totalRun" | "valid",
      number
    >
  >;
}

/** Verify the observed 1EdTech Qti30Inspector JSON format against one explicitly supplied ZIP. */
export async function verifyQtiValidatorEvidence(
  options: QtiValidatorEvidenceOptions,
): Promise<QtiValidatorEvidence> {
  let size = 0;
  let reportBytes: Uint8Array;
  try {
    const info = await stat(options.report);
    size = info.size;
    if (!info.isFile() || size === 0 || size > 8 * 1024 * 1024) {
      return failure(
        "unavailable",
        "certification.validator.size",
        "Report must be a nonempty regular file no larger than 8 MiB.",
      );
    }
    reportBytes = await readFile(options.report);
    if (reportBytes.byteLength > 8 * 1024 * 1024)
      return failure(
        "unavailable",
        "certification.validator.size",
        "Report exceeds the 8 MiB limit.",
      );
  } catch {
    return failure(
      "unavailable",
      "certification.validator.read",
      "Unable to read the validator report.",
    );
  }
  const reportSha256 = sha256(reportBytes);
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(reportBytes));
  } catch {
    return {
      ...failure(
        "rejected",
        "certification.validator.malformed",
        "Report is not valid UTF-8 JSON.",
      ),
      reportSha256,
    };
  }
  const parsed = parseMemberReport(decoded);
  if (!parsed.ok) return { ...failure("rejected", parsed.code, parsed.message), reportSha256 };
  const report = parsed.report;
  const scope = {
    generator: "Qti30Inspector",
    specificationVersion: "3.0",
    capability: "content-validation",
    inputName: report.inputName,
    generated: report.generated,
  } as const;
  const diagnostics: QtiDiagnostic[] = [];
  if (
    report.outcome !== "VALID" ||
    report.counts.fatals !== 0 ||
    report.counts.errors !== 0 ||
    report.counts.exceptions !== 0 ||
    report.counts.notRun !== 0 ||
    report.counts.totalRun === 0
  ) {
    diagnostics.push(
      certificationDiagnostic(
        "certification.validator.failed",
        "The official report is unsuccessful or incomplete.",
      ),
    );
  }
  // Conservative policy until warnings have an explicitly reviewed submission disposition.
  if (report.counts.warnings !== 0)
    diagnostics.push(
      certificationDiagnostic(
        "certification.validator.warnings",
        "Validator warnings require review before this evidence can pass.",
      ),
    );
  const trusted = options.trustedReportSha256 === reportSha256;
  if (!trusted)
    diagnostics.push(
      certificationDiagnostic(
        "certification.validator.provenance",
        "No matching trusted download digest was supplied. Parsing does not authenticate the report's origin.",
      ),
    );
  let artifactSha256: string | undefined;
  if (options.package === undefined) {
    diagnostics.push(
      certificationDiagnostic(
        "certification.validator.packageRequired",
        "An exact package is required to check report scope.",
      ),
    );
  } else {
    try {
      const packageInfo = await stat(options.package);
      if (!packageInfo.isFile() || packageInfo.size > 512 * 1024 * 1024) {
        return {
          ...failure(
            "rejected",
            "certification.validator.packageSize",
            "Package must be a regular file no larger than 512 MiB.",
          ),
          reportSha256,
          scope,
        };
      }
      artifactSha256 = sha256(await readFile(options.package));
      if (
        report.id !== `qti3-sha256-${artifactSha256}` ||
        report.inputName !== basename(options.package)
      ) {
        diagnostics.push(
          certificationDiagnostic(
            "certification.validator.artifactMismatch",
            "Report ID or input name does not match the supplied package. Set the pre-upload package SHA-256 as the report ID.",
          ),
        );
      }
    } catch {
      diagnostics.push(
        certificationDiagnostic(
          "certification.validator.packageRead",
          "Unable to read the package covered by the report.",
        ),
      );
    }
  }
  return {
    source: options.report,
    status: diagnostics.length === 0 ? "verified-pass" : trusted ? "rejected" : "unverified",
    size,
    reportSha256,
    artifactSha256,
    scope,
    trust: trusted ? "operator-attested-download" : "none",
    diagnostics,
  };

  function failure(
    status: QtiValidatorEvidence["status"],
    code: string,
    message: string,
  ): QtiValidatorEvidence {
    return {
      source: options.report,
      status,
      size,
      trust: "none",
      diagnostics: [certificationDiagnostic(code, message)],
    };
  }
}

function parseMemberReport(
  value: unknown,
):
  | { readonly ok: true; readonly report: MemberReport }
  | { readonly ok: false; readonly code: string; readonly message: string } {
  const malformed = {
    ok: false,
    code: "certification.validator.malformed",
    message: "The member validator report has missing, malformed, or inconsistent fields.",
  } as const;
  if (
    !record(value) ||
    !record(value.input) ||
    !record(value.specification) ||
    !record(value.summary)
  )
    return malformed;
  if (
    value.generator !== "Qti30Inspector" ||
    value.specification.pid !== "qti3.pid" ||
    value.specification.shortName !== "qti" ||
    value.specification.version !== "3.0" ||
    value.input.type !== "ZIP"
  ) {
    return {
      ok: false,
      code: "certification.validator.unsupportedScope",
      message:
        "Only the observed Qti30Inspector QTI 3.0 package JSON report is supported; SBAC, other inspectors, and versions are separate scopes.",
    };
  }
  if (
    typeof value.id !== "string" ||
    typeof value.generated !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value.generated) ||
    typeof value.input.name !== "string" ||
    value.input.name.length === 0 ||
    typeof value.summary.outcome !== "string"
  )
    return malformed;
  const keys = [
    "fatals",
    "errors",
    "warnings",
    "exceptions",
    "notRun",
    "totalRun",
    "valid",
  ] as const;
  for (const key of keys) if (!nonnegativeInteger(value.summary[key])) return malformed;
  for (const [count, list] of [
    ["fatals", "fatals"],
    ["errors", "errors"],
    ["warnings", "warnings"],
    ["exceptions", "exceptions"],
    ["notRun", "notRun"],
    ["valid", "valids"],
  ] as const) {
    if (!Array.isArray(value[list]) || value[list].length !== value.summary[count])
      return malformed;
  }
  const { fatals, errors, warnings, exceptions, notRun, totalRun, valid } = value.summary;
  if (
    !nonnegativeInteger(fatals) ||
    !nonnegativeInteger(errors) ||
    !nonnegativeInteger(warnings) ||
    !nonnegativeInteger(exceptions) ||
    !nonnegativeInteger(notRun) ||
    !nonnegativeInteger(totalRun) ||
    !nonnegativeInteger(valid)
  )
    return malformed;
  return {
    ok: true,
    report: {
      id: value.id,
      generated: value.generated,
      inputName: value.input.name,
      outcome: value.summary.outcome,
      counts: { fatals, errors, warnings, exceptions, notRun, totalRun, valid },
    },
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

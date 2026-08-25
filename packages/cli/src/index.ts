#!/usr/bin/env node
import { parseQtiXml } from "@longsightgroup/qti3-core";
import { readTextInput } from "./cli-io.js";
import { basicItemPlayerReport } from "./commands/basic-item-player.js";
import { runCertificationCommand } from "./commands/certification.js";
import {
  parseDirectory,
  scoreCorrectDirectory,
  scoreCorrectFile,
  validateDirectory,
  validateFile,
  writeCanonicalFixtures,
} from "./commands/items.js";
import { runPrepareDeliveryCommand } from "./commands/prepare-delivery.js";
import { runScoreCommand } from "./commands/score.js";
import {
  accessibilityProofReport,
  assertSupportMatrix,
  runCanonicalFixtures,
  supportMatrixReport,
} from "./commands/support.js";
import { inspectPackageSafely } from "./package/package-inspection.js";
import {
  errorResult,
  jsonResult,
  nodeCliOutput,
  renderCliResult,
  runFileSystemCommand,
  type CliCommandResult,
  type CliOutput,
} from "./cli-result.js";

const USAGE =
  "Usage: qti3 parse <item.xml> | qti3 parse-dir <directory> | qti3 validate <item.xml> | qti3 validate-dir <directory> | qti3 score <item.xml> --responses <responses.json> | qti3 score-correct <item.xml> | qti3 score-correct-dir <directory> | qti3 prepare-delivery <item.xml> [--mode static|server-materialized-adaptive] [--state <state.json>] [--out <candidate.xml>] | qti3 inspect-package <package.zip|directory> | qti3 validate-package <package.zip|directory> | qti3 basic-item-player-report [package.zip|directory ...] | qti3 certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <validator-report.json>] | qti3 certification import-basic-tests --qti-root <qti-conformance/qti3.0> | qti3 write-fixtures <directory> | qti3 support-matrix | qti3 a11y-proof | qti3 assert-support | qti3 run-fixtures";

/** Route one CLI invocation, render its output, and return its process exit code. */
export async function main(
  args = process.argv.slice(2),
  output: CliOutput = nodeCliOutput,
): Promise<number> {
  const result = await executeCli(args);
  return renderCliResult(result, output);
}

async function executeCli(args: string[]): Promise<CliCommandResult> {
  const [command, ...commandArgs] = args;
  const file = commandArgs[0];

  switch (command) {
    case undefined:
      break;
    case "certification":
      return runCertificationCommand(commandArgs);
    case "parse": {
      if (file === undefined) break;
      const xml = await readTextInput(file, "QTI item");
      if (!xml.ok) return errorResult(xml.message);
      const result = parseQtiXml(xml.value);
      return jsonResult(result, result.ok ? 0 : 1);
    }
    case "parse-dir": {
      if (file === undefined) break;
      return runFileSystemCommand(async () => {
        const report = await parseDirectory(file);
        return jsonResult(report, report.failed === 0 ? 0 : 1);
      });
    }
    case "validate": {
      if (file === undefined) break;
      return runFileSystemCommand(async () => {
        const result = await validateFile(file);
        return jsonResult(result, result.ok ? 0 : 1);
      });
    }
    case "validate-dir": {
      if (file === undefined) break;
      return runFileSystemCommand(async () => {
        const report = await validateDirectory(file);
        return jsonResult(report, report.failed === 0 ? 0 : 1);
      });
    }
    case "score-correct": {
      if (file === undefined) break;
      return runFileSystemCommand(async () => {
        const result = await scoreCorrectFile(file);
        return jsonResult(result, result.ok && (!result.scorable || result.scorePositive) ? 0 : 1);
      });
    }
    case "score-correct-dir": {
      if (file === undefined) break;
      return runFileSystemCommand(async () => {
        const report = await scoreCorrectDirectory(file);
        return jsonResult(report, report.failed === 0 ? 0 : 1);
      });
    }
    case "score":
      return runScoreCommand(commandArgs);
    case "prepare-delivery":
      return runPrepareDeliveryCommand(commandArgs);
    case "inspect-package": {
      if (file === undefined) break;
      const report = await inspectPackageSafely(file, "inspect");
      return jsonResult(report, report.failed === 0 ? 0 : 1);
    }
    case "validate-package": {
      if (file === undefined) break;
      const report = await inspectPackageSafely(file, "validate");
      return jsonResult(report, report.failed === 0 ? 0 : 1);
    }
    case "basic-item-player-report": {
      return runFileSystemCommand(async () => {
        const report = await basicItemPlayerReport(commandArgs);
        return jsonResult(report, report.failed === 0 ? 0 : 1);
      });
    }
    case "write-fixtures": {
      if (file === undefined) break;
      return runFileSystemCommand(async () => {
        const report = await writeCanonicalFixtures(file);
        return jsonResult(report, 0);
      });
    }
    case "support-matrix":
      return jsonResult(supportMatrixReport(), 0);
    case "a11y-proof":
      return jsonResult(accessibilityProofReport(), 0);
    case "assert-support": {
      const report = assertSupportMatrix();
      return jsonResult(report, report.failed === 0 ? 0 : 1);
    }
    case "run-fixtures": {
      const report = runCanonicalFixtures();
      return jsonResult(report, report.failed === 0 ? 0 : 1);
    }
  }

  return { exitCode: 1, stdout: USAGE };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}

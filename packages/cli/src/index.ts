#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseQtiXml } from "@longsightgroup/qti3-core";
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

const USAGE =
  "Usage: qti3 parse <item.xml> | qti3 parse-dir <directory> | qti3 validate <item.xml> | qti3 validate-dir <directory> | qti3 score <item.xml> --responses <responses.json> | qti3 score-correct <item.xml> | qti3 score-correct-dir <directory> | qti3 prepare-delivery <item.xml> [--mode static|server-materialized-adaptive] [--state <state.json>] [--out <candidate.xml>] | qti3 inspect-package <package.zip|directory> | qti3 validate-package <package.zip|directory> | qti3 basic-item-player-report [package.zip|directory ...] | qti3 certification import-basic-items --qti-root <qti-conformance/qti3.0> [--validator-report <validator-report.json>] | qti3 certification import-basic-tests --qti-root <qti-conformance/qti3.0> | qti3 write-fixtures <directory> | qti3 support-matrix | qti3 a11y-proof | qti3 assert-support | qti3 run-fixtures";

/** Route one CLI invocation and return its process exit code. */
export async function main(args = process.argv.slice(2)): Promise<number> {
  const [command, ...commandArgs] = args;
  const file = commandArgs[0];

  switch (command) {
    case undefined:
      break;
    case "certification": {
      const result = await runCertificationCommand(commandArgs);
      if (result !== undefined) return result;
      break;
    }
    case "parse": {
      if (file === undefined) break;
      const xml = await readFile(file, "utf8");
      const result = parseQtiXml(xml);
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }
    case "parse-dir": {
      if (file === undefined) break;
      const report = await parseDirectory(file);
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
    case "validate": {
      if (file === undefined) break;
      const result = await validateFile(file);
      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 1;
    }
    case "validate-dir": {
      if (file === undefined) break;
      const report = await validateDirectory(file);
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
    case "score-correct": {
      if (file === undefined) break;
      const result = await scoreCorrectFile(file);
      console.log(JSON.stringify(result, null, 2));
      return result.ok && (!result.scorable || result.scorePositive) ? 0 : 1;
    }
    case "score-correct-dir": {
      if (file === undefined) break;
      const report = await scoreCorrectDirectory(file);
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
    case "score":
      return runScoreCommand(commandArgs);
    case "prepare-delivery":
      return runPrepareDeliveryCommand(commandArgs);
    case "inspect-package": {
      if (file === undefined) break;
      const report = await inspectPackageSafely(file, { strict: false });
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
    case "validate-package": {
      if (file === undefined) break;
      const report = await inspectPackageSafely(file, { strict: true });
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
    case "basic-item-player-report": {
      const report = await basicItemPlayerReport(commandArgs);
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
    case "write-fixtures": {
      if (file === undefined) break;
      const report = await writeCanonicalFixtures(file);
      console.log(JSON.stringify(report, null, 2));
      return 0;
    }
    case "support-matrix":
      console.log(JSON.stringify(supportMatrixReport(), null, 2));
      return 0;
    case "a11y-proof":
      console.log(JSON.stringify(accessibilityProofReport(), null, 2));
      return 0;
    case "assert-support": {
      const report = assertSupportMatrix();
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
    case "run-fixtures": {
      const report = runCanonicalFixtures();
      console.log(JSON.stringify(report, null, 2));
      return report.failed === 0 ? 0 : 1;
    }
  }

  console.log(USAGE);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}

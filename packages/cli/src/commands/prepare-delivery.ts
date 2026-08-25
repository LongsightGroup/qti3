import { writeFile } from "node:fs/promises";
import { isQtiValue, prepareQtiDeliveryXml, type QtiValue } from "@longsightgroup/qti3-core";
import { fileErrorMessage, readJsonObject, readTextInput } from "../cli-io.js";
import { errorResult, jsonResult, type CliCommandResult } from "../cli-result.js";

const PREPARE_DELIVERY_USAGE =
  "Usage: qti3 prepare-delivery <item.xml> [--mode static|server-materialized-adaptive] [--state <state.json>] [--out <candidate.xml>]";

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

type PrepareDeliveryOptionsResult =
  | { readonly ok: true; readonly options: PrepareDeliveryCommandOptions }
  | { readonly ok: false; readonly message: string };

/** Prepare candidate-safe static or server-materialized adaptive delivery XML. */
export async function runPrepareDeliveryCommand(args: string[]): Promise<CliCommandResult> {
  const parsed = parsePrepareDeliveryArgs(args);
  if (!parsed.ok) {
    return errorResult(parsed.message);
  }

  const itemXml = await readTextInput(parsed.options.itemFile, "QTI item");
  if (!itemXml.ok) {
    return errorResult(itemXml.message);
  }

  const prepared =
    parsed.options.mode === "static"
      ? { ok: true as const, value: prepareQtiDeliveryXml(itemXml.value, { mode: "static" }) }
      : await prepareAdaptiveDelivery(itemXml.value, parsed.options.stateFile);
  if (!prepared.ok) {
    return errorResult(prepared.message);
  }
  const result = prepared.value;

  if (parsed.options.outputFile === undefined) {
    return jsonResult(result, result.ok ? 0 : 1);
  }

  const { candidateSafeXml: _candidateSafeXml, ...summary } = result;
  if (!result.ok || result.candidateSafeXml === undefined) {
    return jsonResult(summary, 1);
  }
  try {
    await writeFile(parsed.options.outputFile, result.candidateSafeXml, "utf8");
  } catch (error) {
    return errorResult(
      fileErrorMessage("Candidate XML output", parsed.options.outputFile, "write", error),
    );
  }
  return jsonResult({ ...summary, outputFile: parsed.options.outputFile }, 0);
}

function parsePrepareDeliveryArgs(args: string[]): PrepareDeliveryOptionsResult {
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const result: Record<string, QtiValue> = {};
  for (const [identifier, entry] of Object.entries(value)) {
    if (!isQtiValue(entry)) return undefined;
    result[identifier] = entry;
  }
  return result;
}

import { scoreQtiItemServerSide } from "@longsightgroup/qti3-core";
import { readJsonObject, readTextInput } from "../cli-io.js";

const SCORE_USAGE = "Usage: qti3 score <item.xml> --responses <responses.json>";

interface ScoreCommandOptions {
  itemFile: string;
  responsesFile: string;
}

type ScoreOptionsResult =
  | { readonly ok: true; readonly options: ScoreCommandOptions }
  | { readonly ok: false; readonly message: string };

/** Run trusted server-side scoring for a QTI item and response JSON file. */
export async function runScoreCommand(args: string[]): Promise<number> {
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

function parseScoreArgs(args: string[]): ScoreOptionsResult {
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

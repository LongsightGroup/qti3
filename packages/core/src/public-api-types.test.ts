import { describe, expect, it } from "vitest";
import type {
  QtiAreaMapEntry,
  QtiGapMatchGapSegment,
  QtiGapMatchSegment,
  QtiGapMatchTextSegment,
  QtiHottextChoiceSegment,
  QtiHottextSegment,
  QtiHottextTextSegment,
  QtiLookupOutcomeValue,
  QtiMapEntry,
  QtiOutcomeDeclaration,
  QtiProcessingExpression,
  QtiResponseBranch,
  QtiResponseCondition,
  QtiResponseDeclaration,
  QtiResponseProcessing,
  QtiResponseRule,
  QtiSetOutcomeValue,
} from "./index.js";

type PublicParserModelTypes = [
  QtiResponseDeclaration,
  QtiOutcomeDeclaration,
  QtiMapEntry,
  QtiAreaMapEntry,
  QtiResponseProcessing,
  QtiResponseCondition,
  QtiResponseBranch,
  QtiResponseRule,
  QtiSetOutcomeValue,
  QtiLookupOutcomeValue,
  QtiProcessingExpression,
  QtiHottextSegment,
  QtiHottextTextSegment,
  QtiHottextChoiceSegment,
  QtiGapMatchSegment,
  QtiGapMatchTextSegment,
  QtiGapMatchGapSegment,
];

const typeExportsCompile: PublicParserModelTypes | undefined = undefined;

describe("public parser model type exports", () => {
  it("exposes parser model types from the core entrypoint", () => {
    expect(typeExportsCompile).toBeUndefined();
  });
});

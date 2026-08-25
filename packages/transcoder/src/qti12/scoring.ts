import { escapeXmlAttribute, escapeXmlText } from "../xml.js";
import { isCanvasQti12Dialect, type Qti12WireDialect } from "./types.js";
import { formatScore } from "./shared.js";

export function conditions(
  identifier: string,
  correct: readonly string[],
  dialect: Qti12WireDialect,
): string {
  return correct.map((value) => condition(identifier, [value], dialect)).join("");
}

export function condition(
  identifier: string,
  correct: readonly string[],
  dialect: Qti12WireDialect = "standard",
  score = isCanvasQti12Dialect(dialect) ? 100 : 1,
): string {
  const comparisons = correct
    .map(
      (value) =>
        `<varequal respident="${escapeXmlAttribute(identifier)}">${escapeXmlText(value)}</varequal>`,
    )
    .join("");
  const expression = correct.length > 1 ? `<and>${comparisons}</and>` : comparisons;
  return `<respcondition continue="${
    isCanvasQti12Dialect(dialect) && score === 100 ? "No" : "Yes"
  }"><conditionvar>${expression}</conditionvar><setvar action="${
    isCanvasQti12Dialect(dialect) && score === 100 ? "Set" : "Add"
  }" varname="SCORE">${formatScore(score)}</setvar></respcondition>`;
}

export function choiceCondition(
  identifier: string,
  correct: readonly string[],
  allChoices: readonly string[],
  cardinality: "single" | "multiple" | "ordered",
  dialect: Qti12WireDialect = "standard",
): string {
  if (correct.length === 0) return "";
  if (cardinality === "ordered") {
    const ordered = correct
      .map(
        (value, index) =>
          `<varequal respident="${escapeXmlAttribute(identifier)}" index="${String(
            index + 1,
          )}">${escapeXmlText(value)}</varequal>`,
      )
      .join("");
    return scoringCondition(`<and>${ordered}</and>`, dialect);
  }
  if (cardinality === "multiple") {
    const selected = correct
      .map(
        (value) =>
          `<varequal respident="${escapeXmlAttribute(identifier)}">${escapeXmlText(value)}</varequal>`,
      )
      .join("");
    const correctSet = new Set(correct);
    const excluded = allChoices
      .filter((value) => !correctSet.has(value))
      .map(
        (value) =>
          `<not><varequal respident="${escapeXmlAttribute(identifier)}">${escapeXmlText(
            value,
          )}</varequal></not>`,
      )
      .join("");
    return scoringCondition(`<and>${selected}${excluded}</and>`, dialect);
  }
  return scoringCondition(
    `<varequal respident="${escapeXmlAttribute(identifier)}">${escapeXmlText(correct[0] ?? "")}</varequal>`,
    dialect,
  );
}

export function areaCondition(
  identifier: string,
  areaType: string,
  coords: string,
  dialect: Qti12WireDialect,
): string {
  return `<respcondition continue="${isCanvasQti12Dialect(dialect) ? "No" : "Yes"}"><conditionvar><varinside respident="${escapeXmlAttribute(
    identifier,
  )}" areatype="${escapeXmlAttribute(areaType)}">${escapeXmlText(
    coords,
  )}</varinside></conditionvar><setvar action="${
    isCanvasQti12Dialect(dialect) ? "Set" : "Add"
  }" varname="SCORE">${isCanvasQti12Dialect(dialect) ? "100" : "1"}</setvar></respcondition>`;
}

function scoringCondition(expression: string, dialect: Qti12WireDialect): string {
  return `<respcondition continue="${isCanvasQti12Dialect(dialect) ? "No" : "Yes"}"><conditionvar>${expression}</conditionvar><setvar action="${
    isCanvasQti12Dialect(dialect) ? "Set" : "Add"
  }" varname="SCORE">${isCanvasQti12Dialect(dialect) ? "100" : "1"}</setvar></respcondition>`;
}

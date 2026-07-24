import { escapeXml } from "../xml.js";
import type { Qti12WireDialect } from "./types.js";
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
  score = dialect === "canvas-classic" ? 100 : 1,
): string {
  const comparisons = correct
    .map((value) => `<varequal respident="${escapeXml(identifier)}">${escapeXml(value)}</varequal>`)
    .join("");
  const expression = correct.length > 1 ? `<and>${comparisons}</and>` : comparisons;
  return `<respcondition continue="${
    dialect === "canvas-classic" && score === 100 ? "No" : "Yes"
  }"><conditionvar>${expression}</conditionvar><setvar action="${
    dialect === "canvas-classic" && score === 100 ? "Set" : "Add"
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
          `<varequal respident="${escapeXml(identifier)}" index="${String(
            index + 1,
          )}">${escapeXml(value)}</varequal>`,
      )
      .join("");
    return scoringCondition(`<and>${ordered}</and>`, dialect);
  }
  if (cardinality === "multiple") {
    const selected = correct
      .map(
        (value) => `<varequal respident="${escapeXml(identifier)}">${escapeXml(value)}</varequal>`,
      )
      .join("");
    const correctSet = new Set(correct);
    const excluded = allChoices
      .filter((value) => !correctSet.has(value))
      .map(
        (value) =>
          `<not><varequal respident="${escapeXml(identifier)}">${escapeXml(
            value,
          )}</varequal></not>`,
      )
      .join("");
    return scoringCondition(`<and>${selected}${excluded}</and>`, dialect);
  }
  return scoringCondition(
    `<varequal respident="${escapeXml(identifier)}">${escapeXml(correct[0] ?? "")}</varequal>`,
    dialect,
  );
}

export function areaCondition(
  identifier: string,
  areaType: string,
  coords: string,
  dialect: Qti12WireDialect,
): string {
  return `<respcondition continue="${dialect === "canvas-classic" ? "No" : "Yes"}"><conditionvar><varinside respident="${escapeXml(
    identifier,
  )}" areatype="${escapeXml(areaType)}">${escapeXml(
    coords,
  )}</varinside></conditionvar><setvar action="${
    dialect === "canvas-classic" ? "Set" : "Add"
  }" varname="SCORE">${dialect === "canvas-classic" ? "100" : "1"}</setvar></respcondition>`;
}

function scoringCondition(expression: string, dialect: Qti12WireDialect): string {
  return `<respcondition continue="${dialect === "canvas-classic" ? "No" : "Yes"}"><conditionvar>${expression}</conditionvar><setvar action="${
    dialect === "canvas-classic" ? "Set" : "Add"
  }" varname="SCORE">${dialect === "canvas-classic" ? "100" : "1"}</setvar></respcondition>`;
}

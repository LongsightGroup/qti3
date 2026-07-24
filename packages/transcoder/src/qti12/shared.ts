import type { QtiChoice, QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";

import { accessibleChoiceLabel } from "../rich-content-html.js";

export function values(value: QtiValue): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(values);
  return value === null ? [] : [String(value)];
}

export function normalizePoint(value: string): string {
  const [x, y] = value.trim().split(/[\s,]+/, 2);
  return x && y ? `${x},${y}` : value;
}

export function pairIdentifier(value: string): string {
  return `PAIR_${qti12Identifier(value.replace(/\s+/g, "_"))}`;
}

export function qti12Identifier(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(normalized) ? normalized : `R_${normalized}`;
}

export function choiceLabel(choice: QtiChoice): string {
  return (
    choice.attributes["hotspot-label"] ??
    choice.attributes["aria-label"] ??
    choice.attributes.label ??
    choice.text
  );
}

export function qti12Area(shape: string | undefined): string {
  return shape === "circle"
    ? "Ellipse"
    : shape === "poly"
      ? "Bounded"
      : shape === "default"
        ? "Default"
        : "Rectangle";
}

export function manualInstruction(type: QtiInteraction["type"]): string {
  if (type === "drawing") return "Describe the response you would draw.";
  if (type === "upload") return "Describe the file or work you would submit.";
  if (type === "media") return "Describe your response after reviewing the media.";
  if (type === "endAttempt") return "Explain whether the attempt should end and why.";
  if (type === "custom" || type === "portableCustom") {
    return "Provide the requested response in text.";
  }
  return "Provide a complete written response.";
}

export function manualInstructionFor(interaction: QtiInteraction): string {
  const labels = interaction.choices.flatMap((choice) => accessibleChoiceLabel(choice) ?? []);
  const instruction = manualInstruction(interaction.type);
  return labels.length === 0
    ? instruction
    : `${instruction} Available task elements: ${labels.join("; ")}.`;
}

export function pairSides(interaction: QtiInteraction): readonly [QtiChoice[], QtiChoice[]] {
  if (interaction.type === "match") {
    return [
      interaction.choices.filter((choice) => choice.role === "matchSource"),
      interaction.choices.filter((choice) => choice.role === "matchTarget"),
    ];
  }
  if (interaction.type === "gapMatch" || interaction.type === "graphicGapMatch") {
    return [
      interaction.choices.filter((choice) => choice.role === "gapChoice"),
      interaction.choices.filter((choice) => choice.role === "gap"),
    ];
  }
  const choices = interaction.choices.filter(
    (choice) => choice.role === "associableChoice" || choice.role === "hotspot",
  );
  return [choices, choices];
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

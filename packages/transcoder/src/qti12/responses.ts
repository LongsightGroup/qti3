import type { QtiChoice, QtiInteraction } from "@longsightgroup/qti3-core";

import { interactionPolicyFallback } from "../profiles.js";
import type { QtiTranscodeDiagnostic } from "../types.js";
import { canvasHotspotResponse } from "../qti12-canvas.js";
import { serializeRichChoiceContent } from "../rich-content-html.js";
import { escapeXmlAttribute, escapeXmlText } from "../xml.js";
import { serializeQti12Asset } from "./assets.js";
import { choiceCondition, condition, conditions } from "./scoring.js";
import {
  choiceLabel,
  manualInstructionFor,
  normalizePoint,
  pairIdentifier,
  pairSides,
  qti12Area,
  qti12Identifier,
} from "./shared.js";
import {
  isCanvasQti12Dialect,
  type Qti12MapContext,
  type Qti12Response,
  type Qti12WireDialect,
} from "./types.js";

export function choiceResponse(
  identifier: string,
  interaction: QtiInteraction,
  choices: readonly QtiChoice[],
  dialect: Qti12WireDialect,
): string {
  const cardinality =
    interaction.type === "order"
      ? "Ordered"
      : interaction.responseCardinality === "multiple"
        ? "Multiple"
        : "Single";
  return `<response_lid ident="${escapeXmlAttribute(identifier)}" rcardinality="${cardinality}">
        <render_choice shuffle="No">${choices
          .map(
            (choice) =>
              `<response_label ident="${escapeXmlAttribute(qti12Identifier(choice.identifier))}"><material><mattext texttype="${
                isCanvasQti12Dialect(dialect) ? "text/html" : "text/plain"
              }">${serializeChoiceContent(choice, dialect)}</mattext></material></response_label>`,
          )
          .join("")}</render_choice>
      </response_lid>`;
}

export function extendedTextResponse(
  identifier: string,
  instruction: string,
  dialect: Qti12WireDialect = "standard",
): string {
  return `<response_str ident="${escapeXmlAttribute(identifier)}" rcardinality="Single"><material><mattext texttype="text/plain">${escapeXmlText(
    instruction,
  )}</mattext></material><render_fib fibtype="String" prompt="Box" rows="8" columns="72">${
    isCanvasQti12Dialect(dialect)
      ? '<response_label ident="answer1" rshuffle="No"></response_label>'
      : ""
  }</render_fib></response_str>`;
}

export function textResponse(
  identifier: string,
  interaction: QtiInteraction,
  dialect: Qti12WireDialect,
): string {
  const instruction =
    interaction.type === "selectPoint" || interaction.type === "positionObject"
      ? "Enter the response as x,y coordinates."
      : interaction.type === "slider"
        ? "Enter a value within the stated range."
        : "";
  return `<response_str ident="${escapeXmlAttribute(identifier)}" rcardinality="Single"><material><mattext texttype="text/plain">${escapeXmlText(
    instruction,
  )}</mattext></material><render_fib fibtype="${
    interaction.type === "slider" ? "Decimal" : "String"
  }" prompt="Box" rows="1" columns="30">${
    isCanvasQti12Dialect(dialect)
      ? '<response_label ident="answer1" rshuffle="No"></response_label>'
      : ""
  }</render_fib></response_str>`;
}

export function hotspotResponse(identifier: string, interaction: QtiInteraction): string {
  const ordered = interaction.type === "graphicOrder";
  const labels = interaction.choices
    .filter((choice) => choice.role === "hotspot")
    .map(
      (choice) =>
        `<response_label ident="${escapeXmlAttribute(qti12Identifier(choice.identifier))}" rarea="${qti12Area(
          choice.attributes.shape,
        )}">${escapeXmlText(choice.attributes.coords ?? "")}<material><mattext texttype="text/plain">${escapeXmlText(
          choiceLabel(choice),
        )}</mattext></material></response_label>`,
    )
    .join("");
  return `<response_lid ident="${escapeXmlAttribute(identifier)}" rcardinality="${
    ordered ? "Ordered" : interaction.responseCardinality === "multiple" ? "Multiple" : "Single"
  }"><render_hotspot>${labels}</render_hotspot></response_lid>`;
}

export function associateResponse(
  interaction: QtiInteraction,
  identifier: string,
  sourcePath: string | undefined,
): Qti12Response {
  const choices = interaction.choices.filter((choice) => choice.role === "associableChoice");
  return {
    identifier,
    xml: `<response_grp ident="${escapeXmlAttribute(identifier)}" rcardinality="Multiple"><render_choice shuffle="No">${choices
      .map(
        (choice) =>
          `<response_label ident="${escapeXmlAttribute(qti12Identifier(choice.identifier))}"><material><mattext texttype="text/plain">${escapeXmlText(choiceLabel(choice))}</mattext></material></response_label>`,
      )
      .join("")}</render_choice></response_grp>`,
    correct: [],
    scoring: "manual",
    emitted: "response_grp",
    processingXml: "",
    diagnostics: [
      {
        code: "profile.qti12.scoring.associate_manual",
        severity: "warning",
        message:
          "Preserved the native QTI 1.2 association task but removed non-portable automatic pair scoring.",
        path: sourcePath,
      },
    ],
  };
}

export function pairChoiceResponse(
  interaction: QtiInteraction,
  identifier: string,
  correctPairs: readonly string[],
  sourcePath: string | undefined,
  dialect: Qti12WireDialect,
): Qti12Response {
  const [left, right] = pairSides(interaction);
  if (left.length === 0 || right.length === 0) {
    return {
      identifier,
      xml: extendedTextResponse(identifier, "Describe the requested relationships.", dialect),
      correct: [],
      scoring: "manual",
      fallback: "extended-text",
      emitted: "response_str",
      processingXml: "",
      diagnostics: [
        {
          code: "profile.qti12.fallback.choice_without_labels",
          severity: "warning",
          message:
            "Accessible relationship labels were unavailable, so the task requires manual grading.",
          path: sourcePath,
        },
      ],
    };
  }
  const pairChoices = left.flatMap((sourceChoice) =>
    right.map((targetChoice) => {
      const pair = `${sourceChoice.identifier} ${targetChoice.identifier}`;
      return {
        identifier: pairIdentifier(pair),
        text: `${choiceLabel(sourceChoice)} — ${choiceLabel(targetChoice)}`,
      };
    }),
  );
  const encodedCorrect = correctPairs.map(pairIdentifier);
  return {
    identifier,
    xml: `<response_lid ident="${escapeXmlAttribute(identifier)}" rcardinality="${
      encodedCorrect.length > 1 ? "Multiple" : "Single"
    }"><material><mattext texttype="text/plain">Select the correct relationship${
      encodedCorrect.length > 1 ? "s" : ""
    }.</mattext></material><render_choice shuffle="No">${pairChoices
      .map(
        (choice) =>
          `<response_label ident="${choice.identifier}"><material><mattext texttype="text/plain">${escapeXmlText(choice.text)}</mattext></material></response_label>`,
      )
      .join("")}</render_choice></response_lid>`,
    correct: encodedCorrect,
    scoring: encodedCorrect.length > 0 ? "automatic" : "unscored",
    fallback: "choice",
    emitted: "response_lid",
    processingXml: choiceCondition(
      identifier,
      encodedCorrect,
      pairChoices.map((choice) => choice.identifier),
      encodedCorrect.length > 1 ? "multiple" : "single",
      dialect,
    ),
    diagnostics: [
      {
        code: "profile.qti12.fallback.choice",
        severity: "warning",
        message:
          "Converted the relationship task to explicit labeled relationship choices with equivalent deterministic scoring.",
        path: sourcePath,
      },
    ],
  };
}

export function matchResponse(
  interaction: QtiInteraction,
  correct: readonly string[],
  sourcePath: string | undefined,
  dialect: Qti12WireDialect,
): Qti12Response {
  const [sources, targets] = pairSides(interaction);
  if (sources.length === 0 || targets.length === 0) {
    return pairChoiceResponse(interaction, "RESPONSE", correct, sourcePath, dialect);
  }
  const correctBySource = new Map(
    correct.flatMap((pair) => {
      const [source, target] = pair.trim().split(/\s+/, 2);
      return source && target ? [[source, target] as const] : [];
    }),
  );
  return buildMatchResponse({
    sources: sources.map((choice) => ({
      identifier: choice.identifier,
      label: choiceLabel(choice),
    })),
    targets: targets.map((choice) => ({
      identifier: choice.identifier,
      label: choiceLabel(choice),
    })),
    correctBySource,
    sourcePath,
    dialect,
  });
}

export function sequenceAsMatchResponse(context: Qti12MapContext): Qti12Response {
  const targets = sequenceTargetChoices(context.interaction);
  if (targets.length === 0) {
    return manualExtendedTextQti12Response(context);
  }
  const ordered = resolveSequenceCorrect(context.correct, targets);
  if (ordered.length === 0) {
    return manualExtendedTextQti12Response(context);
  }
  const sources = ordered.map((_, index) => ({
    identifier: `POS_${String(index + 1)}`,
    label: `Step ${String(index + 1)}`,
  }));
  const correctBySource = new Map(
    ordered.map((targetId, index) => [`POS_${String(index + 1)}`, targetId] as const),
  );
  return buildMatchResponse({
    sources,
    targets,
    correctBySource,
    sourcePath: context.sourcePath,
    dialect: context.dialect,
    fallback: "matching",
    diagnostic: context.policy.diagnostic
      ? {
          ...context.policy.diagnostic,
          severity: "warning",
          path: context.sourcePath,
        }
      : context.fallbackDiagnostic("matching"),
  });
}

function sequenceTargetChoices(
  interaction: QtiInteraction,
): readonly { readonly identifier: string; readonly label: string }[] {
  return interaction.choices
    .filter((choice) => choice.role === "simpleChoice" || choice.role === "hotspot")
    .map((choice) => ({
      identifier: choice.identifier,
      label: choiceLabel(choice).trim(),
    }))
    .filter((choice) => choice.label.length > 0);
}

function resolveSequenceCorrect(
  correct: readonly string[],
  targets: readonly { readonly identifier: string }[],
): string[] {
  const targetIds = new Set(targets.map((target) => qti12Identifier(target.identifier)));
  const ordered = correct
    .map((value) => qti12Identifier(value))
    .filter((value) => targetIds.has(value));
  if (ordered.length === targets.length) return ordered;
  if (ordered.length > 0) return ordered;
  return targets.map((target) => qti12Identifier(target.identifier));
}

function buildMatchResponse(input: {
  readonly sources: readonly { readonly identifier: string; readonly label: string }[];
  readonly targets: readonly { readonly identifier: string; readonly label: string }[];
  readonly correctBySource: ReadonlyMap<string, string>;
  readonly sourcePath: string | undefined;
  readonly dialect: Qti12WireDialect;
  readonly fallback?: "matching" | undefined;
  readonly diagnostic?: QtiTranscodeDiagnostic | undefined;
}): Qti12Response {
  const controls = input.sources
    .map(
      (source) => `<response_lid ident="${escapeXmlAttribute(
        isCanvasQti12Dialect(input.dialect)
          ? `response_${qti12Identifier(source.identifier)}`
          : qti12Identifier(source.identifier),
      )}" rcardinality="Single">
        <material><mattext texttype="text/plain">${escapeXmlText(source.label)}</mattext></material>
        <render_choice shuffle="No">${input.targets
          .map(
            (target) =>
              `<response_label ident="${escapeXmlAttribute(qti12Identifier(target.identifier))}"><material><mattext texttype="text/plain">${escapeXmlText(target.label)}</mattext></material></response_label>`,
          )
          .join("")}</render_choice>
      </response_lid>`,
    )
    .join("");
  const score = input.correctBySource.size === 0 ? 0 : 100 / input.correctBySource.size;
  const processing = [...input.correctBySource].map(([source, target]) =>
    condition(
      isCanvasQti12Dialect(input.dialect)
        ? `response_${qti12Identifier(source)}`
        : qti12Identifier(source),
      [qti12Identifier(target)],
      input.dialect,
      score,
    ),
  );
  const correctPairs = [...input.correctBySource].map(([source, target]) => `${source} ${target}`);
  return {
    identifier: "MATCH",
    xml: controls,
    correct: correctPairs,
    scoring: processing.length > 0 ? "automatic" : "unscored",
    fallback: input.fallback,
    emitted: "response_lid",
    processingXml: processing.join(""),
    diagnostics: input.diagnostic ? [input.diagnostic] : [],
  };
}

export function serializeCanvasHotspot(
  identifier: string,
  interaction: QtiInteraction,
  correct: readonly string[],
): string {
  const stage = interaction.object ?? interaction.positionObjectStage;
  return canvasHotspotResponse(
    identifier,
    interaction,
    correct,
    stage ? serializeQti12Asset(stage) : "",
  );
}

function serializeChoiceContent(choice: QtiChoice, dialect: Qti12WireDialect): string {
  return isCanvasQti12Dialect(dialect)
    ? serializeRichChoiceContent(choice)
    : escapeXmlText(choiceLabel(choice));
}

export function choiceCardinality(interaction: QtiInteraction): "single" | "multiple" | "ordered" {
  return interaction.type === "order"
    ? "ordered"
    : interaction.responseCardinality === "multiple"
      ? "multiple"
      : "single";
}

/** Canonical manual written-response envelope for QTI 1.2 policy fallbacks. */
export function manualExtendedTextQti12Response(
  context: Qti12MapContext,
  instruction = manualInstructionFor(context.interaction),
  diagnosticSeverity: "info" | "warning" = "warning",
): Qti12Response {
  return {
    identifier: context.identifier,
    xml: extendedTextResponse(context.identifier, instruction, context.dialect),
    correct: [],
    scoring: "manual",
    fallback: "extended-text",
    emitted: "response_str",
    processingXml: "",
    diagnostics: context.policy.diagnostic
      ? [
          {
            ...context.policy.diagnostic,
            severity: diagnosticSeverity,
            path: context.sourcePath,
          },
        ]
      : [context.fallbackDiagnostic("extended-text")],
  };
}

export function textEntryResponse(context: Qti12MapContext): Qti12Response {
  const normalizedCorrect =
    context.interaction.type === "selectPoint" || context.interaction.type === "positionObject"
      ? context.correct.map(normalizePoint)
      : context.correct;
  return {
    identifier: context.identifier,
    xml: textResponse(context.identifier, context.interaction, context.dialect),
    correct: normalizedCorrect,
    scoring: normalizedCorrect.length > 0 ? "automatic" : "unscored",
    fallback: interactionPolicyFallback(context.policy),
    emitted: "response_str",
    processingXml: conditions(context.identifier, normalizedCorrect, context.dialect),
    diagnostics:
      context.policy.fidelity === "lossy"
        ? [context.fallbackDiagnostic(interactionPolicyFallback(context.policy) ?? "text-entry")]
        : [],
  };
}

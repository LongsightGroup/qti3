import type { QtiChoice, QtiInteraction } from "@longsightgroup/qti3-core";

import { itemMaximumScore } from "./item-score.js";
import { interactionPolicyFallback, type MoodleInteractionPolicy } from "./profiles.js";
import { declarationFor } from "./qti12/mappers.js";
import {
  choiceLabel,
  manualInstructionFor,
  normalizePoint,
  pairSides,
  values,
} from "./qti12/shared.js";
import type { NormalizedQti3Item } from "./source.js";
import type { QtiTranscodeDiagnostic, QtiTranscodeScoringDisposition } from "./types.js";

interface MoodleMappedInteraction {
  readonly source: QtiInteraction["type"];
  readonly emitted: string;
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly fallback?: string | undefined;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

interface MoodleQuestionBase {
  readonly scoring: QtiTranscodeScoringDisposition;
  readonly emitted: string;
  readonly fallback?: string | undefined;
  readonly instruction?: string | undefined;
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

interface MoodleAnswer {
  readonly text: string;
  readonly fraction: number;
}

type MoodleQuestion =
  | (MoodleQuestionBase & {
      readonly type: "multichoice";
      readonly single: boolean;
      readonly answers: readonly MoodleAnswer[];
    })
  | (MoodleQuestionBase & {
      readonly type: "matching";
      readonly subquestions: readonly {
        readonly question: string;
        readonly answer: string;
      }[];
    })
  | (MoodleQuestionBase & {
      readonly type: "shortanswer";
      readonly answers: readonly string[];
    })
  | (MoodleQuestionBase & {
      readonly type: "numerical";
      readonly answers: readonly { readonly value: string; readonly tolerance: number }[];
    })
  | (MoodleQuestionBase & {
      readonly type: "essay";
      readonly attachments: 0 | 1;
    });

/** Semantic Moodle question plan produced before XML serialization. */
export interface MoodleItemPlan {
  readonly title: string;
  readonly defaultGrade: number;
  readonly question: MoodleQuestion;
  readonly mappings: readonly MoodleMappedInteraction[];
  readonly diagnostics: readonly QtiTranscodeDiagnostic[];
}

/** Map one normalized QTI item into a Moodle question plan. */
export function planMoodleItem(
  source: NormalizedQti3Item,
  policies: Readonly<Record<QtiInteraction["type"], MoodleInteractionPolicy>>,
): MoodleItemPlan {
  const interactions = source.item.interactions;
  const primaryInteraction = interactions[0];
  if (!primaryInteraction) {
    throw new Error("Moodle XML planning requires at least one interaction.");
  }
  const question =
    interactions.length === 1
      ? mapSingleInteraction(source, primaryInteraction, policies)
      : manualQuestion(
          primaryInteraction,
          source.sourcePath,
          [
            "Answer every part of the question in one complete response.",
            ...interactions.map(manualInstructionFor),
          ].join(" "),
          "profile.moodle.xml.multiple_interactions_manual",
        );
  const mappings = interactions.map<MoodleMappedInteraction>((interaction) => {
    const mapped =
      interactions.length === 1
        ? question
        : manualQuestion(
            interaction,
            source.sourcePath,
            manualInstructionFor(interaction),
            "profile.moodle.xml.multiple_interactions_manual",
          );
    return {
      source: interaction.type,
      emitted: mapped.emitted,
      scoring: mapped.scoring,
      fallback: mapped.fallback,
      diagnostics: mapped.diagnostics,
    };
  });
  return {
    title: source.item.title?.trim() || source.item.identifier || "Question",
    defaultGrade: itemMaximumScore(source.item),
    question,
    mappings,
    diagnostics: mappings.flatMap((mapping) => mapping.diagnostics),
  };
}

function mapSingleInteraction(
  source: NormalizedQti3Item,
  interaction: QtiInteraction,
  policies: Readonly<Record<QtiInteraction["type"], MoodleInteractionPolicy>>,
): MoodleQuestion {
  const policy = policies[interaction.type];
  const correct = values(declarationFor(source, interaction)?.correctResponse ?? null);
  if (interaction.type === "match") {
    return matchingQuestion(interaction, correct, source.sourcePath);
  }
  if (interaction.type === "order" || interaction.type === "graphicOrder") {
    return sequenceQuestion(interaction, correct, source.sourcePath);
  }
  if (interaction.type === "gapMatch" || interaction.type === "graphicGapMatch") {
    return relationshipChoiceQuestion(interaction, correct, source.sourcePath);
  }
  if (
    interaction.type === "textEntry" ||
    interaction.type === "slider" ||
    interaction.type === "selectPoint" ||
    interaction.type === "positionObject"
  ) {
    return scalarQuestion(interaction, correct, policy, source.sourcePath);
  }
  if (policy.transformation === "choice-fallback" || interaction.type === "choice") {
    return choiceQuestion(interaction, correct, policy, source.sourcePath);
  }
  return manualQuestion(interaction, source.sourcePath);
}

function choiceQuestion(
  interaction: QtiInteraction,
  correct: readonly string[],
  policy: MoodleInteractionPolicy,
  sourcePath: string | undefined,
): MoodleQuestion {
  const choices = usableChoices(interaction);
  if (choices.length < 2 || correct.length === 0) {
    return manualQuestion(interaction, sourcePath);
  }
  const multiple = interaction.responseCardinality === "multiple" || correct.length > 1;
  const correctIds = new Set(correct);
  const correctFraction = 100 / correctIds.size;
  const incorrectCount = choices.filter((choice) => !correctIds.has(choice.identifier)).length;
  const incorrectFraction = multiple && incorrectCount > 0 ? -100 / incorrectCount : 0;
  const diagnostic =
    policy.fidelity === "lossy" || multiple
      ? fallbackDiagnostic(
          interaction,
          sourcePath,
          "choice",
          multiple
            ? "Mapped the response to Moodle multichoice with deterministic partial-credit fractions."
            : "Converted the interaction to labeled Moodle choices.",
        )
      : undefined;
  return {
    type: "multichoice",
    single: !multiple,
    answers: choices.map((choice) => ({
      text: choiceLabel(choice),
      fraction: correctIds.has(choice.identifier) ? correctFraction : incorrectFraction,
    })),
    scoring: "automatic",
    emitted: "multichoice",
    fallback: interactionPolicyFallback(policy),
    diagnostics: diagnostic ? [diagnostic] : [],
  };
}

function relationshipChoiceQuestion(
  interaction: QtiInteraction,
  correct: readonly string[],
  sourcePath: string | undefined,
): MoodleQuestion {
  const [left, right] = pairSides(interaction);
  const pairChoices = left.flatMap((sourceChoice) =>
    right.map((targetChoice) => ({
      identifier: `${sourceChoice.identifier} ${targetChoice.identifier}`,
      label: `${choiceLabel(sourceChoice)} — ${choiceLabel(targetChoice)}`,
    })),
  );
  if (pairChoices.length < 2 || correct.length === 0) {
    return manualQuestion(interaction, sourcePath);
  }
  const correctPairs = new Set(correct);
  const correctFraction = 100 / correctPairs.size;
  const incorrectCount = pairChoices.filter(
    (choice) => !correctPairs.has(choice.identifier),
  ).length;
  const incorrectFraction = incorrectCount > 0 ? -100 / incorrectCount : 0;
  return {
    type: "multichoice",
    single: correct.length <= 1,
    answers: pairChoices.map((choice) => ({
      text: choice.label,
      fraction: correctPairs.has(choice.identifier) ? correctFraction : incorrectFraction,
    })),
    scoring: "automatic",
    emitted: "multichoice",
    fallback: "choice",
    diagnostics: [
      fallbackDiagnostic(
        interaction,
        sourcePath,
        "choice",
        "Converted the relationship task to explicit labeled relationship choices.",
      ),
    ],
  };
}

function scalarQuestion(
  interaction: QtiInteraction,
  correct: readonly string[],
  policy: MoodleInteractionPolicy,
  sourcePath: string | undefined,
): MoodleQuestion {
  if (correct.length === 0) return manualQuestion(interaction, sourcePath);
  const normalizedCorrect =
    interaction.type === "selectPoint" || interaction.type === "positionObject"
      ? correct.map(normalizePoint)
      : correct;
  const numerical = interaction.type === "slider";
  const instruction = numerical
    ? "Enter a value within the stated range."
    : interaction.type === "selectPoint" || interaction.type === "positionObject"
      ? "Enter the response as x,y coordinates."
      : undefined;
  const diagnostic =
    policy.fidelity === "lossy"
      ? fallbackDiagnostic(
          interaction,
          sourcePath,
          "text-entry",
          `Converted the interaction to a Moodle ${numerical ? "numerical" : "short-answer"} response.`,
        )
      : undefined;
  const common = {
    scoring: "automatic" as const,
    fallback: interactionPolicyFallback(policy),
    instruction,
    diagnostics: diagnostic ? [diagnostic] : [],
  };
  return numerical
    ? {
        ...common,
        type: "numerical",
        emitted: "numerical",
        answers: normalizedCorrect.map((value) => ({ value, tolerance: 0 })),
      }
    : {
        ...common,
        type: "shortanswer",
        emitted: "shortanswer",
        answers: normalizedCorrect,
      };
}

function matchingQuestion(
  interaction: QtiInteraction,
  correctPairs: readonly string[],
  sourcePath: string | undefined,
): MoodleQuestion {
  const [sources, targets] = pairSides(interaction);
  const correctBySource = new Map(
    correctPairs.flatMap((pair) => {
      const [source, target] = pair.trim().split(/\s+/, 2);
      return source && target ? [[source, target] as const] : [];
    }),
  );
  if (sources.length < 2 || targets.length < 3 || correctBySource.size < 2) {
    return manualQuestion(interaction, sourcePath);
  }
  const targetById = new Map(targets.map((choice) => [choice.identifier, choice]));
  const usedTargets = new Set(correctBySource.values());
  const subquestions = sources.flatMap((sourceChoice) => {
    const target = targetById.get(correctBySource.get(sourceChoice.identifier) ?? "");
    return target ? [{ question: choiceLabel(sourceChoice), answer: choiceLabel(target) }] : [];
  });
  const distractors = targets
    .filter((target) => !usedTargets.has(target.identifier))
    .map((target) => ({ question: "", answer: choiceLabel(target) }));
  return {
    type: "matching",
    subquestions: [...subquestions, ...distractors],
    scoring: "automatic",
    emitted: "matching",
    instruction: `Match each prompt to an answer. Prompts: ${sources
      .map(choiceLabel)
      .join("; ")}. Available answers: ${targets.map(choiceLabel).join("; ")}.`,
    diagnostics: [],
  };
}

function sequenceQuestion(
  interaction: QtiInteraction,
  correct: readonly string[],
  sourcePath: string | undefined,
): MoodleQuestion {
  const choices = usableChoices(interaction);
  const choiceById = new Map(choices.map((choice) => [choice.identifier, choice]));
  const ordered = (correct.length > 0 ? correct : choices.map((choice) => choice.identifier))
    .map((identifier) => choiceById.get(identifier))
    .filter((choice): choice is QtiChoice => choice !== undefined);
  if (ordered.length < 3) return manualQuestion(interaction, sourcePath);
  return {
    type: "matching",
    subquestions: ordered.map((choice, index) => ({
      question: `Position ${String(index + 1)}`,
      answer: choiceLabel(choice),
    })),
    scoring: "automatic",
    emitted: "matching",
    fallback: "matching",
    diagnostics: [
      fallbackDiagnostic(
        interaction,
        sourcePath,
        "matching",
        "Converted the ordered response to one Moodle matching row per sequence position.",
      ),
    ],
  };
}

function manualQuestion(
  interaction: QtiInteraction,
  sourcePath: string | undefined,
  instruction = manualInstructionFor(interaction),
  code = "profile.moodle.xml.fallback.essay",
): MoodleQuestion {
  const upload = interaction.type === "upload";
  return {
    type: "essay",
    attachments: upload ? 1 : 0,
    scoring: "manual",
    emitted: "essay",
    fallback: interaction.type === "extendedText" || upload ? undefined : "extended-text",
    instruction,
    diagnostics:
      interaction.type === "extendedText" || upload
        ? []
        : [
            {
              code,
              severity: "warning",
              message: `Converted ${interaction.type} to a Moodle essay question for manual grading.`,
              path: sourcePath,
            },
          ],
  };
}

function usableChoices(interaction: QtiInteraction): QtiChoice[] {
  return interaction.choices.filter((choice) => choiceLabel(choice).trim().length > 0);
}

function fallbackDiagnostic(
  interaction: QtiInteraction,
  path: string | undefined,
  fallback: string,
  message: string,
): QtiTranscodeDiagnostic {
  return {
    code: `profile.moodle.xml.fallback.${fallback}`,
    severity: "warning",
    message: `${message} Source interaction: ${interaction.type}.`,
    path,
  };
}

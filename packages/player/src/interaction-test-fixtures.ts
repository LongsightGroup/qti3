import {
  deprecatedInteractionSupport,
  interactionRegistryStatus,
  interactionSupport,
  type QtiInteraction,
} from "@longsightgroup/qti3-core";

const defaultSource = { line: 1, column: 1, offset: 0, path: "item" };

const qtiNameByInteractionType = new Map(
  [...interactionSupport, ...deprecatedInteractionSupport].map((entry) => [
    entry.interactionType,
    entry.qtiName,
  ]),
);

export function testInteraction(
  overrides: Partial<QtiInteraction> & Pick<QtiInteraction, "type">,
): QtiInteraction {
  const qtiName =
    overrides.qtiName ?? qtiNameByInteractionType.get(overrides.type) ?? `qti-${overrides.type}`;
  const interaction = {
    registryStatus: interactionRegistryStatus(qtiName),
    qtiName,
    responseIdentifier: "RESPONSE",
    responseCardinality: "single" as const,
    responseBaseType: "identifier" as const,
    choices: [],
    attributes: {},
    childElements: [],
    text: "",
    source: defaultSource,
    ...overrides,
  };
  return {
    ...interaction,
    registryStatus: overrides.registryStatus ?? interactionRegistryStatus(interaction.qtiName),
  };
}

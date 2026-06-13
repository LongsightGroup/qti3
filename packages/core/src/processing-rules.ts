import type { QtiResponseCondition, QtiResponseRule } from "./types.js";

export function responseConditionsFromRules(
  rules: readonly QtiResponseRule[],
): QtiResponseCondition[] {
  return rules.flatMap((rule) => {
    if (rule.type === "responseCondition") return [rule.condition];
    if (rule.type === "responseProcessingFragment") return responseConditionsFromRules(rule.rules);
    return [];
  });
}

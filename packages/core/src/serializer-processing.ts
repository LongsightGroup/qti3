import { responseConditionsFromRules } from "./processing-rules.js";
import { serializeExpression } from "./serializer-processing-expressions.js";
import {
  addSerializerDiagnostic,
  renderElement,
  type SerializationContext,
  type XmlAttribute,
} from "./serializer-processing-xml.js";
import type {
  QtiDiagnostic,
  QtiResponseBranch,
  QtiResponseCondition,
  QtiResponseProcessing,
  QtiResponseRule,
} from "./types.js";

export interface QtiSerializeResponseProcessingResult {
  ok: boolean;
  xml?: string | undefined;
  diagnostics: QtiDiagnostic[];
}

export function serializeResponseProcessing(
  processing: QtiResponseProcessing,
): QtiSerializeResponseProcessingResult {
  const context: SerializationContext = { diagnostics: [] };
  const rules = responseProcessingRules(processing, context);

  const attrs: XmlAttribute[] = [];
  if (processing.template !== undefined) attrs.push(["template", processing.template]);

  const body = rules.flatMap((rule) => serializeResponseRule(rule, context, 1));
  const hasErrors = context.diagnostics.some((diagnostic) => diagnostic.severity === "error");

  if (hasErrors) {
    return { ok: false, diagnostics: context.diagnostics };
  }

  return {
    ok: true,
    xml: renderElement("qti-response-processing", attrs, body, 0).join("\n"),
    diagnostics: context.diagnostics,
  };
}

function responseProcessingRules(
  processing: QtiResponseProcessing,
  context: SerializationContext,
): QtiResponseRule[] {
  if (processing.conditions.length === 0) return processing.rules;

  const flattened = responseConditionsFromRules(processing.rules);
  if (sameConditionReferences(flattened, processing.conditions)) return processing.rules;

  if (processing.rules.length === 0) {
    return processing.conditions.map((condition) => ({ type: "responseCondition", condition }));
  }

  addSerializerDiagnostic(context, "responseProcessing.serialize.conditions", {
    message:
      "QtiResponseProcessing.conditions must be represented as responseCondition rules when rules are present.",
  });
  return processing.rules;
}

function sameConditionReferences(
  left: QtiResponseCondition[],
  right: QtiResponseCondition[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((condition, index) => condition === right[index]);
}

function serializeResponseRule(
  rule: QtiResponseRule,
  context: SerializationContext,
  indent: number,
): string[] {
  switch (rule.type) {
    case "setOutcomeValue": {
      const expressionXml = serializeExpression(rule.expression, context, indent + 1);
      if (!requireRuleIdentifier(rule.identifier, "qti-set-outcome-value", rule.source, context)) {
        return [];
      }
      return renderElement(
        "qti-set-outcome-value",
        [["identifier", rule.identifier]],
        expressionXml,
        indent,
      );
    }
    case "lookupOutcomeValue": {
      const expressionXml = serializeExpression(rule.expression, context, indent + 1);
      if (
        !requireRuleIdentifier(rule.identifier, "qti-lookup-outcome-value", rule.source, context)
      ) {
        return [];
      }
      return renderElement(
        "qti-lookup-outcome-value",
        [["identifier", rule.identifier]],
        expressionXml,
        indent,
      );
    }
    case "exitResponse":
      return renderElement("qti-exit-response", [], [], indent);
    case "responseCondition":
      return serializeResponseCondition(rule.condition, context, indent);
    case "responseProcessingFragment":
      return renderElement(
        "qti-response-processing-fragment",
        [],
        rule.rules.flatMap((child) => serializeResponseRule(child, context, indent + 1)),
        indent,
      );
  }
}

function serializeResponseCondition(
  condition: QtiResponseCondition,
  context: SerializationContext,
  indent: number,
): string[] {
  if (condition.ifExpression === undefined) {
    addSerializerDiagnostic(context, "responseProcessing.serialize.missingExpression", {
      message: "qti-response-condition requires an if expression.",
    });
    return [];
  }

  const children: string[] = [
    ...renderElement(
      "qti-response-if",
      [],
      [
        ...serializeExpression(condition.ifExpression, context, indent + 2),
        ...condition.thenRules.flatMap((rule) => serializeResponseRule(rule, context, indent + 2)),
      ],
      indent + 1,
    ),
  ];

  for (const branch of condition.elseIfs) {
    children.push(...serializeResponseBranch(branch, context, indent + 1));
  }

  if (condition.elseRules.length > 0) {
    children.push(
      ...renderElement(
        "qti-response-else",
        [],
        condition.elseRules.flatMap((rule) => serializeResponseRule(rule, context, indent + 2)),
        indent + 1,
      ),
    );
  }

  return renderElement("qti-response-condition", [], children, indent);
}

function serializeResponseBranch(
  branch: QtiResponseBranch,
  context: SerializationContext,
  indent: number,
): string[] {
  if (branch.expression === undefined) {
    addSerializerDiagnostic(context, "responseProcessing.serialize.missingExpression", {
      message: "qti-response-else-if requires an expression.",
    });
    return [];
  }
  return renderElement(
    "qti-response-else-if",
    [],
    [
      ...serializeExpression(branch.expression, context, indent + 1),
      ...branch.rules.flatMap((rule) => serializeResponseRule(rule, context, indent + 1)),
    ],
    indent,
  );
}

function requireRuleIdentifier(
  identifier: string,
  tagName: string,
  source: QtiResponseRule["source"],
  context: SerializationContext,
): boolean {
  if (identifier !== "") return true;
  addSerializerDiagnostic(context, "responseProcessing.serialize.invalidAttribute", {
    message: `${tagName} requires a non-empty identifier.`,
    source,
  });
  return false;
}

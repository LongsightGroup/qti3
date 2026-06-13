import type { QtiProcessingExpression } from "./types.js";

const baseOne = {
  type: "baseValue",
  baseType: "integer",
  value: 1,
} satisfies QtiProcessingExpression;
const baseTwo = {
  type: "baseValue",
  baseType: "integer",
  value: 2,
} satisfies QtiProcessingExpression;
const variableScore = { type: "variable", identifier: "SCORE" } satisfies QtiProcessingExpression;
const variableResponse = {
  type: "variable",
  identifier: "RESPONSE",
} satisfies QtiProcessingExpression;

export type ExpressionCoverage = {
  [K in QtiProcessingExpression["type"]]: {
    expression: Extract<QtiProcessingExpression, { type: K }>;
    xml: string;
  };
};

export const expressionCoverage = {
  baseValue: {
    expression: baseOne,
    xml: '    <qti-base-value base-type="integer">1</qti-base-value>',
  },
  null: { expression: { type: "null" }, xml: "    <qti-null/>" },
  isNull: {
    expression: { type: "isNull", identifier: "RESPONSE" },
    xml: [
      "    <qti-is-null>",
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-is-null>",
    ].join("\n"),
  },
  matchCorrect: {
    expression: {
      type: "matchCorrect",
      identifier: "RESPONSE",
      correctIdentifier: "RESPONSE",
    },
    xml: [
      "    <qti-match>",
      '      <qti-variable identifier="RESPONSE"/>',
      '      <qti-correct identifier="RESPONSE"/>',
      "    </qti-match>",
    ].join("\n"),
  },
  match: {
    expression: { type: "match", left: variableResponse, right: baseOne },
    xml: [
      "    <qti-match>",
      '      <qti-variable identifier="RESPONSE"/>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-match>",
    ].join("\n"),
  },
  correct: {
    expression: { type: "correct", identifier: "RESPONSE" },
    xml: '    <qti-correct identifier="RESPONSE"/>',
  },
  default: {
    expression: { type: "default", identifier: "SCORE" },
    xml: '    <qti-default identifier="SCORE"/>',
  },
  mapResponse: {
    expression: { type: "mapResponse", identifier: "RESPONSE" },
    xml: '    <qti-map-response identifier="RESPONSE"/>',
  },
  mapResponsePoint: {
    expression: { type: "mapResponsePoint", identifier: "RESPONSE" },
    xml: '    <qti-map-response-point identifier="RESPONSE"/>',
  },
  variable: {
    expression: variableResponse,
    xml: '    <qti-variable identifier="RESPONSE"/>',
  },
  randomInteger: {
    expression: { type: "randomInteger", min: 1, max: 10, step: 1, attributes: {} },
    xml: '    <qti-random-integer min="1" max="10" step="1"/>',
  },
  randomFloat: {
    expression: { type: "randomFloat", min: 0, max: 1, attributes: {} },
    xml: '    <qti-random-float min="0" max="1"/>',
  },
  random: {
    expression: { type: "random", values: [baseOne, baseTwo] },
    xml: [
      "    <qti-random>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-random>",
    ].join("\n"),
  },
  multiple: {
    expression: { type: "multiple", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-multiple>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-multiple>",
    ].join("\n"),
  },
  ordered: {
    expression: { type: "ordered", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-ordered>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-ordered>",
    ].join("\n"),
  },
  index: {
    expression: { type: "index", expression: variableResponse, n: "1" },
    xml: [
      '    <qti-index n="1">',
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-index>",
    ].join("\n"),
  },
  containerSize: {
    expression: { type: "containerSize", expression: variableResponse },
    xml: [
      "    <qti-container-size>",
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-container-size>",
    ].join("\n"),
  },
  sum: {
    expression: { type: "sum", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-sum>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-sum>",
    ].join("\n"),
  },
  product: {
    expression: { type: "product", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-product>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-product>",
    ].join("\n"),
  },
  min: {
    expression: { type: "min", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-min>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-min>",
    ].join("\n"),
  },
  max: {
    expression: { type: "max", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-max>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-max>",
    ].join("\n"),
  },
  subtract: {
    expression: { type: "subtract", left: baseTwo, right: baseOne },
    xml: [
      "    <qti-subtract>",
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-subtract>",
    ].join("\n"),
  },
  divide: {
    expression: { type: "divide", left: baseTwo, right: baseOne },
    xml: [
      "    <qti-divide>",
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-divide>",
    ].join("\n"),
  },
  power: {
    expression: { type: "power", left: baseTwo, right: baseOne },
    xml: [
      "    <qti-power>",
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-power>",
    ].join("\n"),
  },
  integerDivide: {
    expression: { type: "integerDivide", left: baseTwo, right: baseOne },
    xml: [
      "    <qti-integer-divide>",
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-integer-divide>",
    ].join("\n"),
  },
  integerModulus: {
    expression: { type: "integerModulus", left: baseTwo, right: baseOne },
    xml: [
      "    <qti-integer-modulus>",
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-integer-modulus>",
    ].join("\n"),
  },
  round: {
    expression: { type: "round", expression: baseOne },
    xml: [
      "    <qti-round>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-round>",
    ].join("\n"),
  },
  roundTo: {
    expression: {
      type: "roundTo",
      expression: baseOne,
      roundingMode: "decimalPlaces",
      figures: 1,
    },
    xml: [
      '    <qti-round-to rounding-mode="decimalPlaces" figures="1">',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-round-to>",
    ].join("\n"),
  },
  truncate: {
    expression: { type: "truncate", expression: baseOne },
    xml: [
      "    <qti-truncate>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-truncate>",
    ].join("\n"),
  },
  integerToFloat: {
    expression: { type: "integerToFloat", expression: baseOne },
    xml: [
      "    <qti-integer-to-float>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-integer-to-float>",
    ].join("\n"),
  },
  and: {
    expression: { type: "and", expressions: [variableScore] },
    xml: ["    <qti-and>", '      <qti-variable identifier="SCORE"/>', "    </qti-and>"].join("\n"),
  },
  anyN: {
    expression: { type: "anyN", min: "1", max: "2", expressions: [variableScore] },
    xml: [
      '    <qti-any-n min="1" max="2">',
      '      <qti-variable identifier="SCORE"/>',
      "    </qti-any-n>",
    ].join("\n"),
  },
  or: {
    expression: { type: "or", expressions: [variableScore] },
    xml: ["    <qti-or>", '      <qti-variable identifier="SCORE"/>', "    </qti-or>"].join("\n"),
  },
  not: {
    expression: { type: "not", expression: variableScore },
    xml: ["    <qti-not>", '      <qti-variable identifier="SCORE"/>', "    </qti-not>"].join("\n"),
  },
  equal: {
    expression: { type: "equal", left: baseOne, right: baseOne },
    xml: [
      "    <qti-equal>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-equal>",
    ].join("\n"),
  },
  equalRounded: {
    expression: {
      type: "equalRounded",
      left: baseOne,
      right: baseOne,
      roundingMode: "decimalPlaces",
      figures: 1,
    },
    xml: [
      '    <qti-equal-rounded rounding-mode="decimalPlaces" figures="1">',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-equal-rounded>",
    ].join("\n"),
  },
  numericCompare: {
    expression: { type: "numericCompare", operator: "gte", left: variableScore, right: baseOne },
    xml: [
      "    <qti-gte>",
      '      <qti-variable identifier="SCORE"/>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-gte>",
    ].join("\n"),
  },
  durationCompare: {
    expression: { type: "durationCompare", operator: "lt", left: variableScore, right: baseOne },
    xml: [
      "    <qti-duration-lt>",
      '      <qti-variable identifier="SCORE"/>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-duration-lt>",
    ].join("\n"),
  },
  stringMatch: {
    expression: {
      type: "stringMatch",
      left: variableResponse,
      right: { type: "baseValue", baseType: "string", value: "A" },
      caseSensitive: false,
      substring: true,
    },
    xml: [
      '    <qti-string-match case-sensitive="false" substring="true">',
      '      <qti-variable identifier="RESPONSE"/>',
      '      <qti-base-value base-type="string">A</qti-base-value>',
      "    </qti-string-match>",
    ].join("\n"),
  },
  substring: {
    expression: {
      type: "substring",
      left: variableResponse,
      right: { type: "baseValue", baseType: "string", value: "A" },
      caseSensitive: true,
    },
    xml: [
      '    <qti-substring case-sensitive="true">',
      '      <qti-variable identifier="RESPONSE"/>',
      '      <qti-base-value base-type="string">A</qti-base-value>',
      "    </qti-substring>",
    ].join("\n"),
  },
  patternMatch: {
    expression: { type: "patternMatch", expression: variableResponse, pattern: "[A-Z]+" },
    xml: [
      '    <qti-pattern-match pattern="[A-Z]+">',
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-pattern-match>",
    ].join("\n"),
  },
  fieldValue: {
    expression: { type: "fieldValue", fieldIdentifier: "candidate", expression: variableResponse },
    xml: [
      '    <qti-field-value field-identifier="candidate">',
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-field-value>",
    ].join("\n"),
  },
  member: {
    expression: { type: "member", value: baseOne, collection: variableResponse },
    xml: [
      "    <qti-member>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-member>",
    ].join("\n"),
  },
  delete: {
    expression: { type: "delete", value: baseOne, collection: variableResponse },
    xml: [
      "    <qti-delete>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-delete>",
    ].join("\n"),
  },
  contains: {
    expression: { type: "contains", collection: variableResponse, values: baseOne },
    xml: [
      "    <qti-contains>",
      '      <qti-variable identifier="RESPONSE"/>',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-contains>",
    ].join("\n"),
  },
  gcd: {
    expression: { type: "gcd", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-gcd>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-gcd>",
    ].join("\n"),
  },
  inside: {
    expression: {
      type: "inside",
      shape: "circle",
      coords: [10, 20, 5],
      attributes: { coords: "0,0,0", shape: "rect", tolerance: "2" },
      expression: variableResponse,
    },
    xml: [
      '    <qti-inside shape="rect" coords="0,0,0" tolerance="2">',
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-inside>",
    ].join("\n"),
  },
  lcm: {
    expression: { type: "lcm", expressions: [baseOne, baseTwo] },
    xml: [
      "    <qti-lcm>",
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      '      <qti-base-value base-type="integer">2</qti-base-value>',
      "    </qti-lcm>",
    ].join("\n"),
  },
  mathConstant: {
    expression: { type: "mathConstant", name: "pi" },
    xml: '    <qti-math-constant name="pi"/>',
  },
  mathOperator: {
    expression: { type: "mathOperator", name: "sin", expressions: [baseOne] },
    xml: [
      '    <qti-math-operator name="sin">',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-math-operator>",
    ].join("\n"),
  },
  repeat: {
    expression: { type: "repeat", numberRepeats: "2", expressions: [baseOne] },
    xml: [
      '    <qti-repeat number-repeats="2">',
      '      <qti-base-value base-type="integer">1</qti-base-value>',
      "    </qti-repeat>",
    ].join("\n"),
  },
  statsOperator: {
    expression: { type: "statsOperator", name: "mean", expression: variableResponse },
    xml: [
      '    <qti-stats-operator name="mean">',
      '      <qti-variable identifier="RESPONSE"/>',
      "    </qti-stats-operator>",
    ].join("\n"),
  },
  customOperator: {
    expression: {
      type: "customOperator",
      definition: "https://example.invalid/operator?a=1&b=2",
      className: "demo",
      attributes: { "data-extra": `"quoted"` },
      expressions: [{ type: "null" }],
    },
    xml: [
      '    <qti-custom-operator class="demo" data-extra="&quot;quoted&quot;" definition="https://example.invalid/operator?a=1&amp;b=2">',
      "      <qti-null/>",
      "    </qti-custom-operator>",
    ].join("\n"),
  },
} satisfies ExpressionCoverage;

export function expressionCoverageXml(expressionType: QtiProcessingExpression["type"]): string {
  return [
    "<qti-response-processing>",
    '  <qti-set-outcome-value identifier="SCORE">',
    expressionCoverage[expressionType].xml,
    "  </qti-set-outcome-value>",
    "</qti-response-processing>",
  ].join("\n");
}

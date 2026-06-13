/**
 * QTI processing-expression element tags used by the structured serializer.
 *
 * The parser still owns XML-to-model recognition in `parser-processing.ts`; when adding a new
 * expression variant, update parser behavior, serializer behavior, and the exhaustive coverage
 * table in `serializer-processing.fixtures.ts`.
 */

export const identifierExpressionTags = {
  correct: "qti-correct",
  default: "qti-default",
  mapResponse: "qti-map-response",
  mapResponsePoint: "qti-map-response-point",
  variable: "qti-variable",
} as const;

export type IdentifierExpressionType = keyof typeof identifierExpressionTags;

export const unaryExpressionTags = {
  containerSize: "qti-container-size",
  round: "qti-round",
  truncate: "qti-truncate",
  integerToFloat: "qti-integer-to-float",
} as const;

export type UnaryExpressionType = keyof typeof unaryExpressionTags;

export const naryExpressionTags = {
  multiple: "qti-multiple",
  ordered: "qti-ordered",
  sum: "qti-sum",
  product: "qti-product",
  min: "qti-min",
  max: "qti-max",
  and: "qti-and",
  or: "qti-or",
  gcd: "qti-gcd",
  lcm: "qti-lcm",
} as const;

export type NaryExpressionType = keyof typeof naryExpressionTags;

export const leftRightExpressionTags = {
  match: "qti-match",
  subtract: "qti-subtract",
  divide: "qti-divide",
  power: "qti-power",
  integerDivide: "qti-integer-divide",
  integerModulus: "qti-integer-modulus",
  equal: "qti-equal",
} as const;

export type LeftRightExpressionType = keyof typeof leftRightExpressionTags;

export const numericCompareTags = {
  lt: "qti-lt",
  lte: "qti-lte",
  gt: "qti-gt",
  gte: "qti-gte",
} as const;

export const durationCompareTags = {
  lt: "qti-duration-lt",
  gte: "qti-duration-gte",
} as const;

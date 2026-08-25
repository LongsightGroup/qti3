import type { QtiValue } from "./types.js";

export const MATH_OPERATOR_NAMES = [
  "abs",
  "acos",
  "acot",
  "acsc",
  "asec",
  "asin",
  "atan",
  "atan2",
  "ceil",
  "cos",
  "cosh",
  "cot",
  "coth",
  "csc",
  "csch",
  "exp",
  "floor",
  "ln",
  "log",
  "sec",
  "sech",
  "signum",
  "sin",
  "sinh",
  "tan",
  "tanh",
  "toDegrees",
  "toRadians",
] as const;

export const STATS_OPERATOR_NAMES = [
  "mean",
  "sampleVariance",
  "sampleSD",
  "popVariance",
  "popSD",
] as const;

/** Round decimal ties away from zero without an intermediate scaled binary float. */
export function roundToDecimalPlaces(value: number, figures: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const decimal = decimalDigits(value);
  const retainedDigits = decimal.exponent + figures + 1;
  return roundDecimalDigits(value, decimal, retainedDigits);
}

/** Round significant decimal digits, with half-up ties on the absolute magnitude. */
export function roundToSignificantFigures(value: number, figures: number): number {
  if (value === 0 || figures <= 0) return 0;
  if (!Number.isFinite(value)) return Number.NaN;
  return roundDecimalDigits(value, decimalDigits(value), figures);
}

interface DecimalDigits {
  digits: string;
  exponent: number;
}

function decimalDigits(value: number): DecimalDigits {
  const [coefficient = "", exponent = "0"] = Math.abs(value).toExponential().split("e");
  return {
    digits: coefficient.replace(".", ""),
    exponent: Number(exponent),
  };
}

function roundDecimalDigits(value: number, decimal: DecimalDigits, retainedDigits: number): number {
  if (retainedDigits >= decimal.digits.length) return value;
  if (retainedDigits < 0) return value < 0 ? -0 : 0;

  const roundingDigit = decimal.digits[retainedDigits] ?? "0";
  const retained = retainedDigits === 0 ? 0n : BigInt(decimal.digits.slice(0, retainedDigits));
  const rounded = roundingDigit >= "5" ? retained + 1n : retained;
  if (rounded === 0n) return value < 0 ? -0 : 0;

  const unitExponent = decimal.exponent - retainedDigits + 1;
  return Number(`${value < 0 ? "-" : ""}${rounded}e${unitExponent}`);
}

export function roundWithMode(value: number, roundingMode: string, figures: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (roundingMode === "decimalPlaces") return roundToDecimalPlaces(value, figures);
  if (roundingMode === "significantFigures") return roundToSignificantFigures(value, figures);
  return null;
}

export function generalizedGcd(values: number[]): number {
  let result = 0;
  for (const value of values) {
    result = gcd(result, Math.abs(value));
  }
  return result;
}

export function generalizedLcm(values: number[]): number {
  if (values.some((value) => value === 0)) return 0;
  return values.reduce((result, value) => lcm(result, Math.abs(value)), 1);
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function lcm(left: number, right: number): number {
  return Math.abs(left * right) / gcd(left, right);
}

export function mathOperatorValue(name: string, values: number[]): QtiValue {
  const [first, second] = values;
  if (first === undefined) return null;
  switch (name) {
    case "abs":
      return finiteOrNull(Math.abs(first));
    case "acos":
      return Math.abs(first) > 1 ? null : finiteOrNull(Math.acos(first));
    case "acot":
      return finiteOrNull(Math.PI / 2 - Math.atan(1 / first));
    case "acsc":
      return Math.abs(first) < 1 ? null : finiteOrNull(Math.PI / 2 - Math.asin(1 / first));
    case "asec":
      return Math.abs(first) < 1 ? null : finiteOrNull(Math.PI / 2 - Math.acos(1 / first));
    case "asin":
      return Math.abs(first) > 1 ? null : finiteOrNull(Math.asin(first));
    case "atan":
      return finiteOrNull(Math.atan(first));
    case "atan2":
      return second === undefined ? null : finiteOrNull(Math.atan2(first, second));
    case "ceil":
      return finiteOrNull(Math.ceil(first));
    case "cos":
      return finiteOrNull(Math.cos(first));
    case "cosh":
      return finiteOrNull(Math.cosh(first));
    case "cot":
      return finiteOrNull(1 / Math.tan(first));
    case "coth":
      return finiteOrNull(1 / Math.tanh(first));
    case "csc":
      return finiteOrNull(1 / Math.sin(first));
    case "csch":
      return finiteOrNull(1 / Math.sinh(first));
    case "exp":
      return finiteOrNull(Math.exp(first));
    case "floor":
      return finiteOrNull(Math.floor(first));
    case "ln":
      return first < 0 ? null : finiteOrNull(Math.log(first));
    case "log":
      return first < 0 ? null : finiteOrNull(Math.log10(first));
    case "sec":
      return finiteOrNull(1 / Math.cos(first));
    case "sech":
      return finiteOrNull(1 / Math.cosh(first));
    case "signum":
      return finiteOrNull(Math.sign(first));
    case "sin":
      return finiteOrNull(Math.sin(first));
    case "sinh":
      return finiteOrNull(Math.sinh(first));
    case "tan":
      return finiteOrNull(Math.tan(first));
    case "tanh":
      return finiteOrNull(Math.tanh(first));
    case "toDegrees":
      return finiteOrNull((first * 180) / Math.PI);
    case "toRadians":
      return finiteOrNull((first * Math.PI) / 180);
    default:
      return null;
  }
}

export function statsOperatorValue(name: string, values: number[]): QtiValue {
  if (values.length === 0) return 0;
  const meanValue = mean(values);
  const squareDiffs = values.map((value) => (value - meanValue) ** 2);
  switch (name) {
    case "mean":
      return meanValue;
    case "sampleVariance":
      return meanWithDivisor(squareDiffs, values.length > 1 ? values.length - 1 : 1);
    case "sampleSD":
      return Math.sqrt(meanWithDivisor(squareDiffs, values.length > 1 ? values.length - 1 : 1));
    case "popVariance":
      return mean(squareDiffs);
    case "popSD":
      return Math.sqrt(mean(squareDiffs));
    default:
      return null;
  }
}

function mean(values: number[]): number {
  return meanWithDivisor(values, values.length);
}

function meanWithDivisor(values: number[], divisor: number): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / divisor;
}

function finiteOrNull(value: number): QtiValue {
  return Number.isFinite(value) ? value : null;
}

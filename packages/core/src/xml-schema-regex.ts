import { assertNever } from "./assert-never.js";
import {
  isXmlRegexCharacter,
  parseXmlSchemaRegex,
  type XmlRegexNode,
  type XmlRegexProblem,
} from "./xml-schema-regex-parser.js";

export { parseXmlSchemaRegex, patternVariableIdentifier } from "./xml-schema-regex-parser.js";
export const XML_REGEX_MAX_INPUT_LENGTH = 100_000;
export const XML_REGEX_MAX_STEPS = 1_000_000;
export type XmlRegexMatchResult =
  | { ok: true; matches: boolean }
  | { ok: false; problem: XmlRegexProblem };

/** Whole-string Appendix F matching using memoized position sets, never backtracking. */
export function matchXmlSchemaRegex(pattern: string, input: string): XmlRegexMatchResult {
  const parsed = parseXmlSchemaRegex(pattern);
  if (!parsed.ok) return parsed;
  if (input.length > XML_REGEX_MAX_INPUT_LENGTH)
    return {
      ok: false,
      problem: { code: "limit", message: "Input exceeds 100000 UTF-16 code units." },
    };
  // XML Schema operates on Unicode code points, not grapheme clusters.
  const characters = Array.from(input);
  let remainingSteps = XML_REGEX_MAX_STEPS;
  const memo = new Map<XmlRegexNode, Map<number, ReadonlySet<number>>>();
  const empty: ReadonlySet<number> = new Set();
  const spend = () => {
    remainingSteps -= 1;
    return remainingSteps >= 0;
  };
  function append(target: Set<number>, source: ReadonlySet<number>): void {
    for (const position of source) {
      if (!spend()) return;
      target.add(position);
    }
  }
  function advance(node: XmlRegexNode, positions: ReadonlySet<number>): Set<number> {
    const next = new Set<number>();
    for (const position of positions) {
      if (!spend()) break;
      append(next, match(node, position));
    }
    return next;
  }
  function match(node: XmlRegexNode, start: number): ReadonlySet<number> {
    if (!spend()) return empty;
    const cached = memo.get(node)?.get(start);
    if (cached) return cached;
    const result = evaluate(node, start);
    let byPosition = memo.get(node);
    if (!byPosition) {
      byPosition = new Map();
      memo.set(node, byPosition);
    }
    byPosition.set(start, result);
    return result;
  }
  function evaluate(node: XmlRegexNode, start: number): ReadonlySet<number> {
    switch (node.type) {
      case "character": {
        const value = characters[start];
        return value !== undefined && isXmlRegexCharacter(value) && node.matcher.test(value)
          ? new Set([start + 1])
          : empty;
      }
      case "choice": {
        const result = new Set<number>();
        for (const child of node.children) {
          if (!spend()) break;
          append(result, match(child, start));
        }
        return result;
      }
      case "sequence": {
        let positions: ReadonlySet<number> = new Set([start]);
        for (const child of node.children) {
          if (positions.size === 0 || !spend()) break;
          positions = advance(child, positions);
        }
        return positions;
      }
      case "repeat": {
        const result = new Set<number>(node.minimum === 0 ? [start] : []);
        let positions: ReadonlySet<number> = new Set([start]);
        for (let count = 1; count <= node.maximum && spend(); count += 1) {
          const next = advance(node.child, positions);
          if (next.size === 0) break;
          if (count >= node.minimum) append(result, next);
          // Nullable operands can reach a fixed point before a large minimum count.
          if (
            next.size === positions.size &&
            [...next].every((position) => positions.has(position))
          ) {
            if (count < node.minimum) append(result, next);
            break;
          }
          positions = next;
        }
        return result;
      }
      default:
        return assertNever(node);
    }
  }
  const matches = match(parsed.expression, 0).has(characters.length);
  return remainingSteps < 0
    ? {
        ok: false,
        problem: { code: "limit", message: "Pattern matching exceeded 1000000 evaluation steps." },
      }
    : { ok: true, matches };
}

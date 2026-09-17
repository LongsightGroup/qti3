import { xmlNameCharacters, xmlNameInitial, xmlSchemaBlocks } from "./xml-schema-regex-data.js";

export type XmlRegexNode =
  | { type: "character"; matcher: RegExp }
  | { type: "sequence" | "choice"; children: XmlRegexNode[] }
  | { type: "repeat"; child: XmlRegexNode; minimum: number; maximum: number };
export interface XmlRegexProblem {
  code: "syntax" | "limit";
  message: string;
}
export type XmlRegexParseResult =
  | { ok: true; expression: XmlRegexNode }
  | { ok: false; problem: XmlRegexProblem };
interface CharacterToken {
  source: string;
  point?: number;
}

export const XML_REGEX_MAX_PATTERN_LENGTH = 16_384;
export const XML_REGEX_MAX_DEPTH = 64;
const categories = /^(?:L[ultmo]?|M[nce]?|N[dlo]?|P[cdseifo]?|Z[slp]?|S[mcko]?|C[cfon]?)$/;
const singleEscapes: Readonly<Record<string, string>> = { n: "\n", r: "\r", t: "\t" };
const multiEscapes: Readonly<Record<string, string>> = {
  s: "[ \\t\\n\\r]",
  S: "[^ \\t\\n\\r]",
  d: "\\p{Nd}",
  D: "\\P{Nd}",
  w: "[^\\p{P}\\p{Z}\\p{C}]",
  W: "[\\p{P}\\p{Z}\\p{C}]",
  i: `[${xmlNameInitial}]`,
  I: `[^${xmlNameInitial}]`,
  c: `[${xmlNameCharacters}]`,
  C: `[^${xmlNameCharacters}]`,
};

/** Parses Appendix F syntax; native regexes only classify one code point at a time. */
export function parseXmlSchemaRegex(pattern: string): XmlRegexParseResult {
  if (pattern.length > XML_REGEX_MAX_PATTERN_LENGTH)
    return {
      ok: false,
      problem: { code: "limit", message: "Pattern exceeds 16384 UTF-16 code units." },
    };
  let offset = 0;
  let problem: XmlRegexProblem | undefined;
  const peek = () => pattern[offset];
  const hasProblem = () => problem !== undefined;
  const fail = (message: string, code: XmlRegexProblem["code"] = "syntax"): undefined => {
    problem ??= { code, message: `${message} At pattern offset ${offset}.` };
    return undefined;
  };
  function literal(character: string): CharacterToken | undefined {
    if (!isXmlRegexCharacter(character)) return fail("Pattern contains a non-XML character.");
    const point = character.codePointAt(0) ?? 0;
    return { source: `\\u{${point.toString(16)}}`, point };
  }
  function escape(): CharacterToken | undefined {
    offset += 1;
    const character = peek();
    if (character === undefined) return fail("Incomplete escape.");
    offset += 1;
    if (Object.hasOwn(singleEscapes, character)) return literal(singleEscapes[character] ?? "");
    if ("\\|.?*+(){}-[]^".includes(character)) return literal(character);
    if (Object.hasOwn(multiEscapes, character)) return { source: multiEscapes[character] ?? "" };
    if (character !== "p" && character !== "P") return fail("Unknown XML Schema escape.");
    if (peek() !== "{") return fail("Expected a Unicode property in braces.");
    offset += 1;
    const end = pattern.indexOf("}", offset);
    if (end < 0) return fail("Unclosed Unicode property.");
    const property = pattern.slice(offset, end);
    offset = end + 1;
    if (categories.test(property)) return { source: `\\${character}{${property}}` };
    const block = property.startsWith("Is") ? property.slice(2) : "";
    if (!Object.hasOwn(xmlSchemaBlocks, block)) return fail("Unknown XML Schema Unicode property.");
    const ranges = xmlSchemaBlocks[block];
    // Preserve the Appendix F Specials block's legacy BOM member as well.
    return {
      source: `[${character === "P" ? "^" : ""}${ranges}${block === "Specials" ? "\\u{FEFF}" : ""}]`,
    };
  }
  function classToken(): CharacterToken | undefined {
    const character = peek();
    if (character === "\\") return escape();
    if (character === undefined || character === "[" || character === "]")
      return fail("Expected a character in the class.");
    const code = pattern.codePointAt(offset);
    if (code === undefined) return fail("Expected a character.");
    const value = String.fromCodePoint(code);
    offset += value.length;
    return literal(value);
  }
  function characterClass(depth: number): string | undefined {
    if (depth > XML_REGEX_MAX_DEPTH) return fail("Character-class nesting exceeds 64.", "limit");
    offset += 1;
    const negative = peek() === "^";
    if (negative) offset += 1;
    const members: string[] = [];
    let subtraction: string | undefined;
    while (!hasProblem() && peek() !== "]") {
      if (members.length > 0 && pattern.slice(offset, offset + 2) === "-[") {
        offset += 1;
        subtraction = characterClass(depth + 1);
        if (peek() !== "]") return fail("Subtraction must end the character class.");
        break;
      }
      const wasDash = peek() === "-";
      if (wasDash && members.length > 0 && pattern[offset + 1] !== "]")
        return fail("An unescaped dash must begin or end a class.");
      const first = classToken();
      if (!first) return undefined;
      if (
        !wasDash &&
        peek() === "-" &&
        pattern[offset + 1] !== "[" &&
        pattern[offset + 1] !== "]"
      ) {
        offset += 1;
        if (peek() === "-") return fail("Escape a dash used as a range endpoint.");
        const last = classToken();
        if (!last) return undefined;
        if (first.point === undefined || last.point === undefined || first.point > last.point)
          return fail("Invalid character range.");
        members.push(`[${first.source}-${last.source}]`);
      } else members.push(first.source);
    }
    if (problem) return undefined;
    if (peek() !== "]" || members.length === 0) return fail("Unclosed or empty character class.");
    offset += 1;
    const union = `(?:${members.join("|")})`;
    const base = negative ? `(?!${union})[\\s\\S]` : union;
    return subtraction === undefined ? base : `(?!${subtraction})${base}`;
  }
  function characterNode(source: string): XmlRegexNode | undefined {
    try {
      return { type: "character", matcher: new RegExp(`^(?:${source})$`, "u") };
    } catch {
      return fail("Unable to compile the character class.");
    }
  }
  function atom(depth: number): XmlRegexNode | undefined {
    if (depth > XML_REGEX_MAX_DEPTH) return fail("Group nesting exceeds 64.", "limit");
    const token = peek();
    if (token === "(") {
      offset += 1;
      const expression = expressionAt(depth + 1);
      if (peek() !== ")") return fail("Unclosed group.");
      offset += 1;
      return expression;
    }
    if (token === "[") {
      const source = characterClass(depth + 1);
      return source === undefined ? undefined : characterNode(source);
    }
    if (token === ".") {
      offset += 1;
      return characterNode("[^\\n\\r]");
    }
    if (token === "\\") {
      const escaped = escape();
      return escaped ? characterNode(escaped.source) : undefined;
    }
    if (token === undefined || "?*+{}]|)".includes(token)) return fail("Unexpected metacharacter.");
    const value = classToken();
    return value ? characterNode(value.source) : undefined;
  }
  function piece(depth: number): XmlRegexNode | undefined {
    const child = atom(depth);
    if (!child) return undefined;
    const quantifier = peek();
    if (quantifier === "?" || quantifier === "*" || quantifier === "+") {
      offset += 1;
      return {
        type: "repeat",
        child,
        minimum: quantifier === "+" ? 1 : 0,
        maximum: quantifier === "?" ? 1 : Infinity,
      };
    }
    if (quantifier !== "{") return child;
    const match = /^\{([0-9]+)(?:,([0-9]*))?\}/.exec(pattern.slice(offset));
    if (!match || match[1] === undefined) return fail("Malformed quantifier.");
    offset += match[0].length;
    const minimum = Number(match[1]);
    const maximum =
      match[2] === undefined ? minimum : match[2] === "" ? Infinity : Number(match[2]);
    if (!Number.isSafeInteger(minimum) || (maximum !== Infinity && !Number.isSafeInteger(maximum)))
      return fail("Quantifier exceeds the safe integer range.", "limit");
    if (maximum < minimum) return fail("Quantifier maximum is smaller than its minimum.");
    return { type: "repeat", child, minimum, maximum };
  }
  function expressionAt(depth: number): XmlRegexNode | undefined {
    const branches: XmlRegexNode[] = [];
    while (!hasProblem()) {
      const children: XmlRegexNode[] = [];
      while (peek() !== undefined && peek() !== "|" && peek() !== ")" && !hasProblem()) {
        const node = piece(depth);
        if (!node) return undefined;
        children.push(node);
      }
      branches.push({ type: "sequence", children });
      if (peek() !== "|") break;
      offset += 1;
    }
    return { type: "choice", children: branches };
  }
  const expression = expressionAt(0);
  if (!problem && offset !== pattern.length) fail("Unexpected closing delimiter.");
  if (problem) return { ok: false, problem };
  return expression
    ? { ok: true, expression }
    : { ok: false, problem: { code: "syntax", message: "Invalid pattern." } };
}

/** QTI StringOrVariableRef uses braces, so bare identifiers remain literal patterns. */
export function patternVariableIdentifier(pattern: string): string | undefined {
  if (!pattern.startsWith("{") || !pattern.endsWith("}")) return undefined;
  const identifier = pattern.slice(1, -1);
  const initial = `[${xmlNameInitial}]`;
  const rest = `[${xmlNameCharacters}]`;
  return !identifier.includes(":") && new RegExp(`^${initial}${rest}*$`, "u").test(identifier)
    ? identifier
    : undefined;
}

export function isXmlRegexCharacter(value: string): boolean {
  const point = value.codePointAt(0) ?? 0;
  return (
    point === 9 ||
    point === 10 ||
    point === 13 ||
    (point >= 0x20 && point <= 0xd7ff) ||
    (point >= 0xe000 && point <= 0xfffd) ||
    (point >= 0x10000 && point <= 0x10ffff)
  );
}

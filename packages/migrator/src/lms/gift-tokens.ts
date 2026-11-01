/** Tokenize separators before decoding escaped literal characters. */
export type GiftAnswerToken = {
  marker: "=" | "~";
  text: string;
  score: number;
  feedback?: string | undefined;
};

export function tokenizeAnswers(content: string): GiftAnswerToken[] {
  const tokens: GiftAnswerToken[] = [];
  let current: GiftAnswerToken | null = null;
  let buffer = "";
  let escaped = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (escaped) {
      buffer += `\\${ch}`;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "=" || ch === "~") {
      if (current) {
        current.text = buffer.trim();
        tokens.push(current);
      }
      current = { marker: ch, text: "", score: ch === "=" ? 1 : 0 };
      buffer = "";
      continue;
    }
    buffer += ch;
  }
  if (current) {
    current.text = buffer.trim();
    tokens.push(current);
  }

  return tokens
    .map((token) => {
      const text = token.text;
      const { answerText, feedback, score } = parseTokenText(text, token.marker);
      return {
        marker: token.marker,
        text: answerText,
        feedback,
        score,
      };
    })
    .filter((token) => token.text.length > 0);
}

function parseTokenText(
  text: string,
  marker: "=" | "~",
): { answerText: string; feedback?: string | undefined; score: number } {
  let score = marker === "=" ? 1 : 0;
  let working = text.trim();
  const scoreMatch = /^%(-?\d+(?:\.\d+)?)%/i.exec(working);
  if (scoreMatch) {
    score = Number(scoreMatch[1]) / 100;
    working = working.slice(scoreMatch[0].length).trim();
  }
  const feedbackIdx = findUnescaped(working, "#");
  let feedback: string | undefined;
  if (feedbackIdx >= 0) {
    feedback = working.slice(feedbackIdx + 1).trim();
    working = working.slice(0, feedbackIdx).trim();
  }
  return { answerText: working, feedback, score };
}

export function findUnescaped(text: string, token: string): number {
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (text.startsWith(token, i)) return i;
  }
  return -1;
}

export function unescapeGift(value: string): string {
  return value.replace(/\\([n~={}#:>\\])/g, (_match, character: string) =>
    character === "n" ? "\n" : character,
  );
}

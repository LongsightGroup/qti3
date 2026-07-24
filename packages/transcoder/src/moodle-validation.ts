import type { QtiTranscodeDiagnostic } from "./types.js";

const QUESTION_TYPES = new Set(["essay", "matching", "multichoice", "numerical", "shortanswer"]);

/** Validate the Moodle XML subset emitted by the transcoder. */
export function validateMoodleXmlDocument(root: Element): readonly QtiTranscodeDiagnostic[] {
  const failures: string[] = [];
  if (localName(root) !== "quiz" || root.namespaceURI) {
    failures.push("root must be an unnamespaced quiz element");
  }
  const questions = directChildren(root, "question");
  if (questions.length === 0) failures.push("quiz must contain at least one question");
  for (const [index, question] of questions.entries()) {
    validateQuestion(question, index, failures);
  }
  return failures.map((message) => ({
    code: "target.moodle_xml.semantic",
    severity: "error",
    message: `Generated Moodle XML is invalid: ${message}.`,
  }));
}

function validateQuestion(question: Element, index: number, failures: string[]): void {
  const context = `question ${String(index + 1)}`;
  const type = question.getAttribute("type");
  if (!type || !QUESTION_TYPES.has(type)) {
    failures.push(`${context} has an unsupported or missing type`);
    return;
  }
  requireNestedText(question, "name", context, failures);
  const questionText = directChildren(question, "questiontext")[0];
  if (!questionText || !directChildren(questionText, "text")[0]) {
    failures.push(`${context} lacks questiontext/text`);
  } else {
    validateEmbeddedFiles(questionText, context, failures);
  }
  const defaultGrade = numericChild(question, "defaultgrade");
  if (defaultGrade === undefined || defaultGrade <= 0) {
    failures.push(`${context} defaultgrade must be positive`);
  }
  const penalty = numericChild(question, "penalty");
  if (penalty === undefined || penalty < 0) {
    failures.push(`${context} penalty must be non-negative`);
  }
  if (!["0", "1"].includes(childText(question, "hidden") ?? "")) {
    failures.push(`${context} hidden must be 0 or 1`);
  }

  switch (type) {
    case "multichoice":
      validateMultichoice(question, context, failures);
      return;
    case "matching":
      validateMatching(question, context, failures);
      return;
    case "shortanswer":
      validateShortAnswer(question, context, failures);
      return;
    case "numerical":
      validateNumerical(question, context, failures);
      return;
    case "essay":
      validateEssay(question, context, failures);
      return;
  }
}

function validateEmbeddedFiles(questionText: Element, context: string, failures: string[]): void {
  for (const file of directChildren(questionText, "file")) {
    const name = file.getAttribute("name");
    const path = file.getAttribute("path");
    const data = file.textContent.trim();
    if (!name || !path || !path.startsWith("/") || !path.endsWith("/") || path.includes("..")) {
      failures.push(`${context} contains an invalid embedded file path`);
    }
    if (file.getAttribute("encoding") !== "base64" || !isBase64(data)) {
      failures.push(`${context} contains an invalid embedded file payload`);
    }
  }
}

function isBase64(value: string): boolean {
  return (
    value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  );
}

function validateMultichoice(question: Element, context: string, failures: string[]): void {
  if (!["true", "false"].includes(childText(question, "single") ?? "")) {
    failures.push(`${context} multichoice single must be true or false`);
  }
  const answers = directChildren(question, "answer");
  if (answers.length < 2) failures.push(`${context} multichoice requires at least two answers`);
  const fractions = answers.map((answer) => Number(answer.getAttribute("fraction")));
  if (fractions.some((fraction) => !Number.isFinite(fraction))) {
    failures.push(`${context} multichoice answer fractions must be numeric`);
  } else {
    const positiveTotal = fractions
      .filter((fraction) => fraction > 0)
      .reduce((sum, fraction) => sum + fraction, 0);
    if (Math.abs(positiveTotal - 100) > 0.001) {
      failures.push(`${context} multichoice positive fractions must total 100`);
    }
  }
  validateAnswerText(answers, context, failures);
}

function validateMatching(question: Element, context: string, failures: string[]): void {
  const subquestions = directChildren(question, "subquestion");
  const prompts = subquestions.filter((entry) => nestedText(entry, "text").trim().length > 0);
  if (subquestions.length < 3 || prompts.length < 2) {
    failures.push(`${context} matching requires two prompts and three answers`);
  }
  for (const subquestion of subquestions) {
    const answer = directChildren(subquestion, "answer")[0];
    if (!answer || nestedText(answer, "text").trim().length === 0) {
      failures.push(`${context} matching subquestion lacks an answer`);
    }
  }
}

function validateShortAnswer(question: Element, context: string, failures: string[]): void {
  const answers = directChildren(question, "answer");
  if (answers.length === 0) failures.push(`${context} shortanswer requires an answer`);
  validateAnswerText(answers, context, failures);
}

function validateNumerical(question: Element, context: string, failures: string[]): void {
  const answers = directChildren(question, "answer");
  if (answers.length === 0) failures.push(`${context} numerical requires an answer`);
  validateAnswerText(answers, context, failures);
  for (const answer of answers) {
    const tolerance = numericChild(answer, "tolerance");
    if (tolerance === undefined || tolerance < 0) {
      failures.push(`${context} numerical tolerance must be non-negative`);
    }
  }
}

function validateEssay(question: Element, context: string, failures: string[]): void {
  if (childText(question, "responseformat") !== "editor") {
    failures.push(`${context} essay responseformat must be editor`);
  }
  if (childText(question, "responserequired") !== "1") {
    failures.push(`${context} essay response must be required`);
  }
  const attachments = numericChild(question, "attachments");
  const attachmentsRequired = numericChild(question, "attachmentsrequired");
  if (
    attachments === undefined ||
    attachmentsRequired === undefined ||
    attachments < 0 ||
    attachmentsRequired < 0 ||
    attachmentsRequired > attachments
  ) {
    failures.push(`${context} essay attachment requirements are inconsistent`);
  }
}

function validateAnswerText(
  answers: readonly Element[],
  context: string,
  failures: string[],
): void {
  if (answers.some((answer) => nestedText(answer, "text").trim().length === 0)) {
    failures.push(`${context} contains an answer without text`);
  }
}

function requireNestedText(
  parent: Element,
  childName: string,
  context: string,
  failures: string[],
): void {
  const child = directChildren(parent, childName)[0];
  if (!child || nestedText(child, "text").trim().length === 0) {
    failures.push(`${context} lacks ${childName}/text`);
  }
}

function numericChild(parent: Element, name: string): number | undefined {
  const value = Number(childText(parent, name));
  return Number.isFinite(value) ? value : undefined;
}

function childText(parent: Element, name: string): string | undefined {
  return directChildren(parent, name)[0]?.textContent.trim();
}

function nestedText(parent: Element, name: string): string {
  return parent.getElementsByTagName(name).item(0)?.textContent ?? "";
}

function directChildren(parent: Element, name: string): Element[] {
  const children: Element[] = [];
  const descendants = parent.getElementsByTagName(name);
  for (let index = 0; index < descendants.length; index += 1) {
    const child = descendants.item(index);
    if (child && child.parentNode === parent) children.push(child);
  }
  return children;
}

function localName(node: Node): string {
  return node.nodeName.replace(/^.*:/, "");
}

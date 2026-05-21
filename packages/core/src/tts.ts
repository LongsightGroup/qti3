import type {
  QtiAssessmentItem,
  QtiChoice,
  QtiContentNode,
  QtiDiagnostic,
  QtiDocument,
  QtiInteraction,
  QtiSourceLocation,
} from "./types.js";

export type QtiDataSsmlBreakStrength =
  | "medium"
  | "none"
  | "strong"
  | "weak"
  | "x-strong"
  | "x-weak";

export interface QtiDataSsmlBreak {
  strength?: QtiDataSsmlBreakStrength | undefined;
  time?: string | undefined;
}

export interface QtiDataSsmlPhoneme {
  ph: string;
  alphabet?: "ipa" | "x-sampa" | undefined;
  type?: "default" | "ruby" | undefined;
}

export interface QtiDataSsmlProsody {
  rate?: string | undefined;
}

export interface QtiDataSsmlSayAs {
  "interpret-as": "cardinal" | "characters" | "date" | "ordinal" | "telephone" | "time";
}

export interface QtiDataSsmlSub {
  alias: string;
}

export interface QtiDataSsml {
  break?: QtiDataSsmlBreak | undefined;
  phoneme?: QtiDataSsmlPhoneme | undefined;
  prosody?: QtiDataSsmlProsody | undefined;
  "say-as"?: QtiDataSsmlSayAs | undefined;
  sub?: QtiDataSsmlSub | undefined;
}

export type QtiDataSsmlParseResult =
  | { ok: true; value: QtiDataSsml }
  | { ok: false; errors: string[] };

export type QtiTextToSpeechSegmentKind =
  | "text"
  | "content"
  | "interaction"
  | "interactionPrompt"
  | "choice"
  | "printedVariable"
  | "feedback";

export interface QtiTextToSpeechSegment {
  index: number;
  kind: QtiTextToSpeechSegmentKind;
  text: string;
  attributes: Record<string, string>;
  qtiName?: string | undefined;
  responseIdentifier?: string | undefined;
  identifier?: string | undefined;
  interactionIndex?: number | undefined;
  choiceIdentifier?: string | undefined;
  dataSsml?: string | undefined;
  ssml?: QtiDataSsml | undefined;
  ssmlErrors?: string[] | undefined;
  suppressTts?: string[] | undefined;
  source?: QtiSourceLocation | undefined;
}

export interface QtiTextToSpeechTraversal {
  itemIdentifier: string;
  language?: string | undefined;
  segments: QtiTextToSpeechSegment[];
  diagnostics: QtiDiagnostic[];
}

interface TraversalContext {
  item: QtiAssessmentItem;
  segments: QtiTextToSpeechSegment[];
  diagnostics: QtiDiagnostic[];
}

interface SegmentInput {
  kind: QtiTextToSpeechSegmentKind;
  text: string;
  attributes?: Record<string, string> | undefined;
  qtiName?: string | undefined;
  responseIdentifier?: string | undefined;
  identifier?: string | undefined;
  interactionIndex?: number | undefined;
  choiceIdentifier?: string | undefined;
  source?: QtiSourceLocation | undefined;
}

const dataSsmlFunctionNames = new Set(["break", "phoneme", "prosody", "say-as", "sub"]);
const breakStrengths = new Set(["medium", "none", "strong", "weak", "x-strong", "x-weak"]);
const phonemeAlphabets = new Set(["ipa", "x-sampa"]);
const phonemeTypes = new Set(["default", "ruby"]);
const sayAsInterpretations = new Set([
  "cardinal",
  "characters",
  "date",
  "ordinal",
  "telephone",
  "time",
]);

export function parseQtiDataSsml(raw: string): QtiDataSsmlParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse JSON.";
    return { ok: false, errors: [`data-ssml must be valid JSON: ${message}`] };
  }

  if (!isRecord(parsed)) {
    return { ok: false, errors: ["data-ssml must be a JSON object."] };
  }

  const errors: string[] = [];
  const value: QtiDataSsml = {};
  const entries = Object.entries(parsed);
  if (entries.length === 0) {
    errors.push("data-ssml must include at least one Data-SSML function.");
  }

  for (const [name, functionValue] of entries) {
    if (!dataSsmlFunctionNames.has(name)) {
      errors.push(`Unsupported Data-SSML function "${name}".`);
      continue;
    }
    if (!isRecord(functionValue)) {
      errors.push(`Data-SSML function "${name}" must be a JSON object.`);
      continue;
    }

    const before = errors.length;
    if (name === "break") {
      const breakValue = validateBreak(functionValue, errors);
      if (errors.length === before) value["break"] = breakValue;
    } else if (name === "phoneme") {
      const phoneme = validatePhoneme(functionValue, errors);
      if (phoneme && errors.length === before) value.phoneme = phoneme;
    } else if (name === "prosody") {
      const prosody = validateProsody(functionValue, errors);
      if (errors.length === before) value.prosody = prosody;
    } else if (name === "say-as") {
      const sayAs = validateSayAs(functionValue, errors);
      if (sayAs && errors.length === before) value["say-as"] = sayAs;
    } else if (name === "sub") {
      const sub = validateSub(functionValue, errors);
      if (sub && errors.length === before) value.sub = sub;
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function createTextToSpeechTraversal(
  model: QtiDocument | QtiAssessmentItem,
): QtiTextToSpeechTraversal {
  const item = "item" in model ? model.item : model;
  const context: TraversalContext = {
    item,
    segments: [],
    diagnostics: [],
  };
  if (item.body.length > 0) {
    traverseContentNodes(item.body, context);
  } else {
    item.interactions.forEach((interaction, index) =>
      traverseInteraction(interaction, index, context),
    );
  }
  return {
    itemIdentifier: item.identifier,
    language: item.language,
    segments: context.segments,
    diagnostics: context.diagnostics,
  };
}

export function validateQtiDataSsmlMetadata(item: QtiAssessmentItem): QtiDiagnostic[] {
  return createTextToSpeechTraversal(item).diagnostics;
}

function validateBreak(value: Record<string, unknown>, errors: string[]): QtiDataSsmlBreak {
  validateAllowedProperties(value, "break", ["strength", "time"], errors);
  const result: QtiDataSsmlBreak = {};
  const strength = optionalEnum(value, "strength", "break.strength", breakStrengths, errors);
  const time = optionalString(value, "time", "break.time", errors);
  if (strength) result.strength = strength as QtiDataSsmlBreakStrength;
  if (time !== undefined) result.time = time;
  return result;
}

function validatePhoneme(
  value: Record<string, unknown>,
  errors: string[],
): QtiDataSsmlPhoneme | undefined {
  validateAllowedProperties(value, "phoneme", ["alphabet", "ph", "type"], errors);
  const ph = requiredString(value, "ph", "phoneme.ph", errors);
  const alphabet = optionalEnum(value, "alphabet", "phoneme.alphabet", phonemeAlphabets, errors);
  const type = optionalEnum(value, "type", "phoneme.type", phonemeTypes, errors);
  if (!ph) return undefined;
  const result: QtiDataSsmlPhoneme = { ph };
  if (alphabet) result.alphabet = alphabet as QtiDataSsmlPhoneme["alphabet"];
  if (type) result.type = type as QtiDataSsmlPhoneme["type"];
  return result;
}

function validateProsody(value: Record<string, unknown>, errors: string[]): QtiDataSsmlProsody {
  validateAllowedProperties(value, "prosody", ["rate"], errors);
  const result: QtiDataSsmlProsody = {};
  const rate = optionalString(value, "rate", "prosody.rate", errors);
  if (rate !== undefined) result.rate = rate;
  return result;
}

function validateSayAs(
  value: Record<string, unknown>,
  errors: string[],
): QtiDataSsmlSayAs | undefined {
  validateAllowedProperties(value, "say-as", ["interpret-as"], errors);
  const interpretation = requiredEnum(
    value,
    "interpret-as",
    "say-as.interpret-as",
    sayAsInterpretations,
    errors,
  );
  if (!interpretation) return undefined;
  return { "interpret-as": interpretation as QtiDataSsmlSayAs["interpret-as"] };
}

function validateSub(value: Record<string, unknown>, errors: string[]): QtiDataSsmlSub | undefined {
  validateAllowedProperties(value, "sub", ["alias"], errors);
  const alias = requiredString(value, "alias", "sub.alias", errors);
  return alias ? { alias } : undefined;
}

function traverseContentNodes(nodes: QtiContentNode[], context: TraversalContext): void {
  for (const node of nodes) {
    traverseContentNode(node, context);
  }
}

function traverseContentNode(node: QtiContentNode, context: TraversalContext): void {
  if (node.kind === "text") {
    addTextSegment(node.text, node.source, context);
    return;
  }

  if (node.kind === "interaction") {
    const interaction = context.item.interactions[node.interactionIndex];
    if (interaction) traverseInteraction(interaction, node.interactionIndex, context);
    return;
  }

  if (node.kind === "printedVariable") {
    addSegment(
      {
        kind: "printedVariable",
        text: "",
        attributes: node.attributes,
        qtiName: "qti-printed-variable",
        identifier: node.identifier,
        source: node.source,
      },
      context,
    );
    return;
  }

  if (node.kind === "feedback") {
    if (hasTtsMetadata(node.attributes)) {
      addSegment(
        {
          kind: "feedback",
          text: normalizeSpeechText(contentNodeChildrenText(node.children)),
          attributes: node.attributes,
          qtiName: node.feedbackType === "block" ? "qti-feedback-block" : "qti-feedback-inline",
          identifier: node.identifier,
          source: node.source,
        },
        context,
      );
      return;
    }
    traverseContentNodes(node.children, context);
    return;
  }

  if (hasTtsMetadata(node.attributes)) {
    addSegment(
      {
        kind: "content",
        text: normalizeSpeechText(contentNodeChildrenText(node.children)),
        attributes: node.attributes,
        qtiName: node.qtiName,
        source: node.source,
      },
      context,
    );
    return;
  }

  traverseContentNodes(node.children, context);
}

function traverseInteraction(
  interaction: QtiInteraction,
  interactionIndex: number,
  context: TraversalContext,
): void {
  if (hasTtsMetadata(interaction.attributes)) {
    addSegment(
      {
        kind: "interaction",
        text: normalizeSpeechText(interaction.prompt ?? interaction.text),
        attributes: interaction.attributes,
        qtiName: interaction.qtiName,
        responseIdentifier: interaction.responseIdentifier,
        interactionIndex,
        source: interaction.source,
      },
      context,
    );
  }

  const promptText = normalizeSpeechText(interaction.prompt ?? "");
  const promptAttributes = interaction.promptAttributes ?? {};
  if (promptText.length > 0 || hasTtsMetadata(promptAttributes)) {
    addSegment(
      {
        kind: "interactionPrompt",
        text: promptText,
        attributes: promptAttributes,
        qtiName: "qti-prompt",
        responseIdentifier: interaction.responseIdentifier,
        interactionIndex,
        source: interaction.promptSource ?? interaction.source,
      },
      context,
    );
  }

  for (const choice of interaction.choices) {
    addChoiceSegment(choice, interaction, interactionIndex, context);
  }

  if (interaction.portableCustom) {
    traverseContentNodes(interaction.portableCustom.interactionMarkup, context);
  }
}

function addChoiceSegment(
  choice: QtiChoice,
  interaction: QtiInteraction,
  interactionIndex: number,
  context: TraversalContext,
): void {
  const text = normalizeSpeechText(choice.text);
  if (text.length === 0 && !hasTtsMetadata(choice.attributes)) return;
  addSegment(
    {
      kind: "choice",
      text,
      attributes: choice.attributes,
      qtiName: choice.qtiName,
      responseIdentifier: interaction.responseIdentifier,
      identifier: choice.identifier,
      interactionIndex,
      choiceIdentifier: choice.identifier,
      source: choice.source,
    },
    context,
  );
}

function addTextSegment(
  text: string,
  source: QtiSourceLocation | undefined,
  context: TraversalContext,
): void {
  const normalized = normalizeSpeechText(text);
  if (normalized.length === 0) return;
  addSegment({ kind: "text", text: normalized, attributes: {}, source }, context);
}

function addSegment(input: SegmentInput, context: TraversalContext): void {
  const attributes = input.attributes ?? {};
  const segment: QtiTextToSpeechSegment = {
    index: context.segments.length,
    kind: input.kind,
    text: input.text,
    attributes: { ...attributes },
  };
  if (input.qtiName) segment.qtiName = input.qtiName;
  if (input.responseIdentifier) segment.responseIdentifier = input.responseIdentifier;
  if (input.identifier) segment.identifier = input.identifier;
  if (input.interactionIndex !== undefined) segment.interactionIndex = input.interactionIndex;
  if (input.choiceIdentifier) segment.choiceIdentifier = input.choiceIdentifier;
  if (input.source) segment.source = input.source;

  const suppressTts = ttsSuppressionModes(attributes);
  if (suppressTts.length > 0) segment.suppressTts = suppressTts;

  const rawDataSsml = attributeValue(attributes, "data-ssml");
  if (rawDataSsml !== undefined) {
    segment.dataSsml = rawDataSsml;
    const parsed = parseQtiDataSsml(rawDataSsml);
    if (parsed.ok) {
      segment.ssml = parsed.value;
    } else {
      segment.ssmlErrors = parsed.errors;
      context.diagnostics.push({
        code: "content.dataSsml.invalid",
        severity: "warning",
        message: `data-ssml must be valid Data-SSML JSON: ${parsed.errors.join("; ")}`,
        path: input.source?.path,
        source: input.source,
      });
    }
  }

  context.segments.push(segment);
}

function hasTtsMetadata(attributes: Record<string, string>): boolean {
  return (
    attributeValue(attributes, "data-ssml") !== undefined ||
    attributeValue(attributes, "data-qti-suppress-tts") !== undefined
  );
}

function ttsSuppressionModes(attributes: Record<string, string>): string[] {
  const raw = attributeValue(attributes, "data-qti-suppress-tts");
  if (!raw) return [];
  return raw
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
}

function contentNodeChildrenText(nodes: QtiContentNode[]): string {
  return nodes.map(contentNodeText).join(" ");
}

function contentNodeText(node: QtiContentNode): string {
  if (node.kind === "text") return node.text;
  if (node.kind === "interaction") return "";
  if (node.kind === "printedVariable") return "";
  if (node.kind === "feedback") return contentNodeChildrenText(node.children);
  return contentNodeChildrenText(node.children);
}

function normalizeSpeechText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function attributeValue(attributes: Record<string, string>, name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  const entry = Object.entries(attributes).find(
    ([attributeName]) => attributeName.toLowerCase() === normalizedName,
  );
  return entry?.[1];
}

function validateAllowedProperties(
  value: Record<string, unknown>,
  path: string,
  allowed: string[],
  errors: string[],
): void {
  const allowedNames = new Set(allowed);
  for (const name of Object.keys(value)) {
    if (!allowedNames.has(name)) {
      errors.push(`${path}.${name} is not a supported Data-SSML property.`);
    }
  }
}

function optionalString(
  value: Record<string, unknown>,
  name: string,
  path: string,
  errors: string[],
): string | undefined {
  if (!Object.hasOwn(value, name)) return undefined;
  const property = value[name];
  if (typeof property !== "string") {
    errors.push(`${path} must be a string.`);
    return undefined;
  }
  return property;
}

function requiredString(
  value: Record<string, unknown>,
  name: string,
  path: string,
  errors: string[],
): string | undefined {
  if (!Object.hasOwn(value, name)) {
    errors.push(`${path} is required.`);
    return undefined;
  }
  return optionalString(value, name, path, errors);
}

function optionalEnum(
  value: Record<string, unknown>,
  name: string,
  path: string,
  allowed: Set<string>,
  errors: string[],
): string | undefined {
  const property = optionalString(value, name, path, errors);
  if (property === undefined) return undefined;
  if (!allowed.has(property)) {
    errors.push(`${path} has unsupported value "${property}".`);
    return undefined;
  }
  return property;
}

function requiredEnum(
  value: Record<string, unknown>,
  name: string,
  path: string,
  allowed: Set<string>,
  errors: string[],
): string | undefined {
  if (!Object.hasOwn(value, name)) {
    errors.push(`${path} is required.`);
    return undefined;
  }
  return optionalEnum(value, name, path, allowed, errors);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

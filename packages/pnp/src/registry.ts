import { calculatorType, numberParam, readingType, stringParam } from "./helpers.js";
import type {
  Qti3PnpCapabilityMap,
  Qti3PnpKnownSupportName,
  Qti3PnpParamDefinition,
  Qti3PnpParams,
  Qti3PnpPreference,
  Qti3PnpResolution,
  Qti3PnpSessionOptions,
  Qti3PnpSupportCategory,
  Qti3PnpSupportDefinition,
  Qti3PnpSupportLevel,
  Qti3PnpSupportName,
} from "./types.js";

type SupportResolver = {
  capability?: (preference: Qti3PnpPreference, capabilities: Qti3PnpCapabilityMap) => boolean;
  apply?: (resolution: Qti3PnpResolution, preference: Qti3PnpPreference) => void;
  prohibit?: (resolution: Qti3PnpResolution) => void;
};

type SupportValidation = {
  xorGroups?:
    | readonly {
        params: readonly string[];
        message: string;
      }[]
    | undefined;
};

type SupportDefinitionOptions = SupportResolver & {
  cardinality?: Qti3PnpSupportDefinition["cardinality"] | undefined;
  params?: readonly Qti3PnpParamDefinition[] | undefined;
  validation?: SupportValidation | undefined;
};

export type Qti3PnpSupportRegistryEntry = Qti3PnpSupportDefinition &
  SupportResolver & {
    validation?: SupportValidation | undefined;
  };

export const qti3PredefinedCatalogSupports = [
  "additional-directions",
  "audio-description",
  "braille",
  "glossary-on-screen",
  "high-contrast",
  "keyboard-directions",
  "keyword-translation",
  "linguistic-guidance",
  "long-description",
  "sign-language",
  "simplified-language-portions",
  "simplified-graphics",
  "spoken",
  "tactile",
  "transcript",
] as const satisfies readonly Qti3PnpKnownSupportName[];

const catalogSupportSet = new Set<string>(qti3PredefinedCatalogSupports);
const calculatorTypes = ["basic", "standard", "scientific", "graphing"] as const;

const n = (name: string): Qti3PnpParamDefinition => ({ name, valueType: "number" });
const c = (name: string): Qti3PnpParamDefinition => ({ name, valueType: "color" });
const s = (name: string): Qti3PnpParamDefinition => ({ name, valueType: "string" });
const lang = (): Qti3PnpParamDefinition => ({ name: "language", valueType: "language" });
const bool = (name: string): Qti3PnpParamDefinition => ({ name, valueType: "boolean" });
const en = (name: string, values: readonly string[]): Qti3PnpParamDefinition => ({
  name,
  valueType: "enum",
  values,
});

const display =
  (key: keyof NonNullable<Qti3PnpCapabilityMap["display"]>) =>
  (_preference: Qti3PnpPreference, capabilities: Qti3PnpCapabilityMap) =>
    capabilities.display?.[key] === true;
const tool =
  (key: keyof NonNullable<Qti3PnpCapabilityMap["tools"]>) =>
  (_preference: Qti3PnpPreference, capabilities: Qti3PnpCapabilityMap) =>
    capabilities.tools?.[key] === true;
const media =
  (key: keyof NonNullable<Qti3PnpCapabilityMap["media"]>) =>
  (_preference: Qti3PnpPreference, capabilities: Qti3PnpCapabilityMap) =>
    capabilities.media?.[key] === true;
const session =
  (key: keyof NonNullable<Qti3PnpCapabilityMap["session"]>) =>
  (_preference: Qti3PnpPreference, capabilities: Qti3PnpCapabilityMap) =>
    capabilities.session?.[key] === true;

const supportDefinitions = [
  def("additional-directions", "catalog-content"),
  def("additional-testing-time", "session", {
    params: [n("timeMultiplier"), n("fixedMinutes"), bool("unlimited")],
    validation: {
      xorGroups: [
        {
          params: ["timeMultiplier", "fixedMinutes", "unlimited"],
          message: "Additional testing time uses multiple forms.",
        },
      ],
    },
    capability: session("additionalTime"),
    apply: (resolution, preference) => {
      resolution.session.additionalTestingTime = additionalTestingTime(preference.params);
    },
  }),
  def("alternative-text", "catalog-content"),
  def("answer-masking", "tool", {
    capability: tool("answerMasking"),
    apply: (resolution) => {
      resolution.tools.answerMasking = { enabled: true };
    },
  }),
  def("audio-description", "media"),
  def("braille", "catalog-content"),
  def("calculator-on-screen", "tool", {
    params: [en("calculatorType", calculatorTypes)],
    capability: calculatorSupported,
    apply: (resolution, preference) => {
      resolution.tools.calculator = {
        enabled: true,
        type: calculatorType(preference.params.calculatorType ?? preference.params.type),
      };
    },
    prohibit: (resolution) => {
      resolution.tools.calculator = { enabled: false, locked: true };
    },
  }),
  def("captions", "media", {
    capability: media("captions"),
    apply: (resolution) => {
      resolution.media.captions = { enabled: true };
    },
  }),
  def("dictionary-on-screen", "tool", {
    capability: tool("dictionary"),
    apply: (resolution) => {
      resolution.tools.dictionary = { enabled: true };
    },
  }),
  def("encouragement", "tool"),
  def("environment", "environment"),
  def("glossary-on-screen", "catalog-content", {
    capability: tool("glossary"),
    apply: (resolution) => {
      resolution.tools.glossary = { enabled: true };
    },
  }),
  def("hazard-avoidance", "environment"),
  def("high-contrast", "display", {
    capability: display("highContrast"),
    apply: (resolution) => {
      resolution.display.highContrast = true;
    },
  }),
  def("homophone-checker-on-screen", "tool"),
  def("input-requirements", "environment"),
  def("invert-display-polarity", "display", {
    params: [c("foreground"), c("background")],
    capability: display("highContrast"),
    apply: (resolution, preference) => {
      resolution.display.invertDisplayPolarity = {
        foreground: stringParam(preference.params, "foreground"),
        background: stringParam(preference.params, "background"),
      };
    },
  }),
  def("item-translation", "language", { params: [lang()] }),
  def("keyboard-directions", "catalog-content"),
  def("keyword-emphasis", "display", {
    capability: display("keywordEmphasis"),
    apply: (resolution) => {
      resolution.display.keywordEmphasis = true;
    },
  }),
  def("keyword-translation", "catalog-content", { cardinality: "zero-or-many", params: [lang()] }),
  def("language-of-interface", "language", { params: [lang()] }),
  def("layout-single-column", "display", {
    capability: display("singleColumn"),
    apply: (resolution) => {
      resolution.display.singleColumn = true;
    },
  }),
  def("line-reader", "tool", {
    params: [c("highlightColor")],
    capability: tool("lineReader"),
    apply: (resolution, preference) => {
      resolution.tools.lineReader = {
        enabled: true,
        highlightColor: stringParam(preference.params, "highlightColor"),
      };
    },
  }),
  def("linguistic-guidance", "catalog-content"),
  def("long-description", "catalog-content"),
  def("magnification", "display", {
    params: [n("zoomAmount"), n("allContent"), n("text"), n("nonText")],
    capability: display("magnification"),
    apply: (resolution, preference) => {
      resolution.display.magnification = {
        allContent: numberParam(preference.params.zoomAmount ?? preference.params.allContent),
        text: numberParam(preference.params.text),
        nonText: numberParam(preference.params.nonText),
      };
    },
  }),
  def("note-taking-on-screen", "tool"),
  def("outliner-on-screen", "tool"),
  def("peer-interaction-on-screen", "tool"),
  def("sign-language", "media", {
    cardinality: "zero-or-many",
    params: [lang()],
    capability: media("signLanguage"),
    apply: (resolution, preference) => {
      resolution.media.signLanguage = {
        enabled: true,
        language: stringParam(preference.params, "language"),
      };
    },
  }),
  def("simplified-graphics", "catalog-content"),
  def("simplified-language-portions", "catalog-content"),
  def("spell-checker-on-screen", "tool", {
    capability: tool("spellCheck"),
    apply: (resolution) => {
      resolution.tools.spellChecker = { enabled: true };
    },
    prohibit: (resolution) => {
      resolution.tools.spellChecker = { enabled: false, locked: true };
    },
  }),
  def("spoken", "media", {
    params: [
      en("readingType", ["screen-reader", "computer-read-aloud"]),
      n("speechRate"),
      n("pitch"),
      n("volume"),
    ],
    capability: media("spoken"),
    apply: (resolution, preference) => {
      resolution.media.spoken = {
        enabled: true,
        readingType: readingType(preference.params.readingType),
        speechRate: numberParam(preference.params.speechRate),
        pitch: numberParam(preference.params.pitch),
        volume: numberParam(preference.params.volume),
      };
    },
  }),
  def("tactile", "catalog-content"),
  def("text-appearance", "display", {
    params: [
      n("fontSize"),
      c("fontColor"),
      c("backgroundColor"),
      s("fontFace"),
      n("lineHeight"),
      n("lineSpacing"),
      n("letterSpacing"),
      n("wordSpacing"),
      bool("wordWrapping"),
    ],
    capability: display("textAppearance"),
    apply: (resolution, preference) => {
      const display = resolution.display;
      const params = preference.params;
      const fontSize = numberParam(params.fontSize);
      if (fontSize !== undefined) display.fontSize = fontSize;
      const fontColor = stringParam(params, "fontColor");
      if (fontColor !== undefined) display.fontColor = fontColor;
      const backgroundColor = stringParam(params, "backgroundColor");
      if (backgroundColor !== undefined) display.backgroundColor = backgroundColor;
      const fontFace = stringParam(params, "fontFace");
      if (fontFace !== undefined) display.fontFace = fontFace;
      const lineHeight = numberParam(params.lineHeight);
      if (lineHeight !== undefined) display.lineHeight = lineHeight;
      const lineSpacing = numberParam(params.lineSpacing);
      if (lineSpacing !== undefined) display.lineSpacing = lineSpacing;
      const letterSpacing = numberParam(params.letterSpacing);
      if (letterSpacing !== undefined) display.letterSpacing = letterSpacing;
      const wordSpacing = numberParam(params.wordSpacing);
      if (wordSpacing !== undefined) display.wordSpacing = wordSpacing;
      if (typeof params.wordWrapping === "boolean") display.wordWrapping = params.wordWrapping;
    },
  }),
  def("thesaurus-on-screen", "tool"),
  def("transcript", "media", {
    capability: media("transcript"),
    apply: (resolution) => {
      resolution.media.transcript = { enabled: true };
    },
  }),
  def("visual-organizer-on-screen", "tool"),
] as const satisfies readonly Qti3PnpSupportRegistryEntry[];

export const qti3PnpSupportNames = supportDefinitions.map((definition) => definition.name);

export const qti3PnpSupportDefinitions: readonly Qti3PnpSupportDefinition[] =
  supportDefinitions.map(
    ({
      capability: _capability,
      apply: _apply,
      prohibit: _prohibit,
      validation: _validation,
      ...publicDefinition
    }) => publicDefinition,
  );

const supportDefinitionByName = new Map(
  supportDefinitions.map((definition) => [definition.name, definition]),
);

export function getQti3PnpSupportDefinition(
  support: Qti3PnpSupportName,
): Qti3PnpSupportRegistryEntry | undefined {
  return supportDefinitionByName.get(support.toLowerCase());
}

export function createDefaultQti3PnpCapabilities(): Qti3PnpCapabilityMap {
  return {
    supports: Object.fromEntries(
      supportDefinitions
        .filter(
          (definition) =>
            definition.supportLevel === "runtime" ||
            definition.supportLevel === "runtime-and-catalog",
        )
        .map((definition) => [definition.name, { supported: true }]),
    ),
    tools: {
      calculator: calculatorTypes,
      lineReader: true,
      dictionary: true,
      glossary: true,
      spellCheck: true,
      answerMasking: true,
    },
    display: {
      textAppearance: true,
      magnification: true,
      highContrast: true,
      singleColumn: true,
      keywordEmphasis: true,
    },
    media: {
      spoken: true,
      captions: true,
      transcript: true,
      signLanguage: true,
    },
    session: {
      additionalTime: true,
    },
  };
}

function def(
  name: Qti3PnpKnownSupportName,
  category: Qti3PnpSupportCategory,
  options: SupportDefinitionOptions = {},
): Qti3PnpSupportRegistryEntry {
  const allowedAsCatalogSupport = catalogSupportSet.has(name);
  const supportLevel = supportLevelFor(Boolean(options.apply), allowedAsCatalogSupport);
  const definition: Qti3PnpSupportRegistryEntry = {
    name,
    category,
    cardinality: options.cardinality ?? "zero-or-one",
    params: options.params ?? [],
    allowedInFeatureSet: true,
    allowedAsCatalogSupport,
    supportLevel,
    implemented: supportLevel !== "recognized",
  };
  if (options.capability) definition.capability = options.capability;
  if (options.apply) definition.apply = options.apply;
  if (options.prohibit) definition.prohibit = options.prohibit;
  if (options.validation) definition.validation = options.validation;
  return definition;
}

function supportLevelFor(hasRuntime: boolean, hasCatalog: boolean): Qti3PnpSupportLevel {
  if (hasRuntime && hasCatalog) return "runtime-and-catalog";
  if (hasRuntime) return "runtime";
  if (hasCatalog) return "catalog";
  return "recognized";
}

function calculatorSupported(
  preference: Qti3PnpPreference,
  capabilities: Qti3PnpCapabilityMap,
): boolean {
  const calculator = capabilities.tools?.calculator;
  if (calculator === true) return true;
  if (!Array.isArray(calculator)) return false;
  const type =
    calculatorType(preference.params.calculatorType ?? preference.params.type) ?? "basic";
  return calculator.includes(type);
}

function additionalTestingTime(
  params: Qti3PnpParams,
): Qti3PnpSessionOptions["additionalTestingTime"] {
  const multiplier = numberParam(params.timeMultiplier);
  if (multiplier !== undefined) return { type: "time-multiplier", multiplier };
  const minutes = numberParam(params.fixedMinutes);
  if (minutes !== undefined) return { type: "fixed-minutes", minutes };
  if (params.unlimited === true) return { type: "unlimited" };
  return undefined;
}

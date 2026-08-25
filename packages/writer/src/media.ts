import {
  isNonNegativeInteger,
  isPositiveInteger,
  throwIfDiagnostics,
  validateItemBase,
  validateQtiIdentifier,
  writerDiagnostic,
} from "./diagnostics.js";
import { assertQtiIdentifier } from "./identifier.js";
import {
  interactionAttributeList,
  optionalBodySection,
  optionalPromptSection,
  resolveResponseIdentifier,
} from "./interaction-shell.js";
import { sharedVocabularyXmlAttributes } from "./shared-vocabulary.js";
import { assessmentItemShell } from "./shell.js";
import type { Qti3MediaBuilderInput, Qti3MediaSource, Qti3WriterDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText, xmlAttributeList } from "./xml.js";

const MEDIA_KINDS = new Set(["audio", "video", "object"]);

export function buildQti3MediaItem(input: Qti3MediaBuilderInput): string {
  const diagnostics = validateQti3MediaItem(input);
  throwIfDiagnostics(diagnostics);
  return renderQti3MediaItem(input);
}

export function renderQti3MediaItem(input: Qti3MediaBuilderInput): string {
  const responseIdentifier = assertQtiIdentifier(
    resolveResponseIdentifier(input.responseIdentifier),
    "Media response identifier",
  );
  const escapedResponseIdentifier = escapeXmlAttribute(responseIdentifier);
  const declarationsXml = `  <qti-response-declaration identifier="${escapedResponseIdentifier}" cardinality="single" base-type="integer"/>`;
  const companionMaterialsXml = input.transcript?.trim()
    ? `  <qti-companion-materials-info>
    <qti-physical-material>${escapeXmlText(input.transcript.trim())}</qti-physical-material>
  </qti-companion-materials-info>`
    : "";
  const interactionAttrs = interactionAttributeList({
    responseIdentifier: escapedResponseIdentifier,
    sharedVocabulary: undefined,
    interactionType: "media",
    classNames: input.classNames,
    extraAttributes: [
      `autostart="${input.autostart === true ? "true" : "false"}"`,
      `loop="${input.loop === true ? "true" : "false"}"`,
      numberAttribute("min-plays", input.minPlays),
      numberAttribute("max-plays", input.maxPlays),
      input.coords?.trim() ? `coords="${escapeXmlAttribute(input.coords.trim())}"` : "",
      input.interactionLabel?.trim()
        ? `label="${escapeXmlAttribute(input.interactionLabel.trim())}"`
        : "",
    ],
  });
  const bodyXml = `${optionalBodySection(input.bodyHtml)}    <qti-media-interaction ${interactionAttrs}>
${optionalPromptSection(input.promptHtml)}${mediaElementXml(input)}
    </qti-media-interaction>`;

  return assessmentItemShell({
    ...input,
    declarationsXml,
    bodyXml,
    responseProcessingXml: "",
    companionMaterialsXml,
  });
}

export function validateQti3MediaItem(input: Qti3MediaBuilderInput): Qti3WriterDiagnostic[] {
  const diagnostics = validateItemBase(input);
  const responseIdentifier = resolveResponseIdentifier(input.responseIdentifier);
  const responseIdentifierDiagnostic = validateQtiIdentifier(
    "responseIdentifier",
    "Media response identifier",
    responseIdentifier,
  );
  if (responseIdentifierDiagnostic) diagnostics.push(responseIdentifierDiagnostic);

  validateMediaKind(input, diagnostics);
  validateSources(input.sources, diagnostics);
  validatePlaybackBounds(input, diagnostics);
  validateDimensions(input, diagnostics);
  validateCaptions(input, diagnostics);
  return diagnostics;
}

function mediaElementXml(input: Qti3MediaBuilderInput): string {
  const dimensions = [
    numberAttribute("width", input.width),
    numberAttribute("height", input.height),
  ];
  const sharedAttributes = sharedVocabularyXmlAttributes(input.sharedVocabulary, "media").trim();
  if (input.kind === "object") {
    const first = input.sources[0];
    const attrs = [
      `data="${escapeXmlAttribute(first?.src.trim() ?? "")}"`,
      first?.type?.trim() ? `type="${escapeXmlAttribute(first.type.trim())}"` : "",
      ...dimensions,
      input.objectLabel?.trim() ? `label="${escapeXmlAttribute(input.objectLabel.trim())}"` : "",
      sharedAttributes,
    ];
    return `      <object ${xmlAttributeList(attrs)}/>`;
  }
  const tag = input.kind === "audio" ? "audio" : "video";
  const sourcesXml = input.sources.map(sourceXml).join("\n");
  const mediaAttrs = xmlAttributeList([...dimensions, sharedAttributes ? sharedAttributes : ""]);
  const trackXml =
    tag === "video" && input.captionSrc?.trim()
      ? `\n        <track kind="captions" src="${escapeXmlAttribute(input.captionSrc.trim())}" srclang="${escapeXmlAttribute(
          input.captionLang?.trim() || "en",
        )}"/>`
      : "";
  return `      <${tag}${mediaAttrs ? ` ${mediaAttrs}` : ""}>
${sourcesXml}${trackXml}
      </${tag}>`;
}

function sourceXml(source: Qti3MediaSource): string {
  const attrs = [
    `src="${escapeXmlAttribute(source.src.trim())}"`,
    source.type?.trim() ? `type="${escapeXmlAttribute(source.type.trim())}"` : "",
  ];
  return `        <source ${xmlAttributeList(attrs)}/>`;
}

function validateMediaKind(
  input: Qti3MediaBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const kind: string = input.kind;
  if (MEDIA_KINDS.has(kind)) return;
  diagnostics.push(
    writerDiagnostic(
      "invalid_media_kind",
      "kind",
      "Media kind must be audio, video, or object.",
      input.kind,
    ),
  );
}

function validateSources(
  sources: readonly Qti3MediaSource[],
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!sources.length) {
    diagnostics.push(
      writerDiagnostic("missing_media_sources", "sources", "Media items must include a source."),
    );
  }
  for (const [index, source] of sources.entries()) {
    if (source.src.trim()) continue;
    diagnostics.push(
      writerDiagnostic(
        "missing_media_source_src",
        `sources.${index}.src`,
        "Media source src is required.",
      ),
    );
  }
}

function validatePlaybackBounds(
  input: Qti3MediaBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (input.minPlays !== undefined && !isNonNegativeInteger(input.minPlays)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_media_min_plays",
        "minPlays",
        "Media minPlays must be a non-negative integer.",
        input.minPlays,
      ),
    );
  }
  if (input.maxPlays !== undefined && !isNonNegativeInteger(input.maxPlays)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_media_max_plays",
        "maxPlays",
        "Media maxPlays must be a non-negative integer.",
        input.maxPlays,
      ),
    );
  }
  if (
    input.minPlays !== undefined &&
    input.maxPlays !== undefined &&
    isNonNegativeInteger(input.minPlays) &&
    isNonNegativeInteger(input.maxPlays) &&
    input.minPlays > input.maxPlays
  ) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_media_play_bounds",
        "minPlays|maxPlays",
        "Media minPlays must be less than or equal to maxPlays.",
        { minPlays: input.minPlays, maxPlays: input.maxPlays },
      ),
    );
  }
}

function validateDimensions(
  input: Qti3MediaBuilderInput,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  for (const [path, value] of [
    ["width", input.width],
    ["height", input.height],
  ] as const) {
    if (value === undefined || isPositiveInteger(value)) continue;
    diagnostics.push(
      writerDiagnostic(
        "invalid_media_dimension",
        path,
        "Media dimensions must be positive integers.",
        value,
      ),
    );
  }
}

function validateCaptions(input: Qti3MediaBuilderInput, diagnostics: Qti3WriterDiagnostic[]): void {
  const captionSrc = input.captionSrc?.trim();
  if (!captionSrc) return;
  if (input.kind !== "video") {
    diagnostics.push(
      writerDiagnostic(
        "invalid_media_caption_kind",
        "captionSrc",
        "Media captions are supported only for video media.",
        input.kind,
      ),
    );
  }
  if (!/\.vtt(?:\?|#|$)/i.test(captionSrc)) {
    diagnostics.push(
      writerDiagnostic(
        "invalid_media_caption_src",
        "captionSrc",
        "Media captionSrc must reference a .vtt file.",
        input.captionSrc,
      ),
    );
  }
}

function numberAttribute(name: string, value: number | undefined): string {
  return value === undefined ? "" : `${name}="${String(value)}"`;
}

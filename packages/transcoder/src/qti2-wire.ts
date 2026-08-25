import type { QtiObjectAsset } from "@longsightgroup/qti3-core";

import type { Qti2Revision } from "./qti2-processing-dialect.js";
import type { QtiTranscodeDiagnostic } from "./types.js";
import { escapeXmlAttribute, escapeXmlText } from "./xml.js";

export function attributes(source: Readonly<Record<string, string | undefined>>): string {
  const entries = Object.entries(source).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  return entries.length === 0
    ? ""
    : ` ${entries.map(([name, value]) => `${name}="${escapeXmlAttribute(value)}"`).join(" ")}`;
}

export function semanticAttributes(
  source: Readonly<Record<string, string>> | undefined,
  revision: Qti2Revision,
  diagnostics: QtiTranscodeDiagnostic[],
  path: string,
  omitted: ReadonlySet<string> = new Set(),
): string {
  if (!source) return "";
  const target: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (omitted.has(name) || name === "xmlns" || name.startsWith("xmlns:")) continue;
    if (name === "aria-label" && revision.target === "qti21") {
      target.label = value;
      diagnostics.push({
        code: "profile.qti21.attribute.aria_label_normalized",
        severity: "info",
        message: "Mapped aria-label to the QTI 2.1 label attribute.",
        path,
      });
      continue;
    }
    if ((name.startsWith("aria-") || name.startsWith("data-")) && revision.target === "qti21") {
      diagnostics.push({
        code: "profile.qti21.attribute.semantic_not_representable",
        severity: "warning",
        message: `QTI 2.1 cannot carry ${name}="${value}"; visible prompt and label content is preserved.`,
        path,
      });
      continue;
    }
    target[targetAttributeName(name, revision)] = value;
  }
  return attributes(target);
}

function targetAttributeName(name: string, revision: Qti2Revision): string {
  if (revision.target === "qti22" && (name.startsWith("aria-") || name.startsWith("data-"))) {
    return name;
  }
  return name.replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
}

export function serializeObject(object: QtiObjectAsset): string {
  const sources = object.sources
    .map((source) => `<source${attributes({ src: source.src, type: source.type })}></source>`)
    .join("");
  const tracks = object.tracks
    .map(
      (track) =>
        `<track${attributes({
          kind: track.kind,
          src: track.src,
          srclang: track.srclang,
          label: track.label,
          default: track.default ? "default" : undefined,
        })}></track>`,
    )
    .join("");
  return `<object${attributes({
    data: object.data,
    type: object.type,
    width: object.width,
    height: object.height,
  })}>${sources}${tracks}${escapeXmlText(object.text)}</object>`;
}

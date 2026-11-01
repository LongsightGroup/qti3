import { normalizePackagePath } from "@longsightgroup/qti3-core";
import {
  attr,
  childElements,
  findAllDescendantsByLocalName,
  parseXml,
  serializeChildren,
  type XmlElement,
  type XmlNode,
} from "../xml.js";
import type { QtiMigrationAsset } from "../types.js";
import { html, sourceFormat, text } from "./content.js";
import type { LmsIssue } from "./types.js";

export interface MoodleFiles {
  readonly assets: QtiMigrationAsset[];
  readonly owners: Map<XmlElement, { scope: number; paths: Map<string, string> }>;
}
export function extractFiles(
  question: XmlElement,
  identifier: string,
  issues: LmsIssue[],
): MoodleFiles {
  const assets: QtiMigrationAsset[] = [];
  const owners = new Map<XmlElement, { scope: number; paths: Map<string, string> }>();
  for (const file of findAllDescendantsByLocalName(question, "file")) {
    const owner = file.parentNode;
    if (!owner || !isElement(owner)) continue;
    let area = owners.get(owner);
    if (!area) {
      area = { scope: owners.size + 1, paths: new Map() };
      owners.set(owner, area);
    }
    const paths = area.paths;
    const name = attr(file, "name") ?? "";
    const prefix = (attr(file, "path") ?? "").replace(/^\/+|\/+$/g, "");
    const candidate = prefix ? `${prefix}/${name}` : name;
    const relative =
      candidate.includes("\\") || candidate.includes("\0")
        ? undefined
        : normalizePackagePath(candidate, "Moodle file", []);
    if (!relative || !name || paths.has(relative) || attr(file, "encoding") !== "base64") {
      issues.push({
        code: "LMS_MEDIA_REVIEW",
        message: "An embedded file has an invalid or duplicate field-local path or encoding.",
      });
      continue;
    }
    try {
      const data = decodeBase64((file.textContent ?? "").replace(/\s/g, ""));
      const path = `moodle/${identifier}/field-${area.scope}/${relative}`;
      paths.set(relative, path);
      assets.push({ path, data, mediaType: attr(file, "mimetype") ?? undefined });
    } catch {
      issues.push({
        code: "LMS_MEDIA_REVIEW",
        message: `Embedded file ${name} has invalid base64 data.`,
      });
    }
  }
  return { assets, owners };
}
function isElement(node: XmlNode): node is XmlElement {
  return node.nodeType === 1 && "attributes" in node;
}
export function readField(
  element: XmlElement | undefined,
  files: MoodleFiles,
  issues: LmsIssue[],
): string {
  if (!element) return "";
  const normalized = html(text(element), sourceFormat(element), issues);
  const root = parseXml(`<div>${normalized}</div>`, "Moodle normalized field").documentElement;
  const pending = [root];
  for (let index = 0; index < pending.length; index++) {
    const node = pending[index];
    if (!node) continue;
    for (const name of ["src", "href", "data", "poster"]) {
      const reference = attr(node, name);
      if (!reference) continue;
      const suffixIndex = reference.search(/[?#]/);
      const raw = suffixIndex < 0 ? reference : reference.slice(0, suffixIndex);
      const suffix = suffixIndex < 0 ? "" : reference.slice(suffixIndex);
      let decoded: string;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        issues.push({
          code: "LMS_MEDIA_REVIEW",
          message: "A field URL contains invalid percent encoding.",
        });
        continue;
      }
      if (!decoded.startsWith("@@PLUGINFILE@@/")) continue;
      const path = files.owners.get(element)?.paths.get(decoded.slice("@@PLUGINFILE@@/".length));
      if (!path) {
        issues.push({
          code: "LMS_MEDIA_REVIEW",
          message: `Required field-local media ${reference} is missing.`,
        });
        continue;
      }
      node.setAttribute(name, path.split("/").map(encodeURIComponent).join("/") + suffix);
    }
    pending.push(...childElements(node));
  }
  return serializeChildren(root);
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw new Error("Invalid base64");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of value.replace(/=+$/, "")) {
    buffer = (buffer << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  if (bits && buffer & ((1 << bits) - 1)) throw new Error("Invalid base64 padding");
  return Uint8Array.from(bytes);
}

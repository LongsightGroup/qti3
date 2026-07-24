import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strToU8 } from "fflate";

import { relativePackagePath } from "./package-manifest.js";
import type { QtiTranscodeFile } from "./types.js";

const xmlParser = new DOMParser({
  errorHandler: {
    warning: () => undefined,
    error: () => undefined,
    fatalError: () => undefined,
  },
});
const xmlSerializer = new XMLSerializer();

/** Combine item-level Moodle XML and embed package assets in Moodle file nodes. */
export function serializeMoodleXmlPackage(
  items: readonly QtiTranscodeFile[],
  assets: readonly QtiTranscodeFile[],
  assetOwners: ReadonlyMap<string, readonly string[]>,
): QtiTranscodeFile {
  const questions = items.map((item) => {
    if (typeof item.data !== "string") {
      throw new Error(`Moodle XML item ${item.path} is not XML text.`);
    }
    const ownedAssets = assets.filter((asset) => assetOwners.get(asset.path)?.includes(item.path));
    return serializeEmbeddedQuestion(item.data, item.path, ownedAssets);
  });
  return {
    path: "moodle_questions.xml",
    data: `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  ${questions.join("\n  ")}
</quiz>`,
  };
}

function serializeEmbeddedQuestion(
  xml: string,
  itemPath: string,
  assets: readonly QtiTranscodeFile[],
): string {
  const document = xmlParser.parseFromString(xml, "application/xml");
  const question = document.getElementsByTagName("question").item(0);
  if (!question) {
    throw new Error("Generated Moodle XML item lacks a question element.");
  }
  const questionText = question.getElementsByTagName("questiontext").item(0);
  const htmlText = questionText?.getElementsByTagName("text").item(0);
  if (!questionText || !htmlText) {
    throw new Error("Generated Moodle XML question lacks questiontext.");
  }

  const replacements = new Map<string, string>();
  for (const asset of assets) {
    const pluginFilePath = `@@PLUGINFILE@@/${asset.path}`;
    replacements.set(relativePackagePath(itemPath, asset.path), pluginFilePath);
    replacements.set(asset.path, pluginFilePath);
    questionText.appendChild(moodleFileElement(document, asset));
  }
  replaceElementText(document, htmlText, rewriteHtmlAssetUris(htmlText.textContent, replacements));
  return xmlSerializer.serializeToString(question);
}

function rewriteHtmlAssetUris(html: string, replacements: ReadonlyMap<string, string>): string {
  return html.replace(
    /\b(src|href|data)\s*=\s*(["'])(.*?)\2/giu,
    (attribute: string, name: string, quote: string, value: string) => {
      const replacement = replacements.get(value);
      return replacement === undefined ? attribute : `${name}=${quote}${replacement}${quote}`;
    },
  );
}

function replaceElementText(document: Document, element: Element, value: string): void {
  while (element.firstChild) element.removeChild(element.firstChild);
  element.appendChild(document.createTextNode(value));
}

function moodleFileElement(document: Document, file: QtiTranscodeFile): Element {
  const segments = file.path.split("/");
  const name = segments.at(-1) ?? file.path;
  const directory = segments.length > 1 ? `/${segments.slice(0, -1).join("/")}/` : "/";
  const bytes = typeof file.data === "string" ? strToU8(file.data) : file.data;
  const element = document.createElement("file");
  element.setAttribute("name", name);
  element.setAttribute("path", directory);
  element.setAttribute("encoding", "base64");
  element.appendChild(document.createTextNode(bytesToBase64(bytes)));
  return element;
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const block = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += alphabet[(block >> 18) & 63] ?? "";
    output += alphabet[(block >> 12) & 63] ?? "";
    output += second === undefined ? "=" : (alphabet[(block >> 6) & 63] ?? "");
    output += third === undefined ? "=" : (alphabet[block & 63] ?? "");
  }
  return output;
}

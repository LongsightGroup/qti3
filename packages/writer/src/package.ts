import {
  normalizePackagePath,
  parseQtiPackage,
  parseQtiXml,
  type QtiDiagnostic,
} from "@longsightgroup/qti3-core";
import { zipSync, strToU8 } from "fflate";

import { throwIfDiagnostics, validateQtiIdentifier, writerDiagnostic } from "./diagnostics.js";
import { renderQti3AuthoringItem, validateQti3AuthoringItem } from "./interactions.js";
import type { Qti3AuthoringItem, Qti3WriterDiagnostic, Qti3WriterResult } from "./types.js";
import { Qti3WriterError } from "./types.js";
import { xmlEscape, xmlLines } from "./xml.js";

const QTI_PACKAGE_MANIFEST_PATH = "imsmanifest.xml";
const QTI_ITEM_RESOURCE_TYPE = "imsqti_item_xmlv3p0";
const ZIP_EPOCH = new Date("1980-01-02T12:00:00.000Z");

/** Input model for an item-bank QTI 3 package. */
export interface Qti3PackageAuthoringInput {
  readonly identifier: string;
  readonly title?: string | undefined;
  readonly items: readonly Qti3PackageItem[];
}

/** Assessment item source for a generated QTI 3 package. */
export type Qti3PackageItem = Qti3PackageAuthoringItem | Qti3PackageXmlItem;

/** Package item that is rendered from the writer's structured authoring model. */
export interface Qti3PackageAuthoringItem {
  readonly kind: "authoringItem";
  readonly path: string;
  readonly item: Qti3AuthoringItem;
  readonly assets?: readonly Qti3PackageAsset[] | undefined;
}

/** Package item supplied as trusted assessment-item XML. */
export interface Qti3PackageXmlItem {
  readonly kind: "xml";
  readonly path: string;
  readonly identifier: string;
  readonly xml: string;
  readonly assets?: readonly Qti3PackageAsset[] | undefined;
}

/** Non-item file included in an item's manifest resource. */
export interface Qti3PackageAsset {
  readonly path: string;
  readonly data: Uint8Array | string;
  readonly mediaType?: string | undefined;
}

/** File emitted by the QTI 3 package writer. */
export interface Qti3PackageFile {
  readonly path: string;
  readonly data: Uint8Array | string;
}

export type Qti3PackageFilesResult =
  | {
      readonly ok: true;
      readonly files: readonly Qti3PackageFile[];
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly Qti3WriterDiagnostic[] };

export type Qti3PackageZipResult =
  | {
      readonly ok: true;
      readonly zip: Uint8Array;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly Qti3WriterDiagnostic[] };

/** Validate a package authoring input without writing package files. */
export function validateQti3Package(
  input: Qti3PackageAuthoringInput,
): readonly Qti3WriterDiagnostic[] {
  return buildValidPackage(input).diagnostics;
}

/** Write an IMS manifest XML document for an item-bank QTI 3 package. */
export function writeQti3PackageManifest(input: Qti3PackageAuthoringInput): string {
  throwIfDiagnostics(validateQti3Package(input));
  return renderPackageManifest(buildValidPackage(input).normalized);
}

/** Write an IMS manifest XML document and return diagnostics instead of throwing. */
export function writeQti3PackageManifestResult(input: Qti3PackageAuthoringInput): Qti3WriterResult {
  const built = buildValidPackage(input);
  if (built.diagnostics.length) return { ok: false, diagnostics: built.diagnostics };
  return { ok: true, xml: renderPackageManifest(built.normalized), diagnostics: [] };
}

/** Write a package file map containing imsmanifest.xml, item XML files, and declared assets. */
export function writeQti3PackageFiles(
  input: Qti3PackageAuthoringInput,
): readonly Qti3PackageFile[] {
  const result = writeQti3PackageFilesResult(input);
  if (!result.ok) throw new Qti3WriterError(result.diagnostics);
  return result.files;
}

/** Write a package file map and return diagnostics instead of throwing. */
export function writeQti3PackageFilesResult(
  input: Qti3PackageAuthoringInput,
): Qti3PackageFilesResult {
  const built = buildValidPackage(input);
  if (built.diagnostics.length) return { ok: false, diagnostics: built.diagnostics };
  return { ok: true, files: packageFiles(built.normalized), diagnostics: [] };
}

/** Write a deterministic stored ZIP archive for an item-bank QTI 3 package. */
export function writeQti3PackageZip(input: Qti3PackageAuthoringInput): Uint8Array {
  const result = writeQti3PackageZipResult(input);
  if (!result.ok) throw new Qti3WriterError(result.diagnostics);
  return result.zip;
}

/** Write a deterministic stored ZIP archive and return diagnostics instead of throwing. */
export function writeQti3PackageZipResult(input: Qti3PackageAuthoringInput): Qti3PackageZipResult {
  const filesResult = writeQti3PackageFilesResult(input);
  if (!filesResult.ok) return filesResult;

  const zipEntries: Record<string, Uint8Array> = {};
  for (const file of filesResult.files) {
    zipEntries[file.path] = fileDataBytes(file.data);
  }

  const zip = zipSync(zipEntries, { level: 0, mtime: ZIP_EPOCH });
  const parsed = parseQtiPackage(zip);
  const diagnostics = parsed.diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) =>
      writerDiagnostic(
        `package_round_trip_${diagnostic.code}`,
        diagnostic.path ?? "package",
        diagnostic.message,
      ),
    );
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, zip, diagnostics: [] };
}

interface NormalizedPackage {
  readonly identifier: string;
  readonly title?: string | undefined;
  readonly items: readonly NormalizedPackageItem[];
}

interface NormalizedPackageItem {
  readonly path: string;
  readonly identifier: string;
  readonly xml: string;
  readonly assets: readonly NormalizedPackageAsset[];
}

interface NormalizedPackageAsset {
  readonly path: string;
  readonly data: Uint8Array | string;
  readonly mediaType?: string | undefined;
}

interface BuildPackageFilesResult {
  readonly normalized: NormalizedPackage;
  readonly diagnostics: readonly Qti3WriterDiagnostic[];
}

function buildValidPackage(input: Qti3PackageAuthoringInput): BuildPackageFilesResult {
  const diagnostics = validatePackageBase(input);
  const normalized = normalizePackage(input, diagnostics);
  diagnostics.push(...validatePackageGraph(normalized));
  return { normalized, diagnostics };
}

function packageFiles(input: NormalizedPackage): readonly Qti3PackageFile[] {
  const files: Qti3PackageFile[] = [
    { path: QTI_PACKAGE_MANIFEST_PATH, data: renderPackageManifest(input) },
  ];
  for (const item of input.items) {
    files.push({ path: item.path, data: item.xml });
    for (const asset of item.assets) files.push({ path: asset.path, data: asset.data });
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

function validatePackageBase(input: Qti3PackageAuthoringInput): Qti3WriterDiagnostic[] {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const identifierDiagnostic = validateQtiIdentifier(
    "identifier",
    "Package identifier",
    input.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (input.title !== undefined && !input.title.trim()) {
    diagnostics.push(
      writerDiagnostic(
        "missing_package_title",
        "title",
        "Package title must not be empty when provided.",
      ),
    );
  }
  if (input.items.length === 0) {
    diagnostics.push(
      writerDiagnostic(
        "missing_package_items",
        "items",
        "QTI package must contain at least one item.",
      ),
    );
  }
  return diagnostics;
}

function normalizePackage(
  input: Qti3PackageAuthoringInput,
  diagnostics: Qti3WriterDiagnostic[],
): NormalizedPackage {
  return {
    identifier: input.identifier.trim(),
    title: input.title?.trim(),
    items: input.items.map((item) => normalizePackageItem(item, diagnostics)),
  };
}

function normalizePackageItem(
  item: Qti3PackageItem,
  diagnostics: Qti3WriterDiagnostic[],
): NormalizedPackageItem {
  const path = parsePackagePath(item.path, "item path", `items.${item.path}.path`, diagnostics);
  const assets = (item.assets ?? []).map((asset) => normalizePackageAsset(asset, diagnostics));
  if (item.kind === "authoringItem") {
    return {
      path,
      identifier: item.item.identifier.trim(),
      xml: packageItemXml(item, diagnostics),
      assets,
    };
  }
  return {
    path,
    identifier: item.identifier.trim(),
    xml: item.xml,
    assets,
  };
}

function normalizePackageAsset(
  asset: Qti3PackageAsset,
  diagnostics: Qti3WriterDiagnostic[],
): NormalizedPackageAsset {
  return {
    path: parsePackagePath(asset.path, "asset path", `assets.${asset.path}.path`, diagnostics),
    data: asset.data,
    mediaType: asset.mediaType?.trim(),
  };
}

function validatePackageGraph(input: NormalizedPackage): Qti3WriterDiagnostic[] {
  const diagnostics: Qti3WriterDiagnostic[] = [];
  const seenItemIdentifiers = new Set<string>();
  const seenPaths = new Set<string>([QTI_PACKAGE_MANIFEST_PATH]);

  for (const item of input.items) {
    validateUniquePath(item.path, seenPaths, diagnostics);
    validateItemIdentifier(item, seenItemIdentifiers, diagnostics);
    validateItemXml(item, diagnostics);
    validateItemAssets(item, seenPaths, diagnostics);
  }

  return diagnostics;
}

function packageItemXml(item: Qti3PackageItem, diagnostics: Qti3WriterDiagnostic[]): string {
  if (item.kind === "xml") return item.xml;

  const itemDiagnostics = validateQti3AuthoringItem(item.item);
  if (itemDiagnostics.length) {
    diagnostics.push(
      ...itemDiagnostics.map((diagnostic) =>
        writerDiagnostic(
          diagnostic.code,
          `items.${normalizePackagePathForDiagnostic(item.path)}.${diagnostic.path}`,
          diagnostic.message,
          diagnostic.value,
        ),
      ),
    );
    return "";
  }
  return renderQti3AuthoringItem(item.item);
}

function validateItemIdentifier(
  item: NormalizedPackageItem,
  seenItemIdentifiers: Set<string>,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const identifierDiagnostic = validateQtiIdentifier(
    `items.${item.path}.identifier`,
    "Package item identifier",
    item.identifier,
  );
  if (identifierDiagnostic) diagnostics.push(identifierDiagnostic);
  if (!item.identifier) return;
  if (seenItemIdentifiers.has(item.identifier)) {
    diagnostics.push(
      writerDiagnostic(
        "duplicate_package_item_identifier",
        `items.${item.path}.identifier`,
        `Package item identifier "${item.identifier}" must be unique.`,
        item.identifier,
      ),
    );
    return;
  }
  seenItemIdentifiers.add(item.identifier);
}

function validateItemXml(item: NormalizedPackageItem, diagnostics: Qti3WriterDiagnostic[]): void {
  if (!item.xml) return;
  const parsed = parseQtiXml(item.xml);
  for (const diagnostic of parsed.diagnostics) {
    if (diagnostic.severity !== "error") continue;
    diagnostics.push(
      writerDiagnostic(
        `invalid_package_item_xml_${diagnostic.code}`,
        item.path,
        diagnostic.message,
      ),
    );
  }
  const parsedIdentifier = parsed.document?.item.attributes.identifier;
  if (parsed.ok && parsedIdentifier && parsedIdentifier !== item.identifier) {
    diagnostics.push(
      writerDiagnostic(
        "package_item_identifier_mismatch",
        `items.${item.path}.identifier`,
        `Package item identifier "${item.identifier}" must match assessment item identifier "${parsedIdentifier}".`,
        item.identifier,
      ),
    );
  }
}

function validateItemAssets(
  item: NormalizedPackageItem,
  seenPaths: Set<string>,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  const seen = new Set<string>();
  for (const asset of item.assets) {
    if (seen.has(asset.path)) {
      diagnostics.push(
        writerDiagnostic(
          "duplicate_package_item_asset",
          `items.${item.path}.assets`,
          `Package item asset "${asset.path}" must be unique for the item.`,
          asset.path,
        ),
      );
      continue;
    }
    seen.add(asset.path);
    validateUniquePath(asset.path, seenPaths, diagnostics);
    if (asset.mediaType !== undefined && !asset.mediaType.trim()) {
      diagnostics.push(
        writerDiagnostic(
          "missing_package_asset_media_type",
          `items.${item.path}.assets.${asset.path}.mediaType`,
          "Package asset mediaType must not be empty when provided.",
        ),
      );
    }
  }
}

function parsePackagePath(
  path: string,
  context: string,
  diagnosticPath: string,
  diagnostics: Qti3WriterDiagnostic[],
): string {
  if (!path) {
    diagnostics.push(
      writerDiagnostic("missing_package_path", diagnosticPath, "Package path is required."),
    );
    return "";
  }

  const coreDiagnostics: QtiDiagnostic[] = [];
  const slashPath = path.replaceAll("\\", "/");
  const normalized = normalizePackagePath(slashPath, context, coreDiagnostics);
  diagnostics.push(
    ...coreDiagnostics.map((diagnostic) =>
      writerDiagnostic(diagnostic.code, diagnosticPath, diagnostic.message),
    ),
  );
  return normalized ?? slashPath;
}

function normalizePackagePathForDiagnostic(path: string): string {
  return (
    normalizePackagePath(path.replaceAll("\\", "/"), "package item path", []) ??
    path.replaceAll("\\", "/")
  );
}

function validateUniquePath(
  path: string,
  seenPaths: Set<string>,
  diagnostics: Qti3WriterDiagnostic[],
): void {
  if (!path) return;
  if (seenPaths.has(path)) {
    diagnostics.push(
      writerDiagnostic(
        "duplicate_package_path",
        path,
        `Package path "${path}" must be unique.`,
        path,
      ),
    );
    return;
  }
  seenPaths.add(path);
}

function renderPackageManifest(input: NormalizedPackage): string {
  return xmlLines([
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<manifest xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1" identifier="${xmlEscape(input.identifier)}">`,
    input.title
      ? `  <metadata>\n    <title>${xmlEscape(input.title)}</title>\n  </metadata>`
      : undefined,
    `  <resources>`,
    ...input.items.map(renderManifestItemResource),
    `  </resources>`,
    `</manifest>`,
  ]);
}

function renderManifestItemResource(item: NormalizedPackageItem): string {
  const files = [item.path, ...item.assets.map((asset) => asset.path)];
  return xmlLines([
    `    <resource identifier="${xmlEscape(item.identifier)}" type="${QTI_ITEM_RESOURCE_TYPE}" href="${xmlEscape(item.path)}">`,
    ...files.map((path) => `      <file href="${xmlEscape(path)}"/>`),
    `    </resource>`,
  ]);
}

function fileDataBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === "string" ? strToU8(data) : data;
}

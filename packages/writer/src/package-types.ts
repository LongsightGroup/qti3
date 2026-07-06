import type { Qti3AuthoringItem, Qti3WriterDiagnostic } from "./types.js";

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
}

/** File emitted by the QTI 3 package writer. */
export interface Qti3PackageFile {
  readonly path: string;
  readonly data: Uint8Array | string;
}

export type Qti3PackageManifestResult =
  | {
      readonly ok: true;
      readonly xml: string;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly Qti3WriterDiagnostic[] };

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

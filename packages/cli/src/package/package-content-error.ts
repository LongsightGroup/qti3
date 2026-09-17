import type { QtiDiagnostic } from "@longsightgroup/qti3-core";
/** Expected failure caused by malformed or invalid authored package content. */
export class PackageContentError extends Error {
  readonly _tag = "PackageContentError" as const;

  constructor(
    message: string,
    readonly diagnostics: readonly QtiDiagnostic[] = [],
  ) {
    super(message);
    this.name = "PackageContentError";
  }
}

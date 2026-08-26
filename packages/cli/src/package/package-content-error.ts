/** Expected failure caused by malformed or invalid authored package content. */
export class PackageContentError extends Error {
  readonly _tag = "PackageContentError" as const;

  constructor(message: string) {
    super(message);
    this.name = "PackageContentError";
  }
}

import {
  DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS,
  normalizePackagePath,
  type QtiPackageEntry,
} from "@longsightgroup/qti3-core";

/** One atomic saved package; bytes remain the source of truth across application reloads. */
export interface SavedPackage {
  readonly id: string;
  readonly title: string;
  readonly filename: string;
  readonly importedAt: string;
  readonly entries: readonly QtiPackageEntry[];
}

/** Small list projection; callers load entry bodies only when opening a package. */
export type SavedPackageMetadata = Omit<SavedPackage, "entries">;

/** Storage failures are visible to the page; no in-memory save fallback is used. */
export type StorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: "unavailable" | "blocked" | "quota" | "aborted" | "invalid-record" | "storage";
      readonly message: string;
    };

const databaseName = "qti3-saved-packages";
const storeName = "packages";

/** Insert a complete package; success means its transaction has committed. IDs are unique. */
export async function savePackage(record: SavedPackage): Promise<StorageResult<void>> {
  const parsed = parseSavedPackage(record);
  if (!parsed.ok) return parsed;
  return transact("readwrite", (store, done) => {
    store.add(parsed.value);
    done(undefined);
  });
}

/** List saved-package metadata without retaining entry bodies in the list. */
export async function listPackages(): Promise<StorageResult<readonly SavedPackageMetadata[]>> {
  return transact("readonly", (store, done, fail) => {
    const records: SavedPackageMetadata[] = [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        done(records.toSorted((left, right) => left.title.localeCompare(right.title)));
        return;
      }
      const raw: unknown = cursor.value;
      const record = parseMetadata(raw);
      if (!record) {
        fail(invalidRecord());
        return;
      }
      records.push(record);
      cursor.continue();
    };
  });
}

/** Read and parse a stored record. A missing ID is a successful empty lookup. */
export async function readPackage(id: string): Promise<StorageResult<SavedPackage | undefined>> {
  const result = await transact<unknown>("readonly", (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const raw: unknown = request.result;
      done(raw);
    };
  });
  if (!result.ok) return result;
  if (result.value === undefined) return { ok: true, value: undefined };
  return parseSavedPackage(result.value);
}

/** Delete a saved package atomically; success means deletion has committed. */
export async function deletePackage(id: string): Promise<StorageResult<void>> {
  return transact("readwrite", (store, done) => {
    store.delete(id);
    done(undefined);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    done: (value: T) => void,
    fail: (failure: StorageResult<never>) => void,
  ) => void,
): Promise<StorageResult<T>> {
  const opened = await openDatabase();
  if (!opened.ok) return opened;
  const database = opened.value;
  return new Promise((resolve) => {
    let result: StorageResult<T> | undefined;
    try {
      const transaction = database.transaction(storeName, mode);
      transaction.oncomplete = () => {
        database.close();
        resolve(
          result ?? {
            ok: false,
            code: "storage",
            message: "The database operation did not return a result.",
          },
        );
      };
      transaction.addEventListener("abort", () => {
        database.close();
        resolve(result?.ok === false ? result : storageFailure(transaction.error, "aborted"));
      });
      operation(
        transaction.objectStore(storeName),
        (value) => {
          result = { ok: true, value };
        },
        (failure) => {
          result = failure;
          transaction.abort();
        },
      );
    } catch (cause: unknown) {
      database.close();
      resolve(storageFailure(cause, "storage"));
    }
  });
}

function openDatabase(): Promise<StorageResult<IDBDatabase>> {
  return new Promise((resolve) => {
    let blocked = false;
    try {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      };
      request.addEventListener("error", () =>
        resolve(storageFailure(request.error, "unavailable")),
      );
      request.onblocked = () => {
        blocked = true;
        resolve({
          ok: false,
          code: "blocked",
          message: "Close other Saved packages tabs, then try again.",
        });
      };
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) {
          database.close();
          return;
        }
        database.onversionchange = () => database.close();
        resolve({ ok: true, value: database });
      };
    } catch (cause: unknown) {
      resolve(storageFailure(cause, "unavailable"));
    }
  });
}

function storageFailure(
  cause: unknown,
  fallback: "aborted" | "unavailable" | "storage",
): StorageResult<never> {
  if (cause instanceof DOMException && cause.name === "QuotaExceededError")
    return {
      ok: false,
      code: "quota",
      message: "Browser storage is full. Delete a saved package or free space, then retry.",
    };
  return {
    ok: false,
    code: fallback,
    message:
      fallback === "aborted"
        ? "The database transaction was aborted. Your previously saved packages are unchanged."
        : "Browser storage is unavailable. The package was not saved.",
  };
}

function invalidRecord(): StorageResult<never> {
  return {
    ok: false,
    code: "invalid-record",
    message: "The saved package record is invalid and cannot be opened.",
  };
}

function parseMetadata(value: unknown): SavedPackageMetadata | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !value.id ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !("filename" in value) ||
    typeof value.filename !== "string" ||
    !("importedAt" in value) ||
    typeof value.importedAt !== "string" ||
    !Number.isFinite(Date.parse(value.importedAt))
  )
    return undefined;
  return {
    id: value.id,
    title: value.title,
    filename: value.filename,
    importedAt: value.importedAt,
  };
}

function parseSavedPackage(value: unknown): StorageResult<SavedPackage> {
  const metadata = parseMetadata(value);
  if (
    !metadata ||
    !value ||
    typeof value !== "object" ||
    !("entries" in value) ||
    !Array.isArray(value.entries)
  )
    return invalidRecord();
  const limits = DEFAULT_QTI_PACKAGE_RESOURCE_LIMITS;
  if (value.entries.length === 0 || value.entries.length > limits.maxEntries)
    return invalidRecord();
  const entries: QtiPackageEntry[] = [];
  const paths = new Set<string>();
  let total = 0;
  for (const entry of value.entries) {
    const raw: unknown = entry;
    if (
      !raw ||
      typeof raw !== "object" ||
      !("path" in raw) ||
      typeof raw.path !== "string" ||
      !raw.path ||
      raw.path.includes("\\") ||
      raw.path.includes("\0") ||
      paths.has(raw.path) ||
      normalizePackagePath(raw.path, "saved entry", []) !== raw.path ||
      !("bytes" in raw) ||
      !(raw.bytes instanceof Uint8Array)
    )
      return invalidRecord();
    total += raw.bytes.byteLength;
    if (
      raw.bytes.byteLength > limits.maxEntryUncompressedBytes ||
      total > limits.maxTotalUncompressedBytes
    )
      return invalidRecord();
    paths.add(raw.path);
    entries.push({ path: raw.path, bytes: raw.bytes });
  }
  return { ok: true, value: { ...metadata, entries } };
}

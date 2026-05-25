import { describe, expect, it, vi } from "vitest";
import type { QtiAttemptStateV1 } from "@longsightgroup/qti3-core";
import {
  createQtiAssessmentItemPlayerAdapterLoadSync,
  qtiAssessmentItemPlayerLoadStateKey,
} from "./player-adapter.js";

describe("qtiAssessmentItemPlayerLoadStateKey", () => {
  it("returns undefined for missing state", () => {
    expect(qtiAssessmentItemPlayerLoadStateKey(undefined)).toBeUndefined();
  });

  it("treats equivalent state objects as the same load key", () => {
    const state: QtiAttemptStateV1 = {
      schema: "qti3.attempt-state.v1",
      itemIdentifier: "ITEM-1",
      status: "interacting",
      responses: {},
      outcomes: {},
      validationMessages: [],
    };
    expect(qtiAssessmentItemPlayerLoadStateKey(state)).toBe(
      qtiAssessmentItemPlayerLoadStateKey({ ...state }),
    );
  });

  it("treats different key order as different load keys", () => {
    const first: QtiAttemptStateV1 = {
      schema: "qti3.attempt-state.v1",
      itemIdentifier: "ITEM-1",
      status: "interacting",
      responses: {},
      outcomes: {},
      validationMessages: [],
    };
    const second: QtiAttemptStateV1 = {
      schema: "qti3.attempt-state.v1",
      status: "interacting",
      itemIdentifier: "ITEM-1",
      responses: {},
      outcomes: {},
      validationMessages: [],
    };
    expect(qtiAssessmentItemPlayerLoadStateKey(first)).not.toBe(
      qtiAssessmentItemPlayerLoadStateKey(second),
    );
  });
});

describe("createQtiAssessmentItemPlayerAdapterLoadSync", () => {
  it("clears the element when xml is undefined", () => {
    const sync = createQtiAssessmentItemPlayerAdapterLoadSync();
    const element = {
      clearItem: vi.fn(),
      loadXml: vi.fn(() => Promise.resolve()),
    };

    sync.run(element as never, { xml: undefined });

    expect(element.clearItem).toHaveBeenCalledTimes(1);
    expect(element.loadXml).not.toHaveBeenCalled();
  });

  it("reports load failures only for the active sequence", async () => {
    const sync = createQtiAssessmentItemPlayerAdapterLoadSync();
    let rejectFirst: ((error: Error) => void) | undefined;
    const element = {
      clearItem: vi.fn(),
      loadXml: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((_, reject) => {
              rejectFirst = reject;
            }),
        )
        .mockImplementationOnce(() => Promise.resolve()),
    };
    const onLoadError = vi.fn();

    sync.run(element as never, { xml: "<first/>", onLoadError });
    const cleanup = sync.run(element as never, { xml: "<second/>", onLoadError });
    rejectFirst?.(new Error("stale failure"));
    await Promise.resolve();
    cleanup();

    expect(onLoadError).not.toHaveBeenCalled();
  });
});

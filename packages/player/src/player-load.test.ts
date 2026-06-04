// @vitest-environment happy-dom
import { interactionFixtures } from "@longsightgroup/qti3-fixtures";
import type { QtiAttemptStateV1 } from "@longsightgroup/qti3-core";
import { describe, expect, it, vi } from "vitest";
import { defineQtiAssessmentItemPlayer, QtiAssessmentItemPlayer } from "./index.js";

const choiceXml = interactionFixtures.find((fixture) => fixture.id === "choice-reference")!.xml;

describe("QtiAssessmentItemPlayer load lifecycle", () => {
  it("ignores stale loadUrl completions after a newer load starts", async () => {
    defineQtiAssessmentItemPlayer();
    const player = new QtiAssessmentItemPlayer();
    document.body.append(player);

    let resolveFirstFetch: ((xml: string) => void) | undefined;
    const firstFetch = new Promise<string>((resolve) => {
      resolveFirstFetch = resolve;
    });
    const fetchXml = vi
      .fn()
      .mockImplementationOnce(() => firstFetch)
      .mockImplementationOnce(() => Promise.resolve(choiceXml));

    const ready = vi.fn();
    player.addEventListener("qti-ready", ready);

    const firstLoad = player.loadUrl("first.xml", { fetchXml });
    const secondLoad = player.loadUrl("second.xml", { fetchXml });
    await secondLoad;

    expect(ready).toHaveBeenCalledTimes(1);
    resolveFirstFetch?.("<not-valid-qti/>");
    await firstLoad;

    expect(ready).toHaveBeenCalledTimes(1);
    player.remove();
  });

  it("clears rendered content when clearItem is called", async () => {
    defineQtiAssessmentItemPlayer();
    const player = new QtiAssessmentItemPlayer();
    document.body.append(player);

    await player.loadXml(choiceXml);
    expect(player.childElementCount).toBeGreaterThan(0);

    player.clearItem();
    expect(player.childElementCount).toBe(0);
    expect(player.serialize()).toBeUndefined();

    player.remove();
  });

  it("ignores stale loadUrl completions that would parse invalid XML", async () => {
    defineQtiAssessmentItemPlayer();
    const player = new QtiAssessmentItemPlayer();
    document.body.append(player);

    let resolveFirstFetch: ((xml: string) => void) | undefined;
    const firstFetch = new Promise<string>((resolve) => {
      resolveFirstFetch = resolve;
    });
    const fetchXml = vi
      .fn()
      .mockImplementationOnce(() => firstFetch)
      .mockImplementationOnce(() => Promise.resolve(choiceXml));

    const firstLoad = player.loadUrl("first.xml", { fetchXml });
    const secondLoad = player.loadUrl("second.xml", { fetchXml });
    await secondLoad;

    expect(player.childElementCount).toBeGreaterThan(0);
    resolveFirstFetch?.("<not-valid-qti/>");
    await firstLoad;

    expect(player.textContent).not.toContain("Unable to parse QTI item.");
    player.remove();
  });

  it("reports loadUrl fetch failures as diagnostics instead of rejecting", async () => {
    defineQtiAssessmentItemPlayer();
    const player = new QtiAssessmentItemPlayer();
    document.body.append(player);

    const diagnostics = vi.fn();
    player.addEventListener("qti-diagnostics", diagnostics);

    await expect(
      player.loadUrl("missing.xml", {
        fetchXml: async () => {
          throw new Error("network unavailable");
        },
      }),
    ).resolves.toBeUndefined();

    expect(diagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          diagnostics: [
            expect.objectContaining({
              code: "player.loadUrl",
              severity: "error",
              message: "network unavailable",
            }),
          ],
        },
      }),
    );
    expect(player.textContent).toContain("Unable to load QTI item.");
    player.remove();
  });

  it("reports restore misuse as diagnostics instead of throwing", async () => {
    defineQtiAssessmentItemPlayer();
    const player = new QtiAssessmentItemPlayer();
    document.body.append(player);

    const diagnostics = vi.fn();
    player.addEventListener("qti-diagnostics", diagnostics);
    const emptyState: QtiAttemptStateV1 = {
      schema: "qti3.attempt-state.v1",
      itemIdentifier: "choice-reference",
      status: "initialized",
      responses: {},
      outcomes: {},
      validationMessages: [],
    };

    expect(() => player.restore(emptyState)).not.toThrow();
    expect(diagnostics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: {
          diagnostics: [
            expect.objectContaining({
              code: "player.restoreState",
              severity: "error",
              message: "Cannot restore QTI state before loading an item.",
            }),
          ],
        },
      }),
    );

    await player.loadXml(choiceXml);
    const state = player.serialize();
    if (!state) throw new Error("Expected loaded player state.");
    const restored = vi.fn();
    player.addEventListener("qti-restore", restored);

    expect(() => player.restore({ ...state, itemIdentifier: "other-item" })).not.toThrow();
    expect(restored).not.toHaveBeenCalled();
    expect(diagnostics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: {
          diagnostics: [
            expect.objectContaining({
              code: "player.restoreState",
              severity: "error",
              message: "Cannot restore state for other-item into choice-reference.",
            }),
          ],
        },
      }),
    );
    player.remove();
  });

  it("reports incompatible loadXml restored state as diagnostics instead of rejecting", async () => {
    defineQtiAssessmentItemPlayer();
    const player = new QtiAssessmentItemPlayer();
    document.body.append(player);

    await player.loadXml(choiceXml);
    const state = player.serialize();
    if (!state) throw new Error("Expected loaded player state.");

    const diagnostics = vi.fn();
    player.addEventListener("qti-diagnostics", diagnostics);
    await expect(
      player.loadXml(choiceXml, { state: { ...state, itemIdentifier: "other-item" } }),
    ).resolves.toBeUndefined();

    expect(diagnostics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: {
          diagnostics: [
            expect.objectContaining({
              code: "player.restoreState",
              severity: "error",
              message: "Cannot restore state for other-item into choice-reference.",
            }),
          ],
        },
      }),
    );
    expect(player.textContent).toContain("Unable to restore QTI state.");
    player.remove();
  });
});

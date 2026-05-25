// @vitest-environment happy-dom
import { interactionFixtures } from "@longsightgroup/qti3-fixtures";
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
});

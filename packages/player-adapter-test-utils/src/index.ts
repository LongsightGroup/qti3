import { interactionFixtures } from "@longsightgroup/qti3-fixtures";
import { describe, expect, it, vi, type MockInstance } from "vitest";
import {
  QtiAssessmentItemPlayer as QtiAssessmentItemPlayerElement,
  type QtiAssessmentItemPlayerHandle,
} from "@longsightgroup/qti3-player";

const validItemXml = interactionFixtures.find((fixture) => fixture.id === "choice-reference")!.xml;

export interface QtiAssessmentItemPlayerAdapterTestContract<Component, Ref> {
  adapterName: string;
  createComponent(props: QtiAssessmentItemPlayerAdapterTestProps, ref?: Ref): Component;
  createRef(): Ref;
  currentHandle(ref: Ref): QtiAssessmentItemPlayerHandle | undefined | null;
  render(component: Component): HTMLDivElement;
  rerender(component: Component): void;
  flushLoadFailure(): Promise<void>;
}

export interface QtiAssessmentItemPlayerAdapterTestProps {
  ref?: unknown;
  xml?: string | undefined;
  loadOptions?:
    | {
        status?: "interacting" | "completed" | undefined;
        state?: { schema: "qti3.attempt-state.v1"; itemIdentifier: string } | undefined;
        sessionControl?: { showFeedback?: boolean | undefined } | undefined;
      }
    | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
  "data-item-id"?: string | undefined;
  languageOfInterface?: string | undefined;
  messageCatalog?: { locale?: string | undefined; strings?: Record<string, string> } | undefined;
  messages?: Record<string, string> | undefined;
  onReady?: ((detail: { item: { identifier: string } }) => void) | undefined;
  onDiagnostics?: ((detail: { diagnostics: { code: string }[] }) => void) | undefined;
  onLoadError?: ((error: Error) => void) | undefined;
}

export function describeQtiAssessmentItemPlayerAdapterContract<Component, Ref>(
  contract: QtiAssessmentItemPlayerAdapterTestContract<Component, Ref>,
): void {
  describe(`QtiAssessmentItemPlayer ${contract.adapterName} adapter`, () => {
    it("renders one player element and forwards DOM props", () => {
      const host = contract.render(
        contract.createComponent({
          className: "preview",
          "aria-label": "Preview item",
          "data-item-id": "A",
        }),
      );

      const element = host.querySelector("qti-assessment-item-player");
      expect(element).toBeInstanceOf(QtiAssessmentItemPlayerElement);
      expect(host.querySelectorAll("qti-assessment-item-player")).toHaveLength(1);
      expect(element?.getAttribute("class")).toBe("preview");
      expect(element?.getAttribute("aria-label")).toBe("Preview item");
      expect(element?.getAttribute("data-item-id")).toBe("A");
    });

    it("loads XML after synchronous diagnostics listeners are registered", () => {
      const onDiagnostics = vi.fn();
      const loadXml = mockQtiAssessmentItemPlayerLoadXml(function () {
        this.dispatchEvent(
          new CustomEvent("qti-diagnostics", { detail: { diagnostics: [{ code: "x" }] } }),
        );
        return Promise.resolve();
      });

      contract.render(contract.createComponent({ xml: "<item/>", onDiagnostics }));

      expect(loadXml).toHaveBeenCalledTimes(1);
      expect(loadXml).toHaveBeenCalledWith("<item/>", undefined);
      expect(onDiagnostics).toHaveBeenCalledWith({ diagnostics: [{ code: "x" }] });
    });

    it("does not reload for equivalent inline load options but reloads for load-key changes", () => {
      const loadXml = mockQtiAssessmentItemPlayerLoadXml();
      contract.render(
        contract.createComponent({
          xml: "<item/>",
          loadOptions: { status: "interacting", sessionControl: { showFeedback: false } },
        }),
      );
      contract.rerender(
        contract.createComponent({
          xml: "<item/>",
          loadOptions: { status: "interacting", sessionControl: { showFeedback: false } },
        }),
      );
      contract.rerender(
        contract.createComponent({
          xml: "<item/>",
          loadOptions: { status: "completed", sessionControl: { showFeedback: false } },
        }),
      );

      expect(loadXml).toHaveBeenCalledTimes(2);
    });

    it("does not reload for equivalent restored state with a new object reference", () => {
      const loadXml = mockQtiAssessmentItemPlayerLoadXml();
      const state = {
        schema: "qti3.attempt-state.v1" as const,
        itemIdentifier: "ITEM-1",
        status: "interacting" as const,
        responses: {},
        outcomes: {},
        validationMessages: [],
      };
      contract.render(
        contract.createComponent({
          xml: "<item/>",
          loadOptions: { state },
        }),
      );
      contract.rerender(
        contract.createComponent({
          xml: "<item/>",
          loadOptions: { state: { ...state } },
        }),
      );

      expect(loadXml).toHaveBeenCalledTimes(1);
    });

    it("reports declarative load failures", async () => {
      const onLoadError = vi.fn();
      const failure = new Error("load failed");
      mockQtiAssessmentItemPlayerLoadXml(() => Promise.reject(failure));

      contract.render(contract.createComponent({ xml: "<item/>", onLoadError }));
      await contract.flushLoadFailure();

      expect(onLoadError).toHaveBeenCalledWith(failure);
    });

    it("syncs messageCatalog to the player element", () => {
      const messageCatalog = { locale: "sv-SE", strings: { remove: "Ta bort" } };
      mockQtiAssessmentItemPlayerLoadXml();
      const host = contract.render(contract.createComponent({ xml: "<item/>", messageCatalog }));

      const element = host.querySelector("qti-assessment-item-player");
      expect(element).toBeInstanceOf(QtiAssessmentItemPlayerElement);
      expect((element as QtiAssessmentItemPlayerElement).messageCatalog).toEqual(messageCatalog);
    });

    it("uses the latest event callback after rerender", () => {
      const first = vi.fn();
      const second = vi.fn();
      mockQtiAssessmentItemPlayerLoadXml();
      const host = contract.render(contract.createComponent({ xml: "<item/>", onReady: first }));
      contract.rerender(contract.createComponent({ xml: "<item/>", onReady: second }));

      const element = host.querySelector("qti-assessment-item-player");
      element?.dispatchEvent(
        new CustomEvent("qti-ready", { detail: { item: { identifier: "ITEM-1" } } }),
      );

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith({ item: { identifier: "ITEM-1" } });
    });

    it("clears the player when xml becomes undefined", () => {
      const clearItem = vi.spyOn(QtiAssessmentItemPlayerElement.prototype, "clearItem");
      mockQtiAssessmentItemPlayerLoadXml();
      contract.render(contract.createComponent({ xml: "<item/>" }));
      contract.rerender(contract.createComponent({ xml: undefined }));

      expect(clearItem).toHaveBeenCalledTimes(1);
    });

    it("ignores superseded async load completions", async () => {
      let resolveFirst: (() => void) | undefined;
      const first = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      const loadXml = vi.spyOn(QtiAssessmentItemPlayerElement.prototype, "loadXml");
      loadXml.mockImplementationOnce(() => first);

      const host = contract.render(contract.createComponent({ xml: "<first/>" }));
      loadXml.mockRestore();
      contract.rerender(contract.createComponent({ xml: validItemXml }));
      await contract.flushLoadFailure();

      const element = host.querySelector("qti-assessment-item-player");
      expect(element).toBeInstanceOf(QtiAssessmentItemPlayerElement);
      expect((element as QtiAssessmentItemPlayerElement).childElementCount).toBeGreaterThan(0);

      resolveFirst?.();
      await contract.flushLoadFailure();

      expect((element as QtiAssessmentItemPlayerElement).childElementCount).toBeGreaterThan(0);
      expect(element?.textContent).not.toContain("Unable to parse QTI item.");
      expect((element as QtiAssessmentItemPlayerElement).serialize()?.itemIdentifier).toBeTruthy();
    });

    it("exposes an imperative handle", () => {
      mockQtiAssessmentItemPlayerLoadXml();
      const ref = contract.createRef();
      contract.render(contract.createComponent({}, ref));
      const handle = contract.currentHandle(ref);
      const serialize = vi
        .spyOn(handle!.element, "serialize")
        .mockReturnValue({ schema: "qti3.attempt-state.v1" } as ReturnType<
          QtiAssessmentItemPlayerHandle["serialize"]
        >);

      expect(handle?.element).toBeInstanceOf(QtiAssessmentItemPlayerElement);
      expect(handle?.serialize()).toEqual({ schema: "qti3.attempt-state.v1" });
      expect(serialize).toHaveBeenCalledTimes(1);
    });
  });
}

function mockQtiAssessmentItemPlayerLoadXml(
  implementation: (
    this: QtiAssessmentItemPlayerElement,
    xml: string,
    options?: Parameters<QtiAssessmentItemPlayerElement["loadXml"]>[1],
  ) => Promise<void> = () => Promise.resolve(),
): MockInstance<QtiAssessmentItemPlayerElement["loadXml"]> {
  return vi
    .spyOn(QtiAssessmentItemPlayerElement.prototype, "loadXml")
    .mockImplementation(implementation);
}

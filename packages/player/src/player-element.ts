import {
  assertQtiAttemptStateV1,
  createItemSession,
  createCatalogSupportResolution,
  createTextToSpeechTraversal,
  parseQtiXml,
  type QtiAttemptStateV1,
  type QtiDiagnostic,
  type QtiDocument,
  type QtiInteraction,
  type QtiItemSession,
  type QtiPortableCustomStateValue,
  type QtiScoreResult,
  type QtiCatalogSupportResolution,
  type QtiCatalogSupportResolutionOptions,
  type QtiTextToSpeechTraversal,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import {
  renderContentNodes,
  type PlayerContentContext,
} from "./content/content-renderer.js";
import { contentNodeText } from "./content/content-dom.js";
import {
  portableCustomValidityDiagnostic,
  renderPortableCustomResponse,
} from "./interactions/portable-custom-interaction.js";
import {
  collectEmbeddedInteractionDiagnostics,
  collectInteractionRenderDiagnostics,
} from "./interactions/interaction-diagnostics.js";
import { defaultPlayerLocale, normalizedLocale, resolvePlayerMessages } from "./player-locale.js";
import { syncAttemptAvailability } from "./player/attempt-availability.js";
import {
  currentTemplateValue,
  currentVariableValue,
  isFeedbackVisible,
  isTemplateContentVisible,
  mathTemplateValue,
} from "./player/content-state.js";
import { syncDynamicBodyState } from "./player/dynamic-body.js";
import { syncFeedbackPanel } from "./player/feedback-panel.js";
import {
  renderBlockInteractionSection,
  renderEmbeddedInteractionSection,
} from "./player/interaction-render.js";
import { renderPlayerShell } from "./player/render-shell.js";
import { resolveRenderedAssets } from "./player/resolve-assets.js";
import type {
  QtiAssessmentItemPlayerEventDetailMap,
  QtiAssessmentItemPlayerEventName,
  QtiPlayerLoadOptions,
  QtiPlayerMessageOverrides,
  QtiPlayerResolveAsset,
  QtiPlayerSessionControl,
  QtiScoreAttemptOptions,
} from "./player-types.js";
import {
  cloneDiagnostics,
  errorView,
  validateItemResponses,
} from "./player-validation.js";
import { syncValidationMessages } from "./player-validation-dom.js";

const HTMLElementBase: typeof HTMLElement =
  globalThis.HTMLElement ??
  (class {
    replaceChildren(): void {}
    dispatchEvent(): boolean {
      return true;
    }
  } as unknown as typeof HTMLElement);


export class QtiAssessmentItemPlayer extends HTMLElementBase {
  static get observedAttributes(): string[] {
    return ["language-of-interface", "locale"];
  }

  private documentModel?: QtiDocument;
  private session?: QtiItemSession;
  private resolveAsset: QtiPlayerResolveAsset | undefined;
  private validationMessages: QtiDiagnostic[] = [];
  private authoringDiagnostics: QtiDiagnostic[] = [];
  private languageOfInterfaceOverride: string | undefined;
  private messageOverrides: QtiPlayerMessageOverrides = {};
  private sessionControl: Required<QtiPlayerSessionControl> = {
    validateResponses: true,
    showFeedback: true,
  };

  get languageOfInterface(): string {
    return (
      this.languageOfInterfaceOverride ??
      this.getAttribute?.("language-of-interface") ??
      this.getAttribute?.("locale") ??
      defaultPlayerLocale(this)
    );
  }

  set languageOfInterface(value: string | undefined) {
    this.languageOfInterfaceOverride = normalizedLocale(value);
    this.rerenderIfLoaded();
  }

  get locale(): string {
    return this.languageOfInterface;
  }

  set locale(value: string | undefined) {
    this.languageOfInterface = value;
  }

  get messages(): QtiPlayerMessageOverrides {
    return this.messageOverrides;
  }

  set messages(value: QtiPlayerMessageOverrides | undefined) {
    this.messageOverrides = value ?? {};
    this.rerenderIfLoaded();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if ((name !== "language-of-interface" && name !== "locale") || oldValue === newValue) {
      return;
    }
    this.rerenderIfLoaded();
  }

  async loadXml(xml: string, options: QtiPlayerLoadOptions = {}): Promise<void> {
    this.sessionControl = {
      validateResponses: options.sessionControl?.validateResponses ?? true,
      showFeedback: options.sessionControl?.showFeedback ?? true,
    };
    this.resolveAsset = options.resolveAsset;
    const result = parseQtiXml(xml);
    const playerDiagnostics = result.document
      ? [
          ...collectInteractionRenderDiagnostics(result.document.item.interactions),
          ...collectEmbeddedInteractionDiagnostics(result.document.item),
        ]
      : [];
    this.dispatchEvent(
      new CustomEvent("qti-diagnostics", {
        detail: { diagnostics: [...result.diagnostics, ...playerDiagnostics] },
      }),
    );
    this.authoringDiagnostics = cloneDiagnostics(
      playerDiagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    );
    if (!result.document) {
      this.replaceChildren(errorView("Unable to parse QTI item."));
      return;
    }

    this.documentModel = result.document;
    this.session = createItemSession(result.document, options.state);
    this.validationMessages = cloneDiagnostics(options.state?.validationMessages ?? []);
    if (options.status) this.session.setStatus(options.status);
    this.render();
    this.renderValidationMessages();
    this.updateAttemptAvailability();
    this.dispatchPlayerEvent("qti-ready", { item: result.document.item });
    this.emitStateChange();
  }

  async loadUrl(url: string, options: QtiPlayerLoadOptions = {}): Promise<void> {
    const fetchXml = options.fetchXml ?? defaultFetchXml;
    await this.loadXml(await fetchXml(url), options);
  }

  scoreAttempt(options: QtiScoreAttemptOptions = {}): QtiScoreResult | undefined {
    const session = this.session;
    if (!session) return undefined;
    const shouldValidateResponses =
      options.validateResponses ?? this.sessionControl.validateResponses;
    const responseValidation = shouldValidateResponses ? this.validateResponses() : [];
    const validationMessages = [...this.authoringDiagnostics, ...responseValidation];
    if (validationMessages.length > 0) {
      this.validationMessages = cloneDiagnostics(responseValidation);
      this.renderValidationMessages();
      const state = this.serialize();
      if (!state) return undefined;
      this.dispatchPlayerEvent("qti-validation", {
        validationMessages: cloneDiagnostics(validationMessages),
        state,
      });
      this.emitStateChange(state);
      return undefined;
    }
    this.validationMessages = [];
    this.renderValidationMessages();
    const result = session.score();
    this.dispatchPlayerEvent("qti-score", result);
    this.updateDynamicBodyState();
    this.updateAttemptAvailability();
    if (this.sessionControl.showFeedback) this.renderFeedback(result.outcomes);
    this.emitStateChange(result.state);
    return result;
  }

  reset(): void {
    if (!this.documentModel) return;
    this.session = createItemSession(this.documentModel);
    this.validationMessages = [];
    this.render();
    this.updateAttemptAvailability();
    this.dispatchEvent(new CustomEvent("qti-reset", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  restore(state: QtiAttemptStateV1): void {
    if (!this.documentModel) {
      throw new Error("Cannot restore QTI state before loading an item.");
    }
    assertQtiAttemptStateV1(state);
    if (state.itemIdentifier !== this.documentModel.item.identifier) {
      throw new Error(
        `Cannot restore state for ${state.itemIdentifier} into ${this.documentModel.item.identifier}.`,
      );
    }
    this.session = createItemSession(this.documentModel, state);
    this.validationMessages = cloneDiagnostics(state.validationMessages);
    this.render();
    this.renderValidationMessages();
    this.updateAttemptAvailability();
    this.dispatchEvent(new CustomEvent("qti-restore", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  suspend(): void {
    if (!this.session) return;
    this.session.setStatus("suspended");
    const state = this.serialize();
    if (!state) return;
    this.dispatchPlayerEvent("qti-suspend", { state });
    this.emitStateChange(state);
  }

  endAttempt(options: QtiScoreAttemptOptions = {}): void {
    const result = this.scoreAttempt(options);
    if (!result) return;
    if (
      !this.documentModel?.item.adaptive ||
      result.state.outcomes.completionStatus === "completed"
    ) {
      this.session?.setStatus("completed");
    }
    this.updateAttemptAvailability();
    const state = this.serialize();
    if (!state) return;
    this.dispatchPlayerEvent("qti-endattempt", { state });
    this.emitStateChange(state);
  }

  serialize(): QtiAttemptStateV1 | undefined {
    const state = this.session?.serialize();
    if (state) {
      state.validationMessages = cloneDiagnostics(this.visibleValidationMessages());
    }
    return state;
  }

  getTextToSpeechTraversal(): QtiTextToSpeechTraversal | undefined {
    if (!this.documentModel) return undefined;
    return createTextToSpeechTraversal(this.documentModel);
  }

  getCatalogSupportResolution(
    options: QtiCatalogSupportResolutionOptions = {},
  ): QtiCatalogSupportResolution | undefined {
    if (!this.documentModel) return undefined;
    return createCatalogSupportResolution(this.documentModel, options);
  }

  private emitStateChange(state = this.serialize()): void {
    if (!state) return;
    this.dispatchPlayerEvent("qti-statechange", { state });
  }

  private dispatchPlayerEvent<T extends QtiAssessmentItemPlayerEventName>(
    type: T,
    detail: QtiAssessmentItemPlayerEventDetailMap[T],
  ): void {
    this.dispatchEvent(new CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>(type, { detail }));
  }

  private playerMessages() {
    return resolvePlayerMessages(this.languageOfInterface, this.messageOverrides);
  }

  private rerenderIfLoaded(): void {
    if (!this.documentModel) return;
    this.render();
    this.renderValidationMessages();
    this.updateAttemptAvailability();
  }

  private render(): void {
    const documentModel = this.documentModel;
    if (!documentModel) return;

    this.applyDefaultStyles();
    const root = renderPlayerShell({
      documentModel,
      contentContext: this.contentContext(),
      renderStandaloneInteraction: (interaction) => this.renderInteraction(interaction),
    });
    if (this.resolveAsset) resolveRenderedAssets(root, this.resolveAsset);
    this.replaceChildren(root);
  }

  private renderInteraction(interaction: QtiInteraction): HTMLElement {
    const responseIdentifier = interaction.responseIdentifier;
    return renderBlockInteractionSection({
      interaction,
      messages: this.playerMessages(),
      update: this.bindResponseUpdate(responseIdentifier),
      currentValue: responseIdentifier ? this.currentResponseValue(responseIdentifier) : null,
      isCompleted: () => this.attemptIsCompleted(),
      endAttempt: () => this.endAttempt(),
      renderPortableCustom: (portableInteraction, portableUpdate, portableValue) =>
        this.renderPortableCustomResponse(portableInteraction, portableUpdate, portableValue),
    });
  }

  private bindResponseUpdate(responseIdentifier: string | undefined): (value: QtiValue) => void {
    return (value) => {
      if (this.attemptIsCompleted()) return;
      if (!responseIdentifier || !this.session) return;
      this.session.respond(responseIdentifier, value);
      this.clearValidationMessage(responseIdentifier);
      this.dispatchPlayerEvent("qti-responsechange", { responseIdentifier, value });
      this.emitStateChange();
    };
  }

  private contentContext(): PlayerContentContext {
    const sessionState = () => this.session?.serialize();
    return {
      interactionAt: (index) => this.documentModel?.item.interactions[index],
      renderBlockInteraction: (interaction) => this.renderInteraction(interaction),
      renderEmbeddedInteraction: (embeddedInteraction) => {
        const responseIdentifier = embeddedInteraction.responseIdentifier;
        return renderEmbeddedInteractionSection(
          embeddedInteraction,
          this.bindResponseUpdate(responseIdentifier),
          responseIdentifier ? this.currentResponseValue(responseIdentifier) : null,
        );
      },
      currentVariableValue: (identifier) => currentVariableValue(sessionState(), identifier),
      mathTemplateValue: (node) => {
        const identifier = contentNodeText(node).trim();
        return mathTemplateValue(
          node,
          this.documentModel,
          identifier ? currentTemplateValue(sessionState(), identifier) : null,
        );
      },
      isFeedbackVisible: (node) =>
        isFeedbackVisible(node, currentVariableValue(sessionState(), node.outcomeIdentifier)),
      isTemplateContentVisible: (element) => {
        const templateIdentifier = element.dataset.templateIdentifier;
        return isTemplateContentVisible(
          element,
          templateIdentifier ? currentTemplateValue(sessionState(), templateIdentifier) : null,
        );
      },
    };
  }

  private renderPortableCustomResponse(
    interaction: QtiInteraction,
    update: (value: QtiValue) => void,
    currentValue: QtiValue,
  ): HTMLElement {
    const responseIdentifier = interaction.responseIdentifier;
    return renderPortableCustomResponse({
      interaction,
      update,
      currentValue,
      currentState: responseIdentifier
        ? this.currentInteractionState(responseIdentifier)
        : undefined,
      renderMarkup: (nodes) => renderContentNodes(nodes, this.contentContext()),
      setInteractionState: (identifier, state) => this.session?.setInteractionState(identifier, state),
      setValidity: (identifier, valid, message) =>
        this.setPortableCustomValidity(identifier, valid, message),
      emitStateChange: () => this.emitStateChange(),
      onMount: (detail) => this.dispatchPlayerEvent("qti-portable-custom-mount", detail),
    });
  }

  private updateDynamicBodyState(): void {
    const sessionState = this.session?.serialize();
    syncDynamicBodyState(this, {
      variableValue: (identifier) => currentVariableValue(sessionState, identifier),
      templateValue: (identifier) => currentTemplateValue(sessionState, identifier),
    });
  }

  private updateAttemptAvailability(): void {
    syncAttemptAvailability(this, {
      completed: this.attemptIsCompleted(),
      status: this.session?.serialize().status ?? "unloaded",
      host: this,
    });
  }

  private attemptIsCompleted(): boolean {
    return this.session?.serialize().status === "completed";
  }

  private currentResponseValue(identifier: string): QtiValue {
    return this.session?.serialize().responses[identifier] ?? null;
  }

  private currentInteractionState(identifier: string): QtiPortableCustomStateValue | undefined {
    return this.session?.serialize().interactionStates?.[identifier];
  }

  private setPortableCustomValidity(
    responseIdentifier: string,
    valid: boolean,
    message: string | undefined,
  ): void {
    const diagnostic = portableCustomValidityDiagnostic(responseIdentifier, valid, message);
    if (!diagnostic) {
      this.clearValidationMessage(responseIdentifier);
      return;
    }
    this.validationMessages = [
      ...this.validationMessages.filter((entry) => entry.path !== responseIdentifier),
      diagnostic,
    ];
    this.renderValidationMessages();
  }

  private applyDefaultStyles(): void {
    this.style.color = "CanvasText";
    this.style.backgroundColor = "Canvas";
    this.style.colorScheme = "light dark";
  }

  private validateResponses(): QtiDiagnostic[] {
    const state = this.session?.serialize();
    if (!state || !this.documentModel) return [];
    return validateItemResponses(this.documentModel, state);
  }

  private visibleValidationMessages(): QtiDiagnostic[] {
    return [...this.authoringDiagnostics, ...this.validationMessages];
  }

  private renderValidationMessages(): void {
    syncValidationMessages(this, this.visibleValidationMessages());
  }

  private clearValidationMessage(responseIdentifier: string): void {
    const before = this.validationMessages.length;
    this.validationMessages = this.validationMessages.filter(
      (message) => message.path !== responseIdentifier,
    );
    if (this.validationMessages.length !== before) this.renderValidationMessages();
  }

  private renderFeedback(outcomes: Record<string, QtiValue>): void {
    const documentModel = this.documentModel;
    if (!documentModel) return;
    syncFeedbackPanel(this.querySelector<HTMLElement>(".qti3-feedback"), documentModel.item, outcomes);
  }
}

export function defineQtiAssessmentItemPlayer(): void {
  if (globalThis.customElements && !customElements.get("qti-assessment-item-player")) {
    customElements.define("qti-assessment-item-player", QtiAssessmentItemPlayer);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "qti-assessment-item-player": QtiAssessmentItemPlayer;
  }
}

async function defaultFetchXml(url: string): Promise<string> {
  if (!globalThis.fetch) {
    throw new Error("No fetch implementation is available. Provide loadUrl(url, { fetchXml }).");
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) throw new Error(`Failed to load QTI XML from ${url}: ${response.status}.`);
  return response.text();
}

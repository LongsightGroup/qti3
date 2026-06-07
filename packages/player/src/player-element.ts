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
import { renderContentNodes, type PlayerContentContext } from "./content/content-renderer.js";
import { contentNodeText } from "./content/content-dom.js";
import {
  portableCustomValidityDiagnostic,
  renderPortableCustomResponse,
} from "./interactions/portable-custom-interaction.js";
import {
  collectEmbeddedInteractionDiagnostics,
  collectInteractionRenderDiagnostics,
} from "./interactions/interaction-diagnostics.js";
import type { PlayerMessageCatalog } from "./player-message-catalog.js";
import { defaultPlayerLocale, normalizedLocale, resolvePlayerMessages } from "./player-locale.js";
import type {
  PlayerMessageResolver,
  QtiPlayerMessageOverrides,
} from "./player-message-resolver.js";
import { syncAttemptAvailability } from "./player/attempt-availability.js";
import {
  currentTemplateValue,
  currentVariableValue,
  isFeedbackVisible,
  isTemplateContentVisible,
  mathTemplateValue,
} from "./player/content-state.js";
import { syncDynamicBodyState } from "./player/dynamic-body.js";
import { defaultFetchXml } from "./player/fetch-xml.js";
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
  QtiPlayerResolveAsset,
  QtiPlayerSessionControl,
  QtiScoreAttemptOptions,
} from "./player-types.js";
import {
  cloneDiagnostics,
  errorView,
  maximumResponseDiagnostic,
  responseCount,
  validateItemResponses,
} from "./player-validation.js";
import { maximumAllowedResponses } from "./response-limits.js";
import { QTI3_INLINE_VALIDATION_EVENT, type InlineValidationDetail } from "./inline-validation.js";
import { syncValidationMessages } from "./player-validation-dom.js";
import {
  isAuthoringDiagnostic,
  mergeVisibleValidationMessages,
  responseValidationMessages,
  splitSerializedValidationMessages,
} from "./player/validation-messages.js";

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
    return ["data-keyword-emphasis", "language-of-interface", "locale"];
  }

  private documentModel?: QtiDocument;
  private session?: QtiItemSession;
  private resolveAsset: QtiPlayerResolveAsset | undefined;
  private validationMessages: QtiDiagnostic[] = [];
  private authoringDiagnostics: QtiDiagnostic[] = [];
  private languageOfInterfaceOverride: string | undefined;
  private keywordEmphasisOverride: boolean | undefined;
  private messageCatalogOverride: PlayerMessageCatalog | undefined;
  private messageOverrides: QtiPlayerMessageOverrides = {};
  private resolvedMessagesCache: PlayerMessageResolver | undefined;
  private sessionControl: Required<QtiPlayerSessionControl> = {
    validateResponses: true,
    showFeedback: true,
  };
  private loadGeneration = 0;

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
    this.invalidatePlayerMessages();
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
    this.invalidatePlayerMessages();
    this.rerenderIfLoaded();
  }

  get messageCatalog(): PlayerMessageCatalog | undefined {
    return this.messageCatalogOverride;
  }

  set messageCatalog(value: PlayerMessageCatalog | undefined) {
    this.messageCatalogOverride = value;
    this.invalidatePlayerMessages();
    this.rerenderIfLoaded();
  }

  get keywordEmphasisEnabled(): boolean {
    return this.keywordEmphasisOverride ?? this.getAttribute?.("data-keyword-emphasis") === "true";
  }

  set keywordEmphasisEnabled(value: boolean | undefined) {
    const nextOverride = value === undefined ? undefined : value === true;
    if (nextOverride === this.keywordEmphasisOverride) {
      this.syncKeywordEmphasisPresentation();
      return;
    }
    this.keywordEmphasisOverride = nextOverride;
    this.syncKeywordEmphasisPresentation();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === "data-keyword-emphasis") {
      this.syncKeywordEmphasisPresentation();
      return;
    }
    if (name !== "language-of-interface" && name !== "locale") return;
    this.invalidatePlayerMessages();
    this.rerenderIfLoaded();
  }

  connectedCallback(): void {
    this.addEventListener(QTI3_INLINE_VALIDATION_EVENT, this.handleInlineValidation);
  }

  disconnectedCallback(): void {
    this.removeEventListener(QTI3_INLINE_VALIDATION_EVENT, this.handleInlineValidation);
  }

  private handleInlineValidation = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as InlineValidationDetail | undefined;
    if (!detail?.responseIdentifier) return;
    this.applyInlineValidation(detail.responseIdentifier, detail.diagnostic, { emitState: true });
  };

  private invalidatePlayerMessages(): void {
    this.resolvedMessagesCache = undefined;
  }

  private syncKeywordEmphasisPresentation(): void {
    const playerRoot = this.querySelector<HTMLElement>(".qti3-player");
    if (!playerRoot) return;
    if (this.keywordEmphasisEnabled) {
      playerRoot.dataset.keywordEmphasis = "true";
    } else {
      delete playerRoot.dataset.keywordEmphasis;
    }
  }

  /** Clears the loaded item. Does not emit player events; declarative hosts control this via `xml`. */
  clearItem(): void {
    this.loadGeneration += 1;
    delete this.documentModel;
    delete this.session;
    this.validationMessages = [];
    this.authoringDiagnostics = [];
    this.replaceChildren();
  }

  async loadXml(xml: string, options: QtiPlayerLoadOptions = {}): Promise<void> {
    const generation = this.beginLoad();
    await this.applyLoadedXml(generation, xml, options);
  }

  async loadUrl(url: string, options: QtiPlayerLoadOptions = {}): Promise<void> {
    const generation = this.beginLoad();
    const fetchXml = options.fetchXml ?? defaultFetchXml;
    let xml: string;
    try {
      xml = await fetchXml(url);
    } catch (error) {
      if (!this.isCurrentLoad(generation)) return;
      this.emitDiagnostics([playerErrorDiagnostic("player.loadUrl", error)]);
      this.replaceChildren(errorView("Unable to load QTI item."));
      return;
    }
    if (!this.isCurrentLoad(generation)) return;
    await this.applyLoadedXml(generation, xml, options);
  }

  private beginLoad(): number {
    this.loadGeneration += 1;
    return this.loadGeneration;
  }

  private isCurrentLoad(generation: number): boolean {
    return generation === this.loadGeneration;
  }

  private async applyLoadedXml(
    generation: number,
    xml: string,
    options: QtiPlayerLoadOptions,
  ): Promise<void> {
    if (!this.isCurrentLoad(generation)) return;

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
    if (!this.isCurrentLoad(generation)) return;

    this.dispatchEvent(
      new CustomEvent("qti-diagnostics", {
        detail: { diagnostics: [...result.diagnostics, ...playerDiagnostics] },
      }),
    );
    const loadTimeAuthoringDiagnostics = [
      ...result.diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error" && isAuthoringDiagnostic(diagnostic),
      ),
      ...playerDiagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    ];
    const serializedValidation = options.state?.validationMessages?.length
      ? splitSerializedValidationMessages(options.state.validationMessages)
      : undefined;
    this.authoringDiagnostics = cloneDiagnostics(
      serializedValidation
        ? [...loadTimeAuthoringDiagnostics, ...serializedValidation.authoringDiagnostics]
        : loadTimeAuthoringDiagnostics,
    );
    if (!result.document) {
      if (!this.isCurrentLoad(generation)) return;
      this.replaceChildren(errorView("Unable to parse QTI item."));
      return;
    }

    if (!this.isCurrentLoad(generation)) return;

    this.documentModel = result.document;
    try {
      this.session = createItemSession(result.document, options.state);
    } catch (error) {
      if (!this.isCurrentLoad(generation)) return;
      this.emitDiagnostics([playerErrorDiagnostic("player.restoreState", error)]);
      this.replaceChildren(errorView("Unable to restore QTI state."));
      return;
    }
    this.validationMessages = cloneDiagnostics(
      serializedValidation
        ? serializedValidation.validationMessages
        : responseValidationMessages(options.state?.validationMessages ?? []),
    );
    if (options.status) this.session.setStatus(options.status);
    this.render();
    this.renderValidationMessages();
    this.updateAttemptAvailability();
    this.dispatchPlayerEvent("qti-ready", { item: result.document.item });
    this.emitStateChange();
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
      this.emitDiagnostics([
        {
          code: "player.restoreState",
          severity: "error",
          message: "Cannot restore QTI state before loading an item.",
        },
      ]);
      return;
    }
    try {
      assertQtiAttemptStateV1(state);
      if (state.itemIdentifier !== this.documentModel.item.identifier) {
        throw new Error(
          `Cannot restore state for ${state.itemIdentifier} into ${this.documentModel.item.identifier}.`,
        );
      }
      this.session = createItemSession(this.documentModel, state);
    } catch (error) {
      this.emitDiagnostics([playerErrorDiagnostic("player.restoreState", error)]);
      return;
    }
    this.validationMessages = cloneDiagnostics(
      responseValidationMessages(state.validationMessages),
    );
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
      state.validationMessages = cloneDiagnostics(
        mergeVisibleValidationMessages(this.authoringDiagnostics, this.validationMessages),
      );
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

  private emitDiagnostics(diagnostics: QtiDiagnostic[]): void {
    this.dispatchPlayerEvent("qti-diagnostics", { diagnostics });
  }

  private dispatchPlayerEvent<T extends QtiAssessmentItemPlayerEventName>(
    type: T,
    detail: QtiAssessmentItemPlayerEventDetailMap[T],
  ): void {
    this.dispatchEvent(new CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>(type, { detail }));
  }

  private playerMessages(): PlayerMessageResolver {
    if (!this.resolvedMessagesCache) {
      this.resolvedMessagesCache = resolvePlayerMessages(
        this.languageOfInterface,
        this.messageOverrides,
        this.messageCatalogOverride,
      );
    }
    return this.resolvedMessagesCache;
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
      keywordEmphasisEnabled: this.keywordEmphasisEnabled,
    });
    if (this.resolveAsset) resolveRenderedAssets(root, this.resolveAsset);
    this.replaceChildren(root);
  }

  private renderInteraction(interaction: QtiInteraction): HTMLElement {
    const responseIdentifier = interaction.responseIdentifier;
    return renderBlockInteractionSection({
      interaction,
      messages: this.playerMessages(),
      update: this.bindResponseUpdate(responseIdentifier, interaction),
      currentValue: responseIdentifier ? this.currentResponseValue(responseIdentifier) : null,
      isCompleted: () => this.attemptIsCompleted(),
      endAttempt: () => this.endAttempt(),
      renderPortableCustom: (portableInteraction, portableUpdate, portableValue) =>
        this.renderPortableCustomResponse(portableInteraction, portableUpdate, portableValue),
    });
  }

  private bindResponseUpdate(
    responseIdentifier: string | undefined,
    interaction?: QtiInteraction,
  ): (value: QtiValue) => void {
    return (value) => {
      if (this.attemptIsCompleted()) return;
      if (!responseIdentifier || !this.session) return;
      const maximum = maximumAllowedResponses(interaction);
      if (maximum !== undefined && responseCount(value) > maximum) {
        this.applyInlineValidation(
          responseIdentifier,
          maximumResponseDiagnostic(responseIdentifier, interaction, maximum),
          { emitState: true },
        );
        return;
      }
      this.session.respond(responseIdentifier, value);
      this.applyInlineValidation(responseIdentifier, undefined);
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
          this.bindResponseUpdate(responseIdentifier, embeddedInteraction),
          responseIdentifier ? this.currentResponseValue(responseIdentifier) : null,
          this.playerMessages(),
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
      setInteractionState: (identifier, state) =>
        this.session?.setInteractionState(identifier, state),
      setValidity: (identifier, valid, message) => {
        const diagnostic = portableCustomValidityDiagnostic(identifier, valid, message);
        this.applyInlineValidation(identifier, diagnostic);
      },
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

  private applyInlineValidation(
    responseIdentifier: string,
    diagnostic: QtiDiagnostic | undefined,
    options: { emitState?: boolean } = {},
  ): void {
    if (!diagnostic) {
      this.clearValidationMessage(responseIdentifier);
      if (options.emitState) this.emitStateChange();
      return;
    }
    this.validationMessages = [
      ...this.validationMessages.filter((entry) => entry.path !== responseIdentifier),
      { ...diagnostic, path: responseIdentifier },
    ];
    this.renderValidationMessages();
    if (options.emitState) this.emitStateChange();
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
    return mergeVisibleValidationMessages(this.authoringDiagnostics, this.validationMessages);
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
    syncFeedbackPanel(
      this.querySelector<HTMLElement>(".qti3-feedback"),
      documentModel.item,
      outcomes,
    );
  }
}

function playerErrorDiagnostic(code: string, error: unknown): QtiDiagnostic {
  return {
    code,
    severity: "error",
    message: error instanceof Error ? error.message : String(error),
  };
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

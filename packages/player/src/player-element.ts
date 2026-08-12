import {
  assertQtiAttemptStateV1,
  createItemSession,
  createCatalogSupportResolution,
  createCompanionMaterialsResolution,
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
  type QtiCompanionMaterialsResolution,
  type QtiCompanionMaterialsResolutionOptions,
  type QtiTextToSpeechTraversal,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { CatalogHost } from "./catalog-host.js";
import type { QtiCatalogDeliveryResolution } from "./catalog-delivery.js";
import { isCatalogRequestDisabled } from "./catalog-request-state.js";
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
import {
  getQtiInteractionRegions,
  type QtiInteractionRegion,
} from "./player/interaction-regions.js";
import { renderPlayerShell } from "./player/render-shell.js";
import { resolveRenderedAssets } from "./player/resolve-assets.js";
import { resolvePlayerStylesheets } from "./player/stylesheet-delivery.js";
import type {
  QtiAssessmentItemPlayerEventDetailMap,
  QtiAssessmentItemPlayerEventName,
  QtiCatalogRequestActivation,
  QtiCatalogRequestPolicy,
  QtiPlayerLoadOptions,
  QtiPlayerResolveAsset,
  QtiPlayerSessionControl,
  QtiResolvedStylesheet,
  QtiRenderedCatalogReference,
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
import { QTI3_INLINE_VALIDATION_EVENT, isInlineValidationDetail } from "./inline-validation.js";
import { syncValidationMessages } from "./player-validation-dom.js";
import {
  isAuthoringDiagnostic,
  mergeVisibleValidationMessages,
  responseValidationMessages,
  splitSerializedValidationMessages,
} from "./player/validation-messages.js";
import { PlayerElementHost } from "./player-element-host.js";

function observeResolvedAssets(
  root: ParentNode,
  resolveAsset: QtiPlayerResolveAsset,
): MutationObserver | undefined {
  const Observer = "MutationObserver" in globalThis ? globalThis.MutationObserver : undefined;
  const NodeConstructor = "Node" in globalThis ? globalThis.Node : undefined;
  const ElementConstructor = "Element" in globalThis ? globalThis.Element : undefined;
  if (!Observer || !NodeConstructor || !ElementConstructor || !(root instanceof NodeConstructor)) {
    return undefined;
  }

  const observer = new Observer((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof ElementConstructor)) continue;
        resolveRenderedAssets(node, resolveAsset);
      }
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
  });
  return observer;
}

interface LoadedPlayerItem {
  readonly document: QtiDocument;
  session: QtiItemSession;
  readonly resolveAsset: QtiPlayerResolveAsset | undefined;
  readonly stylesheets: QtiResolvedStylesheet[];
  readonly sessionControl: Required<QtiPlayerSessionControl>;
  readonly authoringDiagnostics: QtiDiagnostic[];
  validationMessages: QtiDiagnostic[];
}

export class QtiAssessmentItemPlayer extends PlayerElementHost {
  static get observedAttributes(): string[] {
    return ["data-keyword-emphasis", "language-of-interface", "locale"];
  }

  private loadedItem: LoadedPlayerItem | undefined;
  private assetObserver: MutationObserver | undefined;
  private languageOfInterfaceOverride: string | undefined;
  private keywordEmphasisOverride: boolean | undefined;
  private readonly catalogHost = new CatalogHost();
  private messageCatalogOverride: PlayerMessageCatalog | undefined;
  private messageOverrides: QtiPlayerMessageOverrides = {};
  private resolvedMessagesCache: PlayerMessageResolver | undefined;
  private loadGeneration = 0;

  get languageOfInterface(): string {
    return (
      this.languageOfInterfaceOverride ??
      this.getAttribute("language-of-interface") ??
      this.getAttribute("locale") ??
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
    return this.keywordEmphasisOverride ?? this.getAttribute("data-keyword-emphasis") === "true";
  }

  set keywordEmphasisEnabled(value: boolean | undefined) {
    const nextOverride = value === undefined ? undefined : value;
    if (nextOverride === this.keywordEmphasisOverride) {
      this.syncKeywordEmphasisPresentation();
      return;
    }
    this.keywordEmphasisOverride = nextOverride;
    this.syncKeywordEmphasisPresentation();
  }

  /** Returns the host-owned policy used to expose candidate catalog request controls. */
  get catalogRequestPolicy(): QtiCatalogRequestPolicy | undefined {
    return this.catalogHost.requestPolicy;
  }

  /** Configures which catalog supports candidates may request without choosing host presentation. */
  set catalogRequestPolicy(value: QtiCatalogRequestPolicy | undefined) {
    this.catalogHost.setRequestPolicy(value);
    this.rerenderIfLoaded();
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
    this.disconnectAssetObserver();
  }

  private handleInlineValidation = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail;
    if (!isInlineValidationDetail(detail)) return;
    this.applyInlineValidation(detail.responseIdentifier, detail.diagnostic, { emitState: true });
  };

  private invalidatePlayerMessages(): void {
    this.resolvedMessagesCache = undefined;
  }

  private disconnectAssetObserver(): void {
    this.assetObserver?.disconnect();
    this.assetObserver = undefined;
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

  private clearLoadedItemState(): void {
    this.disconnectAssetObserver();
    this.loadedItem = undefined;
    this.catalogHost.clearItemState();
  }

  /** Clears the loaded item. Does not emit player events; declarative hosts control this via `xml`. */
  clearItem(): void {
    this.loadGeneration += 1;
    this.clearLoadedItemState();
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
      this.transitionCurrentLoadToError(
        generation,
        [playerErrorDiagnostic("player.loadUrl", error)],
        "Unable to load QTI item.",
      );
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

  private transitionCurrentLoadToError(
    generation: number,
    diagnostics: QtiDiagnostic[],
    message: string,
  ): void {
    if (!this.isCurrentLoad(generation)) return;
    this.clearLoadedItemState();
    this.replaceChildren(errorView(message));
    this.emitDiagnostics(diagnostics);
  }

  private async applyLoadedXml(
    generation: number,
    xml: string,
    options: QtiPlayerLoadOptions,
  ): Promise<void> {
    if (!this.isCurrentLoad(generation)) return;

    const nextSessionControl: Required<QtiPlayerSessionControl> = {
      validateResponses: options.sessionControl?.validateResponses ?? true,
      showFeedback: options.sessionControl?.showFeedback ?? true,
    };
    const result = parseQtiXml(xml);
    if (!this.isCurrentLoad(generation)) return;
    if (!result.document) {
      this.transitionCurrentLoadToError(
        generation,
        result.diagnostics,
        "Unable to parse QTI item.",
      );
      return;
    }

    const nextDocumentModel = result.document;
    const stylesheetResolution = resolvePlayerStylesheets(
      nextDocumentModel.item.stylesheets,
      options.resolveStylesheet,
    );
    const playerDiagnostics = [
      ...collectInteractionRenderDiagnostics(nextDocumentModel.item.interactions),
      ...collectEmbeddedInteractionDiagnostics(nextDocumentModel.item),
      ...stylesheetResolution.diagnostics,
    ];
    if (!this.isCurrentLoad(generation)) return;

    const loadTimeAuthoringDiagnostics = [
      ...result.diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error" && isAuthoringDiagnostic(diagnostic),
      ),
      ...playerDiagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    ];
    const serializedValidation = options.state?.validationMessages.length
      ? splitSerializedValidationMessages(options.state.validationMessages)
      : undefined;
    const nextAuthoringDiagnostics = cloneDiagnostics(
      serializedValidation
        ? [...loadTimeAuthoringDiagnostics, ...serializedValidation.authoringDiagnostics]
        : loadTimeAuthoringDiagnostics,
    );
    const nextValidationMessages = cloneDiagnostics(
      serializedValidation
        ? serializedValidation.validationMessages
        : responseValidationMessages(options.state?.validationMessages ?? []),
    );

    this.emitDiagnostics([...result.diagnostics, ...playerDiagnostics]);
    if (!this.isCurrentLoad(generation)) return;

    let nextSession: QtiItemSession;
    try {
      nextSession = createItemSession(nextDocumentModel, options.state);
    } catch (error) {
      this.transitionCurrentLoadToError(
        generation,
        [playerErrorDiagnostic("player.restoreState", error)],
        "Unable to restore QTI state.",
      );
      return;
    }
    if (options.status) nextSession.setStatus(options.status);
    if (!this.isCurrentLoad(generation)) return;

    this.loadedItem = {
      document: nextDocumentModel,
      session: nextSession,
      resolveAsset: options.resolveAsset,
      stylesheets: stylesheetResolution.links,
      sessionControl: nextSessionControl,
      authoringDiagnostics: nextAuthoringDiagnostics,
      validationMessages: nextValidationMessages,
    };
    this.render();
    this.renderValidationMessages();
    this.updateAttemptAvailability();
    this.dispatchPlayerEvent("qti-ready", { item: nextDocumentModel.item });
    this.emitStateChange();
  }

  scoreAttempt(options: QtiScoreAttemptOptions = {}): QtiScoreResult | undefined {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return undefined;
    const shouldValidateResponses =
      options.validateResponses ?? loadedItem.sessionControl.validateResponses;
    const responseValidation = shouldValidateResponses ? this.validateResponses() : [];
    const validationMessages = [...loadedItem.authoringDiagnostics, ...responseValidation];
    if (validationMessages.length > 0) {
      loadedItem.validationMessages = cloneDiagnostics(responseValidation);
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
    loadedItem.validationMessages = [];
    this.renderValidationMessages();
    const result = loadedItem.session.score();
    this.dispatchPlayerEvent("qti-score", result);
    this.updateDynamicBodyState();
    this.updateAttemptAvailability();
    if (loadedItem.sessionControl.showFeedback) this.renderFeedback(result.outcomes);
    this.emitStateChange(result.state);
    return result;
  }

  reset(): void {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return;
    loadedItem.session = createItemSession(loadedItem.document);
    loadedItem.validationMessages = [];
    this.render();
    this.updateAttemptAvailability();
    this.dispatchEvent(new CustomEvent("qti-reset", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  restore(state: QtiAttemptStateV1): void {
    const loadedItem = this.loadedItem;
    if (!loadedItem) {
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
      if (state.itemIdentifier !== loadedItem.document.item.identifier) {
        throw new Error(
          `Cannot restore state for ${state.itemIdentifier} into ${loadedItem.document.item.identifier}.`,
        );
      }
      loadedItem.session = createItemSession(loadedItem.document, state);
    } catch (error) {
      this.emitDiagnostics([playerErrorDiagnostic("player.restoreState", error)]);
      return;
    }
    loadedItem.validationMessages = cloneDiagnostics(
      responseValidationMessages(state.validationMessages),
    );
    this.render();
    this.renderValidationMessages();
    this.updateAttemptAvailability();
    this.dispatchEvent(new CustomEvent("qti-restore", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  suspend(): void {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return;
    loadedItem.session.setStatus("suspended");
    this.updateAttemptAvailability();
    const state = this.serialize();
    if (!state) return;
    this.dispatchPlayerEvent("qti-suspend", { state });
    this.emitStateChange(state);
  }

  endAttempt(options: QtiScoreAttemptOptions = {}): void {
    const result = this.scoreAttempt(options);
    if (!result) return;
    const loadedItem = this.loadedItem;
    if (!loadedItem) return;
    if (
      !loadedItem.document.item.adaptive ||
      result.state.outcomes.completionStatus === "completed"
    ) {
      loadedItem.session.setStatus("completed");
    }
    this.updateAttemptAvailability();
    const state = this.serialize();
    if (!state) return;
    this.dispatchPlayerEvent("qti-endattempt", { state });
    this.emitStateChange(state);
  }

  serialize(): QtiAttemptStateV1 | undefined {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return undefined;
    const state = loadedItem.session.serialize();
    state.validationMessages = cloneDiagnostics(
      mergeVisibleValidationMessages(
        loadedItem.authoringDiagnostics,
        loadedItem.validationMessages,
      ),
    );
    return state;
  }

  getTextToSpeechTraversal(): QtiTextToSpeechTraversal | undefined {
    if (!this.loadedItem) return undefined;
    return createTextToSpeechTraversal(this.loadedItem.document);
  }

  getCatalogSupportResolution(
    options: QtiCatalogSupportResolutionOptions = {},
  ): QtiCatalogSupportResolution | undefined {
    if (!this.loadedItem) return undefined;
    return createCatalogSupportResolution(this.loadedItem.document, options);
  }

  /** Returns sanitized, asset-resolved catalog data for explicit support and language options. */
  getCatalogDeliveryResolution(
    options: QtiCatalogSupportResolutionOptions = {},
  ): QtiCatalogDeliveryResolution | undefined {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return undefined;
    return this.catalogHost.getDeliveryResolution(
      loadedItem.document,
      loadedItem.resolveAsset,
      options,
    );
  }

  /** Returns exact live element bindings for rendered authored catalog references. */
  getRenderedCatalogReferences(): QtiRenderedCatalogReference[] {
    if (!this.loadedItem) return [];
    return this.catalogHost.getRenderedReferences(this.loadedItem.document);
  }

  /** Requests host presentation for one live reference when it matches the configured policy. */
  requestCatalog(
    referenceId: string,
    activation: QtiCatalogRequestActivation = "programmatic",
  ): boolean {
    const loadedItem = this.loadedItem;
    if (!loadedItem || this.catalogRequestsDisabled()) return false;
    return this.catalogHost.requestCatalog(
      loadedItem.document,
      loadedItem.resolveAsset,
      referenceId,
      activation,
      (detail) => this.dispatchPlayerEvent("qti-catalogrequest", detail),
    );
  }

  getCompanionMaterialsResolution(
    options: QtiCompanionMaterialsResolutionOptions = {},
  ): QtiCompanionMaterialsResolution | undefined {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return undefined;
    return createCompanionMaterialsResolution(loadedItem.document, {
      ...options,
      resolveAsset: options.resolveAsset ?? loadedItem.resolveAsset,
    });
  }

  getInteractionRegions(): QtiInteractionRegion[] {
    return getQtiInteractionRegions(this);
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
    if (!this.loadedItem) return;
    this.render();
    this.renderValidationMessages();
    this.updateAttemptAvailability();
  }

  private render(): void {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return;

    this.catalogHost.beginRender(loadedItem.document);
    this.applyDefaultStyles();
    const root = renderPlayerShell({
      documentModel: loadedItem.document,
      contentContext: this.contentContext(),
      renderStandaloneInteraction: (interaction) => this.renderInteraction(interaction),
      keywordEmphasisEnabled: this.keywordEmphasisEnabled,
      stylesheets: loadedItem.stylesheets,
    });
    this.catalogHost.installRequestControls(
      loadedItem.document,
      loadedItem.resolveAsset,
      this.playerMessages(),
      (detail) => {
        if (this.catalogRequestsDisabled()) return;
        this.dispatchPlayerEvent("qti-catalogrequest", detail);
      },
    );
    this.disconnectAssetObserver();
    if (loadedItem.resolveAsset) {
      resolveRenderedAssets(root, loadedItem.resolveAsset);
      this.assetObserver = observeResolvedAssets(root, loadedItem.resolveAsset);
    }
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
      renderPromptContent: (nodes) => renderContentNodes(nodes, this.contentContext()),
    });
  }

  private bindResponseUpdate(
    responseIdentifier: string | undefined,
    interaction?: QtiInteraction,
  ): (value: QtiValue) => void {
    return (value) => {
      if (this.attemptIsCompleted()) return;
      const loadedItem = this.loadedItem;
      if (!responseIdentifier || !loadedItem) return;
      const maximum = maximumAllowedResponses(interaction);
      if (maximum !== undefined && responseCount(value) > maximum) {
        this.applyInlineValidation(
          responseIdentifier,
          maximumResponseDiagnostic(responseIdentifier, interaction, maximum),
          { emitState: true },
        );
        return;
      }
      loadedItem.session.respond(responseIdentifier, value);
      this.applyInlineValidation(responseIdentifier, undefined);
      this.dispatchPlayerEvent("qti-responsechange", { responseIdentifier, value });
      this.emitStateChange();
    };
  }

  private contentContext(): PlayerContentContext {
    const sessionState = () => this.loadedItem?.session.serialize();
    return {
      interactionAt: (index) => this.loadedItem?.document.item.interactions[index],
      renderBlockInteraction: (interaction) => this.renderInteraction(interaction),
      renderEmbeddedInteraction: (embeddedInteraction) => {
        const responseIdentifier = embeddedInteraction.responseIdentifier;
        return renderEmbeddedInteractionSection({
          interaction: embeddedInteraction,
          update: this.bindResponseUpdate(responseIdentifier, embeddedInteraction),
          currentValue: responseIdentifier ? this.currentResponseValue(responseIdentifier) : null,
          messages: this.playerMessages(),
          endAttempt: () => this.endAttempt(),
        });
      },
      currentVariableValue: (identifier) => currentVariableValue(sessionState(), identifier),
      mathTemplateValue: (node) => {
        const identifier = contentNodeText(node).trim();
        return mathTemplateValue(
          node,
          this.loadedItem?.document,
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
      observeRenderedElement: (source, element) =>
        this.catalogHost.registerRenderedElement(source, element),
    };
  }

  private catalogRequestsDisabled(): boolean {
    const status = this.loadedItem?.session.serialize().status ?? "unloaded";
    return isCatalogRequestDisabled(status, this.attemptIsCompleted());
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
        this.loadedItem?.session.setInteractionState(identifier, state),
      setValidity: (identifier, valid, message) => {
        const diagnostic = portableCustomValidityDiagnostic(identifier, valid, message);
        this.applyInlineValidation(identifier, diagnostic);
      },
      emitStateChange: () => this.emitStateChange(),
      onMount: (detail) => this.dispatchPlayerEvent("qti-portable-custom-mount", detail),
    });
  }

  private updateDynamicBodyState(): void {
    const sessionState = this.loadedItem?.session.serialize();
    syncDynamicBodyState(this, {
      variableValue: (identifier) => currentVariableValue(sessionState, identifier),
      templateValue: (identifier) => currentTemplateValue(sessionState, identifier),
    });
  }

  private updateAttemptAvailability(): void {
    syncAttemptAvailability(this, {
      completed: this.attemptIsCompleted(),
      status: this.loadedItem?.session.serialize().status ?? "unloaded",
      host: this,
    });
  }

  private attemptIsCompleted(): boolean {
    return this.loadedItem?.session.serialize().status === "completed";
  }

  private currentResponseValue(identifier: string): QtiValue {
    return this.loadedItem?.session.serialize().responses[identifier] ?? null;
  }

  private currentInteractionState(identifier: string): QtiPortableCustomStateValue | undefined {
    return this.loadedItem?.session.serialize().interactionStates?.[identifier];
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
    const loadedItem = this.loadedItem;
    if (!loadedItem) return;
    loadedItem.validationMessages = [
      ...loadedItem.validationMessages.filter((entry) => entry.path !== responseIdentifier),
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
    const loadedItem = this.loadedItem;
    if (!loadedItem) return [];
    return validateItemResponses(loadedItem.document, loadedItem.session.serialize(), {
      responseIdentifiers: this.visibleInteractionResponseIdentifiers(),
    });
  }

  private visibleInteractionResponseIdentifiers(): Set<string> {
    const identifiers = new Set<string>();
    for (const interaction of this.querySelectorAll<HTMLElement>(
      ".qti3-interaction[data-response-identifier]",
    )) {
      const identifier = interaction.dataset.responseIdentifier;
      if (identifier && !interaction.closest("[hidden]")) identifiers.add(identifier);
    }
    return identifiers;
  }

  private visibleValidationMessages(): QtiDiagnostic[] {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return [];
    return mergeVisibleValidationMessages(
      loadedItem.authoringDiagnostics,
      loadedItem.validationMessages,
    );
  }

  private renderValidationMessages(): void {
    syncValidationMessages(this, this.visibleValidationMessages());
  }

  private clearValidationMessage(responseIdentifier: string): void {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return;
    const before = loadedItem.validationMessages.length;
    loadedItem.validationMessages = loadedItem.validationMessages.filter(
      (message) => message.path !== responseIdentifier,
    );
    if (loadedItem.validationMessages.length !== before) this.renderValidationMessages();
  }

  private renderFeedback(outcomes: Record<string, QtiValue>): void {
    const loadedItem = this.loadedItem;
    if (!loadedItem) return;
    syncFeedbackPanel(
      this.querySelector<HTMLElement>(".qti3-feedback"),
      loadedItem.document.item,
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
  if (!customElements.get("qti-assessment-item-player")) {
    customElements.define("qti-assessment-item-player", QtiAssessmentItemPlayer);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "qti-assessment-item-player": QtiAssessmentItemPlayer;
  }
}

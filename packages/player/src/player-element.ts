import {
  assertQtiAttemptStateV1,
  createItemSession,
  createCatalogSupportResolution,
  createTextToSpeechTraversal,
  parseQtiXml,
  visibleModalFeedback,
  type QtiAttemptStatus,
  type QtiAttemptStateV1,
  type QtiContentNode,
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
  contentNodeText,
  copySafeAttributes,
  formatPrintedValue,
  isResolvableAssetUrl,
} from "./content/content-dom.js";
import {
  renderContentNodes,
  type PlayerContentContext,
} from "./content/content-renderer.js";
import { renderInteractionResponse } from "./interactions/interaction-dispatch.js";
import {
  portableCustomValidityDiagnostic,
  renderPortableCustomResponse,
} from "./interactions/portable-custom-interaction.js";
import {
  collectEmbeddedInteractionDiagnostics,
  collectInteractionRenderDiagnostics,
} from "./interactions/interaction-diagnostics.js";
import { renderUnsupportedEmbeddedInteraction } from "./interactions/unsupported-interaction.js";
import { interactionLabel, qtiSharedClassNames } from "./interactions/interaction-label.js";
import {
  renderInlineTextEntry,
} from "./interactions/text-interaction.js";
import { renderSelect } from "./interactions/inline-choice-interaction.js";
import { defaultPlayerLocale, normalizedLocale, resolvePlayerMessages } from "./player-locale.js";
import type { QtiPlayerMessages } from "./player-messages.js";
import { playerStyleElement } from "./player-styles.js";
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
  inlineValidationMessageElement,
  validateItemResponses,
  validationMessageElement,
} from "./player-validation.js";

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
    const validationMessages = shouldValidateResponses ? this.validateResponses() : [];
    if (validationMessages.length > 0) {
      this.validationMessages = cloneDiagnostics(validationMessages);
      this.renderValidationMessages();
      const state = this.serialize();
      if (!state) return undefined;
      this.dispatchPlayerEvent("qti-validation", {
        validationMessages: cloneDiagnostics(this.validationMessages),
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
    if (state) state.validationMessages = cloneDiagnostics(this.validationMessages);
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

  private playerMessages(): QtiPlayerMessages {
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
    const root = document.createElement("article");
    root.className = "qti3-player";
    if (documentModel.item.language) {
      root.lang = documentModel.item.language;
      root.setAttribute("xml:lang", documentModel.item.language);
    }
    root.append(playerStyleElement());

    if (documentModel.item.prompt && documentModel.item.body.length === 0) {
      const prompt = document.createElement("p");
      prompt.className = "qti3-item-prompt";
      prompt.textContent = documentModel.item.prompt;
      root.append(prompt);
    }

    if (documentModel.item.body.length > 0) {
      const body = document.createElement("div");
      body.className = "qti3-item-body";
      body.append(...renderContentNodes(documentModel.item.body, this.contentContext()));
      root.append(body);
    } else {
      for (const interaction of documentModel.item.interactions) {
        root.append(this.renderInteraction(interaction));
      }
    }

    const feedback = document.createElement("section");
    feedback.className = "qti3-feedback";
    feedback.role = "status";
    feedback.setAttribute("aria-live", "polite");
    feedback.hidden = true;
    root.append(feedback);

    this.resolveRenderedAssets(root);
    this.replaceChildren(root);
  }

  private renderInteraction(interaction: QtiInteraction): HTMLElement {
    const messages = this.playerMessages();
    const field = document.createElement("section");
    field.className = `qti3-interaction qti3-${interaction.type}`;
    field.classList.add(...qtiSharedClassNames(interaction.attributes.class));
    field.dataset.interactionType = interaction.type;
    if (interaction.responseIdentifier)
      field.dataset.responseIdentifier = interaction.responseIdentifier;

    const heading = document.createElement("h3");
    copySafeAttributes(heading, interaction.promptAttributes ?? {});
    const label = interactionLabel(interaction);
    heading.textContent = label;
    field.append(heading);
    if (interaction.responseIdentifier) {
      field.append(validationMessageElement(interaction.responseIdentifier));
    }

    const responseIdentifier = interaction.responseIdentifier;
    const update = this.bindResponseUpdate(responseIdentifier);
    const currentValue = responseIdentifier ? this.currentResponseValue(responseIdentifier) : null;

    field.append(
      renderInteractionResponse({
        interaction,
        update,
        currentValue,
        messages,
        isCompleted: () => this.attemptIsCompleted(),
        interactionLabel: label,
        endAttempt: () => this.endAttempt(),
        renderPortableCustom: (portableInteraction, portableUpdate, portableValue) =>
          this.renderPortableCustomResponse(portableInteraction, portableUpdate, portableValue),
      }),
    );
    return field;
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
    return {
      interactionAt: (index) => this.documentModel?.item.interactions[index],
      renderBlockInteraction: (interaction) => this.renderInteraction(interaction),
      renderEmbeddedInteraction: (embeddedInteraction) =>
        this.renderEmbeddedInteraction(embeddedInteraction),
      currentVariableValue: (identifier) => this.currentVariableValue(identifier),
      mathTemplateValue: (node) => this.mathTemplateValue(node),
      isFeedbackVisible: (node) => this.isFeedbackVisible(node),
      isTemplateContentVisible: (element) => this.isTemplateContentVisible(element),
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

  private renderEmbeddedInteraction(interaction: QtiInteraction): HTMLElement {
    if (interaction.type !== "inlineChoice" && interaction.type !== "textEntry") {
      return renderUnsupportedEmbeddedInteraction(interaction);
    }

    const wrapper = document.createElement("span");
    wrapper.className = `qti3-interaction qti3-${interaction.type} qti3-embedded-interaction`;
    wrapper.dataset.interactionType = interaction.type;
    if (interaction.responseIdentifier)
      wrapper.dataset.responseIdentifier = interaction.responseIdentifier;

    const responseIdentifier = interaction.responseIdentifier;
    const update = this.bindResponseUpdate(responseIdentifier);
    const currentValue = responseIdentifier ? this.currentResponseValue(responseIdentifier) : null;

    if (interaction.responseIdentifier) {
      wrapper.append(inlineValidationMessageElement(interaction.responseIdentifier));
    }
    wrapper.append(
      interaction.type === "inlineChoice"
        ? renderSelect(interaction, update, currentValue)
        : renderInlineTextEntry(interaction, update, currentValue),
    );
    return wrapper;
  }

  private updateDynamicBodyState(): void {
    for (const output of this.querySelectorAll<HTMLOutputElement>(".qti3-printed-variable")) {
      const identifier = output.dataset.identifier;
      if (!identifier) continue;
      output.value = formatPrintedValue(
        this.currentVariableValue(identifier),
        output.dataset.format,
      );
      output.textContent = output.value;
    }

    for (const element of this.querySelectorAll<HTMLElement>(
      ".qti3-feedback-block, .qti3-feedback-inline",
    )) {
      const identifier = element.dataset.feedbackIdentifier;
      const outcomeIdentifier = element.dataset.outcomeIdentifier;
      if (!identifier || !outcomeIdentifier) continue;
      const value = this.currentVariableValue(outcomeIdentifier);
      const hasIdentifier = Array.isArray(value)
        ? value.map(String).includes(identifier)
        : String(value ?? "") === identifier;
      element.hidden = element.dataset.showHide === "hide" ? hasIdentifier : !hasIdentifier;
    }

    for (const element of this.querySelectorAll<HTMLElement>(
      ".qti3-template-block, .qti3-template-inline",
    )) {
      element.hidden = !this.isTemplateContentVisible(element);
    }
  }

  private updateAttemptAvailability(): void {
    const completed = this.attemptIsCompleted();
    this.dataset.status = this.session?.serialize().status ?? "unloaded";
    const article = this.querySelector<HTMLElement>(".qti3-player");
    if (article) article.dataset.status = this.dataset.status;

    for (const control of this.querySelectorAll<
      HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(
      ".qti3-interaction button, .qti3-interaction input, .qti3-interaction select, .qti3-interaction textarea",
    )) {
      control.disabled = completed;
    }

    for (const element of this.querySelectorAll<HTMLElement>(
      ".qti3-interaction [tabindex]:not(button):not(input):not(select):not(textarea)",
    )) {
      if (completed) {
        element.dataset.previousTabIndex = element.getAttribute("tabindex") ?? "0";
        element.tabIndex = -1;
        element.setAttribute("aria-disabled", "true");
      } else {
        const previous = element.dataset.previousTabIndex;
        if (previous !== undefined) {
          element.tabIndex = Number(previous);
          delete element.dataset.previousTabIndex;
        }
        element.removeAttribute("aria-disabled");
      }
    }
  }

  private attemptIsCompleted(): boolean {
    return this.session?.serialize().status === "completed";
  }

  private isFeedbackVisible(node: Extract<QtiContentNode, { kind: "feedback" }>): boolean {
    const value = this.currentVariableValue(node.outcomeIdentifier);
    const hasIdentifier = Array.isArray(value)
      ? value.map(String).includes(node.identifier)
      : String(value ?? "") === node.identifier;
    return node.showHide === "show" ? hasIdentifier : !hasIdentifier;
  }

  private isTemplateContentVisible(element: HTMLElement): boolean {
    const templateIdentifier = element.dataset.templateIdentifier;
    const identifier = element.dataset.templateValueIdentifier;
    if (!templateIdentifier || !identifier) return true;
    const value = this.currentTemplateValue(templateIdentifier);
    const hasIdentifier = Array.isArray(value)
      ? value.map(String).includes(identifier)
      : String(value ?? "") === identifier;
    return element.dataset.showHide === "hide" ? !hasIdentifier : hasIdentifier;
  }

  private currentVariableValue(identifier: string): QtiValue {
    const state = this.session?.serialize();
    return (
      state?.outcomes[identifier] ??
      state?.templateValues?.[identifier] ??
      state?.responses[identifier] ??
      null
    );
  }

  private currentTemplateValue(identifier: string): QtiValue {
    return this.session?.serialize().templateValues?.[identifier] ?? null;
  }

  private mathTemplateValue(
    node: Extract<QtiContentNode, { kind: "element" }>,
  ): string | undefined {
    if (node.qtiName !== "mi" && node.qtiName !== "mo") return undefined;
    const identifier = contentNodeText(node).trim();
    if (!identifier) return undefined;
    const declaration = this.documentModel?.item.templateDeclarations.find(
      (template) =>
        template.identifier === identifier && template.attributes["math-variable"] === "true",
    );
    if (!declaration) return undefined;
    const value = this.currentTemplateValue(identifier);
    return value === null ? "" : String(value);
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

  private resolveRenderedAssets(root: HTMLElement): void {
    if (!this.resolveAsset) return;
    for (const element of root.querySelectorAll("[src], [href], [data]")) {
      for (const attribute of ["src", "href", "data"]) {
        const value = element.getAttribute(attribute);
        if (!value || !isResolvableAssetUrl(value)) continue;
        element.setAttribute(attribute, this.resolveAsset(value));
      }
    }
  }

  private validateResponses(): QtiDiagnostic[] {
    const state = this.session?.serialize();
    if (!state || !this.documentModel) return [];
    return validateItemResponses(this.documentModel, state);
  }

  private renderValidationMessages(): void {
    const messagesByIdentifier = new Map(
      this.validationMessages
        .filter((message) => message.path)
        .map((message) => [message.path!, message]),
    );
    for (const section of this.querySelectorAll<HTMLElement>("[data-response-identifier]")) {
      const responseIdentifier = section.dataset.responseIdentifier;
      if (!responseIdentifier) continue;
      const message = messagesByIdentifier.get(responseIdentifier);
      const messageElement = section.querySelector<HTMLElement>(
        `[data-validation-for="${responseIdentifier}"]`,
      );
      const controls = section.querySelectorAll<HTMLElement>("input, select, textarea, button");
      if (message && messageElement) {
        messageElement.textContent = message.message;
        messageElement.hidden = false;
        for (const control of controls) {
          control.setAttribute("aria-invalid", "true");
          control.setAttribute("aria-describedby", messageElement.id);
        }
      } else if (messageElement) {
        messageElement.textContent = "";
        messageElement.hidden = true;
        for (const control of controls) {
          control.removeAttribute("aria-invalid");
          control.removeAttribute("aria-describedby");
        }
      }
    }
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
    const feedback = this.querySelector<HTMLElement>(".qti3-feedback");
    if (!documentModel || !feedback) return;

    const visibleFeedback = visibleModalFeedback(documentModel.item, outcomes);
    feedback.replaceChildren(
      ...visibleFeedback.map((item) => {
        const element = document.createElement("p");
        element.dataset.feedbackIdentifier = item.identifier;
        element.textContent = item.text;
        return element;
      }),
    );
    feedback.hidden = visibleFeedback.length === 0;
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

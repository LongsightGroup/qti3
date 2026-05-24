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
  contentElementName,
  contentNodeText,
  copySafeAttributes,
  createContentElement,
  formatPrintedValue,
  isResolvableAssetUrl,
  unsafeContentElements,
} from "./content/content-dom.js";
import { renderChoice } from "./interactions/choice-interaction.js";
import { renderDrawingResponse } from "./interactions/drawing-interaction.js";
import { renderGapMatchResponse } from "./interactions/gap-match-interaction.js";
import { renderGraphicAssociateResponse } from "./interactions/graphic-associate-interaction.js";
import { renderHottextResponse } from "./interactions/hottext-interaction.js";
import { interactionLabel, qtiSharedClassNames } from "./interactions/interaction-label.js";
import { renderSelect } from "./interactions/inline-choice-interaction.js";
import { renderMatchResponse } from "./interactions/match-interaction.js";
import { renderObjectAsset } from "./interactions/object-asset.js";
import { renderPairResponse } from "./interactions/pair-interaction.js";
import { renderPositionObjectResponse } from "./interactions/position-object-interaction.js";
import { usesChoiceSet, usesOrderedResponse, usesPairResponse } from "./interactions/routing.js";
import { renderSelectPointResponse } from "./interactions/select-point-interaction.js";
import {
  renderInlineTextEntry,
  renderSliderResponse,
  renderTextResponse,
} from "./interactions/text-interaction.js";
import { renderHotspotResponse } from "./interactions/hotspot-interaction.js";
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
  matchMaxDiagnostics,
  minimumRequiredResponses,
  responseCount,
  validationMessageElement,
} from "./player-validation.js";
import {
  portableCustomDefinitionFromAttributes,
  portableCustomEventState,
  portableCustomEventValidity,
  portableCustomEventValue,
  scalarString,
} from "./portable-custom-support.js";
import { renderGraphicOrderResponse } from "./reorder/graphic-order-interaction.js";
import { renderOrderedResponse } from "./reorder/order-interaction.js";
import { maximumAllowedResponses, mediaPlayCount } from "./response-limits.js";

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
    this.dispatchEvent(
      new CustomEvent("qti-diagnostics", { detail: { diagnostics: result.diagnostics } }),
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
      body.append(...this.renderContentNodes(documentModel.item.body));
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
    heading.textContent = interactionLabel(interaction);
    field.append(heading);
    if (interaction.responseIdentifier) {
      field.append(validationMessageElement(interaction.responseIdentifier));
    }

    const responseIdentifier = interaction.responseIdentifier;
    const update = (value: QtiValue) => {
      if (this.attemptIsCompleted()) return;
      if (!responseIdentifier || !this.session) return;
      this.session.respond(responseIdentifier, value);
      this.clearValidationMessage(responseIdentifier);
      this.dispatchPlayerEvent("qti-responsechange", { responseIdentifier, value });
      this.emitStateChange();
    };
    const currentValue = responseIdentifier ? this.currentResponseValue(responseIdentifier) : null;

    if (interaction.type === "graphicOrder") {
      field.append(renderGraphicOrderResponse(interaction, update, currentValue, messages));
      return field;
    }

    if (usesOrderedResponse(interaction)) {
      field.append(renderOrderedResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "gapMatch" || interaction.type === "graphicGapMatch") {
      field.append(renderGapMatchResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "graphicAssociate") {
      field.append(renderGraphicAssociateResponse(interaction, update, currentValue, messages));
      return field;
    }

    if (interaction.type === "match") {
      field.append(renderMatchResponse(interaction, update, currentValue, messages));
      return field;
    }

    if (usesPairResponse(interaction)) {
      field.append(renderPairResponse(interaction, update, currentValue, messages));
      return field;
    }

    if (interaction.type === "hotspot" && interaction.object) {
      field.append(renderHotspotResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "hottext") {
      field.append(renderHottextResponse(interaction, update, currentValue));
      return field;
    }

    if (usesChoiceSet(interaction)) {
      field.append(renderChoice(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "inlineChoice") {
      field.append(renderSelect(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "extendedText") {
      field.append(renderTextResponse(interaction, update, "extended", currentValue));
      return field;
    }

    if (interaction.type === "selectPoint") {
      field.append(renderSelectPointResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "positionObject") {
      field.append(renderPositionObjectResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "drawing") {
      field.append(renderDrawingResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "portableCustom") {
      field.append(this.renderPortableCustomResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "textEntry") {
      field.append(renderTextResponse(interaction, update, "entry", currentValue));
      return field;
    }

    if (interaction.type === "slider") {
      field.append(renderSliderResponse(interaction, update, currentValue));
      return field;
    }

    if (interaction.type === "upload") {
      const input = document.createElement("input");
      input.type = "file";
      input.setAttribute("aria-label", heading.textContent ?? "Upload response");
      input.addEventListener("change", () => update(input.files?.[0]?.name ?? ""));
      field.append(input);
      return field;
    }

    if (interaction.type === "endAttempt") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = interaction.attributes.title ?? "End attempt";
      button.addEventListener("click", () => {
        if (responseIdentifier) update(true);
        this.endAttempt();
      });
      field.append(button);
      return field;
    }

    if (interaction.type === "media") {
      field.append(
        renderObjectAsset(interaction, {
          currentValue,
          update,
          isCompleted: () => this.attemptIsCompleted(),
        }),
      );
      return field;
    }

    field.append(renderSelect(interaction, update, currentValue));
    return field;
  }

  private renderPortableCustomResponse(
    interaction: QtiInteraction,
    update: (value: QtiValue) => void,
    currentValue: QtiValue,
  ): HTMLElement {
    const definition =
      interaction.portableCustom ?? portableCustomDefinitionFromAttributes(interaction);
    const responseIdentifier =
      interaction.responseIdentifier ?? definition.responseIdentifier ?? "";
    const currentState = responseIdentifier
      ? this.currentInteractionState(responseIdentifier)
      : undefined;

    const group = document.createElement("div");
    group.role = "group";
    group.setAttribute("aria-label", interaction.prompt ?? "Portable custom interaction");

    const host = document.createElement("div");
    host.className = "qti3-portable-custom-host";
    host.tabIndex = 0;
    host.dataset.responseIdentifier = responseIdentifier;
    host.dataset.typeIdentifier = definition.customInteractionTypeIdentifier ?? "";
    host.dataset.module = definition.module ?? "";
    host.dataset.qtiName = interaction.qtiName;
    if (definition.interactionModules?.primaryConfiguration) {
      host.dataset.primaryConfiguration = definition.interactionModules.primaryConfiguration;
    }
    if (definition.interactionModules?.secondaryConfiguration) {
      host.dataset.secondaryConfiguration = definition.interactionModules.secondaryConfiguration;
    }
    if (currentState !== undefined) host.dataset.state = JSON.stringify(currentState);
    host.setAttribute("role", "application");
    host.setAttribute("aria-label", interaction.prompt ?? "Portable custom interaction host");
    host.style.border = "1px solid CanvasText";
    host.style.padding = "0.5rem";
    host.style.marginBlockEnd = "0.5rem";

    if (definition.interactionMarkup.length > 0) {
      const markup = document.createElement("div");
      markup.className = "qti3-portable-custom-markup";
      markup.append(...this.renderContentNodes(definition.interactionMarkup));
      host.append(markup);
    } else {
      host.textContent = "Portable custom interaction host";
    }

    const fallback = document.createElement("input");
    fallback.type = "hidden";
    fallback.className = "qti3-portable-custom-response";
    fallback.hidden = true;
    fallback.tabIndex = -1;
    fallback.setAttribute("aria-hidden", "true");
    fallback.value = scalarString(currentValue);

    const handlePortableCustomEvent = (event: Event) => {
      const state = portableCustomEventState(event);
      const value = portableCustomEventValue(event);
      const validity = portableCustomEventValidity(event);
      if (state !== undefined && responseIdentifier && this.session) {
        this.session.setInteractionState(responseIdentifier, state);
        host.dataset.state = JSON.stringify(state);
      }
      if (value !== undefined) {
        fallback.value = String(value ?? "");
        update(value);
      }
      if (validity && responseIdentifier) {
        this.setPortableCustomValidity(responseIdentifier, validity.valid, validity.message);
        this.emitStateChange();
      }
      if (value === undefined && state !== undefined && !validity) this.emitStateChange();
    };

    host.addEventListener("qti3-portable-custom-response", handlePortableCustomEvent);
    host.addEventListener("qti3-pci-response", handlePortableCustomEvent);
    host.addEventListener("qti3-portable-custom-state", handlePortableCustomEvent);
    host.addEventListener("qti3-portable-custom-validity", handlePortableCustomEvent);

    queueMicrotask(() => {
      this.dispatchPlayerEvent("qti-portable-custom-mount", {
        responseIdentifier,
        interaction,
        definition,
        host,
        value: currentValue,
        state: currentState,
      });
    });

    group.append(host, fallback);
    return group;
  }

  private renderEmbeddedInteraction(interaction: QtiInteraction): HTMLElement {
    if (interaction.type !== "inlineChoice" && interaction.type !== "textEntry") {
      return this.renderInteraction(interaction);
    }

    const wrapper = document.createElement("span");
    wrapper.className = `qti3-interaction qti3-${interaction.type} qti3-embedded-interaction`;
    wrapper.dataset.interactionType = interaction.type;
    if (interaction.responseIdentifier)
      wrapper.dataset.responseIdentifier = interaction.responseIdentifier;

    const responseIdentifier = interaction.responseIdentifier;
    const update = (value: QtiValue) => {
      if (this.attemptIsCompleted()) return;
      if (!responseIdentifier || !this.session) return;
      this.session.respond(responseIdentifier, value);
      this.clearValidationMessage(responseIdentifier);
      this.dispatchPlayerEvent("qti-responsechange", { responseIdentifier, value });
      this.emitStateChange();
    };
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

  private renderContentNodes(nodes: QtiContentNode[]): Node[] {
    return nodes.flatMap((node) => this.renderContentNode(node));
  }

  private renderContentNode(node: QtiContentNode): Node[] {
    if (node.kind === "text") return [document.createTextNode(node.text)];
    if (node.kind === "interaction") {
      const interaction = this.documentModel?.item.interactions[node.interactionIndex];
      return interaction ? [this.renderEmbeddedInteraction(interaction)] : [];
    }
    if (node.kind === "printedVariable")
      return [this.renderPrintedVariable(node.identifier, node.format)];
    if (node.kind === "feedback") return this.renderFeedbackContent(node);
    if (node.qtiName === "qti-template-block" || node.qtiName === "qti-template-inline") {
      return [this.renderTemplateContent(node)];
    }
    if (node.qtiName === "qti-position-object-stage") {
      return this.renderContentNodes(
        node.children.filter(
          (child) =>
            !("qtiName" in child) || (child.qtiName !== "object" && child.qtiName !== "img"),
        ),
      );
    }
    if (node.qtiName === "qti-prompt") {
      const prompt = document.createElement("p");
      copySafeAttributes(prompt, node.attributes);
      prompt.classList.add("qti3-item-prompt");
      prompt.append(...this.renderContentNodes(node.children));
      return [prompt];
    }

    if (unsafeContentElements.has(node.qtiName)) return [];
    const elementName = contentElementName(node.qtiName);
    if (!elementName) return this.renderContentNodes(node.children);
    const element = createContentElement(elementName);
    copySafeAttributes(element, node.attributes);
    const mathTemplateValue = this.mathTemplateValue(node);
    if (mathTemplateValue === undefined) {
      element.append(...this.renderContentNodes(node.children));
    } else {
      element.textContent = mathTemplateValue;
    }
    return [element];
  }

  private renderTemplateContent(node: Extract<QtiContentNode, { kind: "element" }>): HTMLElement {
    const element = document.createElement(node.qtiName === "qti-template-block" ? "div" : "span");
    copySafeAttributes(element, node.attributes);
    element.classList.add(
      node.qtiName === "qti-template-block" ? "qti3-template-block" : "qti3-template-inline",
    );
    element.dataset.templateIdentifier = node.attributes["template-identifier"] ?? "";
    element.dataset.templateValueIdentifier = node.attributes.identifier ?? "";
    element.dataset.showHide = node.attributes["show-hide"] === "hide" ? "hide" : "show";
    element.hidden = !this.isTemplateContentVisible(element);
    element.append(...this.renderContentNodes(node.children));
    return element;
  }

  private renderPrintedVariable(identifier: string, format: string | undefined): HTMLElement {
    const output = document.createElement("output");
    output.className = "qti3-printed-variable";
    output.dataset.identifier = identifier;
    if (format) output.dataset.format = format;
    output.value = formatPrintedValue(this.currentVariableValue(identifier), format);
    output.textContent = output.value;
    return output;
  }

  private renderFeedbackContent(node: Extract<QtiContentNode, { kind: "feedback" }>): Node[] {
    const element = document.createElement(node.feedbackType === "block" ? "section" : "span");
    element.className = `qti3-feedback-${node.feedbackType}`;
    element.dataset.feedbackIdentifier = node.identifier;
    element.dataset.outcomeIdentifier = node.outcomeIdentifier;
    element.dataset.showHide = node.showHide;
    element.hidden = !this.isFeedbackVisible(node);
    element.append(...this.renderContentNodes(node.children));
    return [element];
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
    if (valid) {
      this.clearValidationMessage(responseIdentifier);
      return;
    }
    const diagnostic: QtiDiagnostic = {
      code: "response.portableCustom.validity",
      severity: "error",
      message: message?.trim() || `${responseIdentifier} is not valid.`,
      path: responseIdentifier,
    };
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
    const interactionsByResponse = new Map(
      this.documentModel.item.interactions
        .filter((interaction) => interaction.responseIdentifier)
        .map((interaction) => [interaction.responseIdentifier!, interaction]),
    );
    const diagnostics: QtiDiagnostic[] = [];
    for (const declaration of this.documentModel.item.responseDeclarations) {
      const interaction = interactionsByResponse.get(declaration.identifier);
      if (declaration.correctResponse === null && interaction?.type !== "media") continue;
      const minimum = minimumRequiredResponses(interaction);
      const count =
        interaction?.type === "media"
          ? mediaPlayCount(state.responses[declaration.identifier] ?? null)
          : responseCount(state.responses[declaration.identifier] ?? null);
      const maximum = maximumAllowedResponses(interaction);
      if (count < minimum) {
        diagnostics.push({
          code: "response.required",
          severity: "error",
          message:
            interaction?.attributes["data-min-selections-message"] ??
            (interaction?.type === "media"
              ? `${declaration.identifier} requires at least ${minimum} play${minimum === 1 ? "" : "s"}.`
              : minimum === 1
                ? `${declaration.identifier} requires a response.`
                : `${declaration.identifier} requires at least ${minimum} responses.`),
          path: declaration.identifier,
        });
      }
      if (maximum !== undefined && count > maximum) {
        diagnostics.push({
          code: "response.maximum",
          severity: "error",
          message:
            interaction?.attributes["data-max-selections-message"] ??
            (interaction?.type === "media"
              ? `${declaration.identifier} allows at most ${maximum} play${maximum === 1 ? "" : "s"}.`
              : `${declaration.identifier} allows at most ${maximum} response${maximum === 1 ? "" : "s"}.`),
          path: declaration.identifier,
        });
      }
      if (interaction) {
        diagnostics.push(
          ...matchMaxDiagnostics(
            declaration.identifier,
            interaction,
            state.responses[declaration.identifier] ?? null,
          ),
        );
      }
    }
    return diagnostics;
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

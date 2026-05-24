import {
  assertQtiAttemptStateV1,
  createItemSession,
  createCatalogSupportResolution,
  createTextToSpeechTraversal,
  parseQtiXml,
  visibleModalFeedback,
  type QtiAssessmentItem,
  type QtiAttemptStatus,
  type QtiAttemptStateV1,
  type QtiChoice,
  type QtiContentNode,
  type QtiDiagnostic,
  type QtiDocument,
  type QtiInteraction,
  type QtiItemSession,
  type QtiObjectAsset,
  type QtiPortableCustomDefinition,
  type QtiPortableCustomStateValue,
  type QtiScoreResult,
  type QtiCatalogSupportResolution,
  type QtiCatalogSupportResolutionOptions,
  type QtiTextToSpeechTraversal,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import { removeButton } from "./controls/remove-button.js";
import {
  choicesOrFallback,
  hotspotAccessibleLabel,
  hotspotCenter,
  hotspotDisplayLabel,
  objectHeight,
  objectIsImage,
  objectWidth,
  placeHotspotButton,
  readableType,
  responseGroup,
  valueToStrings,
} from "./interaction-support.js";
import type { QtiPlayerMessages, QtiPlayerRemoveMessageParams } from "./player-messages.js";
import {
  sourceChoices,
  targetChoices,
  tokenButton,
  tokenRegion,
} from "./interactions/shared.js";
import { renderChoice } from "./interactions/choice-interaction.js";
import { renderDrawingResponse } from "./interactions/drawing-interaction.js";
import { renderGapMatchResponse } from "./interactions/gap-match-interaction.js";
import { renderGraphicAssociateResponse } from "./interactions/graphic-associate-interaction.js";
import { renderHottextResponse } from "./interactions/hottext-interaction.js";
import { interactionLabel, qtiSharedClassNames } from "./interactions/interaction-label.js";
import { renderSelect } from "./interactions/inline-choice-interaction.js";
import { renderMatchResponse } from "./interactions/match-interaction.js";
import { renderPairResponse } from "./interactions/pair-interaction.js";
import { renderPositionObjectResponse } from "./interactions/position-object-interaction.js";
import { renderSelectPointResponse } from "./interactions/select-point-interaction.js";
import {
  renderInlineTextEntry,
  renderSliderResponse,
  renderTextResponse,
} from "./interactions/text-interaction.js";
import { playerStyleElement } from "./player-styles.js";
import { renderGraphicOrderResponse } from "./reorder/graphic-order-interaction.js";
import { renderOrderedResponse } from "./reorder/order-interaction.js";
import {
  maximumAllowedResponses,
  maximumMediaPlays,
  minimumMediaPlays,
  parseUnlimitedMaximum,
} from "./response-limits.js";

export type { QtiPlayerMessages, QtiPlayerRemoveMessageParams } from "./player-messages.js";

export interface QtiPlayerSessionControl {
  validateResponses?: boolean | undefined;
  showFeedback?: boolean | undefined;
}

export interface QtiScoreAttemptOptions {
  validateResponses?: boolean | undefined;
}

export type QtiPlayerFetchXml = (url: string) => Promise<string>;
export type QtiPlayerResolveAsset = (url: string) => string;

export interface QtiPlayerLoadOptions {
  state?: QtiAttemptStateV1 | undefined;
  status?: QtiAttemptStatus | undefined;
  sessionControl?: QtiPlayerSessionControl | undefined;
  fetchXml?: QtiPlayerFetchXml | undefined;
  resolveAsset?: QtiPlayerResolveAsset | undefined;
}

export type QtiPlayerMessageOverrides = Partial<QtiPlayerMessages>;

export interface QtiReadyEventDetail {
  item: QtiAssessmentItem;
}

export interface QtiStateChangeEventDetail {
  state: QtiAttemptStateV1;
}

export interface QtiResponseChangeEventDetail {
  responseIdentifier: string;
  value: QtiValue;
}

export interface QtiPortableCustomMountEventDetail {
  responseIdentifier: string;
  interaction: QtiInteraction;
  definition: QtiPortableCustomDefinition;
  host: HTMLElement;
  value: QtiValue;
  state?: QtiPortableCustomStateValue | undefined;
}

export type QtiScoreEventDetail = QtiScoreResult;

export interface QtiValidationEventDetail {
  validationMessages: QtiDiagnostic[];
  state: QtiAttemptStateV1;
}

export interface QtiSuspendEventDetail {
  state: QtiAttemptStateV1;
}

export interface QtiEndAttemptEventDetail {
  state: QtiAttemptStateV1;
}

export interface QtiAssessmentItemPlayerEventDetailMap {
  "qti-ready": QtiReadyEventDetail;
  "qti-statechange": QtiStateChangeEventDetail;
  "qti-responsechange": QtiResponseChangeEventDetail;
  "qti-portable-custom-mount": QtiPortableCustomMountEventDetail;
  "qti-score": QtiScoreEventDetail;
  "qti-validation": QtiValidationEventDetail;
  "qti-suspend": QtiSuspendEventDetail;
  "qti-endattempt": QtiEndAttemptEventDetail;
}

export type QtiAssessmentItemPlayerEventName = keyof QtiAssessmentItemPlayerEventDetailMap;

export type QtiAssessmentItemPlayerEvent<
  T extends QtiAssessmentItemPlayerEventName = QtiAssessmentItemPlayerEventName,
> = CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>;

export type QtiAssessmentItemPlayerCustomEventMap = {
  [T in QtiAssessmentItemPlayerEventName]: CustomEvent<QtiAssessmentItemPlayerEventDetailMap[T]>;
};

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

const defaultEnglishPlayerMessages: QtiPlayerMessages = {
  remove: () => "Remove",
  removePair: ({ label }) => `Remove ${label}`,
};

const playerMessages = {
  defaultEnglish: defaultEnglishPlayerMessages,
  spanish: playerMessageCatalog("Quitar", ({ label }) => `Quitar ${label}`),
  swedish: playerMessageCatalog("Ta bort", ({ label }) => `Ta bort ${label}`),
  german: playerMessageCatalog("Entfernen", ({ label }) => `${label} entfernen`),
  portuguese: playerMessageCatalog("Remover", ({ label }) => `Remover ${label}`),
  french: playerMessageCatalog("Supprimer", ({ label }) => `Supprimer ${label}`),
};

const builtInPlayerMessageCatalogs: ReadonlyMap<string, QtiPlayerMessages> = new Map([
  ["en", playerMessages.defaultEnglish],
  ["es", playerMessages.spanish],
  ["es-es", playerMessages.spanish],
  ["es-mx", playerMessages.spanish],
  ["sv", playerMessages.swedish],
  ["sv-se", playerMessages.swedish],
  ["de", playerMessages.german],
  ["de-de", playerMessages.german],
  ["pt", playerMessages.portuguese],
  ["pt-br", playerMessages.portuguese],
  ["pt-pt", playerMessages.portuguese],
  ["fr", playerMessages.french],
  ["fr-ca", playerMessages.french],
  ["fr-fr", playerMessages.french],
]);

function playerMessageCatalog(
  remove: string,
  removePair: QtiPlayerMessages["removePair"],
): QtiPlayerMessages {
  return {
    remove: () => remove,
    removePair,
  };
}

function resolvePlayerMessages(
  locale: string,
  overrides: QtiPlayerMessageOverrides,
): QtiPlayerMessages {
  const catalog = builtInPlayerMessageCatalog(locale);
  return {
    remove: overrides.remove ?? catalog?.remove ?? defaultEnglishPlayerMessages.remove,
    removePair:
      overrides.removePair ?? catalog?.removePair ?? defaultEnglishPlayerMessages.removePair,
  };
}

function builtInPlayerMessageCatalog(locale: string): QtiPlayerMessages | undefined {
  for (const candidate of localeFallbacks(locale)) {
    const catalog = builtInPlayerMessageCatalogs.get(candidate);
    if (catalog) return catalog;
  }
  return undefined;
}

function localeFallbacks(locale: string): string[] {
  const normalized = normalizedLocale(locale)?.toLowerCase();
  if (!normalized) return ["en"];
  const parts = normalized.split("-");
  const fallbacks: string[] = [];
  for (let length = parts.length; length > 0; length -= 1) {
    fallbacks.push(parts.slice(0, length).join("-"));
  }
  return fallbacks.includes("en") ? fallbacks : [...fallbacks, "en"];
}

function normalizedLocale(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return Intl.getCanonicalLocales(trimmed)[0] ?? trimmed;
  } catch {
    return trimmed;
  }
}

function defaultPlayerLocale(host?: Element): string {
  const elementLanguage = normalizedLocale(host?.getAttribute("lang"));
  if (elementLanguage) return elementLanguage;

  const navigatorLanguages = globalThis.navigator?.languages ?? [];
  for (const language of navigatorLanguages) {
    const normalized = normalizedLocale(language);
    if (normalized) return normalized;
  }
  return (
    normalizedLocale(globalThis.navigator?.language) ??
    normalizedLocale(host?.closest("[lang]")?.getAttribute("lang")) ??
    normalizedLocale(host?.ownerDocument?.documentElement.lang) ??
    normalizedLocale(globalThis.document?.documentElement.lang) ??
    "en"
  );
}



function usesChoiceSet(interaction: QtiInteraction): boolean {
  if (interaction.type === "choice" || interaction.type === "hotspot") {
    return true;
  }
  return (
    interaction.responseCardinality === "multiple" && interaction.responseBaseType === "identifier"
  );
}

function usesOrderedResponse(interaction: QtiInteraction): boolean {
  return (
    interaction.responseCardinality === "ordered" ||
    interaction.type === "order" ||
    interaction.type === "graphicOrder"
  );
}

function usesPairResponse(interaction: QtiInteraction): boolean {
  return (
    interaction.responseBaseType === "pair" ||
    interaction.responseBaseType === "directedPair" ||
    interaction.type === "associate" ||
    interaction.type === "graphicAssociate" ||
    interaction.type === "match" ||
    interaction.type === "gapMatch" ||
    interaction.type === "graphicGapMatch"
  );
}



function renderHotspotResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
): HTMLElement {
  const group = responseGroup();

  const surface = document.createElement("div");
  surface.className = "qti3-hotspot-surface";
  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  surface.style.position = "relative";
  surface.style.inlineSize = `${width}px`;
  surface.style.aspectRatio = `${width} / ${height}`;
  surface.style.maxInlineSize = "100%";
  surface.style.border = "1px solid CanvasText";
  surface.style.background = "Canvas";
  surface.style.overflow = "hidden";

  const object = interaction.object;
  if (object?.data && object.type?.startsWith("image/")) {
    const image = document.createElement("img");
    image.src = object.data;
    image.alt = object.text || `${readableType(interaction.type)} image`;
    image.style.inlineSize = "100%";
    image.style.blockSize = "100%";
    image.style.objectFit = "contain";
    surface.append(image);
  }

  const selected = new Set(valueToStrings(currentValue));
  const multiple = interaction.responseCardinality === "multiple";
  const selectedSummary = document.createElement("p");
  selectedSummary.className = "qti3-selection-summary";
  selectedSummary.setAttribute("aria-live", "polite");
  selectedSummary.textContent = "No region selected";
  const syncSelected = () => {
    for (const button of surface.querySelectorAll<HTMLButtonElement>("button")) {
      const isSelected = selected.has(button.dataset.choiceIdentifier ?? "");
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.dataset.selected = isSelected ? "true" : "false";
    }
    selectedSummary.textContent =
      selected.size > 0 ? `Selected ${[...selected].join(", ")}` : "No region selected";
  };
  for (const choice of choicesOrFallback(interaction)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "qti3-hotspot-button";
    button.dataset.choiceIdentifier = choice.identifier;
    button.textContent = choice.text;
    button.title = choice.text;
    button.setAttribute("aria-pressed", "false");
    button.style.position = "absolute";
    placeHotspotButton(button, choice, width, height);
    button.addEventListener("click", () => {
      if (multiple) {
        if (selected.has(choice.identifier)) selected.delete(choice.identifier);
        else selected.add(choice.identifier);
        syncSelected();
        update([...selected]);
      } else {
        selected.clear();
        selected.add(choice.identifier);
        syncSelected();
        update(choice.identifier);
      }
    });
    surface.append(button);
  }

  syncSelected();
  group.append(surface, selectedSummary);
  return group;
}

interface MediaResponseBinding {
  currentValue?: QtiValue | undefined;
  update?: ((value: QtiValue) => void) | undefined;
  isCompleted?: (() => boolean) | undefined;
}

function renderObjectAsset(
  interaction: QtiInteraction,
  mediaResponse: MediaResponseBinding = {},
): HTMLElement {
  const object = interaction.object;
  const label = interaction.prompt ?? object?.text ?? "Media interaction";
  const mediaType = object ? mediaElementType(object) : undefined;

  if (object && mediaType === "audio") {
    const audio = document.createElement("audio");
    configureMediaElement(audio, interaction, object, label, mediaResponse);
    audio.style.inlineSize = "100%";
    return audio;
  }

  if (object && mediaType === "video") {
    const video = document.createElement("video");
    configureMediaElement(video, interaction, object, label, mediaResponse);
    if (object.width) video.width = Number(object.width);
    if (object.height) video.height = Number(object.height);
    return video;
  }

  if (object?.data && objectIsImage(object)) {
    const image = document.createElement("img");
    image.src = object.data;
    image.alt = label;
    image.style.maxInlineSize = "100%";
    image.style.blockSize = "auto";
    if (object.width) image.width = Number(object.width);
    if (object.height) image.height = Number(object.height);
    return image;
  }

  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute("aria-label", label);
  const fallbackHref = object?.data ?? object?.sources.find((source) => source.src)?.src;
  if (fallbackHref) {
    const link = document.createElement("a");
    link.href = fallbackHref;
    link.textContent = object?.text || fallbackHref;
    group.append(link);
  } else {
    group.textContent = label;
  }
  return group;
}

function configureMediaElement(
  media: HTMLAudioElement | HTMLVideoElement,
  interaction: QtiInteraction,
  object: QtiObjectAsset,
  label: string,
  mediaResponse: MediaResponseBinding,
): void {
  media.controls = mediaControlsMode(interaction, object) !== "none";
  media.preload = "none";
  media.autoplay = parseBooleanAttribute(interaction.attributes.autostart) ?? false;
  media.loop = parseBooleanAttribute(interaction.attributes.loop) ?? false;
  media.setAttribute("aria-label", label);
  media.style.maxInlineSize = "100%";
  copyMediaDataAttributes(media, interaction.attributes);
  copyMediaDataAttributes(media, object.attributes);

  if (object.data) media.src = object.data;
  for (const source of object.sources) {
    if (!source.src) continue;
    const sourceElement = document.createElement("source");
    sourceElement.src = source.src;
    if (source.type) sourceElement.type = source.type;
    copySafeMediaChildAttributes(sourceElement, source.attributes, sourceAttributeNames);
    media.append(sourceElement);
  }
  for (const track of object.tracks) {
    if (!track.src) continue;
    const trackElement = document.createElement("track");
    trackElement.src = track.src;
    if (track.kind) trackElement.kind = track.kind;
    if (track.srclang) trackElement.srclang = track.srclang;
    if (track.label) trackElement.label = track.label;
    if (track.default) trackElement.default = true;
    copySafeMediaChildAttributes(trackElement, track.attributes, trackAttributeNames);
    media.append(trackElement);
  }

  bindMediaPlayCount(media, interaction, mediaResponse);
}

function copyMediaDataAttributes(element: HTMLElement, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (!name.startsWith("data-")) continue;
    element.setAttribute(name, value);
  }
}

const sourceAttributeNames = new Set(["src", "srcset", "type"]);
const trackAttributeNames = new Set(["default", "kind", "label", "src", "srclang"]);

function copySafeMediaChildAttributes(
  element: HTMLElement,
  attributes: Record<string, string>,
  controlledNames: Set<string>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    const normalizedName = name.toLowerCase();
    if (controlledNames.has(normalizedName)) continue;
    if (
      normalizedName === "class" ||
      normalizedName === "id" ||
      normalizedName === "title" ||
      normalizedName === "media" ||
      normalizedName === "sizes" ||
      normalizedName.startsWith("data-")
    ) {
      element.setAttribute(name, value);
    }
  }
}

function mediaElementType(object: QtiObjectAsset): "audio" | "video" | undefined {
  const types = [object.type, ...object.sources.map((source) => source.type)].filter(
    (value): value is string => Boolean(value),
  );
  if (types.some((value) => value.startsWith("audio/"))) return "audio";
  if (types.some((value) => value.startsWith("video/"))) return "video";
  return undefined;
}

function mediaControlsMode(
  interaction: QtiInteraction,
  object: QtiObjectAsset,
): string | undefined {
  return (
    interaction.attributes["data-qti-media-player-controls"] ??
    object.attributes["data-qti-media-player-controls"]
  );
}

function bindMediaPlayCount(
  media: HTMLAudioElement | HTMLVideoElement,
  interaction: QtiInteraction,
  mediaResponse: MediaResponseBinding,
): void {
  if (!mediaResponse.update) return;
  let playCount = mediaPlayCount(mediaResponse.currentValue ?? null);
  let activePlaySession = false;
  let readyAfterEnded = false;
  const maximum = maximumMediaPlays(interaction);

  const syncState = () => {
    media.dataset.playCount = String(playCount);
    if (maximum !== undefined && playCount >= maximum && !activePlaySession) {
      media.dataset.maxPlaysReached = "true";
    } else {
      delete media.dataset.maxPlaysReached;
    }
  };

  media.addEventListener("play", () => {
    if (mediaResponse.isCompleted?.()) {
      return;
    }
    if (!activePlaySession && maximum !== undefined && playCount >= maximum) {
      media.pause();
      syncState();
      return;
    }
    if (!activePlaySession && (readyAfterEnded || media.currentTime <= 0.25)) {
      playCount += 1;
      mediaResponse.update?.(playCount);
      activePlaySession = true;
      readyAfterEnded = false;
      syncState();
      return;
    }
    activePlaySession = true;
    readyAfterEnded = false;
    syncState();
  });

  media.addEventListener("ended", () => {
    activePlaySession = false;
    readyAfterEnded = true;
    syncState();
  });

  media.addEventListener("seeked", () => {
    if (!media.paused || media.currentTime > 0.25) return;
    activePlaySession = false;
    readyAfterEnded = false;
    syncState();
  });

  syncState();
}

function scalarString(value: QtiValue): string {
  if (value === null || Array.isArray(value) || typeof value === "object") return "";
  return String(value);
}

function portableCustomDefinitionFromAttributes(
  interaction: QtiInteraction,
): QtiPortableCustomDefinition {
  return {
    responseIdentifier: interaction.responseIdentifier,
    customInteractionTypeIdentifier: interaction.attributes["custom-interaction-type-identifier"],
    module: interaction.attributes.module,
    interactionMarkup: [],
    templateVariables: [],
    contextVariables: [],
    stylesheets: [],
    dataAttributes: Object.fromEntries(
      Object.entries(interaction.attributes).filter(([name]) => name.startsWith("data-")),
    ),
    attributes: interaction.attributes,
    source: interaction.source,
  };
}

function portableCustomEventValue(event: Event): QtiValue | undefined {
  if (!("detail" in event)) return undefined;
  const detail = event.detail as { value?: QtiValue; response?: QtiValue } | QtiValue | undefined;
  if (detail === undefined) return undefined;
  if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
    if ("value" in detail) return detail.value ?? null;
    if ("response" in detail) return detail.response ?? null;
    if ("state" in detail || "valid" in detail) return undefined;
  }
  return detail as QtiValue;
}

function portableCustomEventState(event: Event): QtiPortableCustomStateValue | undefined {
  if (!("detail" in event)) return undefined;
  const detail = event.detail as { state?: unknown } | undefined;
  if (typeof detail !== "object" || detail === null || !("state" in detail)) return undefined;
  return isPortableCustomStateValue(detail.state) ? detail.state : undefined;
}

function portableCustomEventValidity(
  event: Event,
): { valid: boolean; message?: string | undefined } | undefined {
  if (!("detail" in event)) return undefined;
  const detail = event.detail as { valid?: unknown; message?: unknown } | undefined;
  if (typeof detail !== "object" || detail === null || typeof detail.valid !== "boolean") {
    return undefined;
  }
  return {
    valid: detail.valid,
    message: typeof detail.message === "string" ? detail.message : undefined,
  };
}

function isPortableCustomStateValue(value: unknown): value is QtiPortableCustomStateValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPortableCustomStateValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isPortableCustomStateValue);
  }
  return false;
}

const htmlContentElements = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "dd",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "kbd",
  "li",
  "ol",
  "p",
  "pre",
  "q",
  "rb",
  "rbc",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
  "var",
]);

const unsafeContentElements = new Set(["script", "style"]);

const mathMlElements = new Set([
  "math",
  "maction",
  "maligngroup",
  "malignmark",
  "menclose",
  "merror",
  "mfenced",
  "mfrac",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mlongdiv",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mscarries",
  "mscarry",
  "msgroup",
  "msline",
  "mspace",
  "msqrt",
  "msrow",
  "mstack",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "semantics",
]);

function contentElementName(qtiName: string): string | undefined {
  if (qtiName === "qti-content-body" || qtiName === "qti-prompt") return undefined;
  if (htmlContentElements.has(qtiName) || mathMlElements.has(qtiName)) return qtiName;
  if (qtiName === "object") return "object";
  if (qtiName === "qti-rubric-block") return "section";
  if (qtiName === "qti-template-block") return "div";
  if (qtiName === "qti-template-inline") return "span";
  return undefined;
}

function createContentElement(name: string): HTMLElement | MathMLElement {
  if (mathMlElements.has(name)) {
    return document.createElementNS("http://www.w3.org/1998/Math/MathML", name) as MathMLElement;
  }
  return document.createElement(name);
}

function copySafeAttributes(element: Element, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (!isSafeContentAttribute(name, value)) continue;
    element.setAttribute(name, value);
    if (name === "xml:lang" && !Object.hasOwn(attributes, "lang")) {
      element.setAttribute("lang", value);
    }
  }
  applySharedAccessibilityVocabulary(element, attributes);
}

function applySharedAccessibilityVocabulary(
  element: Element,
  attributes: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    const ariaName = qtiAriaAttributeName(name);
    if (!ariaName || hasAttributeName(attributes, ariaName)) continue;
    element.setAttribute(ariaName, value);
  }

  const suppressTts = attributeValue(attributes, "data-qti-suppress-tts");
  if (
    suppressesScreenReaderSpeech(suppressTts) &&
    !hasAttributeName(attributes, "aria-hidden") &&
    !hasAttributeName(attributes, "data-qti-aria-hidden")
  ) {
    element.setAttribute("aria-hidden", "true");
  }
}

function qtiAriaAttributeName(name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  const prefix = "data-qti-aria-";
  if (!normalizedName.startsWith(prefix)) return undefined;
  const suffix = normalizedName.slice(prefix.length);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(suffix)) return undefined;
  return `aria-${suffix}`;
}

function attributeValue(attributes: Record<string, string>, name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  const entry = Object.entries(attributes).find(
    ([attributeName]) => attributeName.toLowerCase() === normalizedName,
  );
  return entry?.[1];
}

function hasAttributeName(attributes: Record<string, string>, name: string): boolean {
  return attributeValue(attributes, name) !== undefined;
}

function suppressesScreenReaderSpeech(value: string | undefined): boolean {
  if (!value) return false;
  const tokens = value
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  return tokens.includes("all") || tokens.includes("screen-reader");
}

function isSafeContentAttribute(name: string, value: string): boolean {
  const normalizedName = name.toLowerCase();
  if (normalizedName.startsWith("on")) return false;
  if (normalizedName === "style") return false;
  if (normalizedName === "href" || normalizedName === "src" || normalizedName === "data") {
    return isSafeUrl(value);
  }
  return (
    normalizedName === "alt" ||
    normalizedName === "class" ||
    normalizedName === "colspan" ||
    normalizedName === "dir" ||
    normalizedName === "headers" ||
    normalizedName === "height" ||
    normalizedName === "id" ||
    normalizedName === "lang" ||
    normalizedName === "role" ||
    normalizedName === "rowspan" ||
    normalizedName === "scope" ||
    normalizedName === "title" ||
    normalizedName === "type" ||
    normalizedName === "width" ||
    normalizedName === "xml:lang" ||
    mathMlAttributeNames.has(normalizedName) ||
    normalizedName.startsWith("aria-") ||
    normalizedName.startsWith("data-")
  );
}

const mathMlAttributeNames = new Set([
  "accent",
  "accentunder",
  "align",
  "columnalign",
  "display",
  "fence",
  "largeop",
  "lspace",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "movablelimits",
  "rowalign",
  "rspace",
  "separator",
  "stretchy",
]);

function isSafeUrl(value: string): boolean {
  return (
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("data:audio/") ||
    value.startsWith("data:video/")
  );
}

function isResolvableAssetUrl(value: string): boolean {
  return (
    !value.startsWith("#") &&
    !value.startsWith("data:") &&
    !value.startsWith("blob:") &&
    !value.startsWith("http://") &&
    !value.startsWith("https://")
  );
}

function formatPrintedValue(value: QtiValue, format?: string): string {
  if (value === null || value === undefined) return "";
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (Number.isFinite(numericValue) && format) {
    const fixed = /^%\.(\d+)f$/.exec(format);
    if (fixed) return numericValue.toFixed(Number(fixed[1]));
    if (format === "%d" || format === "%i") return String(Math.trunc(numericValue));
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function contentNodeText(node: QtiContentNode): string {
  if (node.kind === "text") return node.text;
  if ("children" in node) return node.children.map(contentNodeText).join("");
  return "";
}

function errorView(message: string): HTMLElement {
  const element = document.createElement("p");
  element.role = "alert";
  element.textContent = message;
  return element;
}

function validationMessageElement(responseIdentifier: string): HTMLElement {
  const element = document.createElement("p");
  element.id = validationMessageId(responseIdentifier);
  element.dataset.validationFor = responseIdentifier;
  element.hidden = true;
  element.role = "alert";
  return element;
}

function inlineValidationMessageElement(responseIdentifier: string): HTMLElement {
  const element = document.createElement("span");
  element.id = validationMessageId(responseIdentifier);
  element.dataset.validationFor = responseIdentifier;
  element.hidden = true;
  element.role = "alert";
  return element;
}

function validationMessageId(responseIdentifier: string): string {
  return `qti3-validation-${responseIdentifier}`;
}

function cloneDiagnostics(diagnostics: QtiDiagnostic[]): QtiDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    source: diagnostic.source ? { ...diagnostic.source } : undefined,
  }));
}


function responseIsEmpty(value: QtiValue): boolean {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function responseCount(value: QtiValue): number {
  return responseIsEmpty(value) ? 0 : Array.isArray(value) ? value.length : 1;
}


function minimumRequiredResponses(interaction: QtiInteraction | undefined): number {
  if (!interaction) return 1;
  if (interaction.type === "media") return minimumMediaPlays(interaction);
  const explicit =
    interaction.attributes["min-choices"] ?? interaction.attributes["min-associations"];
  if (explicit === undefined) return 1;
  const parsed = Number(explicit);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
}


function mediaPlayCount(value: QtiValue): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function parseBooleanAttribute(value: string | undefined): boolean | undefined {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

function matchMaxDiagnostics(
  responseIdentifier: string,
  interaction: QtiInteraction,
  response: QtiValue,
): QtiDiagnostic[] {
  const identifiers = responseChoiceIdentifiers(response);
  if (identifiers.length === 0) return [];
  const counts = new Map<string, number>();
  for (const identifier of identifiers) {
    counts.set(identifier, (counts.get(identifier) ?? 0) + 1);
  }

  const diagnostics: QtiDiagnostic[] = [];
  for (const choice of interaction.choices) {
    const maximum = parseUnlimitedMaximum(choice.attributes["match-max"]);
    if (maximum === undefined) continue;
    const count = counts.get(choice.identifier) ?? 0;
    if (count <= maximum) continue;
    diagnostics.push({
      code: "response.matchMax",
      severity: "error",
      message: `${choice.text || choice.identifier} may be used at most ${maximum} time${maximum === 1 ? "" : "s"}.`,
      path: responseIdentifier,
    });
  }
  return diagnostics;
}

function responseChoiceIdentifiers(response: QtiValue): string[] {
  const values = Array.isArray(response) ? response : response === null ? [] : [response];
  return values.flatMap((value) => String(value).split(/\s+/).filter(Boolean));
}


async function defaultFetchXml(url: string): Promise<string> {
  if (!globalThis.fetch) {
    throw new Error("No fetch implementation is available. Provide loadUrl(url, { fetchXml }).");
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) throw new Error(`Failed to load QTI XML from ${url}: ${response.status}.`);
  return response.text();
}

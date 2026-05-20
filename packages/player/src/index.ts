import {
  createItemSession,
  parseQtiXml,
  visibleModalFeedback,
  type QtiAttemptStatus,
  type QtiAttemptStateV1,
  type QtiChoice,
  type QtiDiagnostic,
  type QtiDocument,
  type QtiInteraction,
  type QtiItemSession,
  type QtiValue,
} from "@qti3/core";

export interface QtiPlayerSessionControl {
  validateResponses?: boolean | undefined;
  showFeedback?: boolean | undefined;
}

export type QtiPlayerFetchXml = (url: string) => Promise<string>;

export interface QtiPlayerLoadOptions {
  state?: QtiAttemptStateV1 | undefined;
  status?: QtiAttemptStatus | undefined;
  sessionControl?: QtiPlayerSessionControl | undefined;
  fetchXml?: QtiPlayerFetchXml | undefined;
}

const HTMLElementBase: typeof HTMLElement =
  globalThis.HTMLElement ??
  (class {
    replaceChildren(): void {}
    dispatchEvent(): boolean {
      return true;
    }
  } as unknown as typeof HTMLElement);

export class QtiAssessmentItemPlayer extends HTMLElementBase {
  private documentModel?: QtiDocument;
  private session?: QtiItemSession;
  private validationMessages: QtiDiagnostic[] = [];
  private sessionControl: Required<QtiPlayerSessionControl> = {
    validateResponses: true,
    showFeedback: true,
  };

  async loadXml(xml: string, options: QtiPlayerLoadOptions = {}): Promise<void> {
    this.sessionControl = {
      validateResponses: options.sessionControl?.validateResponses ?? true,
      showFeedback: options.sessionControl?.showFeedback ?? true,
    };
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
    if (options.status) this.session.setStatus(options.status);
    this.render();
    this.dispatchEvent(new CustomEvent("qti-ready", { detail: { item: result.document.item } }));
    this.emitStateChange();
  }

  async loadUrl(url: string, options: QtiPlayerLoadOptions = {}): Promise<void> {
    const fetchXml = options.fetchXml ?? defaultFetchXml;
    await this.loadXml(await fetchXml(url), options);
  }

  scoreAttempt(): void {
    const session = this.session;
    if (!session) return;
    const validationMessages = this.sessionControl.validateResponses
      ? this.validateResponses()
      : [];
    if (validationMessages.length > 0) {
      this.validationMessages = validationMessages;
      this.renderValidationMessages();
      const state = session.serialize();
      state.validationMessages = validationMessages;
      this.dispatchEvent(new CustomEvent("qti-validation", { detail: { validationMessages } }));
      this.emitStateChange(state);
      return;
    }
    this.validationMessages = [];
    this.renderValidationMessages();
    const result = session.score();
    this.dispatchEvent(new CustomEvent("qti-score", { detail: result }));
    if (this.sessionControl.showFeedback) this.renderFeedback(result.outcomes);
    this.emitStateChange(result.state);
  }

  reset(): void {
    if (!this.documentModel) return;
    this.session = createItemSession(this.documentModel);
    this.render();
    this.dispatchEvent(new CustomEvent("qti-reset", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  restore(state: QtiAttemptStateV1): void {
    if (!this.documentModel) {
      throw new Error("Cannot restore QTI state before loading an item.");
    }
    if (state.itemIdentifier !== this.documentModel.item.identifier) {
      throw new Error(
        `Cannot restore state for ${state.itemIdentifier} into ${this.documentModel.item.identifier}.`,
      );
    }
    this.session = createItemSession(this.documentModel, state);
    this.render();
    this.dispatchEvent(new CustomEvent("qti-restore", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  suspend(): void {
    this.session?.setStatus("suspended");
    this.dispatchEvent(new CustomEvent("qti-suspend", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  endAttempt(): void {
    this.scoreAttempt();
    this.session?.setStatus("completed");
    this.dispatchEvent(new CustomEvent("qti-endattempt", { detail: { state: this.serialize() } }));
    this.emitStateChange();
  }

  serialize() {
    return this.session?.serialize();
  }

  private emitStateChange(state = this.serialize()): void {
    this.dispatchEvent(new CustomEvent("qti-statechange", { detail: { state } }));
  }

  private render(): void {
    const documentModel = this.documentModel;
    if (!documentModel) return;

    this.applyDefaultStyles();
    const root = document.createElement("article");
    root.className = "qti3-player";
    root.setAttribute("aria-labelledby", "qti3-item-title");
    root.append(playerStyleElement());

    const title = document.createElement("h2");
    title.id = "qti3-item-title";
    title.textContent = documentModel.item.title ?? documentModel.item.identifier;
    root.append(title);

    if (documentModel.item.prompt) {
      const prompt = document.createElement("p");
      prompt.className = "qti3-item-prompt";
      prompt.textContent = documentModel.item.prompt;
      root.append(prompt);
    }

    for (const interaction of documentModel.item.interactions) {
      root.append(this.renderInteraction(interaction));
    }

    const actions = document.createElement("div");
    actions.className = "qti3-actions";
    const score = document.createElement("button");
    score.type = "button";
    score.textContent = "Score";
    score.addEventListener("click", () => this.scoreAttempt());
    actions.append(score);
    root.append(actions);

    const feedback = document.createElement("section");
    feedback.className = "qti3-feedback";
    feedback.role = "status";
    feedback.setAttribute("aria-live", "polite");
    feedback.hidden = true;
    root.append(feedback);

    this.replaceChildren(root);
  }

  private renderInteraction(interaction: QtiInteraction): HTMLElement {
    const field = document.createElement("section");
    field.className = `qti3-interaction qti3-${interaction.type}`;
    field.dataset.interactionType = interaction.type;
    if (interaction.responseIdentifier)
      field.dataset.responseIdentifier = interaction.responseIdentifier;

    const heading = document.createElement("h3");
    heading.textContent = interactionLabel(interaction);
    field.append(heading);
    if (interaction.responseIdentifier) {
      field.append(validationMessageElement(interaction.responseIdentifier));
    }

    const responseIdentifier = interaction.responseIdentifier;
    const update = (value: QtiValue) => {
      if (!responseIdentifier || !this.session) return;
      this.session.respond(responseIdentifier, value);
      this.clearValidationMessage(responseIdentifier);
      this.dispatchEvent(
        new CustomEvent("qti-responsechange", {
          detail: { responseIdentifier, value },
        }),
      );
      this.dispatchEvent(
        new CustomEvent("qti-statechange", { detail: { state: this.session.serialize() } }),
      );
    };

    if (usesOrderedResponse(interaction)) {
      field.append(renderOrderedResponse(interaction, update));
      return field;
    }

    if (interaction.type === "gapMatch" || interaction.type === "graphicGapMatch") {
      field.append(renderGapMatchResponse(interaction, update));
      return field;
    }

    if (usesPairResponse(interaction)) {
      field.append(renderPairResponse(interaction, update));
      return field;
    }

    if (interaction.type === "hotspot" && interaction.object) {
      field.append(renderHotspotResponse(interaction, update));
      return field;
    }

    if (usesChoiceSet(interaction)) {
      field.append(renderChoice(interaction, update));
      return field;
    }

    if (interaction.type === "inlineChoice") {
      field.append(renderSelect(interaction, update));
      return field;
    }

    if (interaction.type === "extendedText") {
      field.append(renderTextResponse(interaction, update, "extended"));
      return field;
    }

    if (interaction.type === "positionObject" || interaction.type === "selectPoint") {
      field.append(renderPointResponse(interaction, update));
      return field;
    }

    if (interaction.type === "drawing") {
      field.append(renderDrawingResponse(interaction, update));
      return field;
    }

    if (interaction.type === "portableCustom") {
      field.append(renderPortableCustomResponse(interaction, update));
      return field;
    }

    if (interaction.type === "textEntry") {
      field.append(renderTextResponse(interaction, update, "entry"));
      return field;
    }

    if (interaction.type === "slider") {
      field.append(renderSliderResponse(interaction, update));
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
      button.addEventListener("click", () => this.endAttempt());
      field.append(button);
      return field;
    }

    if (interaction.type === "media") {
      field.append(renderObjectAsset(interaction));
      return field;
    }

    field.append(renderSelect(interaction, update));
    return field;
  }

  private applyDefaultStyles(): void {
    this.style.color = "CanvasText";
    this.style.backgroundColor = "Canvas";
    this.style.colorScheme = "light dark";
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
      if (declaration.correctResponse === null) continue;
      const interaction = interactionsByResponse.get(declaration.identifier);
      const minimum = minimumRequiredResponses(interaction);
      const count = responseCount(state.responses[declaration.identifier] ?? null);
      if (count >= minimum) continue;
      diagnostics.push({
        code: "response.required",
        severity: "error",
        message:
          minimum === 1
            ? `${declaration.identifier} requires a response.`
            : `${declaration.identifier} requires at least ${minimum} responses.`,
        path: declaration.identifier,
      });
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

function renderChoice(interaction: QtiInteraction, update: (value: QtiValue) => void): HTMLElement {
  const group = document.createElement("fieldset");
  group.className = "qti3-choice-group";
  const legend = document.createElement("legend");
  legend.textContent = readableType(interaction.type);
  group.append(legend);

  const multiple =
    interaction.responseCardinality === "multiple" || interaction.responseCardinality === "ordered";
  const selected = new Set<string>();
  const list = document.createElement("div");
  list.className = "qti3-choice-list";
  list.role = "group";
  list.setAttribute("aria-label", `${readableType(interaction.type)} options`);
  const syncSelected = () => {
    for (const label of list.querySelectorAll<HTMLElement>(".qti3-choice-option")) {
      const identifier = label.dataset.choiceIdentifier ?? "";
      label.dataset.selected = selected.has(identifier) ? "true" : "false";
    }
  };
  for (const choice of choicesOrFallback(interaction)) {
    const label = document.createElement("label");
    label.className = "qti3-choice-option";
    label.dataset.choiceIdentifier = choice.identifier;
    const input = document.createElement("input");
    input.type = multiple ? "checkbox" : "radio";
    input.name = interaction.responseIdentifier ?? interaction.type;
    input.value = choice.identifier;
    input.addEventListener("change", () => {
      if (multiple) {
        if (input.checked) selected.add(choice.identifier);
        else selected.delete(choice.identifier);
        update([...selected]);
      } else {
        selected.clear();
        selected.add(choice.identifier);
        syncSelected();
        update(input.value);
      }
      syncSelected();
    });
    const text = document.createElement("span");
    text.textContent = choice.text;
    label.append(input, text);
    list.append(label);
  }
  group.append(list);
  return group;
}

function usesChoiceSet(interaction: QtiInteraction): boolean {
  if (
    interaction.type === "choice" ||
    interaction.type === "hottext" ||
    interaction.type === "hotspot"
  ) {
    return true;
  }
  return interaction.responseCardinality === "multiple";
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

function renderOrderedResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = orderedResponseLegend(interaction.type);
  group.append(legend);
  appendGraphicContext(group, interaction);

  const choices = choicesOrFallback(interaction).filter((choice) => choice.role !== "gap");
  const ordered = [...choices];
  const list = document.createElement("ol");
  list.className = "qti3-reorder-list";
  list.setAttribute("aria-label", `${readableType(interaction.type)} current order`);
  let draggedIdentifier: string | undefined;

  const commit = () => update(ordered.map((choice) => choice.identifier));
  const moveChoice = (from: number, to: number) => {
    if (from === to || from < 0 || from >= ordered.length || to < 0 || to >= ordered.length) return;
    const [choice] = ordered.splice(from, 1);
    if (!choice) return;
    ordered.splice(to, 0, choice);
    renderList();
    commit();
    list
      .querySelector<HTMLButtonElement>(`[data-choice-identifier="${choice.identifier}"]`)
      ?.focus();
  };
  const renderList = () => {
    list.replaceChildren(
      ...ordered.map((choice, index) => {
        const item = document.createElement("li");
        item.className = "qti3-reorder-item";
        item.draggable = true;
        item.dataset.choiceIdentifier = choice.identifier;
        item.addEventListener("dragstart", (event) => {
          draggedIdentifier = choice.identifier;
          event.dataTransfer?.setData("text/plain", choice.identifier);
          event.dataTransfer?.setDragImage(item, 12, 12);
        });
        item.addEventListener("dragover", (event) => {
          event.preventDefault();
          item.classList.add("qti3-drop-target");
        });
        item.addEventListener("dragleave", () => item.classList.remove("qti3-drop-target"));
        item.addEventListener("drop", (event) => {
          event.preventDefault();
          item.classList.remove("qti3-drop-target");
          const dragged = event.dataTransfer?.getData("text/plain") || draggedIdentifier;
          const from = ordered.findIndex((entry) => entry.identifier === dragged);
          moveChoice(from, index);
        });

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "qti3-token qti3-reorder-handle";
        handle.dataset.choiceIdentifier = choice.identifier;
        handle.setAttribute(
          "aria-label",
          `${choice.text}, position ${index + 1} of ${ordered.length}`,
        );
        handle.textContent = choice.text;
        handle.addEventListener("keydown", (event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            moveChoice(index, index - 1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            moveChoice(index, index + 1);
          }
        });

        const up = document.createElement("button");
        up.type = "button";
        up.className = "qti3-icon-button";
        up.textContent = "Up";
        up.disabled = index === 0;
        up.setAttribute("aria-label", `Move ${choice.text} up`);
        up.addEventListener("click", () => moveChoice(index, index - 1));

        const down = document.createElement("button");
        down.type = "button";
        down.className = "qti3-icon-button";
        down.textContent = "Down";
        down.disabled = index === ordered.length - 1;
        down.setAttribute("aria-label", `Move ${choice.text} down`);
        down.addEventListener("click", () => moveChoice(index, index + 1));

        item.append(handle, up, down);
        return item;
      }),
    );
  };
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.textContent = "Use current order";
  confirm.addEventListener("click", commit);
  renderList();
  group.append(list, confirm);
  return group;
}

function renderPairResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = `${readableType(interaction.type)} pairs`;
  group.append(legend);
  appendGraphicContext(group, interaction);

  const sources = sourceChoices(interaction);
  const targets = targetChoices(interaction);
  const selectedPairs: string[] = [];
  let selectedSource: QtiChoice | undefined;
  let selectedTarget: QtiChoice | undefined;
  const labels = pairRegionLabels(interaction);

  const sourceRegion = tokenRegion(`${readableType(interaction.type)} sources`, labels.source);
  const targetRegion = tokenRegion(`${readableType(interaction.type)} targets`, labels.target);
  const selector = document.createElement("div");
  selector.className = "qti3-pair-selector";
  const pairList = document.createElement("ul");
  pairList.className = "qti3-pair-list";
  pairList.setAttribute("aria-label", `${readableType(interaction.type)} selected pairs`);

  const commit = () => {
    if (interaction.responseCardinality === "single") update(selectedPairs[0] ?? null);
    else update([...selectedPairs]);
  };
  const syncPressed = () => {
    for (const button of sourceRegion.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.choiceIdentifier === selectedSource?.identifier ? "true" : "false",
      );
    }
    for (const button of targetRegion.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.choiceIdentifier === selectedTarget?.identifier ? "true" : "false",
      );
    }
  };
  const addSelectedPair = () => {
    if (!selectedSource || !selectedTarget) return;
    const pair = `${selectedSource.identifier} ${selectedTarget.identifier}`;
    if (!selectedPairs.includes(pair)) selectedPairs.push(pair);
    selectedSource = undefined;
    selectedTarget = undefined;
    syncPressed();
    renderPairs();
    commit();
  };
  const renderPairs = () => {
    pairList.replaceChildren(
      ...selectedPairs.map((pair) => {
        const [source, target] = pair.split(" ");
        const item = document.createElement("li");
        item.className = "qti3-pair-chip";
        const text = document.createElement("span");
        text.textContent = `${choiceText(sources, source)} to ${choiceText(targets, target)}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove ${text.textContent}`);
        remove.addEventListener("click", () => {
          const index = selectedPairs.indexOf(pair);
          if (index >= 0) selectedPairs.splice(index, 1);
          renderPairs();
          commit();
        });
        item.append(text, remove);
        return item;
      }),
    );
  };

  for (const choice of sources) {
    const button = tokenButton(choice);
    button.addEventListener("click", () => {
      selectedSource = choice;
      syncPressed();
      addSelectedPair();
    });
    sourceRegion.append(button);
  }
  for (const choice of targets) {
    const button = tokenButton(choice);
    button.addEventListener("click", () => {
      selectedTarget = choice;
      syncPressed();
      addSelectedPair();
    });
    targetRegion.append(button);
  }

  selector.append(sourceRegion, targetRegion);
  group.append(selector, pairList);
  return group;
}

function pairRegionLabels(interaction: QtiInteraction): { source: string; target: string } {
  if (interaction.type === "associate") return { source: "First concept", target: "Pair with" };
  if (interaction.type === "graphicAssociate")
    return { source: "First hotspot", target: "Pair with" };
  if (interaction.type === "match") return { source: "Prompt", target: "Match" };
  return { source: "Source", target: "Target" };
}

function renderGapMatchResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = `${readableType(interaction.type)} gaps`;
  group.append(legend);
  appendGraphicContext(group, interaction);

  const sources = sourceChoices(interaction);
  const gaps = targetChoices(interaction);
  const assignments = new Map<string, QtiChoice>();
  let selectedSource: QtiChoice | undefined;
  let draggedSource: string | undefined;

  const sourceRegion = tokenRegion(`${readableType(interaction.type)} choices`);
  const gapRegion = document.createElement("div");
  gapRegion.className = "qti3-gap-region";
  gapRegion.role = "group";
  gapRegion.setAttribute("aria-label", `${readableType(interaction.type)} targets`);

  const commit = () => {
    update(
      [...assignments.entries()].map(
        ([gapIdentifier, source]) => `${source.identifier} ${gapIdentifier}`,
      ),
    );
  };
  const syncSources = () => {
    for (const button of sourceRegion.querySelectorAll<HTMLButtonElement>("button")) {
      button.setAttribute(
        "aria-pressed",
        button.dataset.choiceIdentifier === selectedSource?.identifier ? "true" : "false",
      );
    }
  };
  const assign = (gap: QtiChoice, sourceIdentifier: string | undefined) => {
    const source = sources.find((choice) => choice.identifier === sourceIdentifier);
    if (!source) return;
    assignments.set(gap.identifier, source);
    selectedSource = undefined;
    syncSources();
    renderGaps();
    commit();
  };
  const renderGaps = () => {
    gapRegion.replaceChildren(
      ...gaps.map((gap) => {
        const assigned = assignments.get(gap.identifier);
        const target = document.createElement("div");
        target.className = "qti3-gap-target";
        target.dataset.gapIdentifier = gap.identifier;
        target.addEventListener("dragover", (event) => {
          event.preventDefault();
          target.classList.add("qti3-drop-target");
        });
        target.addEventListener("dragleave", () => target.classList.remove("qti3-drop-target"));
        target.addEventListener("drop", (event) => {
          event.preventDefault();
          target.classList.remove("qti3-drop-target");
          assign(gap, event.dataTransfer?.getData("text/plain") || draggedSource);
        });

        const button = document.createElement("button");
        button.type = "button";
        button.className = "qti3-gap-button";
        button.textContent = assigned ? `${gap.text}: ${assigned.text}` : `${gap.text}: empty`;
        button.setAttribute(
          "aria-label",
          assigned ? `${gap.text}, assigned ${assigned.text}` : `${gap.text}, empty`,
        );
        button.addEventListener("click", () => assign(gap, selectedSource?.identifier));

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.disabled = !assigned;
        remove.setAttribute("aria-label", `Remove ${gap.text} assignment`);
        remove.addEventListener("click", () => {
          assignments.delete(gap.identifier);
          renderGaps();
          commit();
        });
        target.append(button, remove);
        return target;
      }),
    );
  };

  for (const source of sources) {
    const button = tokenButton(source);
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      draggedSource = source.identifier;
      event.dataTransfer?.setData("text/plain", source.identifier);
    });
    button.addEventListener("click", () => {
      selectedSource = source;
      syncSources();
    });
    sourceRegion.append(button);
  }

  renderGaps();
  group.append(sourceRegion, gapRegion);
  return group;
}

function renderSelect(interaction: QtiInteraction, update: (value: QtiValue) => void): HTMLElement {
  const select = document.createElement("select");
  select.className = "qti3-inline-select";
  select.setAttribute("aria-label", interactionLabel(interaction));
  appendOptions(select, choicesOrFallback(interaction));
  select.addEventListener("change", () => update(select.value));
  return select;
}

function interactionLabel(interaction: QtiInteraction): string {
  return interaction.prompt ?? interaction.contextText ?? readableType(interaction.type);
}

function renderTextResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  mode: "entry" | "extended",
): HTMLElement {
  const group = document.createElement("div");
  group.className = "qti3-text-response";
  const counter = document.createElement("p");
  counter.className = "qti3-counter";
  counter.setAttribute("aria-live", "polite");
  const expectedLength = Number(interaction.attributes["expected-length"] ?? 0);
  const expectedLines = Number(interaction.attributes["expected-lines"] ?? 0);
  const control =
    mode === "extended" ? document.createElement("textarea") : document.createElement("input");
  control.className = mode === "extended" ? "qti3-textarea" : "qti3-text-input";
  control.setAttribute(
    "aria-label",
    interaction.prompt ?? (mode === "extended" ? "Extended text response" : "Text response"),
  );
  if (mode === "extended" && expectedLines > 0) {
    (control as HTMLTextAreaElement).rows = expectedLines;
  }
  if (mode === "entry" && expectedLength > 0) {
    (control as HTMLInputElement).maxLength = expectedLength;
  }
  const sync = () => {
    const value = control.value;
    const words = value.trim().length > 0 ? value.trim().split(/\s+/).length : 0;
    const lengthText =
      expectedLength > 0
        ? `${value.length} of ${expectedLength} characters`
        : `${value.length} characters`;
    counter.textContent = mode === "extended" ? `${lengthText}, ${words} words` : lengthText;
    update(value);
  };
  control.addEventListener("input", sync);
  control.addEventListener("change", sync);
  sync();
  group.append(control, counter);
  return group;
}

function renderSliderResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("div");
  group.className = "qti3-slider-response";
  const input = document.createElement("input");
  input.type = "range";
  input.min = interaction.attributes["lower-bound"] ?? "0";
  input.max = interaction.attributes["upper-bound"] ?? "100";
  input.step = interaction.attributes.step ?? "1";
  input.value = interaction.attributes["lower-bound"] ?? "0";
  input.setAttribute("aria-label", interaction.prompt ?? "Slider response");
  const output = document.createElement("output");
  output.className = "qti3-slider-output";
  output.value = input.value;
  output.textContent = input.value;
  const sync = () => {
    output.value = input.value;
    output.textContent = input.value;
    update(input.value);
  };
  input.addEventListener("input", sync);
  group.append(input, output);
  return group;
}

function appendGraphicContext(group: HTMLElement, interaction: QtiInteraction): void {
  if (!interaction.type.startsWith("graphic") || !interaction.object) return;
  const context = document.createElement("div");
  context.className = "qti3-graphic-context";
  context.append(renderObjectAsset(interaction));
  group.append(context);
}

function renderPointResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute("aria-label", `${readableType(interaction.type)} coordinate response`);

  const surface = document.createElement("button");
  surface.type = "button";
  surface.className = "qti3-point-surface";
  surface.setAttribute("aria-label", `${readableType(interaction.type)} coordinate area`);
  surface.style.display = "block";
  surface.style.position = "relative";
  surface.style.inlineSize = `${objectWidth(interaction)}px`;
  surface.style.blockSize = `${objectHeight(interaction)}px`;
  surface.style.maxInlineSize = "100%";
  surface.style.border = "1px solid CanvasText";
  surface.style.background = "Canvas";
  surface.style.color = "CanvasText";
  surface.style.cursor = "crosshair";
  surface.style.overflow = "hidden";

  const object = interaction.object;
  if (object?.data && object.type?.startsWith("image/")) {
    const image = document.createElement("img");
    image.src = object.data;
    image.alt = "";
    image.style.position = "absolute";
    image.style.inset = "0";
    image.style.inlineSize = "100%";
    image.style.blockSize = "100%";
    image.style.objectFit = "contain";
    image.style.pointerEvents = "none";
    surface.append(image);
  }

  const marker = document.createElement("span");
  marker.className = "qti3-point-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.style.position = "absolute";
  marker.style.inlineSize = "8px";
  marker.style.blockSize = "8px";
  marker.style.border = "2px solid CanvasText";
  marker.style.borderRadius = "50%";
  marker.style.transform = "translate(-50%, -50%)";
  marker.style.pointerEvents = "none";
  surface.append(marker);

  const point = { x: 10, y: 10 };
  const width = objectWidth(interaction);
  const height = objectHeight(interaction);
  const coordinate = document.createElement("output");
  coordinate.className = "qti3-coordinate-output";
  const commit = () => update(`${point.x} ${point.y}`);
  const syncMarker = () => {
    marker.style.insetInlineStart = `${point.x}px`;
    marker.style.insetBlockStart = `${point.y}px`;
    coordinate.value = `${point.x} ${point.y}`;
    coordinate.textContent = `Selected point ${point.x}, ${point.y}`;
    surface.setAttribute(
      "aria-label",
      `${readableType(interaction.type)} coordinate area, selected ${point.x} ${point.y}`,
    );
  };
  const clampPoint = () => {
    point.x = Math.max(0, Math.min(width, point.x));
    point.y = Math.max(0, Math.min(height, point.y));
  };

  surface.addEventListener("click", (event) => {
    if (event.detail === 0) return;
    point.x = Math.round(event.offsetX);
    point.y = Math.round(event.offsetY);
    clampPoint();
    syncMarker();
    commit();
  });
  surface.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") point.x -= step;
    else if (event.key === "ArrowRight") point.x += step;
    else if (event.key === "ArrowUp") point.y -= step;
    else if (event.key === "ArrowDown") point.y += step;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit();
      return;
    } else return;

    event.preventDefault();
    clampPoint();
    syncMarker();
  });

  syncMarker();
  const controls = document.createElement("div");
  controls.className = "qti3-point-controls";
  for (const [label, dx, dy] of [
    ["Up", 0, -1],
    ["Left", -1, 0],
    ["Right", 1, 0],
    ["Down", 0, 1],
  ] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", `Move point ${label.toLowerCase()}`);
    button.addEventListener("click", () => {
      point.x += dx;
      point.y += dy;
      clampPoint();
      syncMarker();
      commit();
    });
    controls.append(button);
  }
  group.append(surface, coordinate, controls);
  return group;
}

function renderDrawingResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute("aria-label", `${readableType(interaction.type)} response`);

  const surface = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  surface.classList.add("qti3-drawing-surface");
  surface.setAttribute("role", "img");
  surface.setAttribute("aria-label", "Drawing response surface");
  surface.setAttribute("tabindex", "0");
  surface.setAttribute("viewBox", "0 0 160 120");
  surface.style.display = "block";
  surface.style.inlineSize = "160px";
  surface.style.blockSize = "120px";
  surface.style.maxInlineSize = "100%";
  surface.style.border = "1px solid CanvasText";
  surface.style.background = "Canvas";
  surface.style.touchAction = "none";

  let start: { x: number; y: number } | undefined;
  let lastStroke = "";
  const draw = (stroke: string) => {
    const [x1, y1, x2, y2] = stroke.split(" ").map((value) => Number(value));
    if (
      x1 === undefined ||
      y1 === undefined ||
      x2 === undefined ||
      y2 === undefined ||
      [x1, y1, x2, y2].some((value) => !Number.isFinite(value))
    ) {
      return;
    }
    lastStroke = stroke;
    surface.replaceChildren(lineElement(x1, y1, x2, y2));
    update(stroke);
  };

  surface.addEventListener("pointerdown", (event) => {
    start = svgPoint(surface, event);
  });
  surface.addEventListener("pointerup", (event) => {
    if (!start) return;
    const end = svgPoint(surface, event);
    const stroke = `${start.x} ${start.y} ${end.x} ${end.y}`;
    start = undefined;
    draw(stroke);
  });
  surface.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    draw("10 10 90 90");
  });

  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear drawing";
  clear.addEventListener("click", () => {
    lastStroke = "";
    surface.replaceChildren();
    update("");
  });
  const replay = document.createElement("button");
  replay.type = "button";
  replay.textContent = "Replay last stroke";
  replay.addEventListener("click", () => {
    if (lastStroke) draw(lastStroke);
  });

  const tools = document.createElement("div");
  tools.className = "qti3-drawing-tools";
  tools.append(clear, replay);
  group.append(surface, tools);
  return group;
}

function renderPortableCustomResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute("aria-label", interaction.prompt ?? "Portable custom interaction");

  const host = document.createElement("div");
  host.className = "qti3-portable-custom-host";
  host.tabIndex = 0;
  host.dataset.responseIdentifier = interaction.responseIdentifier ?? "";
  host.dataset.typeIdentifier = interaction.attributes["custom-interaction-type-identifier"] ?? "";
  host.dataset.module = interaction.attributes.module ?? "";
  host.dataset.qtiName = interaction.qtiName;
  host.setAttribute("role", "application");
  host.setAttribute("aria-label", interaction.prompt ?? "Portable custom interaction host");
  host.textContent = "Portable custom interaction host";
  host.style.border = "1px solid CanvasText";
  host.style.padding = "0.5rem";
  host.style.marginBlockEnd = "0.5rem";

  const fallback = document.createElement("input");
  fallback.setAttribute("aria-label", `${interaction.prompt ?? "Portable custom"} response`);
  fallback.addEventListener("input", () => update(fallback.value));
  fallback.addEventListener("change", () => update(fallback.value));

  host.addEventListener("qti3-portable-custom-response", (event) => {
    const value = portableCustomEventValue(event);
    if (value === undefined) return;
    fallback.value = String(value ?? "");
    update(value);
  });
  host.addEventListener("qti3-pci-response", (event) => {
    const value = portableCustomEventValue(event);
    if (value === undefined) return;
    fallback.value = String(value ?? "");
    update(value);
  });

  group.append(host, fallback);
  return group;
}

function renderHotspotResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
): HTMLElement {
  const group = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = `${readableType(interaction.type)} regions`;
  group.append(legend);

  const surface = document.createElement("div");
  surface.className = "qti3-hotspot-surface";
  surface.style.position = "relative";
  surface.style.inlineSize = `${objectWidth(interaction)}px`;
  surface.style.blockSize = `${objectHeight(interaction)}px`;
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

  const selected = new Set<string>();
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
    button.setAttribute("aria-pressed", "false");
    button.style.position = "absolute";
    button.style.border = "2px solid CanvasText";
    button.style.background = "transparent";
    button.style.color = "CanvasText";
    button.style.minInlineSize = "2rem";
    button.style.minBlockSize = "2rem";
    placeHotspotButton(button, choice);
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

function renderObjectAsset(interaction: QtiInteraction): HTMLElement {
  const object = interaction.object;
  const type = object?.type ?? "";
  const label = interaction.prompt ?? object?.text ?? "Media interaction";

  if (object?.data && type.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "none";
    audio.src = object.data;
    audio.setAttribute("aria-label", label);
    audio.style.maxInlineSize = "100%";
    audio.style.inlineSize = "100%";
    return audio;
  }

  if (object?.data && type.startsWith("video/")) {
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "none";
    video.src = object.data;
    video.setAttribute("aria-label", label);
    video.style.maxInlineSize = "100%";
    if (object.width) video.width = Number(object.width);
    if (object.height) video.height = Number(object.height);
    return video;
  }

  if (object?.data && type.startsWith("image/")) {
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
  if (object?.data) {
    const link = document.createElement("a");
    link.href = object.data;
    link.textContent = object.text || object.data;
    group.append(link);
  } else {
    group.textContent = label;
  }
  return group;
}

function appendOptions(select: HTMLSelectElement, choices: QtiChoice[]): void {
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Select";
  select.append(empty);
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.identifier;
    option.textContent = choice.text;
    select.append(option);
  }
}

function tokenRegion(label: string, visibleLabel?: string): HTMLElement {
  const region = document.createElement("div");
  region.className = "qti3-token-region";
  region.role = "group";
  region.setAttribute("aria-label", label);
  if (visibleLabel) {
    const heading = document.createElement("strong");
    heading.className = "qti3-region-label";
    heading.textContent = visibleLabel;
    region.append(heading);
  }
  return region;
}

function tokenButton(choice: QtiChoice): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-token";
  button.dataset.choiceIdentifier = choice.identifier;
  button.setAttribute("aria-pressed", "false");
  button.textContent = choice.text;
  return button;
}

function choiceText(choices: QtiChoice[], identifier: string | undefined): string {
  if (!identifier) return "";
  return choices.find((choice) => choice.identifier === identifier)?.text ?? identifier;
}

function sourceChoices(interaction: QtiInteraction): QtiChoice[] {
  const choices = choicesOrFallback(interaction);
  const sourceRoles = new Set(["associableChoice", "matchSource", "gapChoice", "hotspot"]);
  const sources = choices.filter((choice) => sourceRoles.has(choice.role));
  return sources.length > 0 ? sources : choices;
}

function targetChoices(interaction: QtiInteraction): QtiChoice[] {
  const choices = choicesOrFallback(interaction);
  if (interaction.type === "associate" || interaction.type === "graphicAssociate") return choices;
  const targetRoles = new Set(["matchTarget", "gap", "hotspot"]);
  const targets = choices.filter((choice) => targetRoles.has(choice.role));
  return targets.length > 0 ? targets : choices;
}

function choicesOrFallback(interaction: QtiInteraction): QtiChoice[] {
  if (interaction.choices.length > 0) return interaction.choices;
  return [
    {
      identifier: "A",
      text: "A",
      role: "simpleChoice",
      qtiName: "qti-simple-choice",
      attributes: {},
    },
    {
      identifier: "B",
      text: "B",
      role: "simpleChoice",
      qtiName: "qti-simple-choice",
      attributes: {},
    },
  ];
}

function objectWidth(interaction: QtiInteraction): number {
  return dimension(interaction.object?.width, 160);
}

function objectHeight(interaction: QtiInteraction): number {
  return dimension(interaction.object?.height, 120);
}

function dimension(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function placeHotspotButton(button: HTMLButtonElement, choice: QtiChoice): void {
  const coords = (choice.attributes.coords ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  const shape = choice.attributes.shape;

  if (shape === "circle" && coords.length >= 3) {
    const [x, y, radius] = coords as [number, number, number];
    button.style.insetInlineStart = `${x - radius}px`;
    button.style.insetBlockStart = `${y - radius}px`;
    button.style.inlineSize = `${radius * 2}px`;
    button.style.blockSize = `${radius * 2}px`;
    button.style.borderRadius = "50%";
    return;
  }

  if (shape === "rect" && coords.length >= 4) {
    const [left, top, right, bottom] = coords as [number, number, number, number];
    button.style.insetInlineStart = `${left}px`;
    button.style.insetBlockStart = `${top}px`;
    button.style.inlineSize = `${Math.max(1, right - left)}px`;
    button.style.blockSize = `${Math.max(1, bottom - top)}px`;
    return;
  }

  if (shape === "poly" && coords.length >= 6) {
    const xs = coords.filter((_, index) => index % 2 === 0);
    const ys = coords.filter((_, index) => index % 2 === 1);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    button.style.insetInlineStart = `${left}px`;
    button.style.insetBlockStart = `${top}px`;
    button.style.inlineSize = `${Math.max(1, right - left)}px`;
    button.style.blockSize = `${Math.max(1, bottom - top)}px`;
    return;
  }

  button.style.insetInlineStart = "0";
  button.style.insetBlockStart = "0";
}

function svgPoint(surface: SVGSVGElement, event: PointerEvent): { x: number; y: number } {
  const rect = surface.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * 160);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * 120);
  return {
    x: Math.max(0, Math.min(160, x)),
    y: Math.max(0, Math.min(120, y)),
  };
}

function lineElement(x1: number, y1: number, x2: number, y2: number): SVGLineElement {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(x1));
  line.setAttribute("y1", String(y1));
  line.setAttribute("x2", String(x2));
  line.setAttribute("y2", String(y2));
  line.setAttribute("stroke", "CanvasText");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  return line;
}

function portableCustomEventValue(event: Event): QtiValue | undefined {
  if (!("detail" in event)) return undefined;
  const detail = event.detail as { value?: QtiValue; response?: QtiValue } | QtiValue | undefined;
  if (detail === undefined) return undefined;
  if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
    if ("value" in detail) return detail.value ?? null;
    if ("response" in detail) return detail.response ?? null;
  }
  return detail as QtiValue;
}

function readableType(type: string): string {
  return type
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
}

function orderedResponseLegend(type: QtiInteraction["type"]): string {
  if (type === "order" || type === "graphicOrder") return readableType(type);
  return `${readableType(type)} order`;
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

function validationMessageId(responseIdentifier: string): string {
  return `qti3-validation-${responseIdentifier}`;
}

function playerStyleElement(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = `
    .qti3-player {
      display: grid;
      gap: 1rem;
      max-inline-size: 72rem;
      font: 16px/1.45 system-ui, sans-serif;
    }

    .qti3-interaction {
      display: grid;
      gap: 0.75rem;
    }

    .qti3-actions,
    .qti3-reorder-item,
    .qti3-token-region,
    .qti3-pair-chip,
    .qti3-gap-region,
    .qti3-gap-target {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }

    .qti3-reorder-list {
      display: grid;
      gap: 0.5rem;
      padding-inline-start: 1.5rem;
    }

    .qti3-pair-selector {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      align-items: start;
    }

    .qti3-region-label {
      flex-basis: 100%;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .qti3-choice-list {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: minmax(0, 42rem);
    }

    .qti3-choice-option {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      min-block-size: 2.75rem;
      padding: 0.55rem 0.65rem;
      border: 1px solid CanvasText;
      background: Canvas;
      color: CanvasText;
      cursor: pointer;
    }

    .qti3-choice-option[data-selected="true"] {
      background: Highlight;
      color: HighlightText;
    }

    .qti3-reorder-item {
      padding: 0.5rem;
      border: 1px solid CanvasText;
      background: Canvas;
      color: CanvasText;
    }

    .qti3-drop-target {
      outline: 3px solid Highlight;
      outline-offset: 2px;
    }

    .qti3-token,
    .qti3-icon-button,
    .qti3-player button,
    .qti3-player select,
    .qti3-player input,
    .qti3-player textarea {
      font: inherit;
    }

    .qti3-token {
      min-inline-size: 2.5rem;
      padding: 0.35rem 0.65rem;
      border: 1px solid CanvasText;
      background: Canvas;
      color: CanvasText;
      cursor: grab;
    }

    .qti3-token[aria-pressed="true"],
    .qti3-pair-chip {
      background: Highlight;
      color: HighlightText;
    }

    .qti3-pair-list {
      display: grid;
      gap: 0.5rem;
      padding-inline-start: 1.5rem;
    }

    .qti3-pair-chip {
      width: fit-content;
      padding: 0.35rem 0.5rem;
    }

    .qti3-gap-target {
      min-block-size: 2.75rem;
      padding: 0.5rem;
      border: 1px dashed CanvasText;
    }

    .qti3-gap-button {
      min-inline-size: 8rem;
      text-align: start;
    }

    .qti3-text-response,
    .qti3-slider-response {
      display: grid;
      gap: 0.4rem;
      max-inline-size: 42rem;
    }

    .qti3-text-input,
    .qti3-textarea {
      inline-size: 100%;
      box-sizing: border-box;
      padding: 0.55rem 0.65rem;
      border: 1px solid CanvasText;
      background: Canvas;
      color: CanvasText;
    }

    .qti3-textarea {
      min-block-size: 8rem;
      resize: vertical;
    }

    .qti3-counter,
    .qti3-slider-output {
      margin: 0;
      font-size: 0.9rem;
    }

    .qti3-slider-response {
      grid-template-columns: minmax(8rem, 1fr) auto;
      align-items: center;
    }

    .qti3-point-controls,
    .qti3-drawing-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-block-start: 0.5rem;
    }

    .qti3-coordinate-output {
      display: block;
      margin-block-start: 0.4rem;
      font-size: 0.9rem;
    }

    .qti3-hotspot-button[data-selected="true"] {
      background: Highlight !important;
      color: HighlightText !important;
      outline: 3px solid Highlight;
      outline-offset: 2px;
    }

    .qti3-selection-summary {
      margin: 0;
    }

    .qti3-token:focus-visible,
    .qti3-player button:focus-visible,
    .qti3-player select:focus-visible,
    .qti3-player input:focus-visible,
    .qti3-player textarea:focus-visible {
      outline: 3px solid Highlight;
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .qti3-player * {
        scroll-behavior: auto;
      }
    }
  `;
  return style;
}

function responseIsEmpty(value: QtiValue): boolean {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function responseCount(value: QtiValue): number {
  return responseIsEmpty(value) ? 0 : Array.isArray(value) ? value.length : 1;
}

function minimumRequiredResponses(interaction: QtiInteraction | undefined): number {
  if (!interaction) return 1;
  const explicit =
    interaction.attributes["min-choices"] ?? interaction.attributes["min-associations"];
  if (explicit === undefined) return 1;
  const parsed = Number(explicit);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
}

async function defaultFetchXml(url: string): Promise<string> {
  if (!globalThis.fetch) {
    throw new Error("No fetch implementation is available. Provide loadUrl(url, { fetchXml }).");
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) throw new Error(`Failed to load QTI XML from ${url}: ${response.status}.`);
  return response.text();
}

import {
  createItemSession,
  parseQtiXml,
  type QtiAttemptStateV1,
  type QtiChoice,
  type QtiDiagnostic,
  type QtiDocument,
  type QtiInteraction,
  type QtiItemSession,
  type QtiValue,
} from "@qti3/core";

export interface QtiPlayerLoadOptions {
  state?: QtiAttemptStateV1 | undefined;
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
  async loadXml(xml: string, options: QtiPlayerLoadOptions = {}): Promise<void> {
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
    this.render();
    this.dispatchEvent(new CustomEvent("qti-ready", { detail: { item: result.document.item } }));
    this.emitStateChange();
  }

  scoreAttempt(): void {
    const session = this.session;
    if (!session) return;
    const validationMessages = this.validateResponses();
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
    this.dispatchEvent(new CustomEvent("qti-suspend", { detail: { state: this.serialize() } }));
  }

  endAttempt(): void {
    this.scoreAttempt();
    this.dispatchEvent(new CustomEvent("qti-endattempt", { detail: { state: this.serialize() } }));
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

    const title = document.createElement("h2");
    title.id = "qti3-item-title";
    title.textContent = documentModel.item.title ?? documentModel.item.identifier;
    root.append(title);

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

    this.replaceChildren(root);
  }

  private renderInteraction(interaction: QtiInteraction): HTMLElement {
    const field = document.createElement("section");
    field.className = `qti3-interaction qti3-${interaction.type}`;
    field.dataset.interactionType = interaction.type;
    if (interaction.responseIdentifier)
      field.dataset.responseIdentifier = interaction.responseIdentifier;

    const heading = document.createElement("h3");
    heading.textContent = interaction.prompt || readableType(interaction.type);
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

    if (usesPairResponse(interaction)) {
      field.append(renderPairResponse(interaction, update));
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
      const textarea = document.createElement("textarea");
      textarea.setAttribute("aria-label", heading.textContent ?? "Extended text response");
      textarea.addEventListener("input", () => update(textarea.value));
      field.append(textarea);
      return field;
    }

    if (
      interaction.type === "textEntry" ||
      interaction.type === "portableCustom" ||
      interaction.type === "drawing" ||
      interaction.type === "positionObject" ||
      interaction.type === "selectPoint"
    ) {
      const input = document.createElement("input");
      input.value = interaction.responseBaseType === "point" ? "10 10" : "";
      input.setAttribute("aria-label", heading.textContent ?? "Response");
      input.addEventListener("input", () => update(input.value));
      input.addEventListener("change", () => update(input.value));
      field.append(input);
      return field;
    }

    if (interaction.type === "slider") {
      const input = document.createElement("input");
      input.type = "range";
      input.min = interaction.attributes["lower-bound"] ?? "0";
      input.max = interaction.attributes["upper-bound"] ?? "100";
      input.step = interaction.attributes.step ?? "1";
      input.value = interaction.attributes["lower-bound"] ?? "0";
      input.setAttribute("aria-label", heading.textContent ?? "Slider response");
      input.addEventListener("input", () => update(input.value));
      field.append(input);
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
      const media = document.createElement("div");
      media.role = "group";
      media.setAttribute("aria-label", "Media interaction");
      media.textContent = "Media interaction";
      field.append(media);
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
    return this.documentModel.item.responseDeclarations
      .filter((declaration) => declaration.correctResponse !== null)
      .filter((declaration) => responseIsEmpty(state.responses[declaration.identifier] ?? null))
      .map((declaration) => ({
        code: "response.required",
        severity: "error" as const,
        message: `${declaration.identifier} requires a response.`,
        path: declaration.identifier,
      }));
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
  const legend = document.createElement("legend");
  legend.textContent = readableType(interaction.type);
  group.append(legend);

  const multiple =
    interaction.responseCardinality === "multiple" || interaction.responseCardinality === "ordered";
  const selected = new Set<string>();
  for (const choice of choicesOrFallback(interaction)) {
    const label = document.createElement("label");
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
        update(input.value);
      }
    });
    label.append(input, ` ${choice.text}`);
    group.append(label);
  }
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
  legend.textContent = `${readableType(interaction.type)} order`;
  group.append(legend);

  const choices = choicesOrFallback(interaction).filter((choice) => choice.role !== "gap");
  const selects: HTMLSelectElement[] = [];
  for (const [index] of choices.entries()) {
    const label = document.createElement("label");
    label.textContent = `Position ${index + 1} `;
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Position ${index + 1}`);
    appendOptions(select, choices);
    select.addEventListener("change", () => {
      update(selects.map((item) => item.value).filter((value) => value.length > 0));
    });
    selects.push(select);
    label.append(select);
    group.append(label);
  }
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

  const source = document.createElement("select");
  source.setAttribute("aria-label", `${readableType(interaction.type)} source`);
  appendOptions(source, sourceChoices(interaction));

  const target = document.createElement("select");
  target.setAttribute("aria-label", `${readableType(interaction.type)} target`);
  appendOptions(target, targetChoices(interaction));

  const sync = () => {
    if (!source.value || !target.value) {
      update([]);
      return;
    }
    update([`${source.value} ${target.value}`]);
  };
  source.addEventListener("change", sync);
  target.addEventListener("change", sync);

  const sourceLabel = document.createElement("label");
  sourceLabel.textContent = "Source ";
  sourceLabel.append(source);
  const targetLabel = document.createElement("label");
  targetLabel.textContent = "Target ";
  targetLabel.append(target);
  group.append(sourceLabel, targetLabel);
  return group;
}

function renderSelect(interaction: QtiInteraction, update: (value: QtiValue) => void): HTMLElement {
  const select = document.createElement("select");
  select.setAttribute("aria-label", readableType(interaction.type));
  appendOptions(select, choicesOrFallback(interaction));
  select.addEventListener("change", () => update(select.value));
  return select;
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
    { identifier: "A", text: "A", role: "simpleChoice", qtiName: "qti-simple-choice" },
    { identifier: "B", text: "B", role: "simpleChoice", qtiName: "qti-simple-choice" },
  ];
}

function readableType(type: string): string {
  return type
    .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
    .replace(/^./, (letter) => letter.toUpperCase());
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

function responseIsEmpty(value: QtiValue): boolean {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

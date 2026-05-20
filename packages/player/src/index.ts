import {
  createItemSession,
  parseQtiXml,
  type QtiDocument,
  type QtiInteraction,
  type QtiItemSession,
  type QtiValue,
} from "@qti3/core";

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
  private readonly responseControls = new Map<string, HTMLElement[]>();

  async loadXml(xml: string): Promise<void> {
    const result = parseQtiXml(xml);
    this.dispatchEvent(
      new CustomEvent("qti-diagnostics", { detail: { diagnostics: result.diagnostics } }),
    );
    if (!result.document) {
      this.replaceChildren(errorView("Unable to parse QTI item."));
      return;
    }

    this.documentModel = result.document;
    this.session = createItemSession(result.document);
    this.render();
    this.dispatchEvent(new CustomEvent("qti-ready", { detail: { item: result.document.item } }));
  }

  scoreAttempt(): void {
    const session = this.session;
    if (!session) return;
    const result = session.score();
    this.dispatchEvent(new CustomEvent("qti-score", { detail: result }));
    this.dispatchEvent(new CustomEvent("qti-statechange", { detail: { state: result.state } }));
  }

  serialize() {
    return this.session?.serialize();
  }

  private render(): void {
    const documentModel = this.documentModel;
    if (!documentModel) return;

    this.responseControls.clear();
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

    const heading = document.createElement("h3");
    heading.textContent = interaction.prompt || readableType(interaction.type);
    field.append(heading);

    const responseIdentifier = interaction.responseIdentifier;
    const update = (value: QtiValue) => {
      if (!responseIdentifier || !this.session) return;
      this.session.respond(responseIdentifier, value);
      this.dispatchEvent(
        new CustomEvent("qti-responsechange", {
          detail: { responseIdentifier, value },
        }),
      );
      this.dispatchEvent(
        new CustomEvent("qti-statechange", { detail: { state: this.session.serialize() } }),
      );
    };

    if (interaction.type === "choice" || interaction.type === "hottext") {
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
      interaction.type === "custom" ||
      interaction.type === "portableCustom" ||
      interaction.type === "drawing"
    ) {
      const input = document.createElement("input");
      input.setAttribute("aria-label", heading.textContent ?? "Response");
      input.addEventListener("input", () => update(input.value));
      field.append(input);
      return field;
    }

    if (interaction.type === "slider") {
      const input = document.createElement("input");
      input.type = "range";
      input.min = interaction.attributes["lower-bound"] ?? "0";
      input.max = interaction.attributes["upper-bound"] ?? "100";
      input.step = interaction.attributes.step ?? "1";
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
      button.addEventListener("click", () => this.scoreAttempt());
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

  const multiple = interaction.attributes["max-choices"] !== "1";
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

function renderSelect(interaction: QtiInteraction, update: (value: QtiValue) => void): HTMLElement {
  const select = document.createElement("select");
  select.setAttribute("aria-label", readableType(interaction.type));
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Select";
  select.append(empty);
  for (const choice of choicesOrFallback(interaction)) {
    const option = document.createElement("option");
    option.value = choice.identifier;
    option.textContent = choice.text;
    select.append(option);
  }
  select.addEventListener("change", () => update(select.value));
  return select;
}

function choicesOrFallback(interaction: QtiInteraction) {
  if (interaction.choices.length > 0) return interaction.choices;
  return [
    { identifier: "A", text: "A" },
    { identifier: "B", text: "B" },
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

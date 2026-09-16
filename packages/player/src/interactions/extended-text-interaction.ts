import {
  qtiTextResponseString,
  type QtiInteraction,
  type QtiValue,
} from "@longsightgroup/qti3-core";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { renderTextResponse } from "./text-interaction.js";
import { renderExtendedTextXhtmlResponse } from "./extended-text-xhtml.js";

export function renderExtendedTextResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const render = (
    value: QtiValue,
    emit: (value: QtiValue) => void,
    prompt = interaction.prompt,
  ) => {
    const rowInteraction = { ...interaction, prompt };
    return interaction.attributes.format === "xhtml"
      ? renderExtendedTextXhtmlResponse(rowInteraction, emit, value, messages)
      : renderTextResponse(rowInteraction, emit, "extended", value, messages);
  };
  if (
    interaction.responseCardinality !== "multiple" &&
    interaction.responseCardinality !== "ordered"
  ) {
    return render(currentValue, update);
  }
  const group = document.createElement("div");
  group.className = "qti3-text-collection";
  const rows = document.createElement("div");
  const values = Array.isArray(currentValue) ? currentValue.map(qtiTextResponseString) : [];
  const maximum = Number(interaction.attributes["max-strings"] ?? 0);
  const initialCount = Math.min(
    maximum,
    Math.max(1, Number(interaction.attributes["min-strings"] ?? 0)),
  );
  while (values.length < initialCount) values.push("");
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = messages.message("addTextResponse");
  const emit = () => update(values.filter((value) => value !== ""));
  const refresh = (focusIndex?: number) => {
    rows.replaceChildren();
    values.forEach((value, index) => {
      const label = messages.message("textResponsePosition", {
        label: interaction.prompt ?? messages.message("extendedTextResponseLabel"),
        index: index + 1,
      });
      const row = render(
        value,
        (next) => {
          values[index] = qtiTextResponseString(next);
          emit();
        },
        label,
      );
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = messages.message("removePair", { label });
      remove.addEventListener("click", () => {
        values.splice(index, 1);
        refresh(Math.min(index, values.length - 1));
        emit();
        if (values.length === 0) add.focus();
      });
      row.append(remove);
      rows.append(row);
    });
    add.disabled = values.length >= maximum;
    add.dataset.responseDisabled = String(add.disabled);
    if (focusIndex !== undefined && focusIndex >= 0) {
      rows.children[focusIndex]?.querySelector<HTMLElement>('textarea, [role="textbox"]')?.focus();
    }
  };
  add.addEventListener("click", () => {
    if (values.length >= maximum) return;
    values.push("");
    refresh(values.length - 1);
  });
  group.append(rows, add);
  refresh();
  return group;
}

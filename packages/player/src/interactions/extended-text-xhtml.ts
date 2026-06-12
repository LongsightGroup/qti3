import type { QtiInteraction, QtiValue } from "@longsightgroup/qti3-core";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import {
  appendExtendedTextResponseChildren,
  applyExtendedTextRows,
  createExtendedTextCounter,
  expectedExtendedTextRows,
  extendedTextAriaLabel,
  extendedTextCounterState,
  syncExtendedTextCounter,
} from "./extended-text-shared.js";
import {
  richTextLiveDomNeedsNormalization,
  sanitizeRichTextXhtml,
} from "./extended-text-xhtml-sanitize.js";
import {
  renderRichTextToolbar,
  syncRichTextToolbarButtonStates,
  type RichTextToolbarButton,
} from "./extended-text-xhtml-toolbar.js";
import { scalarString } from "./text-value.js";

// Browser formatting adapter: execCommand output varies by engine; responses are always normalized.
function runRichTextCommand(command: string, value?: string): void {
  if (value === undefined) {
    document.execCommand(command);
    return;
  }
  document.execCommand(command, false, value);
}

export function renderExtendedTextXhtmlResponse(
  interaction: QtiInteraction,
  update: (value: QtiValue) => void,
  currentValue: QtiValue,
  messages: PlayerMessageResolver,
): HTMLElement {
  const regions = createQtiInteractionRegionMarkers(interaction);
  const group = document.createElement("div");
  group.className = "qti3-text-response qti3-rich-text-response";

  const editor = document.createElement("div");
  editor.className = "qti3-rich-text-editor";
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-multiline", "true");
  editor.setAttribute("aria-label", extendedTextAriaLabel(interaction, messages));
  regions.control(editor);
  editor.innerHTML = sanitizeRichTextXhtml(scalarString(currentValue));

  const rows = expectedExtendedTextRows(interaction);
  if (rows !== undefined) applyExtendedTextRows(editor, rows);

  const counterState = extendedTextCounterState(interaction);
  const counter = createExtendedTextCounter(counterState);

  const toolbarState: { buttons: RichTextToolbarButton[] } = { buttons: [] };

  const sync = (emitResponse = true, forceDomNormalize = false) => {
    const sanitized = sanitizeRichTextXhtml(editor.innerHTML);
    if (forceDomNormalize || richTextLiveDomNeedsNormalization(editor)) {
      if (editor.innerHTML !== sanitized) editor.innerHTML = sanitized;
    }
    syncExtendedTextCounter(counter, counterState, (editor.textContent ?? "").length, messages);
    syncRichTextToolbarButtonStates(toolbarState.buttons);
    if (emitResponse) update(sanitized);
  };

  const { toolbar, buttons } = renderRichTextToolbar({
    editor,
    messages,
    runCommand: runRichTextCommand,
    sync: () => sync(),
  });
  toolbarState.buttons = buttons;

  editor.addEventListener("input", () => sync());
  editor.addEventListener("change", () => sync());
  editor.addEventListener("blur", () => sync(true, true));
  editor.addEventListener("keyup", () => sync(false));
  editor.addEventListener("mouseup", () => sync(false));
  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard?.getData("text/html");
    if (html) {
      runRichTextCommand("insertHTML", sanitizeRichTextXhtml(html));
    } else {
      runRichTextCommand("insertText", clipboard?.getData("text/plain") ?? "");
    }
    sync(true, true);
  });
  sync(false);

  appendExtendedTextResponseChildren(group, {
    control: editor,
    counter,
    counterPosition: counterState?.position,
  });
  group.insertBefore(toolbar, editor);
  return group;
}

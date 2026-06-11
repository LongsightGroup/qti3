import type { PlayerMessageKey } from "../player-message-manifest.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import {
  createRichTextToolbarIcon,
  type RichTextToolbarIconId,
} from "./extended-text-xhtml-icons.js";

const richTextToggleCommands = new Set([
  "bold",
  "italic",
  "underline",
  "insertUnorderedList",
  "insertOrderedList",
]);

export type RichTextToolbarButton = {
  button: HTMLButtonElement;
  command: string;
};

type RichTextToolbarCommand = {
  command: string;
  icon: RichTextToolbarIconId;
  messageKey: PlayerMessageKey;
};

type RichTextToolbarCommandGroup = {
  groupMessageKey: PlayerMessageKey;
  commands: RichTextToolbarCommand[];
};

const richTextToolbarCommandGroups: RichTextToolbarCommandGroup[] = [
  {
    groupMessageKey: "richTextToolbarFormattingGroup",
    commands: [
      { command: "bold", icon: "bold", messageKey: "richTextBold" },
      { command: "italic", icon: "italic", messageKey: "richTextItalic" },
      { command: "underline", icon: "underline", messageKey: "richTextUnderline" },
    ],
  },
  {
    groupMessageKey: "richTextToolbarListsGroup",
    commands: [
      {
        command: "insertUnorderedList",
        icon: "bulletList",
        messageKey: "richTextBulletedList",
      },
      {
        command: "insertOrderedList",
        icon: "numberedList",
        messageKey: "richTextNumberedList",
      },
    ],
  },
  {
    groupMessageKey: "richTextToolbarHistoryGroup",
    commands: [
      { command: "undo", icon: "undo", messageKey: "richTextUndo" },
      { command: "redo", icon: "redo", messageKey: "richTextRedo" },
    ],
  },
];

function createRichTextToolbarButton(
  command: string,
  label: string,
  icon: RichTextToolbarIconId,
): RichTextToolbarButton {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "qti3-rich-text-toolbar-button";
  button.setAttribute("aria-label", label);
  button.append(createRichTextToolbarIcon(icon));
  if (richTextToggleCommands.has(command)) {
    button.setAttribute("aria-pressed", "false");
  }
  return { button, command };
}

export function renderRichTextToolbar(options: {
  editor: HTMLElement;
  messages: PlayerMessageResolver;
  runCommand: (command: string) => void;
  sync: () => void;
}): { toolbar: HTMLElement; buttons: RichTextToolbarButton[] } {
  const { editor, messages, runCommand, sync } = options;
  const toolbar = document.createElement("div");
  toolbar.className = "qti3-rich-text-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", messages.message("richTextToolbarLabel"));

  const buttons: RichTextToolbarButton[] = [];
  const focusableButtons: HTMLButtonElement[] = [];

  for (const { groupMessageKey, commands } of richTextToolbarCommandGroups) {
    const groupElement = document.createElement("div");
    groupElement.className = "qti3-rich-text-toolbar-group";
    groupElement.setAttribute("role", "group");
    groupElement.setAttribute("aria-label", messages.message(groupMessageKey));

    for (const { command, icon, messageKey } of commands) {
      const entry = createRichTextToolbarButton(command, messages.message(messageKey), icon);
      entry.button.addEventListener("mousedown", (event) => event.preventDefault());
      entry.button.addEventListener("click", () => {
        editor.focus();
        runCommand(command);
        sync();
      });
      groupElement.append(entry.button);
      buttons.push(entry);
      focusableButtons.push(entry.button);
    }

    toolbar.append(groupElement);
  }

  wireRichTextToolbarRovingFocus(focusableButtons);

  return { toolbar, buttons };
}

export function syncRichTextToolbarButtonStates(buttons: RichTextToolbarButton[]): void {
  for (const { button, command } of buttons) {
    if (!richTextToggleCommands.has(command)) continue;
    button.setAttribute("aria-pressed", document.queryCommandState(command) ? "true" : "false");
  }
}

function wireRichTextToolbarRovingFocus(buttons: HTMLButtonElement[]): void {
  const activate = (index: number): void => {
    for (const [position, button] of buttons.entries()) {
      button.tabIndex = position === index ? 0 : -1;
    }
    buttons[index]?.focus();
  };

  for (const [index, button] of buttons.entries()) {
    button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener("keydown", (event) => {
      if (buttons.length === 0) return;
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (index + 1) % buttons.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (index - 1 + buttons.length) % buttons.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = buttons.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      activate(next);
    });
  }
}

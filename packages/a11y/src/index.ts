import { interactionSupport, type QtiInteractionType } from "@longsightgroup/qti3-core";

export interface InteractionA11yContract {
  interactionType: QtiInteractionType;
  keyboardRequired: boolean;
  requiresAccessibleName: boolean;
  requiresValidationMessageAssociation: boolean;
  primaryRole: string;
  focusStrategy: string;
  keyboardModel: string[];
  requiredStates: string[];
}

export interface ManualAssistiveTechnologyScript {
  assistiveTechnology: "VoiceOver" | "NVDA" | "JAWS";
  platform: string;
  browser: string;
  appliesTo: QtiInteractionType[];
  setup: string[];
  procedure: string[];
  expectedResults: string[];
}

export interface AccessibilityProofEntry {
  interactionType: QtiInteractionType;
  primaryRole: string;
  keyboardRequired: boolean;
  keyboardModel: string[];
  proof: {
    automated: string[];
    manual: string[];
  };
}

export const a11yContracts: InteractionA11yContract[] = interactionSupport.map((support) =>
  contractForInteraction(support.interactionType as QtiInteractionType),
);

export const accessibilityProofMatrix: AccessibilityProofEntry[] = a11yContracts.map(
  (contract) => ({
    interactionType: contract.interactionType,
    primaryRole: contract.primaryRole,
    keyboardRequired: contract.keyboardRequired,
    keyboardModel: contract.keyboardModel,
    proof: {
      automated: automatedProofFor(contract),
      manual: manualProofFor(contract),
    },
  }),
);

export const manualAssistiveTechnologyScripts: ManualAssistiveTechnologyScript[] = [
  {
    assistiveTechnology: "VoiceOver",
    platform: "macOS",
    browser: "Safari or Chromium",
    appliesTo: targetInteractions(),
    setup: [
      "Start the manual harness with pnpm dev.",
      "Open the harness in the browser and enable VoiceOver.",
      "Load each reference fixture from the fixture selector.",
    ],
    procedure: [
      "Navigate from the item body into the interaction with standard VoiceOver navigation.",
      "Confirm the prompt, role, current value or selection state, and validation message are announced.",
      "Complete the response using keyboard-only commands.",
      "Score the item and navigate to any feedback or updated state.",
    ],
    expectedResults: [
      "Every interaction has a meaningful accessible name and role.",
      "Keyboard operation reaches and completes the interaction without pointer input.",
      "Validation messages are announced through the control description when present.",
      "Focus order follows the visual and DOM order of the item.",
    ],
  },
  {
    assistiveTechnology: "NVDA",
    platform: "Windows",
    browser: "Firefox or Chromium",
    appliesTo: targetInteractions(),
    setup: [
      "Start the manual harness with pnpm dev on the test machine or open it from a reachable host.",
      "Open the harness in the browser and enable NVDA browse mode.",
      "Load each reference fixture from the fixture selector.",
    ],
    procedure: [
      "Use heading, form-field, and Tab navigation to enter the interaction.",
      "Confirm NVDA announces the role, name, value, selected state, and invalid state where applicable.",
      "Switch modes only when NVDA or the browser requires it for native controls.",
      "Complete the response, score the item, and verify feedback or validation announcements.",
    ],
    expectedResults: [
      "Native controls expose expected roles through the accessibility tree.",
      "Composite interactions expose each operable part in deterministic order.",
      "Selected, pressed, invalid, and described states are announced when applicable.",
      "No fixture requires pointer-only operation.",
    ],
  },
  {
    assistiveTechnology: "JAWS",
    platform: "Windows",
    browser: "Chromium",
    appliesTo: targetInteractions(),
    setup: [
      "Start the manual harness with pnpm dev on the test machine or open it from a reachable host.",
      "Open the harness in Chromium and enable JAWS.",
      "Load each reference fixture from the fixture selector.",
    ],
    procedure: [
      "Use virtual cursor and Tab navigation to reach the interaction.",
      "Read the prompt, control role, current value, validation message, and feedback region.",
      "Complete the response with keyboard-only commands.",
      "Score the item and verify the attempt state can be reviewed without losing focus context.",
    ],
    expectedResults: [
      "JAWS announces a stable role and name for every operable control.",
      "Validation and feedback are reachable after scoring.",
      "Graphic, point, and drawing fixtures expose keyboard-operable controls; PCI fixtures expose a focusable host for a keyboard-operable runtime.",
      "The item can be completed without hidden instructions or product-specific UI.",
    ],
  },
];

function contractForInteraction(interactionType: QtiInteractionType): InteractionA11yContract {
  const base = {
    interactionType,
    keyboardRequired: interactionType !== "media",
    requiresAccessibleName: true,
    requiresValidationMessageAssociation: true,
    primaryRole: "group",
    focusStrategy: "Focus enters the interaction group and then each native control in DOM order.",
    keyboardModel: [
      "Tab moves through controls.",
      "Enter or Space commits native control changes.",
    ],
    requiredStates: ["aria-invalid", "aria-describedby"],
  };

  if (interactionType === "choice" || interactionType === "hottext") {
    return {
      ...base,
      primaryRole: "radiogroup or group",
      keyboardModel: [
        "Tab moves into each radio or checkbox.",
        "Space toggles the focused option.",
        "Shared-vocabulary hidden input-control presentation keeps controls keyboard focusable and projects focus indication onto the visible option.",
      ],
      requiredStates: ["checked", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "order") {
    return {
      ...base,
      primaryRole: "group",
      keyboardModel: [
        "Default order layout: Tab moves through each item handle and its move buttons.",
        "Default order layout: Arrow Up, Arrow Down, Arrow Left, or Arrow Right reorders the focused item handle.",
        "Shared-vocabulary split layout: Tab moves through choices-bank buttons, placed item handles, move buttons, and remove buttons.",
        "Shared-vocabulary split layout: Enter or Space on a choices-bank button adds the choice to the next available order target.",
        "Shared-vocabulary split layout: Remove buttons return placed choices to the choices bank.",
        "Shared-vocabulary split layout: empty target slots expose target label and empty state text for assistive technology.",
        "Arrow icon buttons provide an explicit move-button fallback in both layouts.",
        "Adjacent moves are announced directionally in a polite live region; larger jumps announce the new position.",
      ],
      requiredStates: [
        "position in accessible name",
        "reorder announcement",
        "disabled",
        "aria-invalid",
        "aria-describedby",
      ],
    };
  }

  if (interactionType === "graphicOrder") {
    return {
      ...base,
      primaryRole: "group",
      focusStrategy:
        "Focus moves through graphic hotspot buttons and ordered-list controls; the selection summary is a live region, not a tab stop.",
      keyboardModel: [
        "Tab moves through hotspot buttons, ordered-list controls, and remove buttons.",
        "On hotspot buttons, Enter or Space adds the region to the sequence.",
        "On hotspot buttons, Arrow Up, Arrow Down, Arrow Left, or Arrow Right moves focus between hotspots.",
        "On hotspot buttons, Delete or Backspace removes the region from the sequence.",
        "On ordered-list controls, Arrow Up, Arrow Down, Arrow Left, or Arrow Right reorders the focused region.",
        "On ordered-list controls, Delete or Backspace removes the region from the sequence.",
        "Arrow icon buttons provide an explicit move-button fallback.",
        "Selection count and reordering are announced in a polite live region.",
      ],
      requiredStates: [
        "aria-pressed on hotspots",
        "position in accessible name",
        "selection summary",
        "disabled",
        "aria-invalid",
        "aria-describedby",
      ],
    };
  }

  if (interactionType === "match") {
    return {
      ...base,
      primaryRole: "group or table",
      keyboardModel: [
        "Token-bank layout: Tab moves through source tokens, target tokens, selected pair chips, and remove controls.",
        "Token-bank layout: Enter or Space selects one source token and one target token to create a pair.",
        "Tabular layout: Tab moves through matrix cell buttons in row-major order.",
        "Tabular layout: Enter or Space toggles the focused source-target cell.",
        "Remove buttons delete selected pairs.",
        "Pointer drag from a source token to a target token is a progressive enhancement in token-bank layout.",
      ],
      requiredStates: ["aria-pressed", "selected pair text", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "associate" || interactionType === "graphicAssociate") {
    return {
      ...base,
      primaryRole: "group",
      keyboardModel: [
        "Tab moves through source tokens, target tokens, selected pair chips, and remove controls.",
        "Enter or Space selects one source token and one target token to create a pair.",
        "Remove buttons delete selected pairs.",
        "Pointer drag from a source token to a target token is a progressive enhancement.",
      ],
      requiredStates: ["aria-pressed", "selected pair text", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "gapMatch" || interactionType === "graphicGapMatch") {
    return {
      ...base,
      primaryRole: "group",
      focusStrategy:
        "Focus moves through source tokens, target-gap buttons, and remove controls in DOM order.",
      keyboardModel: [
        "Enter or Space selects a source token.",
        "Enter or Space on a target gap assigns the selected source.",
        "Remove buttons clear assigned gaps.",
        "Pointer drag from a source token to a target gap is a progressive enhancement.",
      ],
      requiredStates: [
        "aria-pressed",
        "assigned source in accessible name",
        "aria-invalid",
        "aria-describedby",
      ],
    };
  }

  if (interactionType === "inlineChoice") {
    return {
      ...base,
      primaryRole: "combobox",
      focusStrategy: "Focus lands directly on the inline choice control.",
      keyboardModel: ["Native select commands choose an inline option."],
      requiredStates: ["value", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "textEntry" || interactionType === "extendedText") {
    return {
      ...base,
      primaryRole: "textbox",
      focusStrategy: "Focus lands directly on the text entry field.",
      keyboardModel: ["Typing edits the response.", "Tab leaves the field."],
      requiredStates: ["value", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "hotspot") {
    return {
      ...base,
      primaryRole: "group",
      focusStrategy: "Focus moves through positioned hotspot buttons over the object image.",
      keyboardModel: [
        "Tab moves through hotspot buttons.",
        "Enter or Space selects the focused hotspot.",
      ],
      requiredStates: ["aria-pressed", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "selectPoint") {
    return {
      ...base,
      primaryRole: "button",
      focusStrategy: "Focus lands on the coordinate surface.",
      keyboardModel: [
        "Arrow keys move the selected coordinate by one unit.",
        "Shift plus arrow keys move by ten units.",
        "Enter or Space commits the selected coordinate.",
      ],
      requiredStates: [
        "selected coordinate in accessible name",
        "aria-invalid",
        "aria-describedby",
      ],
    };
  }

  if (interactionType === "positionObject") {
    return {
      ...base,
      primaryRole: "button",
      focusStrategy: "Focus lands on the placement stage and movable object controls.",
      keyboardModel: [
        "Unanswered objects start unplaced outside the stage.",
        "Arrow keys place or move the selected object by one unit.",
        "Shift plus arrow keys move by ten units.",
        "Enter or Space commits the selected coordinate.",
      ],
      requiredStates: [
        "unplaced state or selected coordinate in accessible name",
        "aria-invalid",
        "aria-describedby",
      ],
    };
  }

  if (interactionType === "slider") {
    return {
      ...base,
      primaryRole: "slider",
      focusStrategy: "Focus lands directly on the range input.",
      keyboardModel: ["Native range input keys change the value."],
      requiredStates: ["value", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "drawing") {
    return {
      ...base,
      primaryRole: "img",
      focusStrategy:
        "Focus lands on the drawing surface and then on auxiliary commands; the live canvas renders as a light surface independent of page color scheme.",
      keyboardModel: [
        "Pointer input draws freehand strokes.",
        "A native pen color input selects the active stroke color.",
        "Enter or Space creates a deterministic keyboard stroke.",
        "Clear drawing removes all strokes.",
        "The live drawing surface uses a light canvas so strokes stay visible when the page is in dark mode.",
      ],
      requiredStates: [
        "accessible name",
        "light canvas rendering",
        "pen color input",
        "aria-invalid",
        "aria-describedby",
      ],
    };
  }

  if (interactionType === "upload") {
    return {
      ...base,
      primaryRole: "button",
      focusStrategy: "Focus lands on the native file input.",
      keyboardModel: ["Native file input commands choose a file."],
      requiredStates: ["selected file name", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "media") {
    return {
      ...base,
      keyboardRequired: false,
      primaryRole: "audio, video, image, or link",
      focusStrategy: "Focus follows native media controls when the media type exposes them.",
      keyboardModel: ["Native media controls provide their platform keyboard behavior."],
      requiredStates: ["accessible name"],
    };
  }

  if (interactionType === "endAttempt") {
    return {
      ...base,
      primaryRole: "button",
      focusStrategy: "Focus lands on the end-attempt button.",
      keyboardModel: ["Enter or Space activates the button."],
      requiredStates: ["accessible name"],
    };
  }

  if (interactionType === "portableCustom") {
    return {
      ...base,
      primaryRole: "group",
      focusStrategy:
        "Focus enters the portable custom host; the host-provided PCI runtime owns focus routing for internal response controls.",
      keyboardModel: [
        "The qti3-ts player exposes a focusable portable custom host and mount event.",
        "The host-provided PCI runtime must expose keyboard-operable response controls.",
        "The PCI runtime must expose accessible names, roles, values, and selected or invalid states for its rendered controls.",
        "Response, validity, and suspend/resume state changes are reported through the portable custom interaction event contract.",
      ],
      requiredStates: [
        "host metadata",
        "host accessible name",
        "runtime accessible name, role, and state",
        "runtime validation bridge",
      ],
    };
  }

  return {
    ...base,
    primaryRole: "unsupported",
    focusStrategy: "Deprecated custom interaction is parsed for diagnostics but not rendered.",
    keyboardRequired: false,
    keyboardModel: ["No runtime keyboard contract is provided for deprecated custom interaction."],
    requiredStates: ["deprecated diagnostic"],
  };
}

function targetInteractions(): QtiInteractionType[] {
  return interactionSupport.map((support) => support.interactionType as QtiInteractionType);
}

function automatedProofFor(contract: InteractionA11yContract): string[] {
  const proof = [
    "accessibility contract unit coverage in @longsightgroup/qti3-a11y",
    "manual harness reference fixture renders without axe-core violations",
    "operable fixture controls expose accessible names in Playwright",
    "operable fixture controls use standard tab order in Playwright",
    "response serialization and fixture scoring coverage",
  ];
  if (contract.requiresValidationMessageAssociation) {
    proof.push("validation message association contract");
  }
  if (contract.interactionType === "graphicGapMatch") {
    proof.push(
      "image-backed gap choice keyboard, pointer, forced-colors, and narrow reflow browser coverage",
    );
  }
  proof.push("forced-colors, reduced-motion, and narrow viewport browser checks");
  return proof;
}

function manualProofFor(contract: InteractionA11yContract): string[] {
  const proof = [
    "VoiceOver manual script",
    "NVDA manual script",
    "JAWS manual script",
    "focus order inspection",
    "accessible name, role, state, and value announcement inspection",
  ];
  if (contract.keyboardRequired) proof.push("keyboard-only completion without pointer input");
  return proof;
}

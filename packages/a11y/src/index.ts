import { interactionSupport, type QtiInteractionType } from "@qti3/core";

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

export const a11yContracts: InteractionA11yContract[] = interactionSupport.map((support) =>
  contractForInteraction(support.interactionType as QtiInteractionType),
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
      "Navigate from the item heading into the interaction with standard VoiceOver navigation.",
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
      "Graphic, point, drawing, and custom-host fixtures expose a keyboard-operable fallback or control.",
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
      ],
      requiredStates: ["checked", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "order" || interactionType === "graphicOrder") {
    return {
      ...base,
      primaryRole: "group",
      keyboardModel: [
        "Tab moves through ordered position controls.",
        "Arrow keys or native select commands choose each ordered option.",
      ],
      requiredStates: ["value", "aria-invalid", "aria-describedby"],
    };
  }

  if (
    interactionType === "associate" ||
    interactionType === "graphicAssociate" ||
    interactionType === "match"
  ) {
    return {
      ...base,
      primaryRole: "group",
      keyboardModel: [
        "Tab moves through source and target controls.",
        "Native select commands choose the source and target pair.",
      ],
      requiredStates: ["value", "aria-invalid", "aria-describedby"],
    };
  }

  if (interactionType === "gapMatch" || interactionType === "graphicGapMatch") {
    return {
      ...base,
      primaryRole: "group",
      focusStrategy: "Focus moves through one labeled target-gap control per gap.",
      keyboardModel: [
        "Tab moves through target-gap controls.",
        "Native select commands choose the source for each target gap.",
      ],
      requiredStates: ["value", "aria-invalid", "aria-describedby"],
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

  if (interactionType === "selectPoint" || interactionType === "positionObject") {
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
      focusStrategy: "Focus lands on the drawing surface and then on auxiliary commands.",
      keyboardModel: [
        "Pointer input draws a stroke.",
        "Enter creates a deterministic keyboard stroke.",
        "Clear button removes the stroke.",
      ],
      requiredStates: ["accessible name", "aria-invalid", "aria-describedby"],
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
      focusStrategy: "Focus enters the portable custom host and its fallback control.",
      keyboardModel: [
        "The host integration must expose a keyboard-operable response control.",
        "The fallback text input accepts a response when no integration has rendered.",
      ],
      requiredStates: ["host metadata", "aria-invalid", "aria-describedby"],
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

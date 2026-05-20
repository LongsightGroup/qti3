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

export const a11yContracts: InteractionA11yContract[] = interactionSupport.map((support) =>
  contractForInteraction(support.interactionType as QtiInteractionType),
);

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

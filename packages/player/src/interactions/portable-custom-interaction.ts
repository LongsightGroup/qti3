import type {
  QtiContentNode,
  QtiDiagnostic,
  QtiInteraction,
  QtiPortableCustomDefinition,
  QtiPortableCustomStateValue,
  QtiValue,
} from "@longsightgroup/qti3-core";
import { createQtiInteractionRegionMarkers } from "../player/interaction-regions.js";
import type { QtiPortableCustomMountEventDetail } from "../player-types.js";
import {
  portableCustomDefinitionFromAttributes,
  portableCustomEventState,
  portableCustomEventValidity,
  portableCustomEventValue,
  scalarString,
} from "../portable-custom-support.js";

export interface PortableCustomResponseContext {
  interaction: QtiInteraction;
  update: (value: QtiValue) => void;
  currentValue: QtiValue;
  currentState?: QtiPortableCustomStateValue | undefined;
  renderMarkup: (nodes: QtiContentNode[]) => Node[];
  setInteractionState: (responseIdentifier: string, state: QtiPortableCustomStateValue) => void;
  setValidity: (responseIdentifier: string, valid: boolean, message?: string) => void;
  emitStateChange: () => void;
  onMount: (detail: QtiPortableCustomMountEventDetail) => void;
}

export function portableCustomValidityDiagnostic(
  responseIdentifier: string,
  valid: boolean,
  message: string | undefined,
): QtiDiagnostic | undefined {
  if (valid) return undefined;
  return {
    code: "response.portableCustom.validity",
    severity: "error",
    message: message?.trim() || `${responseIdentifier} is not valid.`,
    path: responseIdentifier,
  };
}

export function renderPortableCustomResponse(context: PortableCustomResponseContext): HTMLElement {
  const { interaction, update, currentValue } = context;
  const definition =
    interaction.portableCustom ?? portableCustomDefinitionFromAttributes(interaction);
  const responseIdentifier = interaction.responseIdentifier ?? definition.responseIdentifier ?? "";
  const currentState = context.currentState;

  const group = document.createElement("div");
  group.role = "group";
  group.setAttribute("aria-label", interaction.prompt ?? "Portable custom interaction");

  const host = createPortableCustomHost(interaction, definition, responseIdentifier, currentState);
  if (definition.interactionMarkup.length > 0) {
    const markup = document.createElement("div");
    markup.className = "qti3-portable-custom-markup";
    markup.append(...context.renderMarkup(definition.interactionMarkup));
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
    if (state !== undefined && responseIdentifier) {
      context.setInteractionState(responseIdentifier, state);
      host.dataset.state = JSON.stringify(state);
    }
    if (value !== undefined) {
      fallback.value = scalarString(value ?? null);
      update(value);
    }
    if (validity && responseIdentifier) {
      context.setValidity(responseIdentifier, validity.valid, validity.message);
      context.emitStateChange();
    }
    if (value === undefined && state !== undefined && !validity) context.emitStateChange();
  };

  for (const eventName of [
    "qti3-portable-custom-response",
    "qti3-pci-response",
    "qti3-portable-custom-state",
    "qti3-portable-custom-validity",
  ] as const) {
    host.addEventListener(eventName, handlePortableCustomEvent);
  }

  queueMicrotask(() => {
    context.onMount({
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

function createPortableCustomHost(
  interaction: QtiInteraction,
  definition: QtiPortableCustomDefinition,
  responseIdentifier: string,
  currentState: QtiPortableCustomStateValue | undefined,
): HTMLElement {
  const regions = createQtiInteractionRegionMarkers(interaction, { responseIdentifier });
  const host = document.createElement("div");
  host.className = "qti3-portable-custom-host";
  host.tabIndex = 0;
  host.dataset.responseIdentifier = responseIdentifier;
  regions.control(host);
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
  return host;
}

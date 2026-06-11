import type { QtiChoice } from "@longsightgroup/qti3-core";
import { removeButton } from "../controls/remove-button.js";
import type { PlayerMessageResolver } from "../player-message-resolver.js";
import { choiceVisualNodes, hasRichChoiceContent } from "./shared.js";

export interface AssociationPairEndpoint {
  choice: QtiChoice | undefined;
  label: string;
}

export interface AssociationPairChipOptions {
  source: AssociationPairEndpoint;
  target: AssociationPairEndpoint;
  messages: PlayerMessageResolver;
  onRemove: () => void;
}

export function createAssociationPairChip(options: AssociationPairChipOptions): HTMLLIElement {
  const { source, target, messages, onRemove } = options;
  const label = messages.message("associationPairLabel", {
    source: source.label,
    target: target.label,
  });
  const item = document.createElement("li");
  item.className = "qti3-pair-chip";
  const text = document.createElement("span");
  appendAssociationPairLabelVisual(text, source, target);
  const remove = removeButton(label, messages);
  remove.addEventListener("click", onRemove);
  item.append(text, remove);
  return item;
}

function appendAssociationPairLabelVisual(
  parent: HTMLElement,
  source: AssociationPairEndpoint,
  target: AssociationPairEndpoint,
): void {
  parent.className = "qti3-pair-chip-label";
  appendPairChoiceVisual(parent, source);
  parent.append(document.createTextNode(" to "));
  appendPairChoiceVisual(parent, target);
}

function appendPairChoiceVisual(parent: HTMLElement, endpoint: AssociationPairEndpoint): void {
  if (endpoint.choice && (hasRichChoiceContent(endpoint.choice) || endpoint.choice.asset?.data)) {
    parent.append(
      ...choiceVisualNodes(endpoint.choice).filter(
        (node) => node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim()),
      ),
    );
    return;
  }
  parent.append(document.createTextNode(endpoint.label));
}

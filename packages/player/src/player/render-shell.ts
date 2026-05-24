import type { QtiDocument, QtiInteraction } from "@longsightgroup/qti3-core";
import { renderContentNodes, type PlayerContentContext } from "../content/content-renderer.js";
import { playerStyleElement } from "../player-styles.js";

export function renderPlayerShell(options: {
  documentModel: QtiDocument;
  contentContext: PlayerContentContext;
  renderStandaloneInteraction: (interaction: QtiInteraction) => HTMLElement;
}): HTMLElement {
  const { documentModel, contentContext, renderStandaloneInteraction } = options;
  const root = document.createElement("article");
  root.className = "qti3-player";
  if (documentModel.item.language) {
    root.lang = documentModel.item.language;
    root.setAttribute("xml:lang", documentModel.item.language);
  }
  root.append(playerStyleElement());

  if (documentModel.item.prompt && documentModel.item.body.length === 0) {
    const prompt = document.createElement("p");
    prompt.className = "qti3-item-prompt";
    prompt.textContent = documentModel.item.prompt;
    root.append(prompt);
  }

  if (documentModel.item.body.length > 0) {
    const body = document.createElement("div");
    body.className = "qti3-item-body";
    body.append(...renderContentNodes(documentModel.item.body, contentContext));
    root.append(body);
  } else {
    for (const interaction of documentModel.item.interactions) {
      root.append(renderStandaloneInteraction(interaction));
    }
  }

  const feedback = document.createElement("section");
  feedback.className = "qti3-feedback";
  feedback.role = "status";
  feedback.setAttribute("aria-live", "polite");
  feedback.hidden = true;
  root.append(feedback);
  return root;
}

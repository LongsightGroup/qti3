export function syncAttemptAvailability(
  root: ParentNode,
  options: { completed: boolean; status: string; host?: HTMLElement },
): void {
  if (options.host) {
    options.host.dataset.status = options.status;
  }

  const article = root.querySelector<HTMLElement>(".qti3-player");
  if (article) article.dataset.status = options.status;

  for (const control of root.querySelectorAll<
    HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(
    ".qti3-interaction button, .qti3-interaction input, .qti3-interaction select, .qti3-interaction textarea",
  )) {
    control.disabled = options.completed;
  }

  for (const element of root.querySelectorAll<HTMLElement>(
    ".qti3-interaction [tabindex]:not(button):not(input):not(select):not(textarea)",
  )) {
    if (options.completed) {
      element.dataset.previousTabIndex = element.getAttribute("tabindex") ?? "0";
      element.tabIndex = -1;
      element.setAttribute("aria-disabled", "true");
    } else {
      const previous = element.dataset.previousTabIndex;
      if (previous !== undefined) {
        element.tabIndex = Number(previous);
        delete element.dataset.previousTabIndex;
      }
      element.removeAttribute("aria-disabled");
    }
  }
}

/** Connect the manual's inspection panels with automatic keyboard tab activation. */
export function initializeInspectionTabs(): void {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.inspector [role="tab"]')];
  function activate(selected: HTMLButtonElement): void {
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !active;
    }
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      let next: number;
      switch (event.key) {
        case "ArrowRight":
          next = (index + 1) % tabs.length;
          break;
        case "ArrowLeft":
          next = (index + tabs.length - 1) % tabs.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = tabs.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      const target = tabs[next];
      if (target) {
        activate(target);
        target.focus();
      }
    });
  }
}

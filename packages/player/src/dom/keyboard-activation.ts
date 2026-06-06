export function isKeyboardActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

export function handleKeyboardActivation(event: Event, onActivate: () => void): boolean {
  if (!("key" in event) || typeof event.key !== "string") return false;
  if (!isKeyboardActivationKey(event.key)) return false;
  event.preventDefault();
  onActivate();
  return true;
}

export function bindActivateOnEnterOrSpace(element: EventTarget, onActivate: () => void): void {
  element.addEventListener("keydown", (event) => {
    handleKeyboardActivation(event, onActivate);
  });
}

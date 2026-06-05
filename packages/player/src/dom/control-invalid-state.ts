export const CONTROL_PATTERN_MASK_INVALID = "qtiPatternMaskInvalid";
export const CONTROL_VALIDATION_INVALID = "qtiValidationInvalid";

export function syncControlAriaInvalid(control: HTMLElement): void {
  if (
    control.dataset[CONTROL_PATTERN_MASK_INVALID] === "true" ||
    control.dataset[CONTROL_VALIDATION_INVALID] === "true"
  ) {
    control.setAttribute("aria-invalid", "true");
  } else {
    control.removeAttribute("aria-invalid");
  }
}

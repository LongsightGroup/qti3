import { describe, expect, it, vi } from "vitest";
import { handleKeyboardActivation, isKeyboardActivationKey } from "./keyboard-activation.js";

describe("isKeyboardActivationKey", () => {
  it("accepts Enter and Space", () => {
    expect(isKeyboardActivationKey("Enter")).toBe(true);
    expect(isKeyboardActivationKey(" ")).toBe(true);
  });

  it("rejects other keys", () => {
    expect(isKeyboardActivationKey("Tab")).toBe(false);
    expect(isKeyboardActivationKey("Escape")).toBe(false);
  });
});

describe("handleKeyboardActivation", () => {
  it("runs the callback and prevents default for activation keys", () => {
    let activated = false;
    const preventDefault = vi.fn();
    const event = {
      key: "Enter",
      preventDefault,
    } as unknown as KeyboardEvent;

    expect(
      handleKeyboardActivation(event, () => {
        activated = true;
      }),
    ).toBe(true);

    expect(activated).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("ignores non-activation keys", () => {
    let activated = false;
    const preventDefault = vi.fn();
    const event = {
      key: "ArrowDown",
      preventDefault,
    } as unknown as KeyboardEvent;

    expect(
      handleKeyboardActivation(event, () => {
        activated = true;
      }),
    ).toBe(false);

    expect(activated).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

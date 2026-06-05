import { describe, expect, it } from "vitest";
import { reorderMovementDirections, reorderStepDirection } from "./movement.js";

describe("reorder movement directions", () => {
  it("maps vertical orientation to up and down", () => {
    expect(reorderMovementDirections("vertical")).toEqual({ previous: "up", next: "down" });
    expect(reorderStepDirection("vertical", 2, 1)).toBe("up");
    expect(reorderStepDirection("vertical", 1, 2)).toBe("down");
  });

  it("maps horizontal orientation to left and right", () => {
    expect(reorderMovementDirections("horizontal")).toEqual({ previous: "left", next: "right" });
    expect(reorderStepDirection("horizontal", 2, 1)).toBe("left");
    expect(reorderStepDirection("horizontal", 1, 2)).toBe("right");
  });
});

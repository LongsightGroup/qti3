import { describe, expect, it } from "vitest";
import {
  isPortableCustomStateValue,
  portableCustomEventState,
  portableCustomEventValidity,
  portableCustomEventValue,
  scalarString,
} from "./portable-custom-support.js";

describe("portable-custom-support", () => {
  it("stringifies scalar response values only", () => {
    expect(scalarString("A")).toBe("A");
    expect(scalarString(null)).toBe("");
    expect(scalarString(["A"])).toBe("");
  });

  it("parses portable custom response events", () => {
    const responseEvent = new CustomEvent("qti3-portable-custom-response", { detail: { value: "A" } });
    expect(portableCustomEventValue(responseEvent)).toBe("A");

    const stateEvent = new CustomEvent("qti3-portable-custom-state", {
      detail: { state: { count: 2 } },
    });
    expect(portableCustomEventState(stateEvent)).toEqual({ count: 2 });

    const validityEvent = new CustomEvent("qti3-portable-custom-validity", {
      detail: { valid: false, message: "Invalid" },
    });
    expect(portableCustomEventValidity(validityEvent)).toEqual({ valid: false, message: "Invalid" });
  });

  it("validates portable custom state shapes", () => {
    expect(isPortableCustomStateValue({ nested: ["a", 1, true, null] })).toBe(true);
    expect(isPortableCustomStateValue(() => undefined)).toBe(false);
  });
});

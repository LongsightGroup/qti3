import { describe, expect, it } from "vitest";

import { parseXml, serializeNode } from "./xml.js";

describe("migrator XML boundary", () => {
  it("rejects recoverable XML syntax errors instead of using the recovered DOM", () => {
    expect(() => parseXml("<root></root trailing>", "malformed fixture")).toThrow(
      "Failed to parse XML (malformed fixture).",
    );
  });

  it("rejects serialization that would produce malformed XML", () => {
    const document = parseXml("<root/>", "serialization fixture");
    document.documentElement.appendChild(document.createTextNode("\u0001"));

    expect(() => serializeNode(document)).toThrow();
  });
});

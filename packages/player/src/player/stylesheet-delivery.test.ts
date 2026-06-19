import { describe, expect, it } from "vitest";
import { resolvePlayerStylesheets } from "./stylesheet-delivery.js";

describe("player stylesheet delivery", () => {
  it("resolves stylesheet metadata through a host resolver", () => {
    const resolution = resolvePlayerStylesheets(
      [
        {
          href: "../styles/item.css",
          type: "text/css",
          media: "screen",
          title: "Item styles",
          attributes: {},
        },
      ],
      (stylesheet) => ({ href: `https://package.example/${stylesheet.href}` }),
    );

    expect(resolution).toEqual({
      links: [
        {
          href: "https://package.example/../styles/item.css",
          type: "text/css",
          media: "screen",
          title: "Item styles",
        },
      ],
      diagnostics: [],
    });
  });

  it("reports unresolved host stylesheet references only when a resolver is provided", () => {
    expect(resolvePlayerStylesheets([{ href: "style.css", attributes: {} }], undefined)).toEqual({
      links: [],
      diagnostics: [],
    });

    const resolution = resolvePlayerStylesheets(
      [
        {
          href: "style.css",
          attributes: {},
          source: {
            line: 2,
            column: 3,
            offset: 10,
            path: "/qti-assessment-item/qti-stylesheet[1]",
          },
        },
      ],
      () => undefined,
    );

    expect(resolution.links).toEqual([]);
    expect(resolution.diagnostics).toEqual([
      expect.objectContaining({
        code: "player.stylesheet.unresolved",
        severity: "warning",
        path: "/qti-assessment-item/qti-stylesheet[1]",
      }),
    ]);
  });

  it("treats blank resolved stylesheet hrefs as unresolved", () => {
    const resolution = resolvePlayerStylesheets([{ href: "style.css", attributes: {} }], () => ({
      href: "  ",
    }));

    expect(resolution.links).toEqual([]);
    expect(resolution.diagnostics).toEqual([
      expect.objectContaining({
        code: "player.stylesheet.unresolved",
        severity: "warning",
      }),
    ]);
  });
});

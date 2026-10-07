import { expect, it } from "vitest";
import { parseSafeContentProjection } from "../index.js";

it("parses serialized host content with rich markup and host-authorized assets", () => {
  const value: unknown = JSON.parse(
    '[{"kind":"element","name":"section","attributes":{"class":"instructions"},"children":[{"kind":"element","name":"strong","attributes":{},"children":[{"kind":"text","text":"Read the map."}]},{"kind":"element","name":"img","attributes":{"src":"images/map.png","alt":"Reference map"},"children":[]}]}]',
  );
  const result = parseSafeContentProjection(value, () => "/api/content/assets/map?attemptId=A");
  expect(result).toEqual({
    ok: true,
    value: [
      {
        kind: "element",
        name: "section",
        attributes: { class: "instructions" },
        children: [
          {
            kind: "element",
            name: "strong",
            attributes: {},
            children: [{ kind: "text", text: "Read the map." }],
          },
          {
            kind: "element",
            name: "img",
            attributes: { src: "/api/content/assets/map?attemptId=A", alt: "Reference map" },
            children: [],
          },
        ],
      },
    ],
  });
});

it("reapplies the shared sanitizer after transport before host rendering", () => {
  const result = parseSafeContentProjection(
    [
      {
        kind: "element",
        name: "script",
        attributes: {},
        children: [{ kind: "text", text: "unsafeCode()" }],
      },
      {
        kind: "element",
        name: "a",
        attributes: { href: "javascript:unsafeCode()", onclick: "unsafeCode()" },
        children: [{ kind: "text", text: "Read help." }],
      },
      {
        kind: "element",
        name: "img",
        attributes: { src: "map.png", onerror: "unsafeCode()", alt: "Map" },
        children: [],
      },
    ],
    () => "javascript:unsafeCode()",
  );
  expect(result).toEqual({
    ok: true,
    value: [
      {
        kind: "element",
        name: "a",
        attributes: {},
        children: [{ kind: "text", text: "Read help." }],
      },
      { kind: "element", name: "img", attributes: { alt: "Map" }, children: [] },
    ],
  });
});

it.each([
  null,
  {},
  [{ kind: "text", text: 3 }],
  [{ kind: "element", name: "p", attributes: { title: false }, children: [] }],
  [{ kind: "element", name: "p", attributes: {}, children: "Required instructions" }],
  [
    { kind: "text", text: "Valid prefix" },
    { kind: "feedback", text: "Private key" },
  ],
])("rejects malformed serialized trees without returning partial content: %j", (value) => {
  expect(parseSafeContentProjection(value)).toMatchObject({
    ok: false,
    diagnostics: [{ code: "content.projection.invalid", severity: "error" }],
  });
});

it("rejects cycles and oversized trees without stack overflow", () => {
  const cycle: {
    kind: string;
    name: string;
    attributes: Record<string, string>;
    children: unknown[];
  } = {
    kind: "element",
    name: "div",
    attributes: {},
    children: [],
  };
  cycle.children.push(cycle);
  expect(parseSafeContentProjection([cycle])).toMatchObject({ ok: false });
  expect(
    parseSafeContentProjection(Array.from({ length: 10_001 }, () => ({ kind: "text", text: "x" }))),
  ).toMatchObject({ ok: false });
});

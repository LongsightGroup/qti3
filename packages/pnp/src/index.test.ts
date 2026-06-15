import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createDefaultQti3PnpCapabilities,
  normalizeQti3Pnp,
  parseQti3PnpObject,
  parseQti3PnpXml,
  qti3PnpSupportDefinitions,
  qti3PnpSupportNames,
  resolveQti3Pnp,
  validateQti3Pnp,
  type NormalizedQti3PnpProfile,
  type Qti3PnpElementLike,
} from "./index.js";

describe("@longsightgroup/qti3-pnp", () => {
  it("parses and normalizes a single PNP XML root", () => {
    const parsed = parseQti3PnpXml(
      el("access-for-all-pnp", {}, [
        el("text-appearance", {}, [
          el("font-size", {}, [], "18"),
          el("font-color", {}, [], "#112233"),
        ]),
        el("activate-at-initialization-set", {}, [el("glossary-on-screen")]),
      ]),
    );
    const normalized = normalizeQti3Pnp(parsed);

    expect(parsed.ok).toBe(true);
    expect(normalized.ok).toBe(true);
    expect(normalized.profile.preferences).toEqual([
      expect.objectContaining({
        support: "text-appearance",
        mode: "required",
        params: { fontSize: 18, fontColor: "#112233" },
      }),
      expect.objectContaining({
        support: "glossary-on-screen",
        mode: "activate-at-initialization",
        params: {},
      }),
    ]);
  });

  it("parses record-set XML and keeps record identifiers opaque", () => {
    const parsed = parseQti3PnpXml(
      el("access-for-all-pnp-records", {}, [
        el("access-for-all-pnp", { identifier: "student@example.test" }, [
          el("spoken", { "reading-type": "computer-read-aloud" }),
        ]),
      ]),
    );
    const normalized = normalizeQti3Pnp(parsed);

    expect(normalized.profile.records[0]?.identifier).toBe("student@example.test");
    expect(normalized.profile.preferences[0]).toEqual(
      expect.objectContaining({
        support: "spoken",
        params: { readingType: "computer-read-aloud" },
      }),
    );
  });

  it("ignores DOM text nodes and preserves extension prefixes", () => {
    const parsed = parseQti3PnpXml({
      documentElement: domElement("access-for-all-pnp", {}, [
        domText("\n  "),
        domElement("keyword-emphasis"),
        domText("\n  "),
        domElement("longsight-glossary-illustration", { "xmlns:ext": "urn:example" }, [], "ext"),
        domText("\n"),
      ]),
    });
    const normalized = normalizeQti3Pnp(parsed);

    expect(normalized.profile.preferences.map((preference) => preference.support)).toEqual([
      "keyword-emphasis",
      "ext:longsight-glossary-illustration",
    ]);
  });

  it("requires DOMParser or an XML adapter for XML strings", () => {
    const parsed = parseQti3PnpXml("<access-for-all-pnp/>");

    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "PNP_XML_PARSE_ERROR",
    ]);
  });

  it("accepts caller-created object input", () => {
    const parsed = parseQti3PnpObject({
      preferences: [
        {
          support: "calculator-on-screen",
          params: { calculatorType: "scientific" },
        },
      ],
    });
    const normalized = normalizeQti3Pnp(parsed);

    expect(normalized.profile.preferences[0]).toEqual(
      expect.objectContaining({
        support: "calculator-on-screen",
        mode: "required",
        params: { calculatorType: "scientific" },
      }),
    );
  });

  it("validates invalid values and conflicting support states", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(
        el("access-for-all-pnp", {}, [
          el("text-appearance", {}, [el("font-color", {}, [], "red")]),
          el("calculator-on-screen", { "calculator-type": "scientific" }),
          el("prohibit-set", {}, [el("calculator-on-screen")]),
        ]),
      ),
    );

    expect(normalized.ok).toBe(false);
    expect(normalized.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["PNP_INVALID_HEX_COLOR", "PNP_CONFLICTING_SUPPORT_STATE"]),
    );
  });

  it("resolves display, tool, media, and session intents", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(
        el("access-for-all-pnp", {}, [
          el("text-appearance", {}, [el("font-size", {}, [], "20")]),
          el("calculator-on-screen", { "calculator-type": "scientific" }),
          el("spoken", { "reading-type": "screen-reader" }),
          el("additional-testing-time", {}, [el("time-multiplier", {}, [], "1.5")]),
        ]),
      ),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: createDefaultQti3PnpCapabilities(),
    });

    expect(resolution.display.fontSize).toBe(20);
    expect(resolution.tools.calculator).toEqual({ enabled: true, type: "scientific" });
    expect(resolution.media.spoken).toEqual({ enabled: true, readingType: "screen-reader" });
    expect(resolution.session.additionalTestingTime).toEqual({
      type: "time-multiplier",
      multiplier: 1.5,
    });
  });

  it("reports unsupported player capabilities", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(el("access-for-all-pnp", {}, [el("line-reader")])),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: { supports: {}, tools: { lineReader: false } },
    });

    expect(resolution.unresolved[0]?.reason).toBe("unsupported");
    expect(resolution.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "PNP_UNSUPPORTED_BY_PLAYER",
    );
  });

  it("resolves QTI catalog support requests with language matching", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(el("access-for-all-pnp", {}, [el("sign-language", { language: "en-US" })])),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: createDefaultQti3PnpCapabilities(),
      qti: {
        catalogResolution: {
          references: [
            {
              matches: [
                { catalogId: "catalog-1", support: "sign-language", language: "es" },
                { catalogId: "catalog-2", support: "sign-language", language: "en" },
              ],
            },
          ],
        },
      },
    });

    expect(resolution.catalogRequests).toEqual([
      {
        support: "sign-language",
        catalogId: "catalog-2",
        entryLanguage: "en",
        reason: "pnp-required",
      },
    ]);
  });

  it("preserves custom extension supports by default", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(
        el("access-for-all-pnp", {}, [
          el("ext:longsight-glossary-illustration", { "xmlns:ext": "urn:example" }),
        ]),
      ),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: createDefaultQti3PnpCapabilities(),
    });

    expect(normalized.diagnostics).toEqual([]);
    expect(resolution.extensions[0]?.support).toBe("ext:longsight-glossary-illustration");
    expect(resolution.unresolved).toEqual([]);
  });

  it("honors custom extension policy modes", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(el("access-for-all-pnp", {}, [el("ext:vendor-support")])),
    );

    expect(
      resolveQti3Pnp(normalized.profile, {
        capabilities: createDefaultQti3PnpCapabilities(),
        policy: { onCustomSupport: "diagnostic" },
      }).unresolved[0]?.reason,
    ).toBe("unsupported");
    expect(
      resolveQti3Pnp(normalized.profile, {
        capabilities: createDefaultQti3PnpCapabilities(),
        policy: { onCustomSupport: "error" },
      }).diagnostics[0]?.severity,
    ).toBe("error");
    expect(
      resolveQti3Pnp(normalized.profile, {
        capabilities: createDefaultQti3PnpCapabilities(),
        policy: { onCustomSupport: "ignore" },
      }).extensions,
    ).toEqual([]);
  });

  it("resolves catalog-only supports without runtime handlers", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(el("access-for-all-pnp", {}, [el("braille")])),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: createDefaultQti3PnpCapabilities(),
      qti: {
        catalogSupports: [{ catalogId: "catalog-braille", support: "braille" }],
      },
    });

    expect(resolution.catalogRequests).toEqual([
      {
        support: "braille",
        catalogId: "catalog-braille",
        reason: "pnp-required",
      },
    ]);
    expect(resolution.unresolved).toEqual([]);
    expect(resolution.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "PNP_UNSUPPORTED_BY_PLAYER",
    );
  });

  it("falls back to catalog support when runtime capability is disabled", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(el("access-for-all-pnp", {}, [el("glossary-on-screen")])),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: {
        ...createDefaultQti3PnpCapabilities(),
        supports: {
          ...createDefaultQti3PnpCapabilities().supports,
          "glossary-on-screen": { supported: false },
        },
        tools: { glossary: false },
      },
      qti: {
        catalogSupports: [{ catalogId: "catalog-glossary", support: "glossary-on-screen" }],
      },
    });

    expect(resolution.tools.glossary).toBeUndefined();
    expect(resolution.catalogRequests).toEqual([
      {
        support: "glossary-on-screen",
        catalogId: "catalog-glossary",
        reason: "pnp-required",
      },
    ]);
    expect(resolution.unresolved).toEqual([]);
    expect(resolution.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain(
      "PNP_UNSUPPORTED_BY_PLAYER",
    );
  });

  it("lets prohibit-wins skip conflicting requested supports", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(
        el("access-for-all-pnp", {}, [
          el("calculator-on-screen", { "calculator-type": "scientific" }),
          el("prohibit-set", {}, [el("calculator-on-screen")]),
        ]),
      ),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: createDefaultQti3PnpCapabilities(),
      policy: { onConflict: "prohibit-wins" },
    });

    expect(resolution.tools.calculator).toEqual({ enabled: false, locked: true });
    expect(resolution.prohibited).toContain("calculator-on-screen");
    expect(resolution.unresolved).toEqual([]);
  });

  it("reports invalid custom extension names during validation", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(el("access-for-all-pnp", {}, [el("ext:9invalid")])),
    );

    expect(normalized.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "PNP_UNSUPPORTED_EXTENSION",
    );
  });

  it("does not include raw records or candidate identifiers in diagnostics", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(
        el("access-for-all-pnp", { identifier: "secret-student-id" }, [el("line-reader")]),
      ),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: { supports: {}, tools: { lineReader: false } },
    });
    const serialized = JSON.stringify(resolution.diagnostics);

    expect(serialized).not.toContain("secret-student-id");
    expect(serialized).not.toContain("access-for-all-pnp");
  });

  it("defines every known support in the registry", () => {
    const definitions = new Set(qti3PnpSupportDefinitions.map((definition) => definition.name));

    expect(qti3PnpSupportNames.every((name) => definitions.has(name))).toBe(true);
  });

  it("reports catalog-only and runtime support levels explicitly", () => {
    const braille = qti3PnpSupportDefinitions.find((definition) => definition.name === "braille");
    const calculator = qti3PnpSupportDefinitions.find(
      (definition) => definition.name === "calculator-on-screen",
    );

    expect(braille).toEqual(
      expect.objectContaining({ implemented: true, supportLevel: "catalog" }),
    );
    expect(calculator).toEqual(
      expect.objectContaining({ implemented: true, supportLevel: "runtime" }),
    );
  });

  it("represents every runtime support in default capabilities", () => {
    const capabilities = createDefaultQti3PnpCapabilities();

    for (const definition of qti3PnpSupportDefinitions.filter(
      (entry) => entry.supportLevel === "runtime" || entry.supportLevel === "runtime-and-catalog",
    )) {
      expect(capabilities.supports[definition.name]).toEqual({ supported: true });
    }
  });

  it("keeps XOR validation rules out of public parameter definitions", () => {
    const additionalTime = qti3PnpSupportDefinitions.find(
      (definition) => definition.name === "additional-testing-time",
    );

    expect(JSON.stringify(additionalTime?.params)).not.toContain("xorGroup");
  });

  it("keeps the public entrypoint as an export barrel", () => {
    const indexSource = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

    expect(indexSource).not.toContain("function ");
    expect(indexSource).not.toContain("const ");
  });

  it("lets host policy block a support without becoming a policy engine", () => {
    const normalized = normalizeQti3Pnp(
      parseQti3PnpXml(el("access-for-all-pnp", {}, [el("spell-checker-on-screen")])),
    );
    const resolution = resolveQti3Pnp(normalized.profile, {
      capabilities: createDefaultQti3PnpCapabilities(),
      policy: {
        isSupportAllowed: (preference) => preference.support !== "spell-checker-on-screen",
      },
    });

    expect(resolution.tools.spellChecker).toBeUndefined();
    expect(resolution.unresolved[0]?.reason).toBe("policy-blocked");
  });

  it("validates normalized profiles independently", () => {
    const profile: NormalizedQti3PnpProfile = {
      preferences: [
        {
          support: "additional-testing-time",
          mode: "required",
          params: { timeMultiplier: 1.5, fixedMinutes: 10 },
        },
      ],
      records: [],
      diagnostics: [],
    };

    expect(validateQti3Pnp(profile).diagnostics[0]?.code).toBe("PNP_INVALID_XOR_SELECTION");
  });
});

function el(
  name: string,
  attributes: Record<string, string> = {},
  children: Qti3PnpElementLike[] = [],
  text = "",
): Qti3PnpElementLike {
  return { name, attributes, children, text };
}

function domElement(
  localName: string,
  attributes: Record<string, string> = {},
  childNodes: unknown[] = [],
  prefix?: string,
): unknown {
  return {
    nodeType: 1,
    localName,
    prefix,
    childNodes,
    getAttributeNames: () => Object.keys(attributes),
    getAttribute: (name: string) => attributes[name],
  };
}

function domText(textContent: string): unknown {
  return { nodeType: 3, nodeName: "#text", textContent };
}

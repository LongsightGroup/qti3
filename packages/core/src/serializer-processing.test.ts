import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseQtiXml,
  serializeResponseProcessing,
  type QtiProcessingExpression,
  type QtiResponseProcessing,
} from "./index.js";
import { expressionCoverage, expressionCoverageXml } from "./serializer-processing.fixtures.js";

const matchCorrectTemplate = "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct";
const mapResponseTemplate = "https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response";
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/xml");

const fixtureRoundTrips = [
  "choice-reference.xml",
  "extendedText-reference.xml",
  "slider-reference.xml",
  "textEntry-reference.xml",
  "drawing-reference.xml",
  "media-reference.xml",
  "advanced-processing-reference.xml",
  "generic-match-processing-reference.xml",
  "mapping-processing-reference.xml",
] as const;

describe("serializer processing", () => {
  it("serializes template-only and empty response processing", () => {
    expect(
      serializeResponseProcessing({
        template: matchCorrectTemplate,
        rules: [],
        conditions: [],
      }),
    ).toEqual({
      ok: true,
      xml: `<qti-response-processing template="${matchCorrectTemplate}"/>`,
      diagnostics: [],
    });

    expect(
      serializeResponseProcessing({
        rules: [],
        conditions: [],
      }),
    ).toEqual({
      ok: true,
      xml: "<qti-response-processing/>",
      diagnostics: [],
    });
  });

  it("escapes template attributes and baseValue text content", () => {
    const escapedTemplate = 'https://example.invalid/t?a=1&b=2"q<';
    expect(
      serializeResponseProcessing({
        template: escapedTemplate,
        rules: [],
        conditions: [],
      }).xml,
    ).toBe(
      `<qti-response-processing template="https://example.invalid/t?a=1&amp;b=2&quot;q&lt;"/>`,
    );

    const processing: QtiResponseProcessing = {
      rules: [
        {
          type: "setOutcomeValue",
          identifier: "SCORE",
          expression: {
            type: "baseValue",
            baseType: "string",
            value: `A&B "ok" <done>`,
          },
        },
      ],
      conditions: [],
    };

    expect(serializeResponseProcessing(processing).xml).toBe(
      [
        "<qti-response-processing>",
        '  <qti-set-outcome-value identifier="SCORE">',
        '    <qti-base-value base-type="string">A&amp;B "ok" &lt;done&gt;</qti-base-value>',
        "  </qti-set-outcome-value>",
        "</qti-response-processing>",
      ].join("\n"),
    );
  });

  it("serializes template plus inline rules together", () => {
    const result = serializeResponseProcessing({
      template: mapResponseTemplate,
      rules: [{ type: "exitResponse" }],
      conditions: [],
    });

    expect(result).toEqual({
      ok: true,
      xml: [
        `<qti-response-processing template="${mapResponseTemplate}">`,
        "  <qti-exit-response/>",
        "</qti-response-processing>",
      ].join("\n"),
      diagnostics: [],
    });
  });

  it("serializes inline response conditions without duplicating derived conditions", () => {
    const processing: QtiResponseProcessing = {
      rules: [
        {
          type: "responseCondition",
          condition: {
            ifExpression: {
              type: "match",
              left: { type: "variable", identifier: "RESPONSE" },
              right: { type: "correct", identifier: "RESPONSE" },
            },
            thenRules: [
              {
                type: "setOutcomeValue",
                identifier: "SCORE",
                expression: {
                  type: "baseValue",
                  baseType: "string",
                  value: "full",
                },
              },
            ],
            elseIfs: [
              {
                expression: {
                  type: "stringMatch",
                  caseSensitive: false,
                  substring: true,
                  left: { type: "variable", identifier: "RESPONSE" },
                  right: {
                    type: "baseValue",
                    baseType: "string",
                    value: "partial",
                  },
                },
                rules: [
                  {
                    type: "lookupOutcomeValue",
                    identifier: "SCORE",
                    expression: { type: "mapResponse", identifier: "RESPONSE" },
                  },
                ],
              },
            ],
            elseRules: [{ type: "exitResponse" }],
          },
        },
      ],
      conditions: [],
    };

    const serialized = serializeResponseProcessing(processing);
    expect(serialized.ok).toBe(true);
    expect(serialized.xml?.match(/<qti-response-condition>/g)).toHaveLength(1);
    expect(serialized.xml).toBe(
      [
        "<qti-response-processing>",
        "  <qti-response-condition>",
        "    <qti-response-if>",
        "      <qti-match>",
        '        <qti-variable identifier="RESPONSE"/>',
        '        <qti-correct identifier="RESPONSE"/>',
        "      </qti-match>",
        '      <qti-set-outcome-value identifier="SCORE">',
        '        <qti-base-value base-type="string">full</qti-base-value>',
        "      </qti-set-outcome-value>",
        "    </qti-response-if>",
        "    <qti-response-else-if>",
        '      <qti-string-match case-sensitive="false" substring="true">',
        '        <qti-variable identifier="RESPONSE"/>',
        '        <qti-base-value base-type="string">partial</qti-base-value>',
        "      </qti-string-match>",
        '      <qti-lookup-outcome-value identifier="SCORE">',
        '        <qti-map-response identifier="RESPONSE"/>',
        "      </qti-lookup-outcome-value>",
        "    </qti-response-else-if>",
        "    <qti-response-else>",
        "      <qti-exit-response/>",
        "    </qti-response-else>",
        "  </qti-response-condition>",
        "</qti-response-processing>",
      ].join("\n"),
    );
  });

  it("serializes condition-only public models as response condition rules", () => {
    const condition = {
      ifExpression: { type: "variable", identifier: "IS_CORRECT" },
      thenRules: [
        {
          type: "setOutcomeValue",
          identifier: "SCORE",
          expression: { type: "baseValue", baseType: "integer", value: 1 },
        },
      ],
      elseIfs: [],
      elseRules: [],
    } satisfies QtiResponseProcessing["conditions"][number];

    const result = serializeResponseProcessing({
      rules: [],
      conditions: [condition],
    });

    expect(result.ok).toBe(true);
    expect(result.xml).toBe(
      [
        "<qti-response-processing>",
        "  <qti-response-condition>",
        "    <qti-response-if>",
        '      <qti-variable identifier="IS_CORRECT"/>',
        '      <qti-set-outcome-value identifier="SCORE">',
        '        <qti-base-value base-type="integer">1</qti-base-value>',
        "      </qti-set-outcome-value>",
        "    </qti-response-if>",
        "  </qti-response-condition>",
        "</qti-response-processing>",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects condition summaries that disagree with explicit rules", () => {
    const condition = {
      ifExpression: { type: "variable", identifier: "IS_CORRECT" },
      thenRules: [],
      elseIfs: [],
      elseRules: [],
    } satisfies QtiResponseProcessing["conditions"][number];

    const result = serializeResponseProcessing({
      rules: [{ type: "exitResponse" }],
      conditions: [condition],
    });

    expect(result.ok).toBe(false);
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        code: "responseProcessing.serialize.conditions",
        severity: "error",
        message:
          "QtiResponseProcessing.conditions must be represented as responseCondition rules when rules are present.",
      },
    ]);
  });

  it("round-trips supported parsed processing models", () => {
    const xml = [
      '<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item" title="Item" adaptive="false" time-dependent="false">',
      '  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>',
      '  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>',
      "  <qti-response-processing>",
      "    <qti-response-processing-fragment>",
      '      <qti-set-outcome-value identifier="SCORE">',
      "        <qti-sum>",
      '          <qti-base-value base-type="float">1.5</qti-base-value>',
      '          <qti-map-response identifier="RESPONSE"/>',
      "        </qti-sum>",
      "      </qti-set-outcome-value>",
      "    </qti-response-processing-fragment>",
      "  </qti-response-processing>",
      "  <qti-item-body/>",
      "</qti-assessment-item>",
    ].join("\n");
    const parsed = parseQtiXml(xml);
    const processing = parsed.document?.item.responseProcessing;
    expect(processing).toBeDefined();
    if (processing === undefined) throw new Error("expected response processing");

    const serialized = serializeResponseProcessing(processing);
    expect(serialized.ok).toBe(true);
    expect(serialized.xml).toContain("<qti-response-processing-fragment>");

    const reparsed = parseQtiXml(
      xml.replace(
        /<qti-response-processing>[\s\S]*<\/qti-response-processing>/,
        serialized.xml ?? "",
      ),
    );

    expect(stripSources(reparsed.document?.item.responseProcessing)).toEqual(
      stripSources(processing),
    );
  });

  it.each(Object.keys(expressionCoverage) as QtiProcessingExpression["type"][])(
    "serializes modeled expression variant %s with full XML",
    (expressionType) => {
      const result = serializeResponseProcessing({
        rules: [
          {
            type: "setOutcomeValue",
            identifier: "SCORE",
            expression: expressionCoverage[expressionType].expression,
          },
        ],
        conditions: [],
      });

      expect(result.ok).toBe(true);
      expect(result.xml).toBe(expressionCoverageXml(expressionType));
    },
  );

  it("preserves rawValue verbatim and attribute-bag template references", () => {
    const rawValue = "  spaced  ";
    const rawResult = serializeResponseProcessing({
      rules: [
        {
          type: "setOutcomeValue",
          identifier: "SCORE",
          expression: {
            type: "baseValue",
            baseType: "string",
            value: "ignored",
            rawValue,
          },
        },
      ],
      conditions: [],
    });
    expect(rawResult.xml).toContain(
      `<qti-base-value base-type="string">${rawValue}</qti-base-value>`,
    );

    const templateRef = serializeResponseProcessing({
      rules: [
        {
          type: "setOutcomeValue",
          identifier: "SCORE",
          expression: {
            type: "randomInteger",
            min: Number.NaN,
            max: Number.NaN,
            step: Number.NaN,
            attributes: { min: "{$MIN}", max: "{$MAX}", step: "{$STEP}" },
          },
        },
      ],
      conditions: [],
    });
    expect(templateRef.xml).toContain(
      '<qti-random-integer min="{$MIN}" max="{$MAX}" step="{$STEP}"/>',
    );
  });

  it("returns diagnostics and no XML for incomplete models", () => {
    const result = serializeResponseProcessing({
      rules: [
        {
          type: "setOutcomeValue",
          identifier: "",
          expression: { type: "baseValue", value: null },
        },
        {
          type: "responseCondition",
          condition: {
            thenRules: [],
            elseIfs: [{ rules: [] }],
            elseRules: [],
          },
        },
      ],
      conditions: [],
    });

    expect(result.ok).toBe(false);
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "responseProcessing.serialize.invalidAttribute",
      "responseProcessing.serialize.invalidAttribute",
      "responseProcessing.serialize.missingExpression",
    ]);
  });

  it("rejects non-finite numeric base values without rawValue", () => {
    const result = serializeResponseProcessing({
      rules: [
        {
          type: "setOutcomeValue",
          identifier: "SCORE",
          expression: { type: "baseValue", baseType: "float", value: Number.NaN },
        },
      ],
      conditions: [],
    });

    expect(result.ok).toBe(false);
    expect(result.xml).toBeUndefined();
    expect(result.diagnostics).toMatchObject([
      { code: "responseProcessing.serialize.invalidExpression" },
    ]);
  });

  it.each(fixtureRoundTrips)("round-trips fixture response processing model %s", (fixtureName) => {
    const xml = readFileSync(join(fixturesDir, fixtureName), "utf8");
    const parsed = parseQtiXml(xml);
    const processing = parsed.document?.item.responseProcessing;
    expect(processing).toBeDefined();
    if (processing === undefined) return;

    const serialized = serializeResponseProcessing(processing);
    expect(serialized.ok).toBe(true);

    const reparsed = parseQtiXml(
      xml.replace(
        /<qti-response-processing[^>]*>[\s\S]*<\/qti-response-processing>|<qti-response-processing[^>]*\/>/,
        serialized.xml ?? "",
      ),
    );

    expect(stripSources(reparsed.document?.item.responseProcessing)).toEqual(
      stripSources(processing),
    );
  });
});

function stripSources(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSources);
  if (typeof value !== "object" || value === null) return value;

  const stripped: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "source") continue;
    stripped[key] = stripSources(entry);
  }
  return stripped;
}

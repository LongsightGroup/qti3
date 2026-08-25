import { describe, expect, it } from "vitest";
import { createTextToSpeechTraversal, parseQtiDataSsml } from "./index.js";
import { parseQtiXml } from "./parser.js";

describe("QTI Data-SSML metadata", () => {
  it("validates and exposes Data-SSML read-aloud metadata", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="data-ssml" title="data-ssml" time-dependent="false">
        <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
        <qti-item-body>
          <p>Read <span id="mrna" data-ssml='{"sub":{"alias":"messenger RNA"}}'>mRNA</span>.</p>
          <p><span data-qti-suppress-tts="computer-read-aloud">Visual read-aloud skip.</span></p>
          <qti-choice-interaction response-identifier="RESPONSE">
            <qti-prompt data-ssml='{"prosody":{"rate":"slow"}}'>Choose the word.</qti-prompt>
            <qti-simple-choice identifier="A" data-ssml='{"phoneme":{"ph":"t@meItoU","alphabet":"x-sampa"}}'>tomato</qti-simple-choice>
          </qti-choice-interaction>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "content.dataSsml.invalid" }),
    );
    expect(parseQtiDataSsml('{"say-as":{"interpret-as":"ordinal"}}')).toEqual({
      ok: true,
      value: { "say-as": { "interpret-as": "ordinal" } },
    });

    const traversal = createTextToSpeechTraversal(result.document!);
    expect(traversal.diagnostics).toEqual([]);
    expect(traversal.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "content",
          text: "mRNA",
          dataSsml: '{"sub":{"alias":"messenger RNA"}}',
          ssml: { sub: { alias: "messenger RNA" } },
        }),
        expect.objectContaining({
          kind: "content",
          text: "Visual read-aloud skip.",
          suppressTts: ["computer-read-aloud"],
        }),
        expect.objectContaining({
          kind: "interactionPrompt",
          text: "Choose the word.",
          ssml: { prosody: { rate: "slow" } },
        }),
        expect.objectContaining({
          kind: "choice",
          choiceIdentifier: "A",
          text: "tomato",
          ssml: { phoneme: { ph: "t@meItoU", alphabet: "x-sampa" } },
        }),
      ]),
    );
  });

  it("diagnoses invalid Data-SSML metadata without blocking item parsing", () => {
    const result = parseQtiXml(`
      <qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="bad-data-ssml" title="bad-data-ssml" time-dependent="false">
        <qti-item-body>
          <p>
            <span data-ssml="not json">Invalid JSON</span>
            <span data-ssml='{"sub":{}}'>Missing alias</span>
            <span data-ssml='{"mark":{"name":"x"}}'>Unsupported function</span>
          </p>
        </qti-item-body>
      </qti-assessment-item>
    `);

    expect(result.ok).toBe(true);
    const diagnostics = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === "content.dataSsml.invalid",
    );
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          message: expect.stringContaining("data-ssml must be valid JSON"),
        }),
        expect.objectContaining({
          severity: "warning",
          message: expect.stringContaining("sub.alias is required"),
        }),
        expect.objectContaining({
          severity: "warning",
          message: expect.stringContaining('Unsupported Data-SSML function "mark"'),
        }),
      ]),
    );

    const traversal = createTextToSpeechTraversal(result.document!);
    expect(traversal.segments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "Missing alias",
          ssmlErrors: ["sub.alias is required."],
        }),
      ]),
    );
    expect(parseQtiDataSsml("[]")).toEqual({
      ok: false,
      errors: ["data-ssml must be a JSON object."],
    });
  });
});

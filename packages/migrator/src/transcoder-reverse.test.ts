import { readFileSync } from "node:fs";

import {
  deprecatedInteractionSupport,
  interactionSupport,
  type QtiInteractionType,
} from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment, writeQti3AssessmentItem } from "@longsightgroup/qti3-writer";
import {
  transcodeQti3Item,
  transcodeQti3Package,
  type QtiTranscodeProfileId,
} from "@longsightgroup/qti3-transcoder";
import { describe, expect, it } from "vitest";

import { migrateQtiItemToQti3, migrateQtiToQti3 } from "./index.js";
import { assessmentPackageZip } from "./test-helpers.js";

const interactions = [...interactionSupport, ...deprecatedInteractionSupport];

const qti2RefusedTypes = new Set<QtiInteractionType>([
  "drawing",
  "inlineChoice",
  "media",
  "portableCustom",
  "textEntry",
  "upload",
]);
const qti12PreservedTypes = new Set<QtiInteractionType>([
  "choice",
  "hotspot",
  "hottext",
  "positionObject",
  "selectPoint",
  "slider",
  "textEntry",
]);
const qti2Preserved = interactions.filter((entry) => !qti2RefusedTypes.has(entry.interactionType));
const qti2Refused = interactions.filter((entry) => qti2RefusedTypes.has(entry.interactionType));
const qti12Preserved = interactions.filter((entry) =>
  qti12PreservedTypes.has(entry.interactionType),
);
const qti12Refused = interactions.filter(
  (entry) => !qti12PreservedTypes.has(entry.interactionType),
);

function reverseFixture(profile: QtiTranscodeProfileId, interaction: QtiInteractionType) {
  const result = transcodeQti3Item(
    { kind: "xml", xml: fixtureXml(interaction), sourcePath: `${interaction}.xml` },
    { profile },
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected transcoded fixture");
  const reverse = migrateQtiItemToQti3(
    { filename: "item.xml", xml: result.xml },
    { repairPolicy: "safe" },
  );
  return { result, reverse };
}

describe("qti3 transcoder reverse-migration evidence", () => {
  for (const profile of ["qti21-standard@1", "qti22-standard@1"] as const) {
    it(`${profile} reports the composite planning-hint item as unsupported for reverse migration`, () => {
      const xml = readFileSync("packages/fixtures/xml/endAttempt-reference.xml", "utf8");
      const result = transcodeQti3Item({ kind: "xml", xml }, { profile });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.report.mappings.map((mapping) => mapping.sourceInteraction)).toEqual([
        "choice",
        "endAttempt",
      ]);
      const reverse = migrateQtiItemToQti3(
        { filename: "item.xml", xml: result.xml },
        { repairPolicy: "safe" },
      );
      expect(reverse.authoringItem).toBeUndefined();
      expect(reverse.diagnostics).toContainEqual(
        expect.objectContaining({ code: "qti2_composite_interactions_unsupported" }),
      );
    });
    it.each(qti2Preserved)(`${profile} preserves $interactionType`, (interaction) => {
      const { result, reverse } = reverseFixture(profile, interaction.interactionType);
      const expectedInteraction =
        interaction.interactionType === "graphicGapMatch" &&
        result.report.mappings[0]?.emittedInteraction === "gapMatchInteraction"
          ? "gapMatch"
          : interaction.interactionType;
      expect(reverse.authoringItem?.interactionType).toBe(expectedInteraction);
      if (interaction.interactionType === "graphicGapMatch") {
        expect(reverse.authoringItem?.bodyHtml).toContain('qti-gap identifier="G1"');
        expect(reverse.authoringItem?.bodyHtml).toContain('qti-gap identifier="G2"');
      }
      expect(reverse.diagnostics.some((entry) => entry.severity === "error")).toBe(false);
    });
    it.each(qti2Refused)(
      `${profile} refuses unpreserved $interactionType scoring`,
      (interaction) => {
        const { reverse } = reverseFixture(profile, interaction.interactionType);
        expect(reverse.xml).toBeUndefined();
        expect(reverse.authoringItem).toBeUndefined();
        expect(reverse.diagnostics).toContainEqual(
          expect.objectContaining({
            code: "qti2_response_processing_not_preserved",
            severity: "error",
          }),
        );
      },
    );
  }
  it.each(qti12Preserved)("qti12-standard@1 preserves $interactionType", (interaction) => {
    const { result, reverse } = reverseFixture("qti12-standard@1", interaction.interactionType);
    expect(reverse.authoringItem).toBeDefined();
    expect(reverse.diagnostics.some((entry) => entry.severity === "error")).toBe(false);
    expect(result.report.diagnosticCodes).toEqual(result.diagnostics.map((entry) => entry.code));
  });
  it.each(qti12Refused)(
    "qti12-standard@1 refuses unpreserved $interactionType scoring",
    (interaction) => {
      const { reverse } = reverseFixture("qti12-standard@1", interaction.interactionType);
      expect(reverse.xml).toBeUndefined();
      expect(reverse.authoringItem).toBeUndefined();
      expect(reverse.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "qti12_response_processing_unsupported",
          severity: "error",
        }),
      );
    },
  );

  it("rejects Canvas hotspot spatial scoring that the answer-key model cannot preserve", () => {
    const result = transcodeQti3Item(
      { kind: "xml", xml: fixtureXml("hotspot"), sourcePath: "hotspot.xml" },
      { profile: "canvas-classic-quizzes@1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reverse = migrateQtiItemToQti3(
      { filename: "hotspot.xml", xml: result.xml },
      { repairPolicy: "none" },
    );
    expect(reverse.xml).toBeUndefined();
    expect(reverse.authoringItem).toBeUndefined();
    expect(reverse.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti12_response_processing_unsupported", severity: "error" }),
    );
  });

  it("QTI 2.1 assessment package preserves its three referenced items", async () => {
    const reverse = await reverseAssessmentPackage("qti21-standard@1");
    expect(reverse.items.map((item) => item.authoringItem?.interactionType)).toEqual([
      "choice",
      "order",
      "slider",
    ]);
    expect(reverse.items.map((item) => item.identifier)).toEqual([
      "choice_reference",
      "order_reference",
      "slider_reference",
    ]);
    expect(reverse.items.some((item) => item.identifier === "ITEM_1")).toBe(false);
    expect(reverse.items.flatMap((item) => item.diagnostics)).toEqual([]);
    const slider = reverse.items[2]?.authoringItem;
    expect(slider).toMatchObject({
      interactionType: "slider",
      baseType: "integer",
      correctResponse: 2024,
      lowerBound: 2010,
      upperBound: 2030,
      step: 1,
    });
  });
  it("QTI 1.2 assessment package refuses the unpreserved order program", async () => {
    const reverse = await reverseAssessmentPackage("qti12-standard@1");
    expect(reverse.items).toHaveLength(3);
    expect(reverse.items[0]?.authoringItem?.interactionType).toBe("choice");
    expect(reverse.items[1]?.xml).toBeUndefined();
    expect(reverse.items[1]?.diagnostics).toContainEqual(
      expect.objectContaining({ code: "qti12_response_processing_unsupported" }),
    );
    expect(reverse.items[2]?.authoringItem?.interactionType).toBe("textEntry");
  });

  it("migrates a mapped QTI 2.1 slider identically standalone and from a package", async () => {
    const mappedSlider = fixtureXml("slider")
      .replace(
        "</qti-response-declaration>",
        `  <qti-mapping default-value="0">
          <qti-map-entry map-key="2024" mapped-value="1"/>
        </qti-mapping>
      </qti-response-declaration>`,
      )
      .replace("/match_correct", "/map_response");
    const transcoded = await transcodeQti3Package(
      {
        kind: "zip",
        bytes: assessmentPackageZip(["slider"], { slider: mappedSlider }),
      },
      { profile: "qti21-standard@1" },
    );
    expect(transcoded.ok).toBe(true);
    if (!transcoded.ok) return;

    const sliderXml = transcoded.files.find((file) => file.path === "items/slider.xml")?.data;
    expect(sliderXml).toEqual(expect.any(String));
    if (typeof sliderXml !== "string") return;
    expect(sliderXml).toContain('<mapEntry mapKey="2024" mappedValue="1"></mapEntry>');

    const standalone = migrateQtiItemToQti3(
      { filename: "items/slider.xml", xml: sliderXml },
      { repairPolicy: "safe" },
    );
    const packaged = await migrateQtiToQti3(
      { filename: "mapped-slider.zip", bytes: transcoded.zip },
      { repairPolicy: "safe" },
    );

    expect(packaged.items).toHaveLength(1);
    expect(packaged.items[0]?.authoringItem).toEqual(standalone.authoringItem);
    expect(packaged.items[0]?.authoringItem).toMatchObject({
      interactionType: "slider",
      baseType: "integer",
      correctResponse: 2024,
      mappings: [{ mapKey: 2024, mappedValue: 1 }],
      scoring: "map_response",
    });
  });
});

function fixtureXml(interactionType: QtiInteractionType): string {
  // Keep primitive reverse-migration coverage independent of the composite public hint item.
  if (interactionType === "endAttempt") {
    return writeQti3AssessmentItem({
      interactionType: "endAttempt",
      identifier: "end-attempt-control",
      title: "Finish",
      bodyHtml: qti3TrustedXmlFragment("<p>Finish reviewing these instructions.</p>"),
      buttonTitle: "Finish",
    });
  }
  if (interactionType === "custom") {
    return writeQti3AssessmentItem({
      interactionType: "custom",
      identifier: "custom-reference",
      title: "Custom reference",
      bodyHtml: qti3TrustedXmlFragment("<p>Use the widget.</p>"),
      interactionMarkupHtml: qti3TrustedXmlFragment('<div class="widget">Ready</div>'),
    });
  }
  return readFileSync(`packages/fixtures/xml/${interactionType}-reference.xml`, "utf8");
}

async function reverseAssessmentPackage(profile: QtiTranscodeProfileId) {
  const transcoded = await transcodeQti3Package(
    { kind: "zip", bytes: assessmentPackageZip() },
    { profile },
  );
  expect(transcoded.ok).toBe(true);
  if (!transcoded.ok) throw new Error("Expected transcoded package");
  return migrateQtiToQti3(
    { filename: `${profile}.zip`, bytes: transcoded.zip },
    { repairPolicy: "safe" },
  );
}

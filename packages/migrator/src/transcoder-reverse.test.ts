import { readFileSync } from "node:fs";

import {
  deprecatedInteractionSupport,
  interactionSupport,
  type QtiInteractionType,
} from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment, writeQti3AssessmentItem } from "@longsightgroup/qti3-writer";
import { transcodeQti3Item, transcodeQti3Package } from "@longsightgroup/qti3-transcoder";
import { describe, expect, it } from "vitest";

import { migrateQtiItemToQti3, migrateQtiToQti3 } from "./index.js";
import { assessmentPackageZip } from "./test-helpers.js";

const interactions = [...interactionSupport, ...deprecatedInteractionSupport];

describe("qti3 transcoder reverse-migration evidence", () => {
  for (const profile of ["qti21-standard@1", "qti22-standard@1"] as const) {
    for (const interaction of interactions) {
      it(`${profile} preserves ${interaction.interactionType} through reverse migration`, () => {
        const result = transcodeQti3Item(
          {
            kind: "xml",
            xml: fixtureXml(interaction.interactionType),
            sourcePath: `${interaction.interactionType}.xml`,
          },
          { profile },
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const reverse = migrateQtiItemToQti3(
          { filename: "item.xml", xml: result.xml },
          { repairPolicy: "safe" },
        );
        const expectedInteraction =
          interaction.interactionType === "portableCustom"
            ? "custom"
            : interaction.interactionType === "graphicGapMatch" &&
                result.report.mappings[0]?.emittedInteraction === "gapMatchInteraction"
              ? "gapMatch"
              : interaction.interactionType;
        expect(reverse.authoringItem?.interactionType).toBe(expectedInteraction);
        if (interaction.interactionType === "graphicGapMatch") {
          expect(reverse.authoringItem?.bodyHtml).toContain("The first step is to");
        }
        expect(reverse.diagnostics.some((entry) => entry.severity === "error")).toBe(false);
      });
    }
  }

  for (const interaction of interactions) {
    it(`qti12-standard@1 preserves a usable ${interaction.interactionType} task`, () => {
      const result = transcodeQti3Item(
        {
          kind: "xml",
          xml: fixtureXml(interaction.interactionType),
          sourcePath: `${interaction.interactionType}.xml`,
        },
        { profile: "qti12-standard@1" },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const reverse = migrateQtiItemToQti3(
        { filename: "item.xml", xml: result.xml },
        { repairPolicy: "safe" },
      );
      expect(reverse.authoringItem).toBeDefined();
      expect(reverse.diagnostics.some((entry) => entry.severity === "error")).toBe(false);
      expect(result.report.diagnosticCodes).toEqual(result.diagnostics.map((entry) => entry.code));
    });
  }

  it("does not promote Canvas hotspot coordinates into an accessible label", () => {
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
    expect(reverse.diagnostics).toEqual([]);
    expect(reverse.authoringItem?.interactionType).toBe("hotspot");
    if (reverse.authoringItem?.interactionType !== "hotspot") return;
    expect(reverse.authoringItem.choices[0]).toMatchObject({
      coords: "184,52,296,124",
      hotspotLabel: undefined,
    });
  });

  it.each(["qti12-standard@1", "qti21-standard@1"] as const)(
    "%s assessment package preserves exactly its three referenced items",
    async (profile) => {
      const transcoded = await transcodeQti3Package(
        { kind: "zip", bytes: assessmentPackageZip() },
        { profile },
      );
      expect(transcoded.ok).toBe(true);
      if (!transcoded.ok) return;

      const reverse = await migrateQtiToQti3(
        { filename: `${profile}.zip`, bytes: transcoded.zip },
        { repairPolicy: "safe" },
      );

      expect(reverse.items.map((item) => item.authoringItem?.interactionType)).toEqual(
        profile === "qti12-standard@1"
          ? ["choice", "choice", "textEntry"]
          : ["choice", "order", "slider"],
      );
      expect(reverse.items.map((item) => item.identifier)).toEqual([
        "choice_reference",
        "order_reference",
        "slider_reference",
      ]);
      expect(reverse.items.some((item) => item.identifier === "ITEM_1")).toBe(false);
      expect(reverse.items.flatMap((item) => item.diagnostics)).toEqual([]);
      if (profile === "qti21-standard@1") {
        const slider = reverse.items[2]?.authoringItem;
        expect(slider).toMatchObject({
          interactionType: "slider",
          baseType: "integer",
          correctResponse: 2024,
          lowerBound: 2010,
          upperBound: 2030,
          step: 1,
        });
      }
    },
  );

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

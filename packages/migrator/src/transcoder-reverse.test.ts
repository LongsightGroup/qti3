import { readFileSync } from "node:fs";

import {
  deprecatedInteractionSupport,
  interactionSupport,
  type QtiInteractionType,
} from "@longsightgroup/qti3-core";
import { qti3TrustedXmlFragment, writeQti3AssessmentItem } from "@longsightgroup/qti3-writer";
import { transcodeQti3Item } from "@longsightgroup/qti3-transcoder";
import { describe, expect, it } from "vitest";

import { migrateQtiItemToQti3 } from "./index.js";

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
